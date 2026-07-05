/**
 * Fantia service adapter.
 *
 * Auth is via the user's interactive login in the embedded WebView; this
 * adapter reuses the resulting `_session_id` cookie. The endpoints/shapes below
 * were verified against the live fantia.jp with a logged-in session
 * (2026-06-08) — see scripts/probe-fantia.cjs.
 *
 * Notable quirks (vs Fanbox):
 * - `GET /api/v1/me` returns `{ current_user: { id, ... } }` (200) when logged
 *   in, 401 otherwise.
 * - The per-fanclub post listing is the **HTML** page
 *   `/fanclubs/{id}/posts?page=N` (NO `X-Requested-With` header, else JSON 404);
 *   we scrape `/posts/{id}` links from it.
 * - `GET /api/v1/posts/{id}` requires an `X-CSRF-Token` header (taken from the
 *   `<meta name="csrf-token">` on any HTML page) — without it, 403.
 */
import type { Creator, Post } from '@shared/types'
import type { Service, ServiceContext } from '../types'
import {
  fanclubSupporting,
  normalizePost,
  type RawFantiaPlan,
  type RawFantiaPostResponse
} from './normalize'

const BASE = 'https://fantia.jp'
const API = `${BASE}/api/v1`
const XHR = { 'X-Requested-With': 'XMLHttpRequest' }

function extractCsrf(html: string): string {
  const m = html.match(/<meta name="csrf-token" content="([^"]+)"/)
  return m ? m[1] : ''
}

export const fantiaService: Service = {
  id: 'fantia',
  name: 'Fantia',
  homeUrl: `${BASE}/`,
  downloadHeaders: { Referer: `${BASE}/` },

  async checkAuth(ctx: ServiceContext): Promise<boolean> {
    try {
      const me = await ctx.fetchJson<{ current_user?: { id?: number } }>(`${API}/me`, {
        headers: XHR
      })
      return typeof me?.current_user?.id === 'number'
    } catch (err) {
      ctx.log('debug', 'checkAuth failed (treating as logged out)', err)
      return false
    }
  },

  async listCreators(ctx: ServiceContext): Promise<Creator[]> {
    let ids: number[]
    try {
      const res = await ctx.fetchJson<{ fanclub_ids?: number[] }>(`${API}/me/fanclubs`, {
        headers: XHR
      })
      ids = res.fanclub_ids ?? []
    } catch (err) {
      ctx.log('error', 'listCreators (me/fanclubs) failed', err)
      return []
    }
    // Resolve each fanclub's display name with bounded concurrency (keeps the
    // listing fast without hammering Fantia with 48 simultaneous requests).
    const creators: Creator[] = new Array(ids.length)
    let next = 0
    const LIMIT = 5
    const worker = async (): Promise<void> => {
      while (next < ids.length) {
        const i = next++
        const id = ids[i]
        ctx.signal.throwIfAborted()
        let name = String(id)
        let iconUrl: string | undefined
        let supporting: boolean | undefined
        try {
          const fc = await ctx.fetchJson<{
            fanclub?: {
              fanclub_name?: string
              creator_name?: string
              icon?: { main?: string }
              plans?: RawFantiaPlan[]
            }
          }>(`${API}/fanclubs/${id}`, { headers: XHR })
          name = fc.fanclub?.fanclub_name || fc.fanclub?.creator_name || String(id)
          iconUrl = fc.fanclub?.icon?.main
          // Paid(支援中) vs free(フォロー中) from the joined plan's price.
          supporting = fanclubSupporting(fc.fanclub?.plans)
        } catch (err) {
          ctx.log('debug', `fanclub ${id} name lookup failed`, err)
        }
        creators[i] = { serviceId: 'fantia', creatorId: String(id), name, iconUrl, supporting }
      }
    }
    await Promise.all(Array.from({ length: Math.min(LIMIT, ids.length) }, worker))
    return creators
  },

  async *listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post> {
    let csrf = ''
    const seen = new Set<string>()
    const MAX_PAGES = 500 // safety against stray links never terminating
    for (let page = 1; page <= MAX_PAGES; page++) {
      ctx.signal.throwIfAborted()
      let html: string
      try {
        // HTML listing — must NOT send the XHR header (otherwise JSON 404).
        html = await ctx.fetchText(`${BASE}/fanclubs/${encodeURIComponent(creatorId)}/posts?page=${page}`)
      } catch (err) {
        ctx.log('error', `fanclub posts page ${page} failed for ${creatorId}`, err)
        return
      }
      if (!csrf) csrf = extractCsrf(html)
      const ids = [...new Set([...html.matchAll(/\/posts\/(\d+)/g)].map((m) => m[1]))]
      const fresh = ids.filter((id) => !seen.has(id))
      if (fresh.length === 0) return // no new posts on this page -> done
      for (const id of fresh) {
        seen.add(id)
        ctx.signal.throwIfAborted()
        // Already fully downloaded for this run's kinds? Skip the post-detail
        // API call (rate-limited) and let the engine skip it from the ledger.
        const stub = ctx.completedPostStub?.(creatorId, id)
        if (stub) {
          yield stub
          continue
        }
        const post = await fetchPostDetail(ctx, creatorId, id, csrf)
        if (post) yield post
      }
    }
  },

  async countPosts(ctx: ServiceContext, creatorId: string): Promise<number> {
    // Walk the same HTML listing pages as listPosts, counting /posts/<id> links
    // (no per-post detail fetch).
    const seen = new Set<string>()
    const MAX_PAGES = 500
    for (let page = 1; page <= MAX_PAGES; page++) {
      ctx.signal.throwIfAborted()
      const html = await ctx.fetchText(
        `${BASE}/fanclubs/${encodeURIComponent(creatorId)}/posts?page=${page}`
      )
      const ids = [...new Set([...html.matchAll(/\/posts\/(\d+)/g)].map((m) => m[1]))]
      const fresh = ids.filter((id) => !seen.has(id))
      if (fresh.length === 0) return seen.size
      fresh.forEach((id) => seen.add(id))
    }
    return seen.size
  },

  async resolvePost(_ctx: ServiceContext, post: Post): Promise<Post> {
    return post
  }
}

async function fetchPostDetail(
  ctx: ServiceContext,
  creatorId: string,
  postId: string,
  csrf: string
): Promise<Post | null> {
  try {
    const res = await ctx.fetchJson<RawFantiaPostResponse>(`${API}/posts/${encodeURIComponent(postId)}`, {
      headers: { ...XHR, 'X-CSRF-Token': csrf }
    })
    return normalizePost(creatorId, res)
  } catch (err) {
    ctx.log('warn', `post ${postId} detail failed`, err)
    return null
  }
}
