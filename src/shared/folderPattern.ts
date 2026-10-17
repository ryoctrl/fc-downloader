/**
 * User-configurable download folder names. A post is saved under
 *   <root>/<serviceId>/<creator folder>/<post folder>/
 * where the creator folder comes from `creatorFolderPattern` (one segment) and
 * the post folder from `postFolderPattern` (`/` separates nested folders). The
 * defaults reproduce the original fixed layout. Shared by both processes (the
 * settings screen previews it) — keep it free of Node/Electron/DOM imports.
 *
 * Dedup doesn't depend on these names: the ledger keys posts by
 * (service, creator id, post id) and records each post's folder, so changing a
 * pattern only affects posts recorded afterwards.
 */

export const DEFAULT_CREATOR_FOLDER_PATTERN = '{creatorId}'
export const DEFAULT_POST_FOLDER_PATTERN = '{year}/{month}/{postId}'

export const CREATOR_FOLDER_TOKENS = ['creatorId', 'creatorName'] as const
export const POST_FOLDER_TOKENS = ['year', 'month', 'day', 'postId', 'title'] as const

/** Longest `{title}` kept (characters), so a long title can't blow the path. */
const MAX_TITLE_LENGTH = 80

/** Names Windows reserves for devices, in any case and with any extension. */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/**
 * Make one folder name safe on Windows/macOS/Linux: characters illegal there
 * (and control characters) become `_`, trailing dots/spaces are dropped (so
 * `.`/`..` collapse to empty), device names get a `_` suffix, and the length is
 * capped. May return '' — callers fall back to an id.
 */
export function sanitizeFolderName(name: string): string {
  // eslint-disable-next-line no-control-regex
  let s = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '')
  s = s.slice(0, 200).replace(/[. ]+$/, '')
  return WINDOWS_RESERVED.test(s) ? `${s}_` : s
}

const TOKEN = /\{(\w+)\}/g

function render(pattern: string, values: Record<string, string>): string {
  return pattern.replace(TOKEN, (whole, name: string) => values[name] ?? whole)
}

/** Why a pattern can't be saved, or null when it's usable. */
export type FolderPatternError = 'empty' | 'unknownToken' | 'missingPostId'

function unknownTokens(pattern: string, allowed: readonly string[]): string[] {
  return [...pattern.matchAll(TOKEN)].map((m) => m[1]).filter((t) => !allowed.includes(t))
}

export function validateCreatorFolderPattern(pattern: string): FolderPatternError | null {
  if (pattern.trim() === '') return 'empty'
  if (unknownTokens(pattern, CREATOR_FOLDER_TOKENS).length > 0) return 'unknownToken'
  return null
}

/** A post folder must name the post id, or different posts would share it. */
export function validatePostFolderPattern(pattern: string): FolderPatternError | null {
  if (pattern.trim() === '') return 'empty'
  if (unknownTokens(pattern, POST_FOLDER_TOKENS).length > 0) return 'unknownToken'
  if (!pattern.includes('{postId}')) return 'missingPostId'
  return null
}

/** The pattern to use: the user's when valid, else the default. */
export function effectiveCreatorPattern(pattern: string | undefined): string {
  return pattern && !validateCreatorFolderPattern(pattern)
    ? pattern
    : DEFAULT_CREATOR_FOLDER_PATTERN
}

export function effectivePostPattern(pattern: string | undefined): string {
  return pattern && !validatePostFolderPattern(pattern) ? pattern : DEFAULT_POST_FOLDER_PATTERN
}

/**
 * The creator folder name (one segment; a `/` in the pattern or name becomes
 * `_`). An unknown name renders as the id; an empty result falls back to the id.
 */
export function creatorFolderName(
  pattern: string | undefined,
  creator: { creatorId: string; creatorName?: string }
): string {
  const name = creator.creatorName?.trim() || creator.creatorId
  const out = sanitizeFolderName(
    render(effectiveCreatorPattern(pattern), { creatorId: creator.creatorId, creatorName: name })
  )
  return out || sanitizeFolderName(creator.creatorId) || '_'
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * The post folder as path segments. Date tokens are the publish time's UTC
 * parts, like the year/month folders always were (layout.toLocationParts), so
 * the default pattern keeps saving to exactly the same folders. Empty segments
 * are dropped; if nothing is left, the post id alone is used.
 */
export function postFolderSegments(
  pattern: string | undefined,
  post: { postId: string; title?: string; postedAt: string }
): string[] {
  const d = new Date(post.postedAt)
  const valid = !Number.isNaN(d.getTime())
  const values: Record<string, string> = {
    year: valid ? String(d.getUTCFullYear()) : '0000',
    month: valid ? pad2(d.getUTCMonth() + 1) : '00',
    day: valid ? pad2(d.getUTCDate()) : '00',
    postId: post.postId,
    title: (post.title ?? '').trim().slice(0, MAX_TITLE_LENGTH)
  }
  const segs = effectivePostPattern(pattern)
    .split('/')
    .map((seg) => sanitizeFolderName(render(seg, values)))
    .filter((seg) => seg !== '')
  return segs.length > 0 ? segs : [sanitizeFolderName(post.postId) || '_']
}
