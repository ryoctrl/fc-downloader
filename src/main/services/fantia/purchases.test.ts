import { describe, expect, it } from 'vitest'
import {
  parseOrderDate,
  parseOrderIds,
  parseOrderItems,
  parsePurchasedProductIds,
  parseSellerFanclubId,
  productDownloadUrl,
  productPost
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

describe('parsePurchasedProductIds', () => {
  it('collects product ids that have a download link', () => {
    expect(parsePurchasedProductIds(LIST_HTML)).toEqual(['111111', '222222'])
  })

  it('ignores product links without /download (not purchased)', () => {
    expect(parsePurchasedProductIds('<a href="/products/333333">shop</a>')).toEqual([])
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
      { productId: '111111', title: 'Sample product one', fileName: 'sample-one.mp4' },
      { productId: '222222', title: 'Sample product two', fileName: 'sample-two.zip' }
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

describe('parseSellerFanclubId', () => {
  it('takes the first fanclub link on the product page', () => {
    const html = '<a href="/fanclubs/374068">seller</a><a href="/fanclubs/999999">other</a>'
    expect(parseSellerFanclubId(html)).toBe('374068')
  })

  it('is undefined when the page has no fanclub link', () => {
    expect(parseSellerFanclubId('<p>nothing</p>')).toBeUndefined()
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
      fileName: 'sample-one.mp4',
      orderedAt: '2026-07-30T13:52:00.000Z',
      creatorId: '374068'
    })
    expect(post).toMatchObject({
      serviceId: 'fantia',
      creatorId: '374068',
      postId: 'product-111111',
      title: 'Sample product one',
      year: 2026,
      month: 7,
      url: 'https://fantia.jp/products/111111'
    })
    expect(post.files).toEqual([
      {
        fileId: 'product-111111',
        kind: 'video',
        name: 'sample-one.mp4',
        url: 'https://fantia.jp/products/111111/download'
      }
    ])
  })
})
