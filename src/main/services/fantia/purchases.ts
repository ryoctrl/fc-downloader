/**
 * Purchased Fantia shop products ("商品").
 *
 * Posts can advertise a shop product, but the file only becomes available once
 * bought — and Fantia exposes no "purchased" flag on the post API. So rather
 * than hunting for the post that advertises each product, we read the user's own
 * order history, which lists exactly what they bought:
 *
 *   /mypage/users/purchases            orders; each downloadable item links to
 *                                      `/products/<productId>/download`
 *   /mypage/users/purchases/<orderId>  the order's items (title + `ファイル名:`)
 *                                      and its order date
 *   /products/<productId>              the product page, whose first fanclub
 *                                      link is the seller (used to file the
 *                                      product under that creator)
 *
 * Each purchase is then surfaced as its own post (`product-<id>`) so it flows
 * through the normal layout/ledger/viewer with no special cases. Deriving them
 * from the order history (instead of from the posts that advertise them) also
 * means a product bought long ago is picked up without re-fetching every old
 * post — post details are skipped once a post is fully downloaded, so a product
 * added to an already-downloaded post would otherwise never be seen.
 *
 * NOTE: HTML scraping of the user's own pages — no official API exists. Shapes
 * were checked against the live site (2026-07); treat the selectors as `VERIFY:`.
 */
import type { Post, PostFile, ServiceId } from '@shared/types'
import { toLocationParts } from '@main/storage/layout'
import { kindForName } from '@main/storage/files'
import type { ServiceContext } from '../types'

const BASE = 'https://fantia.jp'
/** Safety bound for the order-history pager. */
const MAX_PAGES = 20
/** Re-read the order history at most this often (it changes rarely). */
const CACHE_TTL_MS = 10 * 60 * 1000

/** A purchased downloadable product, ready to be filed under its seller. */
export interface PurchasedProduct {
  productId: string
  /** Original file name from the order page (the URL itself carries none). */
  fileName: string
  title: string
  /** ISO timestamp of the order (drives the year/month folders). */
  orderedAt: string
  /** Seller's fanclub id — the creator this product is filed under. */
  creatorId?: string
  /** Product image (its cover in the library), from the product page. */
  imageUrl?: string
}

/** Product ids that have a download link on an order-history page. */
export function parsePurchasedProductIds(html: string): string[] {
  return [...new Set([...html.matchAll(/\/products\/(\d+)\/download\b/g)].map((m) => m[1]))]
}

/** Order ids linked from an order-history page. */
export function parseOrderIds(html: string): string[] {
  return [...new Set([...html.matchAll(/\/mypage\/users\/purchases\/(\d+)/g)].map((m) => m[1]))]
}

/**
 * The downloadable items of one order page. Each item lives in its own
 * `list-group-item` block holding the product link, its title and the file
 * name, so pairing within a block is unambiguous.
 */
export function parseOrderItems(html: string): Array<{ productId: string; title: string; fileName: string }> {
  const out: Array<{ productId: string; title: string; fileName: string }> = []
  for (const block of html.split('list-group-item').slice(1)) {
    const productId = block.match(/\/products\/(\d+)/)?.[1]
    const fileName = block.match(/ファイル名:\s*([^<]+)/)?.[1]?.trim()
    // The thumbnail link wraps an <img>; the title link is the one with text.
    const title = block.match(/\/products\/\d+"[^>]*>\s*([^<\s][^<]*?)\s*</)?.[1]?.trim()
    if (productId && fileName) out.push({ productId, title: title || productId, fileName })
  }
  return out
}

/** ISO timestamp for an order page's order date (falls back to undefined). */
export function parseOrderDate(html: string): string | undefined {
  const m = html.match(/注文日時[\s\S]{0,120}?(\d{4})\/(\d{2})\/(\d{2})(?:[^\d]{0,10}(\d{2}):(\d{2}))?/)
  if (!m) return undefined
  const [, y, mo, d, hh = '00', mm = '00'] = m
  const t = Date.parse(`${y}-${mo}-${d}T${hh}:${mm}:00+09:00`) // Fantia shows JST
  return Number.isNaN(t) ? undefined : new Date(t).toISOString()
}

/**
 * The product's own image from its page, preferring the large `main_` variant
 * over the small `thumb_` one (the order page only carries `thumb_`).
 */
export function parseProductImageUrl(productHtml: string): string | undefined {
  const urls = [...productHtml.matchAll(/https:\/\/c\.fantia\.jp\/uploads\/product\/image\/\d+\/[^"'\s)]+/g)].map(
    (m) => m[0]
  )
  const named = (prefix: string): string | undefined =>
    urls.find((u) => (u.split('/').pop() ?? '').startsWith(prefix) && !u.endsWith('.webp'))
  return named('main_') ?? named('thumb_') ?? undefined
}

/** The seller's fanclub id from a product page (its first fanclub link). */
export function parseSellerFanclubId(productHtml: string): string | undefined {
  return productHtml.match(/\/fanclubs\/(\d+)/)?.[1]
}

/** The download URL for a purchased product (302s to the CDN file). */
export function productDownloadUrl(productId: string): string {
  return `${BASE}/products/${encodeURIComponent(productId)}/download`
}

/** Build the synthetic post that carries a purchased product's file. */
export function productPost(serviceId: ServiceId, p: PurchasedProduct & { creatorId: string }): Post {
  const { year, month } = toLocationParts(p.orderedAt)
  const files: PostFile[] = []
  // The product image first, so it becomes this post's cover in the library.
  if (p.imageUrl) {
    const ext = (p.imageUrl.split('?')[0].match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg').toLowerCase()
    files.push({ fileId: `product-image-${p.productId}`, kind: 'image', name: `thumb${ext}`, url: p.imageUrl })
  }
  files.push({
    fileId: `product-${p.productId}`,
    kind: kindForName(p.fileName),
    name: p.fileName,
    url: productDownloadUrl(p.productId)
  })
  return {
    serviceId,
    creatorId: p.creatorId,
    postId: `product-${p.productId}`,
    title: p.title,
    postedAt: p.orderedAt,
    year,
    month,
    url: `${BASE}/products/${p.productId}`,
    files
  }
}

let cache: { at: number; items: PurchasedProduct[] } | null = null

/**
 * Every purchased downloadable product, with the seller it should be filed
 * under. Cached briefly so a run that walks many creators reads the history
 * once. Never throws: on failure the caller simply gets no products.
 */
export async function loadPurchasedProducts(ctx: ServiceContext): Promise<PurchasedProduct[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items

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

  // Titles, file names and dates live on the order pages, not the list.
  const items: PurchasedProduct[] = []
  for (const orderId of orderIds) {
    ctx.signal.throwIfAborted()
    try {
      const html = await ctx.fetchText(`${BASE}/mypage/users/purchases/${orderId}`)
      const orderedAt = parseOrderDate(html)
      for (const it of parseOrderItems(html)) {
        if (!purchasedIds.has(it.productId) || !orderedAt) continue
        if (items.some((p) => p.productId === it.productId)) continue
        items.push({ ...it, orderedAt })
      }
    } catch (err) {
      ctx.log('warn', `purchase order ${orderId} failed`, err)
    }
  }

  // Which creator sells each product (so it lands in that creator's folder).
  for (const item of items) {
    ctx.signal.throwIfAborted()
    try {
      const html = await ctx.fetchText(`${BASE}/products/${item.productId}`)
      item.creatorId = parseSellerFanclubId(html)
      item.imageUrl = parseProductImageUrl(html)
    } catch (err) {
      ctx.log('warn', `product ${item.productId} page failed`, err)
    }
  }

  ctx.log('info', `purchased downloadable products: ${items.length}`)
  cache = { at: Date.now(), items }
  return items
}

/** Drop the cached order history (used by tests). */
export function resetPurchasesCache(): void {
  cache = null
}
