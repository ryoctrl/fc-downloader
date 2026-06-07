/**
 * Download engine. Given a service + options, it enumerates creators/posts,
 * skips anything already on disk (dedup via the metadata DB), and downloads
 * remaining files with bounded concurrency, emitting progress events.
 */
import { mkdir, stat } from 'node:fs/promises'
import type {
  DownloadOptions,
  DownloadProgress,
  Post,
  PostFile,
  ServiceId
} from '@shared/types'
import { getService } from '@main/services/registry'
import { createServiceContext } from '@main/services/context'
import { downloadToFile } from '@main/session/manager'
import { filePath, postDir, toLocationParts } from '@main/storage/layout'
import {
  isFileDownloaded,
  isPostComplete,
  markFileDownloaded,
  refreshPostCompletion,
  upsertPost
} from '@main/storage/db'
import { MAX_RETRIES, backoffDelayMs, isRetriableError, sleep } from './retry'

export interface DownloadCallbacks {
  onProgress(progress: DownloadProgress): void
  /** Called when a file finishes (any terminal status). */
  onItem?(item: {
    serviceId: ServiceId
    postId: string
    fileId: string
    fileName: string
    status: 'completed' | 'skipped' | 'failed'
    error?: string
  }): void
}

export class DownloadEngine {
  private abort = new AbortController()
  private running = false
  private progress: DownloadProgress = blankProgress()

  isRunning(): boolean {
    return this.running
  }

  cancel(): void {
    this.abort.abort()
  }

  async run(
    serviceId: ServiceId,
    root: string,
    options: DownloadOptions,
    cb: DownloadCallbacks
  ): Promise<void> {
    if (this.running) throw new Error('A download run is already in progress')
    this.running = true
    this.abort = new AbortController()
    this.progress = blankProgress()
    const signal = this.abort.signal
    const ctx = createServiceContext(serviceId, signal)
    const service = getService(serviceId)

    try {
      // Resolve display names for the ledger (best-effort; falls back to ids).
      const allCreators = await service.listCreators(ctx).catch((err) => {
        ctx.log('warn', 'listCreators failed; creator names unavailable', err)
        return []
      })
      const nameById = new Map(allCreators.map((c) => [c.creatorId, c.name]))
      const creators =
        options.creatorIds.length > 0 ? options.creatorIds : allCreators.map((c) => c.creatorId)

      for (const creatorId of creators) {
        signal.throwIfAborted()
        for await (const listed of service.listPosts(ctx, creatorId)) {
          signal.throwIfAborted()
          const post = service.resolvePost ? await service.resolvePost(ctx, listed) : listed

          if (options.skipExisting && isPostComplete(post, options.includeKinds)) {
            const inScope = post.files.filter((f) =>
              options.includeKinds.includes(f.kind)
            ).length
            this.progress.skipped += inScope
            this.progress.total += inScope
            cb.onProgress({ ...this.progress })
            continue
          }

          await this.downloadPost(serviceId, root, post, options, cb, nameById.get(creatorId))
        }
      }
    } finally {
      this.running = false
      cb.onProgress({ ...this.progress })
    }
  }

  private async downloadPost(
    serviceId: ServiceId,
    root: string,
    post: Post,
    options: DownloadOptions,
    cb: DownloadCallbacks,
    creatorName?: string
  ): Promise<void> {
    const { year, month } = toLocationParts(post.postedAt)
    const loc = { serviceId, creatorId: post.creatorId, year, month, postId: post.postId }
    const dir = postDir(root, loc)
    await mkdir(dir, { recursive: true })
    upsertPost(post, dir, creatorName)

    const targets = post.files.filter((f) => options.includeKinds.includes(f.kind))
    this.progress.total += targets.length

    // Bounded concurrency over this post's files.
    const queue = [...targets]
    const workers = Array.from({ length: Math.max(1, options.concurrency) }, () =>
      this.worker(serviceId, root, loc, post, queue, options, cb)
    )
    await Promise.all(workers)
    refreshPostCompletion(post, options.includeKinds)
  }

  private async worker(
    serviceId: ServiceId,
    root: string,
    loc: { serviceId: ServiceId; creatorId: string; year: number; month: number; postId: string },
    post: Post,
    queue: PostFile[],
    options: DownloadOptions,
    cb: DownloadCallbacks
  ): Promise<void> {
    for (;;) {
      if (this.abort.signal.aborted) return
      const file = queue.shift()
      if (!file) return

      if (
        options.skipExisting &&
        isFileDownloaded(serviceId, post.creatorId, post.postId, file.fileId)
      ) {
        this.progress.skipped += 1
        cb.onItem?.({
          serviceId,
          postId: post.postId,
          fileId: file.fileId,
          fileName: file.name,
          status: 'skipped'
        })
        cb.onProgress({ ...this.progress })
        continue
      }

      const dest = filePath(root, loc, file.name)
      try {
        if (options.skipExisting && (await exists(dest))) {
          markFileDownloaded(post, file.fileId, file.name, undefined, file.kind)
          this.progress.skipped += 1
          cb.onItem?.({
            serviceId,
            postId: post.postId,
            fileId: file.fileId,
            fileName: file.name,
            status: 'skipped'
          })
        } else {
          const size = await this.downloadFile(serviceId, file, dest)
          markFileDownloaded(post, file.fileId, file.name, size, file.kind)
          this.progress.completed += 1
          this.progress.bytesDownloaded += size
          cb.onItem?.({
            serviceId,
            postId: post.postId,
            fileId: file.fileId,
            fileName: file.name,
            status: 'completed'
          })
        }
      } catch (err) {
        this.progress.failed += 1
        cb.onItem?.({
          serviceId,
          postId: post.postId,
          fileId: file.fileId,
          fileName: file.name,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err)
        })
      }
      cb.onProgress({ ...this.progress })
    }
  }

  /**
   * Stream a file to disk, retrying transient failures with exponential
   * backoff. Aborts (cancellation) and permanent HTTP errors are not retried.
   */
  private async downloadFile(serviceId: ServiceId, file: PostFile, dest: string): Promise<number> {
    if (!file.url) throw new Error(`No URL resolved for file ${file.fileId}`)
    const headers = getService(serviceId).downloadHeaders
    const signal = this.abort.signal
    let attempt = 0
    for (;;) {
      signal.throwIfAborted()
      try {
        return await downloadToFile(serviceId, file.url, dest, { signal, headers })
      } catch (err) {
        if (!isRetriableError(err) || attempt >= MAX_RETRIES) throw err
        attempt += 1
        await sleep(backoffDelayMs(attempt), signal)
      }
    }
  }
}

function blankProgress(): DownloadProgress {
  return {
    total: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    inFlight: 0,
    bytesDownloaded: 0,
    bytesTotal: 0
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
