/**
 * pixiv FANBOX service adapter.
 *
 * Auth is via the user's interactive login in the embedded WebView; this
 * adapter reuses the resulting `FANBOXSESSID` cookie through ctx.fetchJson.
 * api.fanbox.cc requires an `Origin: https://www.fanbox.cc` header, and the
 * media CDN requires a `Referer` (see `downloadHeaders`).
 *
 * Fanbox has no official public API; the endpoints/shapes below were verified
 * against the live api.fanbox.cc with a logged-in session (2026-06-07) — see
 * scripts/probe-fanbox.cjs and docs/spec/service-abstraction.md.
 */
import type { Creator, Post } from '@shared/types'
import type { Service, ServiceContext } from '../types'
import { normalizePost, type RawFanboxPost } from './normalize'

const API = 'https://api.fanbox.cc'
const ORIGIN = 'https://www.fanbox.cc'

/** Headers required by the JSON API (cookies are applied by the session). */
const apiHeaders: Record<string, string> = { Origin: ORIGIN, Referer: `${ORIGIN}/` }

export const fanboxService: Service = {
  id: 'fanbox',
  name: 'pixiv FANBOX',
  homeUrl: `${ORIGIN}/`,
  // Media is served from pximg, which 403s without a fanbox Referer.
  downloadHeaders: { Referer: `${ORIGIN}/` },

  async checkAuth(ctx: ServiceContext): Promise<boolean> {
    try {
      // Verified: returns 200 `{ body: <number> }` when logged in, and HTTP 400
      // `{ error: "general_error" }` otherwise (fetchJson throws on >= 400).
      const res = await ctx.fetchJson<{ body?: unknown }>(`${API}/user.countUnreadMessages`, {
        headers: apiHeaders
      })
      return !!res && Object.prototype.hasOwnProperty.call(res, 'body')
    } catch (err) {
      ctx.log('debug', 'checkAuth failed (treating as logged out)', err)
      return false
    }
  },

  async listCreators(ctx: ServiceContext): Promise<Creator[]> {
    // Verified: plan.listSupporting -> `{ body: [{ creatorId, user: { name,
    // iconUrl }, ... }] }`. (Free follows would come from creator.listFollowing;
    // supported plans are the downloadable case.)
    try {
      const res = await ctx.fetchJson<{ body?: RawSupportingPlan[] }>(
        `${API}/plan.listSupporting`,
        { headers: apiHeaders }
      )
      const plans = res.body ?? []
      // De-dupe by creatorId (a creator can have multiple plans).
      const byCreator = new Map<string, Creator>()
      for (const plan of plans) {
        if (!byCreator.has(plan.creatorId)) {
          byCreator.set(plan.creatorId, {
            serviceId: 'fanbox',
            creatorId: plan.creatorId,
            name: plan.user?.name ?? plan.creatorId,
            iconUrl: plan.user?.iconUrl
          })
        }
      }
      return [...byCreator.values()]
    } catch (err) {
      ctx.log('error', 'listCreators failed', err)
      return []
    }
  },

  async *listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post> {
    // Verified pagination: post.paginateCreator returns `{ body: [pageUrl, ...] }`
    // (cursor-based). Each page URL returns `{ body: [postSummary, ...] }`.
    let pageUrls: string[]
    try {
      const pag = await ctx.fetchJson<{ body?: string[] }>(
        `${API}/post.paginateCreator?creatorId=${encodeURIComponent(creatorId)}`,
        { headers: apiHeaders }
      )
      pageUrls = pag.body ?? []
    } catch (err) {
      ctx.log('error', `post.paginateCreator failed for ${creatorId}`, err)
      return
    }
    for (const pageUrl of pageUrls) {
      ctx.signal.throwIfAborted()
      let items: Array<{ id: string }>
      try {
        const page = await ctx.fetchJson<{ body?: Array<{ id: string }> }>(pageUrl, {
          headers: apiHeaders
        })
        items = page.body ?? []
      } catch (err) {
        ctx.log('warn', `post.listCreator page failed for ${creatorId}`, err)
        continue
      }
      for (const item of items) {
        ctx.signal.throwIfAborted()
        const post = await fetchPostDetail(ctx, item.id)
        if (post) yield post
      }
    }
  },

  async countPosts(ctx: ServiceContext, creatorId: string): Promise<number> {
    // Sum the page-list lengths (post summaries) WITHOUT fetching post.info per
    // post — the same pages listPosts walks, just counted.
    const pag = await ctx.fetchJson<{ body?: string[] }>(
      `${API}/post.paginateCreator?creatorId=${encodeURIComponent(creatorId)}`,
      { headers: apiHeaders }
    )
    const pageUrls = pag.body ?? []
    let n = 0
    for (const pageUrl of pageUrls) {
      ctx.signal.throwIfAborted()
      const page = await ctx.fetchJson<{ body?: Array<{ id: string }> }>(pageUrl, {
        headers: apiHeaders
      })
      n += (page.body ?? []).length
    }
    return n
  },

  async resolvePost(_ctx: ServiceContext, post: Post): Promise<Post> {
    // listPosts already fetches full detail per post.
    return post
  }
}

/** VERIFY: shape of a plan.listSupporting entry (subset). */
interface RawSupportingPlan {
  creatorId: string
  user?: { userId?: string; name?: string; iconUrl?: string }
}

async function fetchPostDetail(ctx: ServiceContext, postId: string): Promise<Post | null> {
  try {
    // VERIFY: post.info detail endpoint and its response body shape.
    const res = await ctx.fetchJson<{ body?: RawFanboxPost }>(
      `${API}/post.info?postId=${encodeURIComponent(postId)}`,
      { headers: apiHeaders }
    )
    return res.body ? normalizePost(res.body) : null
  } catch (err) {
    ctx.log('warn', `post.info ${postId} failed`, err)
    return null
  }
}
