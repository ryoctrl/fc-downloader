/*
 * Generate library cover thumbnails for PSD-only posts.
 *
 * A post with only a .psd (no jpg/png) has no cover, so the library shows a
 * placeholder. Here we render the PSD's embedded composite (the flattened
 * preview Photoshop saved) to a small JPEG and hand it to the main process to
 * cache as a sidecar in the post folder (see `psd:saveCover`); the library then
 * uses it as the post's cover on subsequent listings.
 *
 * Only the composite is decoded (`skipLayerImageData`), so this stays cheap even
 * for a huge multi-hundred-layer PSD. Generation is best-effort, bounded to a
 * couple at a time, and attempted at most once per post per session.
 */
import { readPsd } from 'ag-psd'
import { bridge } from './bridge'

/** Longest edge of the generated cover (≥ the grid thumbnail width). */
const COVER_MAX_EDGE = 640
/** How many covers to render concurrently (each reads + decodes a whole PSD). */
const CONCURRENCY = 2

const attempted = new Set<string>()

/** Render one PSD's composite to a JPEG cover; returns its fcfile:// URL. */
async function renderCover(dirPath: string, psdName: string): Promise<string | null> {
  const bytes = await bridge.readPsdBytes(dirPath, psdName)
  if (!bytes) return null
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

  let composite: ReturnType<typeof readPsd>['imageData']
  try {
    // Composite only — skip per-layer decode so even a huge PSD is cheap.
    composite = readPsd(ab, { skipLayerImageData: true, useImageData: true }).imageData
  } catch {
    return null
  }
  if (!composite || composite.width <= 0 || composite.height <= 0) return null
  // Only 8-bit composites map straight to canvas pixels; skip 16/32-bit PSDs.
  if (composite.data.BYTES_PER_ELEMENT !== 1) return null

  const scale = Math.min(1, COVER_MAX_EDGE / Math.max(composite.width, composite.height))
  const w = Math.max(1, Math.round(composite.width * scale))
  const h = Math.max(1, Math.round(composite.height * scale))

  const full = document.createElement('canvas')
  full.width = composite.width
  full.height = composite.height
  const fctx = full.getContext('2d')
  if (!fctx) return null
  const data = new Uint8ClampedArray(
    composite.data.buffer as ArrayBuffer,
    composite.data.byteOffset,
    composite.data.byteLength
  )
  fctx.putImageData(new ImageData(data, composite.width, composite.height), 0, 0)

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')
  if (!octx) return null
  // JPEG has no alpha — flatten onto white so a transparent composite isn't black.
  octx.fillStyle = '#ffffff'
  octx.fillRect(0, 0, w, h)
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(full, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/jpeg', 0.85))
  if (!blob) return null
  return bridge.savePsdCover(dirPath, new Uint8Array(await blob.arrayBuffer()))
}

/**
 * Generate covers for any posts that need one (PSD-only, no cover yet), calling
 * `onCover(dirPath, coverUrl)` as each is produced. Safe to call repeatedly on
 * the posts list — each post is attempted only once per session.
 */
export function ensurePsdCovers(
  posts: { dirPath: string; coverUrl?: string; psdCoverSource?: string }[],
  onCover: (dirPath: string, coverUrl: string) => void
): void {
  const todo = posts.filter((p) => !p.coverUrl && p.psdCoverSource && !attempted.has(p.dirPath))
  if (todo.length === 0) return
  for (const p of todo) attempted.add(p.dirPath)

  let i = 0
  const worker = async (): Promise<void> => {
    while (i < todo.length) {
      const p = todo[i++]
      try {
        const url = await renderCover(p.dirPath, p.psdCoverSource as string)
        if (url) onCover(p.dirPath, url)
      } catch {
        /* best-effort: leave the placeholder */
      }
    }
  }
  for (let k = 0; k < CONCURRENCY; k++) void worker()
}
