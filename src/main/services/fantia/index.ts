/**
 * Fantia service adapter.
 *
 * Auth is via the user's interactive login in the embedded WebView; this
 * adapter reuses the resulting session cookies through ctx.fetchJson. Media is
 * served with a Fantia Referer requirement (see `downloadHeaders`).
 *
 * Fantia has no official public API — endpoint paths/shapes are based on the
 * site's internal XHR and are marked `VERIFY:`. Confirming them requires a real
 * logged-in account (an external dependency); until then listCreators/listPosts
 * degrade to empty results. See docs/spec/service-abstraction.md.
 */
import type { Creator, Post } from '@shared/types'
import type { Service, ServiceContext } from '../types'
import { normalizePost, type RawFantiaPostResponse } from './normalize'

const BASE = 'https://fantia.jp'
const API = `${BASE}/api/v1`

export const fantiaService: Service = {
  id: 'fantia',
  name: 'Fantia',
  homeUrl: `${BASE}/`,
  // Fantia media is served from a CDN that requires a Fantia Referer.
  downloadHeaders: { Referer: `${BASE}/` },

  async checkAuth(ctx: ServiceContext): Promise<boolean> {
    try {
      // VERIFY: /api/v1/me returns the current user (with id) when logged in.
      const me = await ctx.fetchJson<{ id?: number } | null>(`${API}/me`)
      return !!me && typeof me.id === 'number'
    } catch (err) {
      ctx.log('debug', 'checkAuth failed (treating as logged out)', err)
      return false
    }
  },

  async listCreators(ctx: ServiceContext): Promise<Creator[]> {
    // VERIFY: endpoint listing the fanclubs the user supports. The JSON shape
    // below is assumed; many Fantia mypage views are HTML and may need scraping.
    try {
      const res = await ctx.fetchJson<{ fanclubs?: RawFanclub[] }>(`${API}/me/fanclubs`)
      return (res.fanclubs ?? []).map((f) => ({
        serviceId: 'fantia' as const,
        creatorId: String(f.id),
        name: f.creator_name ?? f.fanclub_name ?? String(f.id),
        iconUrl: f.icon?.main
      }))
    } catch (err) {
      ctx.log('error', 'listCreators failed', err)
      return []
    }
  },

  async *listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post> {
    // VERIFY: fanclub post listing + pagination, then per-post detail.
    let page = 1
    for (;;) {
      ctx.signal.throwIfAborted()
      let ids: string[]
      try {
        ids = await fetchPostIds(ctx, creatorId, page)
      } catch (err) {
        ctx.log('error', `listPosts page ${page} failed for ${creatorId}`, err)
        return
      }
      if (ids.length === 0) return
      for (const id of ids) {
        ctx.signal.throwIfAborted()
        const post = await fetchPostDetail(ctx, creatorId, id)
        if (post) yield post
      }
      page += 1
    }
  },

  async resolvePost(_ctx: ServiceContext, post: Post): Promise<Post> {
    // listPosts already fetches full detail per post.
    return post
  }
}

/** VERIFY: a supported fanclub entry. */
interface RawFanclub {
  id: number
  creator_name?: string
  fanclub_name?: string
  icon?: { main?: string }
}

/** VERIFY: a page of post ids for a fanclub. */
async function fetchPostIds(ctx: ServiceContext, fanclubId: string, page: number): Promise<string[]> {
  // VERIFY: real listing endpoint & pagination. Assumes a JSON summary list;
  // if the live listing is HTML, parse post anchors here instead.
  const res = await ctx.fetchJson<{ posts?: Array<{ id: number }> }>(
    `${API}/fanclubs/${encodeURIComponent(fanclubId)}/posts?page=${page}`
  )
  return (res.posts ?? []).map((p) => String(p.id))
}

async function fetchPostDetail(
  ctx: ServiceContext,
  creatorId: string,
  postId: string
): Promise<Post | null> {
  try {
    // VERIFY: the post detail endpoint and its response body shape.
    const raw = await ctx.fetchJson<RawFantiaPostResponse>(
      `${API}/posts/${encodeURIComponent(postId)}`
    )
    return normalizePost(creatorId, raw)
  } catch (err) {
    ctx.log('warn', `post.info ${postId} failed`, err)
    return null
  }
}
