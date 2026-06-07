/**
 * On-demand thumbnail generation + disk cache.
 *
 * Library/grid covers must NOT load full-resolution originals (Fanbox art can be
 * 4000×6000 / several MB); decoding dozens of those in the renderer exhausts
 * memory and janks every navigation. Instead we downscale with Electron's
 * built-in `nativeImage` (no extra native dependency) in the main process and
 * cache the small JPEGs on disk, so each thumbnail is generated at most once and
 * served instantly thereafter. Full-resolution images are only loaded in the
 * detail lightbox.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, nativeImage } from 'electron'

const MAX_WIDTH = 1024
let cacheDir = ''

function dir(): string {
  if (!cacheDir) cacheDir = join(app.getPath('userData'), 'thumbnails')
  return cacheDir
}

/**
 * Return a downscaled JPEG (width px) of the image at `absPath`, generating and
 * caching it on first request. Returns null if the file is missing or not a
 * decodable image (caller should fall back to serving the original).
 */
export async function getThumbnail(absPath: string, width: number): Promise<Buffer | null> {
  const w = Math.max(16, Math.min(MAX_WIDTH, Math.floor(width)))
  const s = await stat(absPath).catch(() => null)
  if (!s || !s.isFile()) return null

  const key = createHash('sha1').update(`${absPath}|${s.mtimeMs}|${s.size}|${w}`).digest('hex')
  const cachePath = join(dir(), `${key}.jpg`)

  const cached = await readFile(cachePath).catch(() => null)
  if (cached) return cached

  // nativeImage.createFromPath decodes via Chromium; empty => not an image.
  const img = nativeImage.createFromPath(absPath)
  if (img.isEmpty()) return null
  const { width: ow } = img.getSize()
  // Don't upscale: a small original is already a fine "thumbnail".
  const resized = ow > w ? img.resize({ width: w, quality: 'good' }) : img
  const buf = resized.toJPEG(80)
  if (!buf || buf.length === 0) return null

  await mkdir(dir(), { recursive: true }).catch(() => {})
  await writeFile(cachePath, buf).catch(() => {
    /* cache write is best-effort */
  })
  return buf
}
