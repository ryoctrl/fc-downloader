import type { LibraryFile } from '@shared/types'
import type { ViewPost } from './library'

export interface LibraryImage extends LibraryFile {
  post: ViewPost
}

export interface ImageBatch {
  images: LibraryImage[]
  processed: number
  failed: number
}

// An in-flight IPC request cannot be aborted. Let the previous scan drain its
// current batch before another selection starts reading folders, keeping the
// four-read cap even during rapid filter changes or remounts.
let previousScan = Promise.resolve()

/** Read only file metadata, four folders at a time. Publish in post order even
 * when IPC requests finish out of order; never scan beyond the filtered posts.
 * Cancellation stops publishing and scheduling further requests. */
export function scanLibraryImages(
  posts: ViewPost[],
  listFiles: (dirPath: string) => Promise<LibraryFile[]>,
  onBatch: (batch: ImageBatch) => void,
  signal: AbortSignal
): Promise<void> {
  const scan = previousScan.then(() => scanPosts(posts, listFiles, onBatch, signal))
  previousScan = scan.catch(() => undefined)
  return scan
}

async function scanPosts(
  posts: ViewPost[],
  listFiles: (dirPath: string) => Promise<LibraryFile[]>,
  onBatch: (batch: ImageBatch) => void,
  signal: AbortSignal
): Promise<void> {
  const batchSize = 4
  let failed = 0
  for (let start = 0; start < posts.length && !signal.aborted; start += batchSize) {
    const batch = posts.slice(start, start + batchSize)
    const results = await Promise.allSettled(batch.map(async (post) => listFiles(post.dirPath)))
    if (signal.aborted) return
    const images: LibraryImage[] = []
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed++
        return
      }
      for (const file of result.value) {
        // Include images in mixed-media posts too, using the same file order as
        // the detail view. Covers and PSD preview sidecars are not extra images.
        if (file.kind === 'image') images.push({ ...file, post: batch[index] })
      }
    })
    onBatch({ images, processed: start + batch.length, failed })
  }
}
