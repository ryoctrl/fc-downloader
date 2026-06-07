/**
 * `fcicon://` — serves a creator's remote avatar through the service's session
 * so the renderer can show it BEFORE the creator is downloaded (and for CDNs
 * that gate on a Referer/cookies, e.g. Fanbox's pximg, which a plain <img>
 * request can't satisfy). Fetched via the per-service session and cached on
 * disk; cosmetic, so any failure just 404s and the UI falls back to a monogram.
 *
 * URL: `fcicon://i/?s=<serviceId>&u=<encodeURIComponent(remoteHttpsUrl)>`
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, protocol } from 'electron'
import { requestFor } from '@main/session/manager'
import { getService, hasService } from '@main/services/registry'
import type { ServiceId } from '@shared/types'

export const FCICON_SCHEME = 'fcicon'

/** Must run before app `ready`. */
export function registerFciconScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FCICON_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true }
    }
  ])
}

function cacheDir(): string {
  return join(app.getPath('userData'), 'icons')
}

function mimeFor(url: string): string {
  const u = url.split('?')[0].toLowerCase()
  if (u.endsWith('.png')) return 'image/png'
  if (u.endsWith('.gif')) return 'image/gif'
  if (u.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

const CACHE_CONTROL = 'private, max-age=86400'

/** Must run after app `ready`. */
export function registerFciconHandler(): void {
  protocol.handle(FCICON_SCHEME, async (request) => {
    let serviceId: string
    let remote: string
    try {
      const url = new URL(request.url)
      serviceId = url.searchParams.get('s') ?? ''
      remote = url.searchParams.get('u') ?? ''
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    // Only proxy https image URLs for a known service.
    if (!/^https:\/\//i.test(remote) || !hasService(serviceId as ServiceId)) {
      return new Response('Forbidden', { status: 403 })
    }

    const key = createHash('sha1').update(remote).digest('hex')
    const cachePath = join(cacheDir(), `${key}.img`)
    const headers = { 'Content-Type': mimeFor(remote), 'Cache-Control': CACHE_CONTROL }

    const cached = await readFile(cachePath).catch(() => null)
    if (cached) return new Response(new Uint8Array(cached), { status: 200, headers })

    try {
      const svc = getService(serviceId as ServiceId)
      const res = await requestFor(serviceId as ServiceId, remote, { headers: svc.downloadHeaders })
      if (res.status >= 400) return new Response('Upstream error', { status: 502 })
      const buf = res.buffer()
      await mkdir(cacheDir(), { recursive: true }).catch(() => {})
      await writeFile(cachePath, buf).catch(() => {})
      return new Response(new Uint8Array(buf), { status: 200, headers })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
