/**
 * Fantia service adapter (MVP target).
 *
 * NOTE ON ENDPOINTS: Fantia has no official public API. The endpoint paths and
 * response shapes below are based on the site's internal XHR endpoints and MUST
 * be verified against the live site before trusting them in production. Each
 * spot that needs verification is marked with `VERIFY:`. See
 * docs/spec/service-abstraction.md for the verification workflow.
 *
 * Authentication is handled entirely by the user logging in through the
 * embedded WebView; this adapter only reuses the resulting session cookies via
 * ctx.fetchJson/fetchText.
 */
import type { Creator, Post, PostFile } from '@shared/types'
import type { Service, ServiceContext } from '../types'
import { toLocationParts } from '@main/storage/layout'

const BASE = 'https://fantia.jp'

export const fantiaService: Service = {
  id: 'fantia',
  name: 'Fantia',
  homeUrl: `${BASE}/`,

  async checkAuth(ctx: ServiceContext): Promise<boolean> {
    try {
      // VERIFY: a lightweight authenticated endpoint. The session/me endpoint
      // returns the current user when logged in, 401/redirect otherwise.
      const me = await ctx.fetchJson<{ id?: number }>(`${BASE}/api/v1/me`)
      return typeof me?.id === 'number'
    } catch (err) {
      ctx.log('debug', 'checkAuth failed (treating as logged out)', err)
      return false
    }
  },

  async listCreators(ctx: ServiceContext): Promise<Creator[]> {
    // VERIFY: endpoint that lists the fanclubs the user follows/supports.
    // Likely an HTML page (/mypage/users/following) that needs scraping, or a
    // JSON endpoint. Returning [] keeps the pipeline working until implemented.
    ctx.log('warn', 'Fantia.listCreators is not yet implemented (VERIFY endpoint)')
    return []
  },

  async *listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post> {
    // VERIFY: fanclub post listing + pagination. The shape below is a sketch.
    let page = 1
    for (;;) {
      ctx.signal.throwIfAborted()
      // VERIFY: real listing endpoint & pagination params.
      const url = `${BASE}/fanclubs/${creatorId}/posts?page=${page}`
      let html: string
      try {
        html = await ctx.fetchText(url)
      } catch (err) {
        ctx.log('error', `listPosts page ${page} failed`, err)
        return
      }
      const ids = parsePostIdsFromListing(html)
      if (ids.length === 0) return
      for (const postId of ids) {
        ctx.signal.throwIfAborted()
        const post = await fetchPostDetail(ctx, creatorId, postId)
        if (post) yield post
      }
      page += 1
    }
  },

  async resolvePost(_ctx: ServiceContext, post: Post): Promise<Post> {
    // listPosts already fetches full detail per post, so this is an identity.
    return post
  }
}

/** VERIFY: extract post ids from a fanclub listing page. */
function parsePostIdsFromListing(_html: string): string[] {
  // TODO: parse anchors like /posts/{id}. Kept as a stub to be filled in with a
  // real fixture in src/main/services/fantia/__tests__.
  return []
}

/** Fetch and normalize a single post into the shared Post shape. */
async function fetchPostDetail(
  ctx: ServiceContext,
  creatorId: string,
  postId: string
): Promise<Post | null> {
  try {
    // VERIFY: the post detail JSON endpoint and its response shape.
    const raw = await ctx.fetchJson<RawFantiaPost>(`${BASE}/api/v1/posts/${postId}`)
    return normalizePost(creatorId, raw)
  } catch (err) {
    ctx.log('warn', `fetchPostDetail ${postId} failed`, err)
    return null
  }
}

/** VERIFY: shape of the Fantia post detail response (subset we consume). */
interface RawFantiaPost {
  post?: {
    id: number
    title: string
    posted_at: string
    post_contents?: Array<{
      id: number
      category?: string
      filename?: string
      // ... media fields vary by content type (photo_gallery, file, etc.)
    }>
  }
}

function normalizePost(creatorId: string, raw: RawFantiaPost): Post | null {
  const p = raw.post
  if (!p) return null
  const postedAt = new Date(p.posted_at).toISOString()
  const { year, month } = toLocationParts(postedAt)
  const files: PostFile[] = (p.post_contents ?? []).map((c) => ({
    fileId: String(c.id),
    kind: 'file', // VERIFY: map c.category -> PostFileKind
    name: c.filename ?? `content-${c.id}`,
    url: '' // VERIFY: resolve the actual download URL per content type
  }))
  return {
    serviceId: 'fantia',
    creatorId,
    postId: String(p.id),
    title: p.title,
    postedAt,
    year,
    month,
    files
  }
}
