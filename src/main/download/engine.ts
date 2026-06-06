/**
 * Download engine. Given a service + options, it enumerates creators/posts,
 * skips anything already on disk (dedup via the metadata DB), and downloads
 * remaining files with bounded concurrency, emitting progress events.
 */
import { mkdir, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import type {
  DownloadOptions,
  DownloadProgress,
  Post,
  PostFile,
  ServiceId
} from '@shared/types'
import { getService } from '@main/services/registry'
import { createServiceContext } from '@main/services/context'
import { requestFor } from '@main/session/manager'
import { filePath, postDir, toLocationParts } from '@main/storage/layout'
import {
  isFileDownloaded,
  isPostComplete,
  markFileDownloaded,
  refreshPostCompletion,
  upsertPost
} from '@main/storage/db'

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
      const creators =
        options.creatorIds.length > 0
          ? options.creatorIds
          : (await service.listCreators(ctx)).map((c) => c.creatorId)

      for (const creatorId of creators) {
        signal.throwIfAborted()
        for await (const listed of service.listPosts(ctx, creatorId)) {
          signal.throwIfAborted()
          const post = service.resolvePost ? await service.resolvePost(ctx, listed) : listed

          if (options.skipExisting && isPostComplete(post)) {
            this.progress.skipped += post.files.length
            this.progress.total += post.files.length
            cb.onProgress({ ...this.progress })
            continue
          }

          await this.downloadPost(serviceId, root, post, options, cb)
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
    cb: DownloadCallbacks
  ): Promise<void> {
    const { year, month } = toLocationParts(post.postedAt)
    const loc = { serviceId, creatorId: post.creatorId, year, month, postId: post.postId }
    const dir = postDir(root, loc)
    await mkdir(dir, { recursive: true })
    upsertPost(post, dir)

    const targets = post.files.filter((f) => options.includeKinds.includes(f.kind))
    this.progress.total += targets.length

    // Bounded concurrency over this post's files.
    const queue = [...targets]
    const workers = Array.from({ length: Math.max(1, options.concurrency) }, () =>
      this.worker(serviceId, root, loc, post, queue, options, cb)
    )
    await Promise.all(workers)
    refreshPostCompletion(post)
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
          markFileDownloaded(post, file.fileId, file.name)
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
          markFileDownloaded(post, file.fileId, file.name, size)
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

  private async downloadFile(serviceId: ServiceId, file: PostFile, dest: string): Promise<number> {
    if (!file.url) throw new Error(`No URL resolved for file ${file.fileId}`)
    const res = await requestFor(serviceId, file.url, { signal: this.abort.signal })
    if (res.status >= 400) throw new Error(`HTTP ${res.status} downloading ${file.url}`)
    // requestFor buffers the body; write the raw bytes to disk.
    const buf = res.buffer()
    await pipeline(Readable.from(buf), createWriteStream(dest))
    return buf.byteLength
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
