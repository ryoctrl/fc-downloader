/**
 * Retry policy for file downloads. The classification + backoff math are pure
 * (and unit-tested); `sleep` is the only impure helper, kept here so the
 * engine's retry loop stays small.
 */

/** Max retry attempts after the initial try (so up to MAX_RETRIES+1 total). */
export const MAX_RETRIES = 3

export interface BackoffOpts {
  baseMs?: number
  maxMs?: number
}

/**
 * Exponential backoff with a ceiling. `attempt` is 1-based (the delay before
 * the 1st retry). 500ms, 1000ms, 2000ms, ... capped at maxMs.
 */
export function backoffDelayMs(attempt: number, opts: BackoffOpts = {}): number {
  const base = opts.baseMs ?? 500
  const max = opts.maxMs ?? 8000
  const n = Math.max(1, attempt)
  return Math.min(max, base * 2 ** (n - 1))
}

/**
 * Whether an error should be retried. Aborts are never retried; HTTP 408/429
 * and 5xx are transient; other 4xx are permanent; anything without a status
 * (network/DNS/socket errors) is treated as transient.
 */
export function isRetriableError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { name?: string; status?: number }
    if (e.name === 'AbortError') return false
    if (typeof e.status === 'number') {
      return e.status === 408 || e.status === 429 || e.status >= 500
    }
  }
  return true
}

/** Resolve after `ms`, or reject with AbortError if the signal fires first. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort(): void {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
