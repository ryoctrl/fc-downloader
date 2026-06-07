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
import { isWithinRoot, mimeForName } from '@main/storage/files'

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
    try {
      rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    const full = normalize(join(root, rel))
    if (!isWithinRoot(root, full)) return new Response('Forbidden', { status: 403 })

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
          'Accept-Ranges': 'bytes'
        }
      })
    }
    const body = Readable.toWeb(createReadStream(full)) as ReadableStream
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' }
    })
  })
}
