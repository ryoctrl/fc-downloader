/**
 * Shared creator-avatar fetching.
 *
 * Some services serve avatars from a CDN that requires a Referer/Origin (e.g.
 * Fanbox's pximg), so the remote URL can't be rendered directly in the
 * renderer. We download it once into the creator's folder and serve it via the
 * fcfile:// protocol. Used both by the download engine (during a run) and by the
 * library backfill (for creators downloaded before avatars existed).
 */
import { mkdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { downloadToFile } from '@main/session/manager'
import { fcfileUrl } from '@main/storage/files'
import type { ServiceId } from '@shared/types'

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Download a creator's avatar into `<root>/<serviceId>/<creatorId>/_avatar.<ext>`
 * (reusing it if already present) and return a fcfile:// URL the viewer can
 * render. Returns undefined when there is no source URL. Throws on a failed
 * fetch — callers treat avatars as cosmetic and swallow errors.
 */
export async function ensureCreatorAvatar(
  serviceId: ServiceId,
  root: string,
  creatorId: string,
  iconUrl: string | undefined,
  headers: Record<string, string> | undefined,
  signal: AbortSignal
): Promise<string | undefined> {
  if (!iconUrl) return undefined
  const clean = iconUrl.split('?')[0]
  const ext = (clean.match(/\.([a-zA-Z0-9]{2,4})$/)?.[1] ?? 'jpg').toLowerCase()
  const dir = join(root, serviceId, creatorId)
  const dest = join(dir, `_avatar.${ext}`)
  const url = fcfileUrl(relative(root, dest))
  if (await exists(dest)) return url
  await mkdir(dir, { recursive: true })
  await downloadToFile(serviceId, iconUrl, dest, { signal, headers })
  return url
}
