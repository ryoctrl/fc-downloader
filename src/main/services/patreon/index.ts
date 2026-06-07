/**
 * Patreon service adapter.
 *
 * Auth is via the user's interactive login in the embedded WebView; this
 * adapter reuses the resulting Patreon session cookies through ctx.fetchJson
 * against the site's internal JSON:API (www.patreon.com/api), the same API the
 * Patreon web client uses. Responses are JSON:API (`application/vnd.api+json`).
 *
 * Verified against the live API with a logged-in session (2026-06-08):
 *   - checkAuth: GET /api/current_user → 200 `{ data: { id, type: "user" } }`.
 *   - the current_user `memberships` / `pledges` relationships exist (they were
 *     empty for the probe account, which supported no campaigns).
 * The campaign-posts + media enumeration is structured from Patreon's JSON:API
 * but is marked `VERIFY:` until confirmed against an account with an active
 * pledge — see scripts/probe-patreon.cjs and docs/spec/service-abstraction.md.
 */
import type { Creator, Post } from '@shared/types'
import type { Service, ServiceContext } from '../types'
import {
  mediaMapFromIncluded,
  normalizePost,
  type RawPatreonMedia,
  type RawPatreonPost
} from './normalize'

const ORIGIN = 'https://www.patreon.com'
const API = `${ORIGIN}/api`

/** JSON:API expects a version param on the internal endpoints. */
const V = 'json-api-version=1.0'

interface JsonApiDoc<T> {
  data?: T
  included?: Array<{ id: string; type: string; attributes?: Record<string, unknown> }>
  links?: { next?: string | null }
}

interface RawCampaign {
  id: string
  type: 'campaign'
  attributes?: { name?: string; vanity?: string; avatar_photo_url?: string; url?: string }
}

export const patreonService: Service = {
  id: 'patreon',
  name: 'Patreon',
  homeUrl: `${ORIGIN}/home`,
  // Media is served from patreonusercontent.com via tokenized URLs; a Patreon
  // Referer keeps parity with the web client.
  downloadHeaders: { Referer: `${ORIGIN}/` },

  async checkAuth(ctx: ServiceContext): Promise<boolean> {
    try {
      // Verified: 200 `{ data: { id, type: "user" } }` when logged in; the
      // endpoint 401s (fetchJson throws) otherwise.
      const res = await ctx.fetchJson<JsonApiDoc<{ id?: string; type?: string }>>(
        `${API}/current_user?${V}`
      )
      return res?.data?.type === 'user' && !!res.data.id
    } catch (err) {
      ctx.log('debug', 'checkAuth failed (treating as logged out)', err)
      return false
    }
  },

  async listCreators(ctx: ServiceContext): Promise<Creator[]> {
    // The campaigns a user supports are reachable through the current_user
    // memberships + pledges relationships; the campaign resources arrive in
    // `included`. (VERIFY: confirm against an account with active pledges.)
    const include = ['memberships.campaign.creator', 'pledges.campaign.creator'].join(',')
    const fields = [
      'fields[campaign]=name,url,avatar_photo_url,vanity',
      'fields[user]=full_name,image_url,url,vanity'
    ].join('&')
    try {
      const res = await ctx.fetchJson<JsonApiDoc<unknown>>(
        `${API}/current_user?${V}&include=${encodeURIComponent(include)}&${fields}`
      )
      const byId = new Map<string, Creator>()
      for (const inc of res.included ?? []) {
        if (inc.type !== 'campaign') continue
        const c = inc as RawCampaign
        if (byId.has(c.id)) continue
        byId.set(c.id, {
          serviceId: 'patreon',
          creatorId: c.id,
          name: c.attributes?.name || c.attributes?.vanity || `campaign-${c.id}`,
          iconUrl: c.attributes?.avatar_photo_url
        })
      }
      return [...byId.values()]
    } catch (err) {
      ctx.log('error', 'listCreators failed', err)
      return []
    }
  },

  async *listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post> {
    // VERIFY: /api/posts?filter[campaign_id]=... returns a JSON:API page of
    // posts with their media in `included`, cursor-paginated via links.next.
    const include = ['images', 'audio', 'video', 'attachments_media', 'media', 'post_file'].join(
      ','
    )
    const fields = [
      'fields[post]=title,published_at,post_type,url,current_user_can_view',
      'fields[media]=download_url,file_name,mimetype,size_bytes,image_urls'
    ].join('&')
    let nextUrl: string | null =
      `${API}/posts?${V}` +
      `&filter[campaign_id]=${encodeURIComponent(creatorId)}` +
      `&filter[contains_exclusive_posts]=true&sort=-published_at` +
      `&include=${encodeURIComponent(include)}&${fields}&page[count]=20`

    let guard = 0
    while (nextUrl && guard++ < 500) {
      ctx.signal.throwIfAborted()
      let doc: JsonApiDoc<RawPatreonPost[]>
      try {
        doc = await ctx.fetchJson<JsonApiDoc<RawPatreonPost[]>>(nextUrl)
      } catch (err) {
        ctx.log('warn', `posts page failed for campaign ${creatorId}`, err)
        return
      }
      const mediaById: Map<string, RawPatreonMedia> = mediaMapFromIncluded(doc.included)
      for (const raw of doc.data ?? []) {
        ctx.signal.throwIfAborted()
        const post = normalizePost(raw, mediaById, creatorId)
        if (post) yield post
      }
      nextUrl = doc.links?.next ?? null
    }
  },

  async resolvePost(_ctx: ServiceContext, post: Post): Promise<Post> {
    // listPosts already attaches full media from each page's `included`.
    return post
  }
}
