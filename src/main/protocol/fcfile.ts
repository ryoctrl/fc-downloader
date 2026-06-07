/**
 * `fcfile://` — a custom protocol that serves files from *inside the download
 * root only*, so the renderer can preview downloaded media (<img>/<video>/
 * <audio>) without exposing the wider filesystem.
 *
 * URLs are root-relative: `fcfile:///<service>/<creator>/<year>/<month>/<id>/<file>`.
 * The handler joins the path onto the current download root and refuses
 * anything that escapes it. Range requests are supported for video/audio seek.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import { getSettings } from '@main/storage/settings'
import { isWithinRoot, kindForName, mimeForName } from '@main/storage/files'
import { getThumbnail } from '@main/storage/thumbnails'

export const FCFILE_SCHEME = 'fcfile'

/** Must run before app `ready`. */
export function registerFcfileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FCFILE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

function parseRange(range: string | null, size: number): { start: number; end: number } | null {
  if (!range) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (!m) return null
  let start = m[1] ? parseInt(m[1], 10) : 0
  let end = m[2] ? parseInt(m[2], 10) : size - 1
  if (Number.isNaN(start)) start = 0
  if (Number.isNaN(end) || end >= size) end = size - 1
  if (start > end || start < 0) return null
  return { start, end }
}

/** Must run after app `ready` (reads the configured download root per request). */
export function registerFcfileHandler(): void {
  protocol.handle(FCFILE_SCHEME, async (request) => {
    const root = getSettings().downloadRoot
    let rel: string
    let thumbWidth = 0
    try {
      const url = new URL(request.url)
      rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const w = parseInt(url.searchParams.get('w') ?? '', 10)
      if (Number.isFinite(w) && w > 0) thumbWidth = w
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    const full = normalize(join(root, rel))
    if (!isWithinRoot(root, full)) return new Response('Forbidden', { status: 403 })

    // Downloaded files are immutable (a given path's bytes never change — dedup
    // skips re-downloads), so let the renderer cache them. Without this every
    // library re-navigation re-streams and re-decodes full-res images.
    const cacheControl = 'private, max-age=86400, immutable'

    // Thumbnail request (?w=N) for an image: serve a downscaled JPEG instead of
    // the full-resolution original (huge originals otherwise jank the library).
    if (thumbWidth > 0 && kindForName(full) === 'image') {
      const buf = await getThumbnail(full, thumbWidth)
      if (buf) {
        return new Response(new Uint8Array(buf), {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': String(buf.length),
            'Cache-Control': cacheControl
          }
        })
      }
      // fall through to serving the original on generation failure
    }

    let size: number
    try {
      const s = await stat(full)
      if (!s.isFile()) return new Response('Not found', { status: 404 })
      size = s.size
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const type = mimeForName(full)
    const range = parseRange(request.headers.get('range'), size)
    if (range) {
      const { start, end } = range
      const body = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream
      return new Response(body, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': cacheControl
        }
      })
    }
    const body = Readable.toWeb(createReadStream(full)) as ReadableStream
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl
      }
    })
  })
}
