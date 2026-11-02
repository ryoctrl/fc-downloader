import { beforeEach, describe, expect, it } from 'vitest'
import type { ServiceContext } from '../types'
import {
  loadPurchasedProducts,
  parseOrderDate,
  parseOrderSellerFanclubId,
  parseOrderIds,
  parseOrderItems,
  parsePurchasedProductIds,
  parseSellerFanclubId,
  parseProductImageUrl,
  productDownloadUrl,
  productPost,
  resetPurchasesCache,
  sellerFanclubIds
} from './purchases'

// Synthetic markup mirroring the order-history pages (ids/names are made up).
const LIST_HTML = `
<div class="list-group-item">
  <a href="/mypage/users/purchases/900001">Sample product one</a>
  <a class="btn" href="/products/111111/download">商品をダウンロード</a>
</div>
<div class="list-group-item">
  <a href="/mypage/users/purchases/900002">Sample product two</a>
  <a class="btn" href="/products/222222/download">商品をダウンロード</a>
</div>`

const ORDER_HTML = `
<div>注文日時 <span class="time">2026/07/30 22:52</span></div>
<div class="list-group-item list-group-item-muted">購入した商品</div>
<div class="list-group-item">
  <a href="/fanclubs/700003"><img src="icon.png" /></a>
  <p><span>以下の商品の販売者：</span><a href="/fanclubs/700003"><span>Sample seller</span></a></p>
</div>
<div class="list-group-item">
  <a class="module-thumbnail" href="/products/111111"><img src="thumb.jpg" /></a>
  <p><strong><a href="/products/111111">Sample product one</a></strong></p>
  <small>ファイル名: sample-one.mp4</small>
  <a href="/products/555555/content_download">ダウンロード</a>
</div>
<div class="list-group-item">
  <a href="/products/222222">Sample product two</a>
  <small>ファイル名: sample-two.zip</small>
</div>`

// A multi-file product: the list opens a modal instead of linking /download,
// and the order page lists each file with its own content_download link.
const MULTI_LIST_HTML = `
<div class="list-group-item">
  <a href="/mypage/users/purchases/900003">Sample bundle</a>
  <button data-target="#download-modal-333333" data-toggle="modal">商品をダウンロード</button>
  <div class="modal download-modal" id="download-modal-333333">
    <p>ファイル名: part-a.mp4</p><a href="/products/666661/content_download">ダウンロード</a>
    <p>ファイル名: part-b.mp4</p><a href="/products/666662/content_download">ダウンロード</a>
  </div>
</div>`

const MULTI_ORDER_HTML = `
<div>注文日時 <span class="time">2026/11/02 10:00</span></div>
<div class="list-group-item">
  <p><span>以下の商品の販売者：</span><a href="/fanclubs/700003">Sample seller</a></p>
</div>
<div class="list-group-item">
  <a class="module-thumbnail" href="/products/333333"><img src="thumb.jpg" /></a>
  <p><strong><a href="/products/333333">Sample bundle</a></strong></p>
  <div class="mb-20">
    <div class="mb-5"><small>ファイル名: part-a.mp4</small></div>
    <video src="/product_hls_playlists/1/p.m3u8"></video>
    <a href="/products/666661/content_download">ダウンロード</a>
  </div>
  <div class="mb-20">
    <div class="mb-5"><small>ファイル名: part-b.mp4</small></div>
    <a href="/products/666662/content_download">ダウンロード</a>
  </div>
</div>`

describe('parsePurchasedProductIds', () => {
  it('collects product ids that have a download link', () => {
    expect(parsePurchasedProductIds(LIST_HTML)).toEqual(['111111', '222222'])
  })

  it('ignores product links without /download (not purchased)', () => {
    expect(parsePurchasedProductIds('<a href="/products/333333">shop</a>')).toEqual([])
  })

  it('collects a multi-file product from its download modal', () => {
    expect(parsePurchasedProductIds(MULTI_LIST_HTML)).toEqual(['333333'])
  })

  it('de-dupes repeated links', () => {
    const html = '<a href="/products/111111/download">a</a><a href="/products/111111/download">b</a>'
    expect(parsePurchasedProductIds(html)).toEqual(['111111'])
  })
})

describe('parseOrderIds', () => {
  it('collects the order ids linked from the list', () => {
    expect(parseOrderIds(LIST_HTML)).toEqual(['900001', '900002'])
  })
})

describe('parseOrderItems', () => {
  it('pairs product, title and file name within each block', () => {
    expect(parseOrderItems(ORDER_HTML)).toEqual([
      { productId: '111111', title: 'Sample product one', files: [{ fileName: 'sample-one.mp4', contentId: '555555' }] },
      { productId: '222222', title: 'Sample product two', files: [{ fileName: 'sample-two.zip' }] }
    ])
  })

  it('lists every file of a multi-file product with its own download id', () => {
    expect(parseOrderItems(MULTI_ORDER_HTML)).toEqual([
      {
        productId: '333333',
        title: 'Sample bundle',
        files: [
          { fileName: 'part-a.mp4', contentId: '666661' },
          { fileName: 'part-b.mp4', contentId: '666662' }
        ]
      }
    ])
  })

  it('skips blocks without a file name (non-download items)', () => {
    const html = '<div class="list-group-item"><a href="/products/444444">physical goods</a></div>'
    expect(parseOrderItems(html)).toEqual([])
  })

  it('returns nothing for unexpected markup instead of throwing', () => {
    expect(parseOrderItems('')).toEqual([])
    expect(parseOrderItems('<p>no items</p>')).toEqual([])
  })
})

describe('parseOrderDate', () => {
  it('reads the order date as an ISO timestamp (JST)', () => {
    expect(parseOrderDate(ORDER_HTML)).toBe('2026-07-30T13:52:00.000Z')
  })

  it('is undefined when absent or unparsable', () => {
    expect(parseOrderDate('<p>no date</p>')).toBeUndefined()
  })
})

describe('parseOrderSellerFanclubId', () => {
  it('reads the seller named on the order page', () => {
    expect(parseOrderSellerFanclubId(ORDER_HTML)).toBe('700003')
  })

  it('is undefined when the order page names no seller', () => {
    expect(parseOrderSellerFanclubId('<a href="/fanclubs/700001">x</a>')).toBeUndefined()
  })
})

describe('sellerFanclubIds', () => {
  it('lists each known seller once', () => {
    const p = { productId: '1', files: [{ fileName: 'a.mp4' }], title: 't', orderedAt: '2026-01-01T00:00:00.000Z' }
    expect(
      sellerFanclubIds([
        { ...p, creatorId: '700001' },
        { ...p, creatorId: '700002' },
        { ...p, creatorId: '700001' },
        { ...p }
      ])
    ).toEqual(['700001', '700002'])
  })
})

describe('parseSellerFanclubId', () => {
  it('takes the first fanclub link on the product page', () => {
    const html = '<a href="/fanclubs/700001">seller</a><a href="/fanclubs/700002">other</a>'
    expect(parseSellerFanclubId(html)).toBe('700001')
  })

  it('is undefined when the page has no fanclub link', () => {
    expect(parseSellerFanclubId('<p>nothing</p>')).toBeUndefined()
  })
})

describe('parseProductImageUrl', () => {
  const html = `
    <img src="https://c.fantia.jp/uploads/product/image/111111/thumb_abc.jpg" />
    <source srcset="https://c.fantia.jp/uploads/product/image/111111/main_abc.webp" />
    <img src="https://c.fantia.jp/uploads/product/image/111111/main_abc.jpg" />`

  it('prefers the large main_ image over thumb_ and skips webp', () => {
    expect(parseProductImageUrl(html)).toBe('https://c.fantia.jp/uploads/product/image/111111/main_abc.jpg')
  })

  it('falls back to thumb_ when there is no main_', () => {
    expect(parseProductImageUrl('<img src="https://c.fantia.jp/uploads/product/image/1/thumb_a.jpg" />')).toBe(
      'https://c.fantia.jp/uploads/product/image/1/thumb_a.jpg'
    )
  })

  it('is undefined when the page has no product image', () => {
    expect(parseProductImageUrl('<p>none</p>')).toBeUndefined()
  })
})

describe('productDownloadUrl', () => {
  it('builds the /download URL from the product id', () => {
    expect(productDownloadUrl('111111')).toBe('https://fantia.jp/products/111111/download')
  })
})

describe('productPost', () => {
  it('builds a post carrying the product file, filed under the seller', () => {
    const post = productPost('fantia', {
      productId: '111111',
      title: 'Sample product one',
      files: [{ fileName: 'sample-one.mp4', contentId: '555555' }],
      orderedAt: '2026-07-30T13:52:00.000Z',
      creatorId: '700001',
      imageUrl: 'https://c.fantia.jp/uploads/product/image/111111/main_abc.jpg'
    })
    expect(post).toMatchObject({
      serviceId: 'fantia',
      creatorId: '700001',
      postId: 'product-111111',
      title: 'Sample product one',
      year: 2026,
      month: 7,
      url: 'https://fantia.jp/products/111111'
    })
    expect(post.files).toEqual([
      {
        fileId: 'product-image-111111',
        kind: 'image',
        name: 'thumb.jpg',
        url: 'https://c.fantia.jp/uploads/product/image/111111/main_abc.jpg'
      },
      {
        fileId: 'product-111111',
        kind: 'video',
        name: 'sample-one.mp4',
        url: 'https://fantia.jp/products/111111/download'
      }
    ])
  })

  it('gives each file of a multi-file product its own download', () => {
    const post = productPost('fantia', {
      productId: '333333',
      title: 'Sample bundle',
      files: [
        { fileName: 'part-a.mp4', contentId: '666661' },
        { fileName: 'part-b.mp4', contentId: '666662' }
      ],
      orderedAt: '2026-11-02T01:00:00.000Z',
      creatorId: '700003'
    })
    expect(post.files).toEqual([
      {
        fileId: 'product-333333-666661',
        kind: 'video',
        name: 'part-a.mp4',
        url: 'https://fantia.jp/products/666661/content_download'
      },
      {
        fileId: 'product-333333-666662',
        kind: 'video',
        name: 'part-b.mp4',
        url: 'https://fantia.jp/products/666662/content_download'
      }
    ])
  })
})

describe('loadPurchasedProducts', () => {
  beforeEach(() => resetPurchasesCache())

  function ctxFor(pages: Record<string, string>): { ctx: ServiceContext; warnings: string[] } {
    const warnings: string[] = []
    const ctx: ServiceContext = {
      signal: new AbortController().signal,
      log: (level, msg) => {
        if (level === 'warn') warnings.push(msg)
      },
      async fetchJson<T>(): Promise<T> {
        throw new Error('unused')
      },
      async fetchText(url: string): Promise<string> {
        const path = url.replace('https://fantia.jp', '')
        return pages[path] ?? ''
      }
    }
    return { ctx, warnings }
  }

  it('files a product under the order page seller even when its page is age-gated', async () => {
    const { ctx } = ctxFor({
      '/mypage/users/purchases?page=1': LIST_HTML,
      '/mypage/users/purchases/900001': ORDER_HTML,
      // An age-restricted product page: redirected, no fanclub link or image.
      '/products/111111': '<title>年齢確認</title>',
      '/products/222222': '<title>年齢確認</title>'
    })
    const items = await loadPurchasedProducts(ctx)
    expect(items.map((p) => [p.productId, p.creatorId])).toEqual([
      ['111111', '700003'],
      ['222222', '700003']
    ])
  })

  it('falls back to the product page seller, and warns when none is found', async () => {
    const noSeller = ORDER_HTML.replace(/販売者/g, '')
    const { ctx, warnings } = ctxFor({
      '/mypage/users/purchases?page=1': LIST_HTML,
      '/mypage/users/purchases/900001': noSeller.replace(/\/fanclubs\/700003/g, ''),
      '/products/111111': '<a href="/fanclubs/700001">seller</a>',
      '/products/222222': '<title>年齢確認</title>'
    })
    const items = await loadPurchasedProducts(ctx)
    expect(items.map((p) => [p.productId, p.creatorId])).toEqual([
      ['111111', '700001'],
      ['222222', undefined]
    ])
    expect(warnings).toContain('product 222222: seller unknown, skipped')
  })

  it('picks up a multi-file product that has no /download link', async () => {
    const { ctx } = ctxFor({
      '/mypage/users/purchases?page=1': MULTI_LIST_HTML,
      '/mypage/users/purchases/900003': MULTI_ORDER_HTML
    })
    const items = await loadPurchasedProducts(ctx)
    expect(items.map((p) => [p.productId, p.creatorId, p.files.length])).toEqual([['333333', '700003', 2]])
  })
})
