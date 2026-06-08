/**
 * Lightweight update check: compare the running version against the latest
 * published GitHub release and tell the renderer if a newer one exists. The
 * renderer just shows a banner linking to the release page — no auto-download
 * (full auto-update needs code signing; see docs/spec/security-and-legal.md).
 */
import { app } from 'electron'
import type { UpdateInfo } from '@shared/types'

const REPO = 'ryoctrl/fc-downloader'

/** Compare dotted numeric versions: >0 if a is newer than b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * Returns update info, or null if the check fails (offline, rate-limited, etc.).
 * `releases/latest` returns the newest non-draft, non-prerelease release.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const current = app.getVersion()
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'fc-downloader', Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = (data.tag_name ?? '').replace(/^v/i, '').trim()
    if (!latest) return null
    return {
      available: compareVersions(latest, current) > 0,
      current,
      latest,
      url: data.html_url ?? `https://github.com/${REPO}/releases/latest`
    }
  } catch {
    return null
  }
}
