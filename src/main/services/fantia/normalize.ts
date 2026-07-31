/**
 * Pure normalization of a Fantia `/api/v1/posts/{id}` response into the shared
 * Post shape. Separated from the network code so it can be unit-tested against
 * saved fixtures.
 *
 * NOTE: Fantia has no official public API. The shapes below mirror the site's
 * internal endpoints and are marked `VERIFY:` where they must be confirmed
 * against a real response. See docs/spec/service-abstraction.md.
 */
import type { Post, PostFile } from '@shared/types'
import { toLocationParts } from '@main/storage/layout'
import { kindForName } from '@main/storage/files'
import { webPostUrl } from '../postUrl'

const BASE = 'https://fantia.jp'

/** VERIFY: a photo inside a photo_gallery content. */
export interface RawFantiaPhoto {
  id: number
  url?: { original?: string; main?: string }
}

/** VERIFY: a shop product embedded in a post (`product` content block). */
export interface RawFantiaProduct {
  /** Shop product id — the same id `/products/<id>/download` takes. */
  id?: number
  name?: string
  /** 'download' for a downloadable product (vs physical goods etc). */
  type?: string
  uri?: string
}

/** VERIFY: one content block of a post (varies by `category`). */
export interface RawFantiaContent {
  id: number
  category?: string // 'photo_gallery' | 'file' | 'blog' | 'product' | 'url' | ...
  title?: string
  filename?: string
  /** File download path for `file` contents (often root-relative). */
  download_uri?: string
  post_content_photos?: RawFantiaPhoto[]
  /** Present on `product` contents: the shop product being advertised. */
  product?: RawFantiaProduct
}

/** VERIFY: subset of the post detail body we consume. */
export interface RawFantiaPost {
  id: number
  title: string
  posted_at: string
  /** The post's own header image, in several sizes (`original` is full size). */
  thumb?: { original?: string; main?: string; large?: string; medium?: string }
  fanclub?: { id?: number; creator_name?: string; fanclub_name?: string }
  post_contents?: RawFantiaContent[]
}

export interface RawFantiaPostResponse {
  post?: RawFantiaPost
}

/** VERIFY: a fanclub plan as returned by `/api/v1/fanclubs/{id}`. The plan the
 *  user is on has `order.status === 'joined'`; a ¥0 plan is the free tier. */
export interface RawFantiaPlan {
  price?: number
  order?: { status?: string } | null
}

/**
 * Paid vs free relationship for a fanclub, from its plans.
 * The user's current plan is the one with `order.status === 'joined'`:
 *  - a joined plan with `price > 0`  → 支援中 (paid)  → true
 *  - only a ¥0 joined plan (無料プラン) → フォロー中 (free) → false
 *  - no joined plan found            → unknown        → undefined
 */
export function fanclubSupporting(plans: RawFantiaPlan[] | undefined): boolean | undefined {
  const joined = (plans ?? []).filter((p) => p?.order?.status === 'joined')
  if (joined.length === 0) return undefined
  return joined.some((p) => (p.price ?? 0) > 0)
}

/** Make a possibly root-relative Fantia URL absolute. */
export function absolutize(uri: string): string {
  if (!uri) return ''
  if (/^https?:\/\//.test(uri)) return uri
  return `${BASE}${uri.startsWith('/') ? '' : '/'}${uri}`
}

function extFromUrl(url: string): string {
  const path = url.split('?')[0]
  const slash = path.lastIndexOf('/')
  const name = slash >= 0 ? path.slice(slash + 1) : path
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : '.jpg'
}

/**
 * Collect downloadable files from a post: its own header image, then the
 * images/files of each content block.
 *
 * The post's header image (`thumb`) is a separate upload from the gallery
 * photos and is often the only image a post has (e.g. a video or product post),
 * so it's collected too — and first, so it becomes the post's cover in the
 * library. Shop products advertised by a post are NOT collected here; they're
 * bought items and come from the order history (see purchases.ts).
 */
export function collectFiles(post: RawFantiaPost): PostFile[] {
  const out: PostFile[] = []
  const seen = new Set<string>()
  const push = (pf: PostFile): void => {
    if (!pf.url || seen.has(pf.fileId)) return
    seen.add(pf.fileId)
    out.push(pf)
  }

  const thumbUrl = absolutize(
    post.thumb?.original ?? post.thumb?.main ?? post.thumb?.large ?? post.thumb?.medium ?? ''
  )
  if (thumbUrl) {
    push({ fileId: `thumb-${post.id}`, kind: 'image', name: `thumb${extFromUrl(thumbUrl)}`, url: thumbUrl })
  }

  for (const c of post.post_contents ?? []) {
    if (c.category === 'photo_gallery') {
      for (const photo of c.post_content_photos ?? []) {
        const url = absolutize(photo.url?.original ?? photo.url?.main ?? '')
        if (!url) continue
        push({ fileId: `${c.id}-${photo.id}`, kind: 'image', name: `${photo.id}${extFromUrl(url)}`, url })
      }
    } else if (c.category === 'file') {
      const url = absolutize(c.download_uri ?? '')
      const name = c.filename ?? `file-${c.id}`
      push({ fileId: String(c.id), kind: kindForName(name), name, url })
    }
    // 'blog' / 'product' / 'url' / 'text' carry no binary we download here.
  }
  return out
}

export function normalizePost(creatorId: string, raw: RawFantiaPostResponse): Post | null {
  const p = raw.post
  if (!p) return null
  const postedAt = new Date(p.posted_at).toISOString()
  const { year, month } = toLocationParts(postedAt)
  return {
    serviceId: 'fantia',
    // Group under the fanclub used for enumeration (matches creator-name map).
    creatorId,
    postId: String(p.id),
    title: p.title,
    postedAt,
    year,
    month,
    url: webPostUrl('fantia', creatorId, String(p.id)),
    files: collectFiles(p)
  }
}
