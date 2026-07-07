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
import type { RecentPost, Service, ServiceContext } from '../types'
import {
  collectDownloadableCreators,
  normalizePost,
  type RawFanboxPost,
  type RawFollowedCreator,
  type RawSupportingPlan
} from './normalize'

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
    // Downloadable creators come from two sources, merged & de-duped:
    //   1. plan.listSupporting     -> `{ body: [{ creatorId, user, ... }] }`
    //      creators with an active PAID plan.
    //   2. creator.listFollowing   -> `{ body: { creators: [{ creatorId, user,
    //      isSupported, isStopped, ... }] } }` — everyone the user follows.
    // (1) alone misses creators whose paid support was stopped but is still
    // valid until month-end, and creators downgraded to a free plan (now just
    // followed) — those only appear in (2). Each source is fetched
    // independently so one failing still yields the other's creators.
    const supporting = await ctx
      .fetchJson<{ body?: RawSupportingPlan[] }>(`${API}/plan.listSupporting`, {
        headers: apiHeaders
      })
      .then((res) => res.body ?? [])
      .catch((err) => {
        ctx.log('error', 'plan.listSupporting failed', err)
        return [] as RawSupportingPlan[]
      })
    const following = await ctx
      .fetchJson<{ body?: { creators?: RawFollowedCreator[] } | RawFollowedCreator[] }>(
        `${API}/creator.listFollowing`,
        { headers: apiHeaders }
      )
      .then((res) => (Array.isArray(res.body) ? res.body : res.body?.creators ?? []))
      .catch((err) => {
        ctx.log('warn', 'creator.listFollowing failed', err)
        return [] as RawFollowedCreator[]
      })
    return collectDownloadableCreators(supporting, following)
  },

  async *recentPosts(ctx: ServiceContext, maxPages: number): AsyncIterable<RecentPost> {
    // Verified: post.listHome -> `{ body: { items: [{ id, creatorId,
    // publishedDatetime, isRestricted, ... }], nextUrl } }` — the reverse-chron
    // timeline across supported + followed creators. `isRestricted` marks posts
    // the viewer can't access (so they aren't "downloadable new").
    let url: string | null = `${API}/post.listHome?limit=30`
    for (let page = 0; page < maxPages && url; page++) {
      ctx.signal.throwIfAborted()
      let body: { items?: RawHomeItem[]; nextUrl?: string | null }
      try {
        const res = await ctx.fetchJson<{ body?: typeof body }>(url, { headers: apiHeaders })
        body = res.body ?? {}
      } catch (err) {
        ctx.log('warn', 'post.listHome failed', err)
        return
      }
      for (const it of body.items ?? []) {
        if (!it.creatorId || !it.id) continue
        yield { creatorId: it.creatorId, postId: it.id, accessible: !it.isRestricted }
      }
      url = body.nextUrl ?? null
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

/** VERIFY: subset of a post.listHome item. */
interface RawHomeItem {
  id: string
  creatorId: string
  publishedDatetime?: string
  isRestricted?: boolean
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
