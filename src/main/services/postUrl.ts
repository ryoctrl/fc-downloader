/**
 * Canonical public web-page URL for a post, derived from the (service, creator,
 * post) tuple. Used both by the adapters (to stamp Post.url at enumeration time)
 * and by the ledger (to backfill a URL for posts recorded before this existed).
 * Pure and deterministic — no network.
 */
import type { ServiceId } from '@shared/types'

export function webPostUrl(
  serviceId: ServiceId,
  creatorId: string,
  postId: string
): string | undefined {
  switch (serviceId) {
    case 'fanbox':
      return `https://www.fanbox.cc/@${creatorId}/posts/${postId}`
    case 'fantia':
      return `https://fantia.jp/posts/${postId}`
    case 'cien':
      return `https://ci-en.net/creator/${creatorId}/article/${postId}`
    case 'patreon':
      return `https://www.patreon.com/posts/${postId}`
    default:
      return undefined
  }
}
