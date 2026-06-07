/**
 * Reading a downloaded post's files from disk for the media viewer, plus the
 * pure helpers (kind/mime by extension, root-containment check, fcfile URL
 * builder) shared with the custom protocol. Disk is the source of truth.
 */
import { readdir, stat } from 'node:fs/promises'
import { join, normalize, relative, sep } from 'node:path'
import type { LibraryFile, PostFileKind } from '@shared/types'
import { getSettings } from './settings'

const KIND_BY_EXT: Record<string, PostFileKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  avif: 'image',
  mp4: 'video',
  webm: 'video',
  m4v: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  flac: 'audio',
  aac: 'audio',
  ogg: 'audio'
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  pdf: 'application/pdf'
}

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function kindForName(name: string): PostFileKind {
  return KIND_BY_EXT[ext(name)] ?? 'file'
}

export function mimeForName(name: string): string {
  return MIME_BY_EXT[ext(name)] ?? 'application/octet-stream'
}

/** True when `full` is `root` itself or strictly inside it (after normalize). */
export function isWithinRoot(root: string, full: string): boolean {
  const r = normalize(root)
  const f = normalize(full)
  return f === r || f.startsWith(r.endsWith(sep) ? r : r + sep)
}

/**
 * Build a fcfile:// URL from a path relative to the download root.
 *
 * A fixed host (`fc`) is used so the first path segment (e.g. the serviceId)
 * is NOT consumed as the URL authority by the standard-scheme parser — with
 * `fcfile:///fanbox/...` Chromium treats `fanbox` as the host and drops it from
 * the pathname. With `fcfile://fc/...` the whole path stays in `pathname`.
 */
export function fcfileUrl(relPath: string): string {
  const encoded = relPath
    .split(/[\\/]/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  return `fcfile://fc/${encoded}`
}

/** List the real files in a post's directory (must be within the root). */
export async function listPostFiles(dirPath: string): Promise<LibraryFile[]> {
  const root = getSettings().downloadRoot
  if (!isWithinRoot(root, dirPath)) return []
  let entries
  try {
    entries = await readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }
  const out: LibraryFile[] = []
  for (const e of entries) {
    if (!e.isFile()) continue
    // Skip in-progress / crash-leftover partial downloads (see downloadToFile).
    if (e.name.endsWith('.part')) continue
    const full = join(dirPath, e.name)
    let sizeBytes = 0
    try {
      sizeBytes = (await stat(full)).size
    } catch {
      /* unreadable — skip size */
    }
    out.push({ name: e.name, url: fcfileUrl(relative(root, full)), kind: kindForName(e.name), sizeBytes })
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return out
}
