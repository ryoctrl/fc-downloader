/**
 * Download engine. Given a service + options, it enumerates creators/posts,
 * skips anything already on disk (dedup via the metadata DB), and downloads
 * remaining files with bounded concurrency, emitting progress events.
 */
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  DownloadActivity,
  DownloadOptions,
  DownloadProgress,
  Post,
  PostFile,
  ServiceId
} from '@shared/types'
import { getService } from '@main/services/registry'
import { createServiceContext } from '@main/services/context'
import { downloadToFile } from '@main/session/manager'
import { dedupeFileNames, postDir, sanitizeFileName, toLocationParts } from '@main/storage/layout'
import { getThumbnail } from '@main/storage/thumbnails'
import { THUMBNAIL_WIDTH } from '@shared/constants'
import { ensureCreatorAvatar } from './avatar'
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
    creatorId: string
    creatorName?: string
    postId: string
    postTitle?: string
    /** Total in-scope files in this post (for an "X / Total" badge). */
    postFileTotal: number
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
  /** Files currently being fetched (in-flight), for the live activity line. */
  private activeFiles = new Set<string>()
  /** The post/creator the engine is currently walking. */
  private cur: Omit<DownloadActivity, 'activeFiles'> = { phase: 'counting' }

  isRunning(): boolean {
    return this.running
  }

  cancel(): void {
    this.abort.abort()
  }

  /** Stamp the current activity onto progress and push it to the renderer. */
  private emit(cb: DownloadCallbacks): void {
    this.progress.inFlight = this.activeFiles.size
    const downloading = this.activeFiles.size > 0
    this.progress.current = {
      // A pending retry takes visual priority over scanning/counting so a 429
      // backoff reads as "waiting" rather than looking stuck.
      phase: downloading ? 'downloading' : this.cur.retry ? 'waiting' : this.cur.phase,
      creatorName: this.cur.creatorName,
      postId: this.cur.postId,
      postTitle: this.cur.postTitle,
      activeFiles: downloading ? [...this.activeFiles] : undefined,
      retry: this.cur.retry
    }
    cb.onProgress({ ...this.progress })
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
    this.activeFiles.clear()
    this.cur = { phase: 'counting' }
    const signal = this.abort.signal
    // On skip-existing runs, give the context the ledger-backed skip helper so
    // adapters can avoid a per-post detail fetch for posts already downloaded.
    // onRetry surfaces request backoff (e.g. HTTP 429) in the activity line.
    const ctx = createServiceContext(serviceId, signal, {
      includeKinds: options.skipExisting ? options.includeKinds : undefined,
      onRetry: (notice) => {
        this.cur.retry = notice
        this.progress.rateLimited = true // sticky: surfaces "access-limited" at the end
        this.emit(cb)
      }
    })
    const service = getService(serviceId)

    try {
      // Resolve display names for the ledger (best-effort; falls back to ids).
      const allCreators = await service.listCreators(ctx).catch((err) => {
        ctx.log('warn', 'listCreators failed; creator names unavailable', err)
        return []
      })
      const nameById = new Map(allCreators.map((c) => [c.creatorId, c.name]))
      const iconById = new Map(allCreators.map((c) => [c.creatorId, c.iconUrl]))
      const creators =
        options.creatorIds.length > 0 ? options.creatorIds : allCreators.map((c) => c.creatorId)

      // Count posts up front (cheap, ids only) so progress is determinate. If
      // any creator can't be counted, leave the total at 0 (indeterminate bar).
      if (service.countPosts) {
        let total = 0
        let countable = true
        for (const creatorId of creators) {
          signal.throwIfAborted()
          this.cur = { phase: 'counting', creatorName: nameById.get(creatorId) }
          this.emit(cb)
          try {
            total += await service.countPosts(ctx, creatorId)
          } catch (err) {
            ctx.log('warn', `countPosts failed for ${creatorId}; progress will be indeterminate`, err)
            countable = false
            break
          }
          this.progress.postsTotal = total
          this.emit(cb)
        }
        this.progress.postsTotal = countable ? total : 0
        this.emit(cb)
      }

      for (const creatorId of creators) {
        signal.throwIfAborted()
        // Fetch the creator's avatar once per run so the library can show it.
        const avatarUrl = await ensureCreatorAvatar(
          serviceId,
          root,
          creatorId,
          iconById.get(creatorId),
          service.downloadHeaders,
          signal
        ).catch((err) => {
          ctx.log('debug', `avatar download failed for ${creatorId}`, err)
          return undefined
        })
        const creatorName = nameById.get(creatorId)
        for await (const listed of service.listPosts(ctx, creatorId)) {
          signal.throwIfAborted()
          const post = service.resolvePost ? await service.resolvePost(ctx, listed) : listed

          // Surface the post we're now on (covers skips too), so the activity
          // line ticks through the walk instead of looking frozen.
          this.cur = { phase: 'scanning', creatorName, postId: post.postId, postTitle: post.title }
          this.emit(cb)

          if (options.skipExisting && isPostComplete(post, options.includeKinds)) {
            const inScope = post.files.filter((f) =>
              options.includeKinds.includes(f.kind)
            ).length
            this.progress.skipped += inScope
            this.progress.total += inScope
            this.progress.postsCompleted += 1
            this.emit(cb)
            continue
          }

          await this.downloadPost(serviceId, root, post, options, cb, creatorName, avatarUrl)
          this.progress.postsCompleted += 1
          this.emit(cb)
        }
      }
    } finally {
      this.running = false
      this.activeFiles.clear()
      this.emit(cb)
    }
  }

  private async downloadPost(
    serviceId: ServiceId,
    root: string,
    post: Post,
    options: DownloadOptions,
    cb: DownloadCallbacks,
    creatorName?: string,
    creatorIconUrl?: string
  ): Promise<void> {
    const { year, month } = toLocationParts(post.postedAt)
    const loc = { serviceId, creatorId: post.creatorId, year, month, postId: post.postId }
    const dir = postDir(root, loc)
    await mkdir(dir, { recursive: true })
    upsertPost(post, dir, creatorName, creatorIconUrl)

    // Assign collision-free on-disk names across the *whole* post (stable,
    // independent of includeKinds) so distinct files never overwrite each other
    // and the ledger records the real on-disk name (for the viewer/cover URLs).
    // Prefix each with a zero-padded post-order index ("001_…") so the viewer —
    // which lists a folder sorted by name — shows files in the post's display
    // order rather than alphabetically (FANBOX/ci-en use non-ordered names).
    const deduped = dedupeFileNames(post.files.map((f) => f.name))
    const width = Math.max(2, String(post.files.length).length)
    const diskNames = deduped.map((n, i) => `${String(i + 1).padStart(width, '0')}_${n}`)
    const diskNameById = new Map(post.files.map((f, i) => [f.fileId, diskNames[i]]))

    const targets = post.files.filter((f) => options.includeKinds.includes(f.kind))
    this.progress.total += targets.length

    // Bounded concurrency over this post's files.
    const queue = [...targets]
    const meta = { creatorName, postFileTotal: targets.length }
    const workers = Array.from({ length: Math.max(1, options.concurrency) }, () =>
      this.worker(serviceId, root, loc, post, queue, options, cb, diskNameById, meta)
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
    cb: DownloadCallbacks,
    diskNameById: Map<string, string>,
    meta: { creatorName?: string; postFileTotal: number }
  ): Promise<void> {
    const item = (
      file: PostFile,
      status: 'completed' | 'skipped' | 'failed',
      error?: string
    ): void =>
      cb.onItem?.({
        serviceId,
        creatorId: post.creatorId,
        creatorName: meta.creatorName,
        postId: post.postId,
        postTitle: post.title,
        postFileTotal: meta.postFileTotal,
        fileId: file.fileId,
        fileName: file.name,
        status,
        error
      })

    for (;;) {
      if (this.abort.signal.aborted) return
      const file = queue.shift()
      if (!file) return

      if (
        options.skipExisting &&
        isFileDownloaded(serviceId, post.creatorId, post.postId, file.fileId)
      ) {
        this.progress.skipped += 1
        item(file, 'skipped')
        this.emit(cb)
        continue
      }

      const diskName = diskNameById.get(file.fileId) ?? sanitizeFileName(file.name)
      const dest = join(postDir(root, loc), diskName)
      try {
        if (options.skipExisting && (await exists(dest))) {
          markFileDownloaded(post, file.fileId, diskName, undefined, file.kind)
          warmThumbnail(file.kind, dest)
          this.progress.skipped += 1
          item(file, 'skipped')
        } else {
          // Mark as in-flight so the activity line shows the live download.
          this.activeFiles.add(file.name)
          this.emit(cb)
          let size: number
          try {
            size = await this.downloadFile(serviceId, file, dest)
          } finally {
            this.activeFiles.delete(file.name)
          }
          markFileDownloaded(post, file.fileId, diskName, size, file.kind)
          warmThumbnail(file.kind, dest)
          this.progress.completed += 1
          this.progress.bytesDownloaded += size
          item(file, 'completed')
        }
      } catch (err) {
        this.progress.failed += 1
        item(file, 'failed', err instanceof Error ? err.message : String(err))
      }
      this.emit(cb)
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
    postsCompleted: 0,
    postsTotal: 0,
    bytesDownloaded: 0,
    bytesTotal: 0
  }
}

/**
 * Pre-generate an image's thumbnail at download time (fire-and-forget) so the
 * library is responsive from the first view. Best-effort: failures are ignored
 * (the fcfile handler regenerates lazily on demand if needed).
 */
function warmThumbnail(kind: PostFile['kind'], dest: string): void {
  if (kind !== 'image') return
  void getThumbnail(dest, THUMBNAIL_WIDTH).catch(() => {
    /* cosmetic; lazily regenerated on view */
  })
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
