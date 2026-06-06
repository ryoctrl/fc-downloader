/**
 * pixiv FANBOX service adapter.
 *
 * Auth is via the user's interactive login in the embedded WebView; this
 * adapter reuses the resulting `FANBOXSESSID` cookie through ctx.fetchJson.
 * api.fanbox.cc requires an `Origin: https://www.fanbox.cc` header, and the
 * media CDN requires a `Referer` (see `downloadHeaders`).
 *
 * Fanbox has no official public API — endpoint paths/shapes are based on the
 * site's internal XHR and are marked `VERIFY:`. See
 * docs/spec/service-abstraction.md for the verification workflow.
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
      // VERIFY: a lightweight authenticated endpoint. Returns { body: { count } }
      // when logged in; 401 otherwise.
      const res = await ctx.fetchJson<{ body?: { count?: number } }>(
        `${API}/user.countUnreadMessages`,
        { headers: apiHeaders }
      )
      return !!res && typeof res.body?.count === 'number'
    } catch (err) {
      ctx.log('debug', 'checkAuth failed (treating as logged out)', err)
      return false
    }
  },

  async listCreators(ctx: ServiceContext): Promise<Creator[]> {
    // VERIFY: plans the user supports. Followed (free) creators would come from
    // creator.listFollowing; supported is the primary case for downloading.
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
    // VERIFY: post.listCreator returns a page of summaries + a nextUrl cursor.
    let url: string | null = `${API}/post.listCreator?creatorId=${encodeURIComponent(creatorId)}&limit=50`
    while (url) {
      ctx.signal.throwIfAborted()
      let page: { body?: { items?: Array<{ id: string }>; nextUrl?: string | null } }
      try {
        page = await ctx.fetchJson(url, { headers: apiHeaders })
      } catch (err) {
        ctx.log('error', `post.listCreator failed for ${creatorId}`, err)
        return
      }
      const items = page.body?.items ?? []
      for (const item of items) {
        ctx.signal.throwIfAborted()
        const post = await fetchPostDetail(ctx, item.id)
        if (post) yield post
      }
      url = page.body?.nextUrl ?? null
    }
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
