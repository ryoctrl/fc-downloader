/**
 * Pure HTML parsing for the ci-en (ci-en.dlsite.com) adapter.
 *
 * ci-en has no clean JSON API — it renders server-side HTML — so the adapter
 * scrapes it. Parsing is isolated here (no network) so it can be unit-tested
 * against saved fixtures. Endpoints/markup were observed against the live site
 * with a logged-in session (2026-06-08) — see scripts/probe-cien.cjs.
 *
 * Gated (paid) content is served from media.ci-en.jp under
 *   /private/attachment/creator/<paddedId>/<hash>/<variant>?px-time=..&px-hash=..
 * where each attachment <hash> exposes several variants; `upload/<originalName>`
 * is the full-resolution original. Public covers/icons live under /public/ and
 * are intentionally excluded (they are not the supported content).
 */
import type { PostFile, PostFileKind } from '@shared/types'

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'])
const VIDEO_EXT = new Set(['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'])

function extOf(name: string): string {
  const m = name.split('?')[0].match(/\.([a-zA-Z0-9]{1,5})$/)
  return (m?.[1] ?? '').toLowerCase()
}

function kindForName(name: string): PostFileKind {
  const e = extOf(name)
  if (IMAGE_EXT.has(e)) return 'image'
  if (VIDEO_EXT.has(e)) return 'video'
  if (AUDIO_EXT.has(e)) return 'audio'
  return 'file'
}

/** Minimal HTML entity decode for the bits that appear in titles/URLs. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

/** Canonical creator id (ci-en links use both `8600` and zero-padded `00008600`). */
export function canonicalCreatorId(raw: string): string {
  const trimmed = raw.replace(/^0+/, '')
  return trimmed.length > 0 ? trimmed : '0'
}

/** Distinct creator ids referenced by `/creator/<id>` links, canonicalized. */
export function parseCreatorIds(html: string): string[] {
  const ids = new Set<string>()
  for (const m of html.matchAll(/\/creator\/(\d+)(?![\d/])/g)) {
    ids.add(canonicalCreatorId(m[1]))
  }
  // Also catch `/creator/<id>/...` forms.
  for (const m of html.matchAll(/\/creator\/(\d+)\//g)) {
    ids.add(canonicalCreatorId(m[1]))
  }
  return [...ids]
}

/**
 * Merge the creator ids scraped from the subscription tab pages into one
 * tier-tagged, de-duped list (document order, first occurrence wins for order).
 * `supporting` is a paid supporter (サポート中); a past supporter (サポート経験
 * あり) and a plain follower (フォロー) are both free. If a creator somehow
 * appears on both a paid and a free tab, the paid tier wins.
 */
export function mergeSubscriptionTiers(
  pages: Array<{ ids: string[]; supporting: boolean }>
): Array<{ creatorId: string; supporting: boolean }> {
  const byId = new Map<string, boolean>()
  const order: string[] = []
  for (const page of pages) {
    for (const id of page.ids) {
      if (byId.has(id)) {
        if (page.supporting && !byId.get(id)) byId.set(id, true) // paid wins
        continue
      }
      byId.set(id, page.supporting)
      order.push(id)
    }
  }
  return order.map((id) => ({ creatorId: id, supporting: byId.get(id) as boolean }))
}

/** Creator display name from a `/creator/<id>` profile page `<title>`. */
export function parseCreatorName(html: string, fallback: string): string {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]
  if (!title) return fallback
  // "NAMEプロフィール - Ci-en（シエン）"
  const name = decodeEntities(title)
    .replace(/\s*-\s*Ci-en（シエン）\s*$/i, '')
    .replace(/プロフィール\s*$/, '')
    .trim()
  return name || fallback
}

/** Creator avatar URL (public icon) from a profile page, if present. */
export function parseCreatorIcon(html: string): string | undefined {
  const m = html.match(/https:\/\/media\.ci-en\.jp\/public\/icon\/creator\/[^"'\\ )]+/)
  return m ? decodeEntities(m[0]) : undefined
}

/** Distinct article ids on a creator's article-listing page, in document order. */
export function parseArticleIds(html: string): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/\/creator\/\d+\/article\/(\d+)/g)) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      ids.push(m[1])
    }
  }
  return ids
}

/** Article title from its page `<title>` ("TITLE - CREATOR - Ci-en（シエン）"). */
export function parseArticleTitle(html: string, fallback: string): string {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]
  if (!title) return fallback
  const decoded = decodeEntities(title).replace(/\s*-\s*Ci-en（シエン）\s*$/i, '')
  // Strip the trailing " - CREATOR" segment if present.
  const lastDash = decoded.lastIndexOf(' - ')
  const t = (lastDash > 0 ? decoded.slice(0, lastDash) : decoded).trim()
  return t || fallback
}

/** Article published timestamp (ISO-8601). Falls back to the epoch. */
export function parseArticleDate(html: string): string {
  const dt = html.match(/datetime="([^"]+)"/i)?.[1]
  if (dt) {
    const d = new Date(dt)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  const ymd = html.match(/(\d{4})[/-](\d{2})[/-](\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (ymd) {
    const [, y, mo, da, h = '00', mi = '00'] = ymd
    const d = new Date(`${y}-${mo}-${da}T${h}:${mi}:00+09:00`) // ci-en is JST
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date(0).toISOString()
}

interface Variant {
  /** Path after the hash, e.g. `upload/name.jpg` or `image-800.jpg` (no query). */
  variant: string
  /** Full URL including the signed query string. */
  url: string
}

/** Rank a variant: prefer the original `upload/...`, then larger derived images. */
function variantScore(variant: string): number {
  if (variant.startsWith('upload/')) return 100
  if (variant.startsWith('image-800')) return 30
  if (variant.startsWith('image-web')) return 20
  if (variant.startsWith('image-')) return 10
  return 5
}

/**
 * Collect gated downloadable files from an article page. Each
 * `/private/attachment/.../<hash>/<variant>` is grouped by hash; the best
 * variant per hash (original `upload/` preferred) becomes one PostFile.
 * Public covers/icons (`/public/...`) are ignored.
 */
export function parseAttachments(html: string): PostFile[] {
  // Some article pages embed media URLs inside JSON/JS with escaped slashes
  // (`https:\/\/media.ci-en.jp\/...`); normalize those so the matcher catches
  // them too, not only plain `<a href>` URLs. (Newer/most-recent articles can
  // render this way, which made them look like they had no content.)
  const text = html.replace(/\\\//g, '/')
  const re =
    /https:\/\/media\.ci-en\.jp\/private\/(?:attachment|file)\/creator\/\d+\/([0-9a-f]+)\/([^"'\\ )]+)/gi
  const byHash = new Map<string, Variant[]>()
  for (const m of text.matchAll(re)) {
    const hash = m[1]
    const url = decodeEntities(m[0])
    const variant = m[2].split('?')[0]
    if (!variant) continue // bare hash dir, no file
    // Skip cropped thumbnails (`image-<N>-c.jpg`): these are shared UI images —
    // the creator icon and recent-article covers that appear on EVERY article
    // page — not this post's content. Including them downloaded another post's
    // thumbnail into each post. Real content is `upload/` / `image-800` /
    // `image-web` (never `-c` cropped).
    if (/^image-\d+-c\./i.test(variant)) continue
    const list = byHash.get(hash) ?? []
    list.push({ variant, url })
    byHash.set(hash, list)
  }

  const files: PostFile[] = []
  for (const [hash, variants] of byHash) {
    variants.sort((a, b) => variantScore(b.variant) - variantScore(a.variant))
    const best = variants[0]
    if (!best) continue
    let name: string
    if (best.variant.startsWith('upload/')) {
      // upload/<urlencoded original name>
      name = decodeURIComponent(best.variant.slice('upload/'.length))
    } else {
      const ext = extOf(best.variant) || 'jpg'
      name = `${hash}.${ext}`
    }
    files.push({ fileId: hash, kind: kindForName(name), name, url: best.url })
  }

  // Videos (and some files) are rendered as a <vue-file-player> custom element
  // whose signed media URL is NOT in the static HTML — the player builds it from
  // base-path + variant + auth-key. The auth-key is valid for the whole hash
  // dir, so request the original `upload/<name>`. (These never appear as plain
  // <img>/href URLs, hence the separate pass.)
  for (const m of text.matchAll(/<vue-file-player\b[^>]*>/gi)) {
    const tag = m[0]
    const attr = (n: string): string => {
      const mm = tag.match(new RegExp(`${n}="([^"]*)"`, 'i'))
      return mm ? decodeEntities(mm[1]) : ''
    }
    const basePath = attr('base-path')
    const authKey = attr('auth-key')
    const fileName = attr('file-name')
    if (!basePath || !authKey || !fileName) continue
    const hash = basePath.match(/\/creator\/\d+\/([0-9a-f]+)\//i)?.[1]
    if (!hash || byHash.has(hash)) continue // skip if already captured directly
    const url = `${basePath.replace(/\/$/, '')}/upload/${encodeURIComponent(fileName)}?${authKey}`
    files.push({ fileId: hash, kind: kindForName(fileName), name: fileName, url })
  }
  return files
}
