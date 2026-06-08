/**
 * Per-service session isolation.
 *
 * Each service gets its own persistent Electron `session` via a partition
 * (`persist:<serviceId>`). Cookies set when the user logs in through the
 * embedded WebView live in that partition, and all subsequent authenticated
 * requests for that service reuse them automatically.
 */
import { createWriteStream } from 'node:fs'
import { rename, unlink } from 'node:fs/promises'
import { net, session, type Session } from 'electron'
import type { ServiceId } from '@shared/types'
import { awaitPoliteSlot } from './throttle'

export function partitionFor(serviceId: ServiceId): string {
  return `persist:${serviceId}`
}

export function sessionFor(serviceId: ServiceId): Session {
  return session.fromPartition(partitionFor(serviceId))
}

/** Wipe a service's cookies/storage (used by "log out / clear session"). */
export async function clearSession(serviceId: ServiceId): Promise<void> {
  const s = sessionFor(serviceId)
  await s.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
  })
}

/**
 * Perform an HTTP request inside a service's session so that its cookies are
 * applied. Uses Electron's `net` module (Chromium network stack) rather than
 * Node's fetch, which does not share the session cookie jar.
 */
export interface SessionResponse {
  status: number
  /** Response headers (keys lowercased by Electron's net stack). */
  headers: Record<string, string | string[]>
  buffer: () => Buffer
  text: () => Promise<string>
  json: <T>() => Promise<T>
}

export async function requestFor(
  serviceId: ServiceId,
  url: string,
  init: RequestInit & { signal?: AbortSignal } = {}
): Promise<SessionResponse> {
  await awaitPoliteSlot(serviceId, init.signal)
  const s = sessionFor(serviceId)
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      method: (init.method as string) ?? 'GET',
      session: s,
      useSessionCookies: true
    })

    // Reasonable defaults so endpoints treat us like the embedded browser.
    request.setHeader('Accept', 'application/json, text/plain, */*')
    if (init.headers) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        request.setHeader(k, v)
      }
    }

    if (init.signal) {
      if (init.signal.aborted) {
        request.abort()
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      init.signal.addEventListener('abort', () => request.abort(), { once: true })
    }

    const chunks: Buffer[] = []
    request.on('response', (response) => {
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        const buf = Buffer.concat(chunks)
        resolve({
          status: response.statusCode,
          headers: response.headers as Record<string, string | string[]>,
          buffer: () => buf,
          text: async () => buf.toString('utf-8'),
          json: async <T,>() => JSON.parse(buf.toString('utf-8')) as T
        })
      })
      response.on('error', reject)
    })
    request.on('error', reject)

    if (init.body) request.write(init.body as string)
    request.end()
  })
}

/** Max retries (after the initial try) for transient metadata-fetch failures. */
export const META_MAX_RETRIES = 4

/** HTTP statuses worth retrying: rate-limit / timeout / transient server errors. */
export function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

/**
 * Parse a `Retry-After` header into milliseconds. Supports both the
 * delta-seconds form ("120") and the HTTP-date form. Returns null if absent or
 * unparseable.
 */
export function parseRetryAfterMs(
  headers: Record<string, string | string[]> | undefined,
  now: number = Date.now()
): number | null {
  const raw = headers?.['retry-after']
  const v = Array.isArray(raw) ? raw[0] : raw
  if (!v) return null
  const secs = Number(v)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const date = Date.parse(v)
  return Number.isFinite(date) ? Math.max(0, date - now) : null
}

function backoffMs(attempt: number): number {
  // 1s, 2s, 4s, 8s … capped at 30s (attempt is 1-based for the Nth retry).
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1))
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Like {@link requestFor}, but transparently retries transient failures —
 * HTTP 429 / 5xx and network errors — with exponential backoff (honouring a
 * `Retry-After` header when present). This is what metadata enumeration uses so
 * a momentary rate-limit doesn't silently truncate a long run. Aborts are never
 * retried. After exhausting retries it returns the last response (so the caller
 * still sees the final status) or rethrows the last network error.
 */
export async function requestForWithRetry(
  serviceId: ServiceId,
  url: string,
  init: RequestInit & { signal?: AbortSignal } = {}
): Promise<SessionResponse> {
  const signal = init.signal
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const res = await requestFor(serviceId, url, init)
      if (isRetriableStatus(res.status) && attempt < META_MAX_RETRIES) {
        const wait = parseRetryAfterMs(res.headers) ?? backoffMs(attempt + 1)
        await sleepMs(wait, signal)
        continue
      }
      return res
    } catch (err) {
      // Aborts and exhausted retries propagate; transient network errors retry.
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) throw err
      if (attempt >= META_MAX_RETRIES) throw err
      await sleepMs(backoffMs(attempt + 1), signal)
    }
  }
}

export interface DownloadFileInit {
  signal?: AbortSignal
  headers?: Record<string, string>
}

/**
 * The stream surface of Electron's net `IncomingMessage` that we rely on.
 * Electron implements the Readable interface at runtime but its types omit
 * pause/resume, so we narrow to what we use (pause/resume are optional and
 * guarded — backpressure simply no-ops if absent).
 */
interface NetResponse {
  statusCode: number
  on(event: 'data', cb: (chunk: Buffer) => void): void
  on(event: 'end', cb: () => void): void
  on(event: 'error', cb: (err: Error) => void): void
  pause?: () => void
  resume?: () => void
}

/**
 * Stream a URL to `destPath` using the service's session (cookies applied),
 * without buffering the whole body in memory. The write is atomic: bytes go to
 * a sibling `<destPath>.part` which is renamed onto `destPath` only after the
 * full body is received, so a failed/cancelled download never leaves a partial
 * file that skip-existing would treat as complete. Resolves with the number of
 * bytes written. Throws an Error carrying a numeric `.status` on HTTP errors,
 * or an AbortError if the signal fires; in both cases the `.part` is removed.
 */
export function downloadToFile(
  serviceId: ServiceId,
  url: string,
  destPath: string,
  init: DownloadFileInit = {}
): Promise<number> {
  // No politeness gate here: file downloads are bounded by the user's
  // concurrency setting (the engine's worker pool), which is the load limit.
  // The min-gap throttle would serialize parallel downloads into ~1 every
  // MIN_GAP_MS, defeating the concurrency setting. (Metadata enumeration in
  // requestFor still goes through awaitPoliteSlot to stay gentle.)
  const s = sessionFor(serviceId)
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET', session: s, useSessionCookies: true })
    request.setHeader('Accept', '*/*')
    if (init.headers) {
      for (const [k, v] of Object.entries(init.headers)) request.setHeader(k, v)
    }

    let settled = false
    // Stream to a sibling `.part` file and atomically rename on success, so an
    // interrupted download (crash/cancel/network drop) never leaves a partial
    // file at destPath that skip-existing would later mistake for complete.
    const tmpPath = `${destPath}.part`
    const cleanupTmp = (): void => {
      void unlink(tmpPath).catch(() => {
        /* best-effort; ENOENT etc. are fine */
      })
    }
    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      cleanupTmp()
      reject(err)
    }
    const succeed = (bytes: number): void => {
      if (settled) return
      settled = true
      rename(tmpPath, destPath).then(
        () => resolve(bytes),
        (e: Error) => {
          cleanupTmp()
          reject(e)
        }
      )
    }

    if (init.signal) {
      if (init.signal.aborted) {
        request.abort()
        fail(new DOMException('Aborted', 'AbortError'))
        return
      }
      init.signal.addEventListener('abort', () => request.abort(), { once: true })
    }

    request.on('response', (incoming) => {
      const response = incoming as unknown as NetResponse
      const status = response.statusCode
      if (status >= 400) {
        response.resume?.() // drain so the socket is freed
        const err = new Error(`HTTP ${status} downloading ${url}`) as Error & { status: number }
        err.status = status
        fail(err)
        return
      }
      const out = createWriteStream(tmpPath)
      let bytes = 0
      out.on('error', (e) => {
        request.abort()
        fail(e)
      })
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (!out.write(chunk)) {
          response.pause?.()
          out.once('drain', () => response.resume?.())
        }
      })
      response.on('end', () => out.end(() => succeed(bytes)))
      response.on('error', (e: Error) => {
        out.destroy()
        fail(e)
      })
    })
    request.on('error', (e) => fail(e))
    request.on('abort', () => fail(new DOMException('Aborted', 'AbortError')))
    request.end()
  })
}
