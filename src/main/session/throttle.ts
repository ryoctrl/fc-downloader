/**
 * Per-service politeness throttle.
 *
 * This app makes automated requests against third-party support sites on the
 * user's behalf (enumerating their supported creators/posts and downloading
 * the content they already pay for). To avoid putting undue load on those
 * services, every **metadata** request (creator/post enumeration and post
 * detail) passes through here first, which spaces successive request *starts*
 * for a given service at least `MIN_GAP_MS` apart — capping the metadata
 * request rate at roughly `1000 / MIN_GAP_MS` per second (≈1 every 2s at
 * 2000ms), independent of the download-concurrency setting.
 *
 * NOTE: large **file downloads** (`downloadToFile`) intentionally do NOT pass
 * through here — they are bounded instead by the user's concurrency setting
 * (the engine's worker pool). The gap would otherwise serialize parallel
 * transfers into one every `MIN_GAP_MS` and tank throughput.
 *
 * The user's own browsing in the embedded WebView is NOT throttled here; this
 * only governs the requests the app issues itself.
 */
import type { ServiceId } from '@shared/types'

/**
 * Minimum spacing between successive automated metadata request starts, per
 * service (≈1 request every 2s). Kept conservative because some sites (e.g.
 * Fantia) rate-limit their post-detail API aggressively; pair this with the
 * "skip already-downloaded posts' detail fetch" optimization so long runs stay
 * both gentle and reasonably fast.
 */
export const MIN_GAP_MS = 2000

/** Earliest timestamp (ms epoch) at which the next request for a service may start. */
const nextAllowedAt = new Map<ServiceId, number>()

/**
 * Resolve once it is polite to start the next request for `serviceId`.
 *
 * Reserves the slot synchronously (so concurrent callers each get a distinct,
 * monotonically increasing start time) and then waits out the remaining gap.
 * If `signal` aborts while waiting, rejects with an AbortError instead of
 * holding the slot.
 */
export function awaitPoliteSlot(serviceId: ServiceId, signal?: AbortSignal): Promise<void> {
  const now = Date.now()
  const earliest = nextAllowedAt.get(serviceId) ?? 0
  const startAt = Math.max(now, earliest)
  nextAllowedAt.set(serviceId, startAt + MIN_GAP_MS)

  const wait = startAt - now
  if (wait <= 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, wait)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Reset all throttle state. Test-only. */
export function resetThrottle(): void {
  nextAllowedAt.clear()
}
