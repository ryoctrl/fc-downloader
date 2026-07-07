/**
 * ci-en (ci-en.dlsite.com) service adapter.
 *
 * NOTE: ci-en migrated from `ci-en.net` to `ci-en.dlsite.com`. `ci-en.net` now
 * 301-redirects to the new domain, but session cookies do NOT survive that
 * cross-domain redirect — fetching the old domain returns the logged-out
 * (guest) page, so new posts' gated media is missing. We therefore target the
 * new domain directly; users must re-login once so the persist:cien partition
 * holds ci-en.dlsite.com cookies. Media is still served from media.ci-en.jp.
 *
 * ci-en renders server-side HTML rather than exposing a JSON API, so this
 * adapter scrapes it using the user's interactive-login session cookies
 * (persist:cien) via ctx.fetchText. Parsing lives in ./parse.ts so it can be
 * unit-tested against fixtures.
 *
 * Verified against the live site with a logged-in session (2026-06-08) — see
 * scripts/probe-cien.cjs:
 *   - checkAuth: GET /mypage carries the authed user-menu links (/logout,
 *     /mypage/setting); logged out it lacks them (redirects to login).
 *   - listCreators: GET /mypage/subscription lists subscribed `/creator/<id>`.
 *   - listPosts: GET /creator/<id>/article?page=N paginates article links.
 *   - article media: gated files at media.ci-en.jp/private/attachment/... with
 *     signed px-time/px-hash params; the `upload/<name>` variant is the original.
 */
import type { Creator, Post } from '@shared/types'
import type { RecentPost, Service, ServiceContext } from '../types'
import { toLocationParts } from '@main/storage/layout'
import { webPostUrl } from '../postUrl'
import {
  mergeSubscriptionTiers,
  parseArticleDate,
  parseArticleIds,
  parseArticleTitle,
  parseAttachments,
  parseCreatorIcon,
  parseCreatorIds,
  parseCreatorName,
  parseRecentArticleRefs
} from './parse'

const BASE = 'https://ci-en.dlsite.com'

export const cienService: Service = {
  id: 'cien',
  name: 'ci-en',
  homeUrl: `${BASE}/`,
  // Gated media is signed (px-hash); a ci-en Referer keeps parity with the site.
  downloadHeaders: { Referer: `${BASE}/` },

  async checkAuth(ctx: ServiceContext): Promise<boolean> {
    try {
      // Verified (2026-06-08): the authed /mypage carries the user-menu links
      // (/logout + /mypage/setting); logged out it lacks them. Checking both
      // avoids false positives from an unrelated "/logout" substring.
      const html = await ctx.fetchText(`${BASE}/mypage`)
      return html.includes('/logout') && html.includes('/mypage/setting')
    } catch (err) {
      ctx.log('debug', 'checkAuth failed (treating as logged out)', err)
      return false
    }
  },

  async listCreators(ctx: ServiceContext): Promise<Creator[]> {
    // The subscription page is split into tabs, each its own URL:
    //   /mypage/subscription          サポート中      (paid, supporting)
    //   /mypage/subscription/history  サポート経験あり (past support — free now)
    //   /mypage/subscription/following フォロー        (free follow)
    // The default page alone misses the last two, so walk all three and tag the
    // tier by source. Each tab is fetched independently so one failing still
    // yields the others.
    const tabs: Array<{ url: string; supporting: boolean }> = [
      { url: `${BASE}/mypage/subscription`, supporting: true },
      { url: `${BASE}/mypage/subscription/history`, supporting: false },
      { url: `${BASE}/mypage/subscription/following`, supporting: false }
    ]
    const pages: Array<{ ids: string[]; supporting: boolean }> = []
    for (const tab of tabs) {
      ctx.signal.throwIfAborted()
      try {
        const html = await ctx.fetchText(tab.url)
        pages.push({ ids: parseCreatorIds(html), supporting: tab.supporting })
      } catch (err) {
        ctx.log('warn', `listCreators: subscription tab failed (${tab.url})`, err)
      }
    }
    if (pages.length === 0) {
      ctx.log('error', 'listCreators: all subscription tabs failed')
      return []
    }

    const creators: Creator[] = []
    for (const { creatorId, supporting } of mergeSubscriptionTiers(pages)) {
      ctx.signal.throwIfAborted()
      try {
        const page = await ctx.fetchText(`${BASE}/creator/${creatorId}`)
        creators.push({
          serviceId: 'cien',
          creatorId,
          name: parseCreatorName(page, creatorId),
          iconUrl: parseCreatorIcon(page),
          supporting
        })
      } catch (err) {
        ctx.log('warn', `creator ${creatorId} profile failed; using id as name`, err)
        creators.push({ serviceId: 'cien', creatorId, name: creatorId, supporting })
      }
    }
    return creators
  },

  async *recentPosts(ctx: ServiceContext, maxPages: number): AsyncIterable<RecentPost> {
    // /mypage/recent is the "New Articles" feed — recent articles across the
    // user's subscriptions, newest-first, as /creator/<id>/article/<id> links.
    // Accessibility isn't exposed in the feed, so it's left undefined (a paid
    // article a free follower can't open may show as "new" — acceptable).
    const seen = new Set<string>()
    for (let page = 1; page <= maxPages; page++) {
      ctx.signal.throwIfAborted()
      let html: string
      try {
        html = await ctx.fetchText(`${BASE}/mypage/recent?page=${page}`)
      } catch (err) {
        ctx.log('warn', `recent feed page ${page} failed`, err)
        return
      }
      const refs = parseRecentArticleRefs(html).filter((r) => {
        const key = `${r.creatorId}/${r.articleId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      if (refs.length === 0) return
      for (const r of refs) yield { creatorId: r.creatorId, postId: r.articleId }
    }
  },

  async *listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post> {
    const seen = new Set<string>()
    for (let page = 1; page <= 200; page++) {
      ctx.signal.throwIfAborted()
      let html: string
      try {
        html = await ctx.fetchText(`${BASE}/creator/${creatorId}/article?page=${page}`)
      } catch (err) {
        ctx.log('warn', `article list page ${page} failed for ${creatorId}`, err)
        return
      }
      // New article ids on this page; once a page yields nothing new we're done
      // (ci-en repeats / empties pages past the end).
      const fresh = parseArticleIds(html).filter((id) => !seen.has(id))
      if (fresh.length === 0) return
      for (const id of fresh) {
        seen.add(id)
        ctx.signal.throwIfAborted()
        // Already fully downloaded for this run's kinds? Skip the per-article
        // detail fetch (the main thing that trips ci-en's 403 rate-limit).
        const stub = ctx.completedPostStub?.(creatorId, id)
        if (stub) {
          yield stub
          continue
        }
        const post = await fetchArticle(ctx, creatorId, id)
        if (post) yield post
      }
    }
  },

  async countPosts(ctx: ServiceContext, creatorId: string): Promise<number> {
    // Walk the same article-listing pages as listPosts, counting article ids
    // (no per-article detail fetch).
    const seen = new Set<string>()
    for (let page = 1; page <= 200; page++) {
      ctx.signal.throwIfAborted()
      const html = await ctx.fetchText(`${BASE}/creator/${creatorId}/article?page=${page}`)
      const fresh = parseArticleIds(html).filter((id) => !seen.has(id))
      if (fresh.length === 0) return seen.size
      fresh.forEach((id) => seen.add(id))
    }
    return seen.size
  },

  async resolvePost(_ctx: ServiceContext, post: Post): Promise<Post> {
    // listPosts already fetches each article's full media.
    return post
  }
}

async function fetchArticle(
  ctx: ServiceContext,
  creatorId: string,
  articleId: string
): Promise<Post | null> {
  let html: string
  try {
    html = await ctx.fetchText(`${BASE}/creator/${creatorId}/article/${articleId}`)
  } catch (err) {
    ctx.log('warn', `article ${articleId} failed`, err)
    return null
  }
  const files = parseAttachments(html)
  if (files.length === 0) {
    // Either the article genuinely has no gated content, or its media uses a
    // shape the parser missed. Log the URL so the case is diagnosable (this is
    // why an occasional post — e.g. the newest — can look "not downloaded").
    ctx.log('warn', `article ${articleId}: no downloadable attachments parsed`, `${BASE}/creator/${creatorId}/article/${articleId}`)
    return null
  }
  const postedAt = parseArticleDate(html)
  const { year, month } = toLocationParts(postedAt)
  return {
    serviceId: 'cien',
    creatorId,
    postId: articleId,
    title: parseArticleTitle(html, `article-${articleId}`),
    postedAt,
    year,
    month,
    url: webPostUrl('cien', creatorId, articleId),
    files
  }
}
