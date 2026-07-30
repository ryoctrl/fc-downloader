import { describe, expect, it } from 'vitest'
import {
  parseOrderIds,
  parseOrderItems,
  parsePurchasedProductIds,
  productDownloadUrl
} from './purchases'

// Synthetic markup mirroring the order-history pages (ids/names are made up).
const LIST_HTML = `
<div class="list-group-item">
  <a href="/mypage/users/purchases/900001">Sample product one</a>
  <span>注文ID: 900001</span>
  <a class="btn" href="/products/111111/download">商品をダウンロード</a>
</div>
<div class="list-group-item">
  <a href="/mypage/users/purchases/900002">Sample product two</a>
  <a class="btn" href="/products/222222/download">商品をダウンロード</a>
</div>`

const ORDER_HTML = `
<div class="list-group-item">
  <a class="module-thumbnail" href="/products/111111"><img src="thumb.jpg" /></a>
  <a href="/products/111111">Sample product one</a>
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
  it('pairs each product with the file name in its own block', () => {
    expect(parseOrderItems(ORDER_HTML)).toEqual([
      { productId: '111111', fileName: 'sample-one.mp4' },
      { productId: '222222', fileName: 'sample-two.zip' }
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

describe('productDownloadUrl', () => {
  it('builds the /download URL from the product id', () => {
    expect(productDownloadUrl('111111')).toBe('https://fantia.jp/products/111111/download')
  })
})
