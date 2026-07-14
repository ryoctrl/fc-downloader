/**
 * Pure normalization of a Fanbox `post.info` body into the shared Post shape.
 * Kept separate from the network code so it can be unit-tested against saved
 * fixtures.
 *
 * NOTE: Fanbox has no official public API. The shapes below mirror the site's
 * internal api.fanbox.cc responses and are marked `VERIFY:` where they should
 * be confirmed against the live API with a saved fixture.
 */
import type { Creator, Post, PostFile, PostFileKind } from '@shared/types'
import { toLocationParts } from '@main/storage/layout'
import { webPostUrl } from '../postUrl'

/** VERIFY: a `plan.listSupporting` entry (subset) — a creator with a paid plan. */
export interface RawSupportingPlan {
  creatorId: string
  user?: { userId?: string; name?: string; iconUrl?: string }
}

/**
 * VERIFY: a `creator.listFollowing` entry (subset). Every followed creator is
 * a download target: a paid supporter sees restricted posts, and a plain
 * follower still sees the creator's free-plan / public posts. The flags below
 * exist so we can tell those apart:
 *  - `isSupported`  active paid plan (also true for a ¥0 "free plan").
 *  - `isStopped`    support cancelled but access remains until month-end.
 * Neither flag is required to include the creator — following alone is enough.
 */
export interface RawFollowedCreator {
  creatorId: string
  user?: { userId?: string; name?: string; iconUrl?: string }
  isFollowed?: boolean
  isSupported?: boolean
  isStopped?: boolean
}

/**
 * Merge the two enumeration sources into the downloadable creator list,
 * de-duped by creatorId (a creator can be both supported and followed).
 * `plan.listSupporting` alone misses creators whose paid support was stopped
 * (still accessible until month-end) or downgraded to a free plan — those come
 * in via `creator.listFollowing`.
 *
 * `supporting` is set so the UI can split 支援中 (paid) from フォロー中 (free):
 *  - every plan.listSupporting entry is a paid supporter → true
 *  - a followed creator is paid when `isSupported` (active plan) or `isStopped`
 *    (cancelled but valid until month-end); a plain follow is free → false
 * The supporting source is applied first, so a creator in both stays `true`.
 */
export function collectDownloadableCreators(
  supporting: RawSupportingPlan[],
  following: RawFollowedCreator[]
): Creator[] {
  const byCreator = new Map<string, Creator>()
  const add = (
    creatorId: string,
    isSupporting: boolean,
    user?: { name?: string; iconUrl?: string }
  ): void => {
    if (!creatorId || byCreator.has(creatorId)) return
    byCreator.set(creatorId, {
      serviceId: 'fanbox',
      creatorId,
      name: user?.name ?? creatorId,
      iconUrl: user?.iconUrl,
      supporting: isSupporting
    })
  }
  // Guard the inputs: a future API-shape change that yields a non-array must
  // not throw here and wipe the whole creator list (a stale cache then sticks).
  for (const p of Array.isArray(supporting) ? supporting : []) add(p.creatorId, true, p.user)
  for (const c of Array.isArray(following) ? following : [])
    add(c.creatorId, !!(c.isSupported || c.isStopped), c.user)
  return [...byCreator.values()]
}

/** VERIFY: subset of the api.fanbox.cc `post.info` response body. */
export interface RawFanboxImage {
  id: string
  extension: string
  originalUrl: string
  thumbnailUrl?: string
}

export interface RawFanboxFile {
  id: string
  name: string
  extension: string
  url: string
  size?: number
}

export interface RawFanboxBody {
  // image post
  images?: RawFanboxImage[]
  // file post
  files?: RawFanboxFile[]
  // article post: ordered blocks reference entries in imageMap / fileMap
  blocks?: Array<{ type: string; imageId?: string; fileId?: string; text?: string }>
  imageMap?: Record<string, RawFanboxImage>
  fileMap?: Record<string, RawFanboxFile>
  // text post
  text?: string
}

export interface RawFanboxPost {
  id: string
  title: string
  creatorId: string
  /** ISO-8601, e.g. "2025-06-01T12:00:00+09:00". */
  publishedDatetime: string
  type: string // 'image' | 'file' | 'article' | 'text' | 'video' | ...
  coverImageUrl?: string | null
  /** null when the viewer is not entitled to the post (restricted tier). */
  body: RawFanboxBody | null
}

const VIDEO_EXT = new Set(['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'])

function kindForExtension(ext: string): PostFileKind {
  const e = ext.toLowerCase()
  if (VIDEO_EXT.has(e)) return 'video'
  if (AUDIO_EXT.has(e)) return 'audio'
  return 'file'
}

function imageFile(img: RawFanboxImage): PostFile {
  return {
    fileId: img.id,
    kind: 'image',
    name: `${img.id}.${img.extension}`,
    url: img.originalUrl
  }
}

function fileEntry(f: RawFanboxFile): PostFile {
  return {
    fileId: f.id,
    kind: kindForExtension(f.extension),
    name: `${f.name}.${f.extension}`,
    url: f.url,
    sizeBytes: f.size
  }
}

/** Collect downloadable files from a body, preserving article block order. */
export function collectFiles(body: RawFanboxBody): PostFile[] {
  const files: PostFile[] = []
  const seen = new Set<string>()
  const push = (pf: PostFile): void => {
    if (!pf.url || seen.has(pf.fileId)) return
    seen.add(pf.fileId)
    files.push(pf)
  }

  // image / file posts
  for (const img of body.images ?? []) push(imageFile(img))
  for (const f of body.files ?? []) push(fileEntry(f))

  // article posts: walk blocks in order, resolving via the maps
  if (body.blocks) {
    for (const block of body.blocks) {
      if (block.imageId && body.imageMap?.[block.imageId]) {
        push(imageFile(body.imageMap[block.imageId]))
      } else if (block.fileId && body.fileMap?.[block.fileId]) {
        push(fileEntry(body.fileMap[block.fileId]))
      }
    }
  }
  // include any map entries not referenced by a block (defensive)
  for (const img of Object.values(body.imageMap ?? {})) push(imageFile(img))
  for (const f of Object.values(body.fileMap ?? {})) push(fileEntry(f))

  return files
}

/** Normalize a raw Fanbox post into the shared Post, or null if inaccessible. */
export function normalizePost(raw: RawFanboxPost): Post | null {
  if (!raw.body) return null
  const postedAt = new Date(raw.publishedDatetime).toISOString()
  const { year, month } = toLocationParts(postedAt)
  return {
    serviceId: 'fanbox',
    creatorId: raw.creatorId,
    postId: raw.id,
    title: raw.title,
    postedAt,
    year,
    month,
    url: webPostUrl('fanbox', raw.creatorId, raw.id),
    files: collectFiles(raw.body)
  }
}
