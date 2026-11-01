import { beforeEach, describe, expect, it } from 'vitest'
import type { Post } from '@shared/types'
import type { ServiceContext } from '../types'
import { fantiaService, resetJoinedFanclubsCache } from './index'
import { resetPurchasesCache } from './purchases'

// Synthetic order history: one product (111111) sold by fanclub 700003.
const PAGES: Record<string, string> = {
  '/mypage/users/purchases?page=1': `
    <a href="/mypage/users/purchases/900001">order</a>
    <a href="/products/111111/download">download</a>`,
  '/mypage/users/purchases/900001': `
    <div>注文日時 <span>2026/07/30 22:52</span></div>
    <div class="list-group-item">
      <p><span>以下の商品の販売者：</span><a href="/fanclubs/700003">seller</a></p>
    </div>
    <div class="list-group-item">
      <a href="/products/111111">Sample product</a>
      <small>ファイル名: sample.mp4</small>
    </div>`,
  '/products/111111': '<p>product</p>',
  '/fanclubs/700003/posts?page=1': '<a href="/posts/500001">public post</a>'
}

function ctxFor(joined: number[]): { ctx: ServiceContext; hits: string[] } {
  const hits: string[] = []
  const ctx: ServiceContext = {
    signal: new AbortController().signal,
    log: () => undefined,
    async fetchJson<T>(url: string): Promise<T> {
      hits.push(url)
      if (url.endsWith('/api/v1/me/fanclubs')) return { fanclub_ids: joined } as T
      if (url.includes('/api/v1/fanclubs/')) return { fanclub: { fanclub_name: 'Sample' } } as T
      if (url.includes('/api/v1/posts/')) return { post: { id: 500001, title: 'p', posted_at: '2026-07-01T00:00:00+09:00', fanclub: { id: 700003 } } } as T
      throw new Error(`unexpected ${url}`)
    },
    async fetchText(url: string): Promise<string> {
      const path = url.replace('https://fantia.jp', '')
      hits.push(path)
      return PAGES[path] ?? ''
    }
  }
  return { ctx, hits }
}

async function collect(it: AsyncIterable<Post>): Promise<Post[]> {
  const out: Post[] = []
  for await (const p of it) out.push(p)
  return out
}

describe('fantia seller-only creators', () => {
  beforeEach(() => {
    resetPurchasesCache()
    resetJoinedFanclubsCache()
  })

  it('lists the seller of a purchased product the user does not follow', async () => {
    const { ctx } = ctxFor([700001])
    const creators = await fantiaService.listCreators(ctx)
    expect(creators.map((c) => c.creatorId)).toEqual(['700001', '700003'])
  })

  it('yields only the purchases for a seller the user does not follow', async () => {
    const { ctx, hits } = ctxFor([700001])
    const posts = await collect(fantiaService.listPosts(ctx, '700003'))
    expect(posts.map((p) => p.postId)).toEqual(['product-111111'])
    expect(hits).not.toContain('/fanclubs/700003/posts?page=1')
    expect(await fantiaService.countPosts!(ctx, '700003')).toBe(1)
  })

  it('still walks every post of a followed seller', async () => {
    const { ctx, hits } = ctxFor([700003])
    await collect(fantiaService.listPosts(ctx, '700003'))
    expect(hits).toContain('/fanclubs/700003/posts?page=1')
  })
})
