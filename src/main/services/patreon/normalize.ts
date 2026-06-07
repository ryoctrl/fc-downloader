/**
 * Pure normalization of Patreon's JSON:API post + media objects into the shared
 * Post shape. Kept separate from the network code so it can be unit-tested
 * against saved fixtures.
 *
 * Patreon's web client uses an undocumented JSON:API at www.patreon.com/api.
 * A post (`type: "post"`) references its downloadable artifacts by id through
 * `relationships`; the artifacts themselves are `type: "media"` resources that
 * arrive in the response's top-level `included` array. The shapes below mirror
 * those responses and are marked `VERIFY:` until confirmed against the live API
 * with a saved fixture from an account that actually supports a campaign (the
 * probe account had no active pledges — see scripts/probe-patreon.cjs).
 */
import type { Post, PostFile, PostFileKind } from '@shared/types'
import { toLocationParts } from '@main/storage/layout'
import { webPostUrl } from '../postUrl'

/** A JSON:API resource linkage: `{ id, type }`, possibly an array or null. */
interface Linkage {
  id: string
  type: string
}

interface Relationship {
  data?: Linkage | Linkage[] | null
}

/** VERIFY: subset of a Patreon `type: "post"` resource. */
export interface RawPatreonPost {
  id: string
  type: 'post'
  attributes: {
    title?: string | null
    /** ISO-8601, e.g. "2025-06-01T12:00:00.000+00:00". */
    published_at?: string | null
    post_type?: string
    url?: string
    /** false when the viewer's tier can't see this post. */
    current_user_can_view?: boolean
  }
  relationships?: {
    images?: Relationship
    audio?: Relationship
    video?: Relationship
    media?: Relationship
    attachments_media?: Relationship
    post_file?: Relationship
    campaign?: Relationship
  }
}

/** VERIFY: subset of a Patreon `type: "media"` resource (from `included`). */
export interface RawPatreonMedia {
  id: string
  type: 'media'
  attributes: {
    download_url?: string | null
    file_name?: string | null
    mimetype?: string | null
    size_bytes?: number | null
    /** Present for image media; keyed variants (original/default/thumbnail). */
    image_urls?: Record<string, string> | null
  }
}

function kindForMime(mime: string | null | undefined): PostFileKind {
  const m = (mime ?? '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('video/')) return 'video'
  return 'file'
}

/** Flatten a relationship's `data` (single | array | null) into linkages. */
function linkagesOf(rel: Relationship | undefined): Linkage[] {
  const d = rel?.data
  if (!d) return []
  return Array.isArray(d) ? d : [d]
}

/** Best download URL for a media: explicit download_url, else original image. */
function mediaUrl(m: RawPatreonMedia): string | undefined {
  const a = m.attributes
  if (a.download_url) return a.download_url
  const imgs = a.image_urls
  if (imgs) return imgs.original ?? imgs.default ?? Object.values(imgs)[0]
  return undefined
}

function toPostFile(m: RawPatreonMedia, kindHint?: PostFileKind): PostFile | null {
  const url = mediaUrl(m)
  if (!url) return null
  const kind = kindHint ?? kindForMime(m.attributes.mimetype)
  const name = m.attributes.file_name?.trim() || `${m.id}`
  return {
    fileId: m.id,
    kind,
    name,
    url,
    sizeBytes: m.attributes.size_bytes ?? undefined
  }
}

/**
 * Collect a post's downloadable files from its relationships, resolving each
 * media linkage against the `included` media map. The relationship the media
 * came through hints its kind (images→image, audio→audio, video→video,
 * attachments/post_file→by mimetype).
 */
export function collectFiles(
  post: RawPatreonPost,
  mediaById: Map<string, RawPatreonMedia>
): PostFile[] {
  const files: PostFile[] = []
  const seen = new Set<string>()
  const rels = post.relationships ?? {}

  const addFrom = (rel: Relationship | undefined, kindHint?: PostFileKind): void => {
    for (const link of linkagesOf(rel)) {
      if (link.type !== 'media' || seen.has(link.id)) continue
      const media = mediaById.get(link.id)
      if (!media) continue
      const pf = toPostFile(media, kindHint)
      if (!pf) continue
      seen.add(link.id)
      files.push(pf)
    }
  }

  addFrom(rels.images, 'image')
  addFrom(rels.audio, 'audio')
  addFrom(rels.video, 'video')
  addFrom(rels.attachments_media)
  addFrom(rels.post_file)
  addFrom(rels.media)

  return files
}

/**
 * Normalize a raw Patreon post + the response's media map into the shared Post,
 * or null if the viewer is not entitled to it (no accessible files).
 */
export function normalizePost(
  raw: RawPatreonPost,
  mediaById: Map<string, RawPatreonMedia>,
  creatorId: string
): Post | null {
  if (raw.attributes.current_user_can_view === false) return null
  const files = collectFiles(raw, mediaById)
  if (files.length === 0) return null
  const postedAt = new Date(raw.attributes.published_at ?? 0).toISOString()
  const { year, month } = toLocationParts(postedAt)
  return {
    serviceId: 'patreon',
    creatorId,
    postId: raw.id,
    title: raw.attributes.title?.trim() || `post-${raw.id}`,
    postedAt,
    year,
    month,
    url: raw.attributes.url || webPostUrl('patreon', creatorId, raw.id),
    files
  }
}

/** Build an id→media map from a JSON:API `included` array. */
export function mediaMapFromIncluded(
  included: Array<{ id: string; type: string }> | undefined
): Map<string, RawPatreonMedia> {
  const map = new Map<string, RawPatreonMedia>()
  for (const x of included ?? []) {
    if (x.type === 'media') map.set(x.id, x as RawPatreonMedia)
  }
  return map
}
