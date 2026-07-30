/**
 * Purchased Fantia shop products ("商品").
 *
 * A post can embed a shop product (a `product` content block). The product
 * itself is only downloadable once bought, and Fantia exposes no "purchased"
 * flag on the post API — so we read the user's own order history instead:
 *
 *   /mypage/users/purchases            list of orders; each downloadable item
 *                                      links to `/products/<productId>/download`
 *   /mypage/users/purchases/<orderId>  the order's items, each with its
 *                                      product link and `ファイル名: <name>`
 *
 * The download URL uses the same product id the post API reports
 * (`content.product.id`), so a purchased product embedded in a post can be
 * fetched directly from `/products/<id>/download` (it 302s to the CDN file).
 *
 * NOTE: HTML scraping of the user's own pages — no official API exists. Shapes
 * were checked against the live site (2026-07); treat the selectors as `VERIFY:`.
 */
import type { ServiceContext } from '../types'

const BASE = 'https://fantia.jp'
/** Safety bound for the order-history pager. */
const MAX_PAGES = 20
/** Re-read the order history at most this often (it changes rarely). */
const CACHE_TTL_MS = 10 * 60 * 1000

/** Product ids that have a download link on an order-history page. */
export function parsePurchasedProductIds(html: string): string[] {
  return [...new Set([...html.matchAll(/\/products\/(\d+)\/download\b/g)].map((m) => m[1]))]
}

/** Order ids linked from an order-history page. */
export function parseOrderIds(html: string): string[] {
  return [...new Set([...html.matchAll(/\/mypage\/users\/purchases\/(\d+)/g)].map((m) => m[1]))]
}

/**
 * `productId -> file name` for the downloadable items of one order page.
 *
 * Each item lives in its own `list-group-item` block holding both the product
 * link and the file name, so pairing within a block is unambiguous.
 */
export function parseOrderItems(html: string): Array<{ productId: string; fileName: string }> {
  const out: Array<{ productId: string; fileName: string }> = []
  for (const block of html.split('list-group-item').slice(1)) {
    const productId = block.match(/\/products\/(\d+)/)?.[1]
    const fileName = block.match(/ファイル名:\s*([^<]+)/)?.[1]?.trim()
    if (productId && fileName) out.push({ productId, fileName })
  }
  return out
}

/** The download URL for a purchased product (302s to the CDN file). */
export function productDownloadUrl(productId: string): string {
  return `${BASE}/products/${encodeURIComponent(productId)}/download`
}

let cache: { at: number; map: Map<string, string> } | null = null

/**
 * Load `productId -> file name` for every purchased downloadable product.
 * Cached briefly so a run that walks many creators reads the history once.
 * Returns an empty map when the history can't be read (never throws) — the
 * caller then simply doesn't offer any product file.
 */
export async function loadPurchasedProducts(ctx: ServiceContext): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.map

  const purchasedIds = new Set<string>()
  const orderIds = new Set<string>()
  for (let page = 1; page <= MAX_PAGES; page++) {
    ctx.signal.throwIfAborted()
    let html: string
    try {
      html = await ctx.fetchText(`${BASE}/mypage/users/purchases?page=${page}`)
    } catch (err) {
      ctx.log('warn', `purchases page ${page} failed`, err)
      break
    }
    const before = purchasedIds.size + orderIds.size
    for (const id of parsePurchasedProductIds(html)) purchasedIds.add(id)
    for (const id of parseOrderIds(html)) orderIds.add(id)
    // No new ids on this page -> past the end (the pager repeats the last page).
    if (purchasedIds.size + orderIds.size === before) break
  }

  // File names live on the order pages, not the list.
  const map = new Map<string, string>()
  for (const orderId of orderIds) {
    ctx.signal.throwIfAborted()
    try {
      const html = await ctx.fetchText(`${BASE}/mypage/users/purchases/${orderId}`)
      for (const { productId, fileName } of parseOrderItems(html)) {
        if (purchasedIds.has(productId)) map.set(productId, fileName)
      }
    } catch (err) {
      ctx.log('warn', `purchase order ${orderId} failed`, err)
    }
  }

  ctx.log('info', `purchased downloadable products: ${map.size}`)
  cache = { at: Date.now(), map }
  return map
}

/** Drop the cached order history (used by tests). */
export function resetPurchasesCache(): void {
  cache = null
}
