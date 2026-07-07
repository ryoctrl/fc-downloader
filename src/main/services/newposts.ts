/**
 * "New posts" indicator: which creators have a downloadable post newer than
 * what's on disk. Walks a service's recent/home feed (cheap — not per-creator)
 * and, for each creator, checks whether their newest *accessible* post is
 * already recorded as downloaded in the ledger. If not, the creator is "new".
 */
import type { ServiceId } from '@shared/types'
import { getService } from './registry'
import { createServiceContext } from './context'
import { isPostDownloaded } from '@main/storage/db'

/** Feed pages to walk. The feed is reverse-chronological across all
 *  subscriptions, so a few pages cover every recently-active creator. */
const MAX_FEED_PAGES = 6

export async function findNewCreators(
  serviceId: ServiceId,
  signal: AbortSignal
): Promise<string[]> {
  const service = getService(serviceId)
  if (!service.recentPosts) return []
  const ctx = createServiceContext(serviceId, signal)

  // The first accessible post seen for a creator is their newest accessible
  // one (feed is newest-first); decide each creator from that alone.
  const decided = new Set<string>()
  const newCreators: string[] = []
  try {
    for await (const rp of service.recentPosts(ctx, MAX_FEED_PAGES)) {
      signal.throwIfAborted()
      if (rp.accessible === false) continue
      if (decided.has(rp.creatorId)) continue
      decided.add(rp.creatorId)
      if (!isPostDownloaded(serviceId, rp.creatorId, rp.postId)) newCreators.push(rp.creatorId)
    }
  } catch (err) {
    ctx.log('warn', 'findNewCreators: recent feed walk failed', err)
  }
  return newCreators
}
