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
import { parentDomain, parseCookieInput, type CookieInputFormat } from './cookies'

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

/** Default lifetime for imported cookies that arrive without an expiry. */
const IMPORT_COOKIE_TTL_SECONDS = 365 * 24 * 60 * 60

export interface CookieImportOutcome {
  ok: boolean
  /** `empty`: nothing usable was pasted. `unparsable`: the shape wasn't
   *  recognised. `failed`: recognised, but every `cookies.set` was rejected. */
  reason?: 'empty' | 'unparsable' | 'failed'
  count: number
  names: string[]
  /** Cookies Chromium refused, with its reason. Surfaced in the UI so a partial
   *  import never masquerades as a complete one. */
  rejected: CookieImportRejection[]
  format: CookieInputFormat | null
}

export interface CookieImportRejection {
  name: string
  reason: string
}

/**
 * Install user-pasted cookies into a service's partition (see ./cookies.ts for
 * why this exists). `origin` is the service's home URL origin — it supplies the
 * host to attach host-only cookies to and the URL each `cookies.set` is scoped
 * by.
 *
 * Cookies that arrive without an expiry are given one: a session-scoped cookie
 * would be dropped when the app closes, which defeats the point of importing a
 * long-lived `session_id`.
 */
export async function importCookies(
  serviceId: ServiceId,
  raw: string,
  origin: string
): Promise<CookieImportOutcome> {
  const parsed = parseCookieInput(raw)
  if (parsed.cookies.length === 0) {
    return {
      ok: false,
      reason: parsed.format ? 'failed' : 'unparsable',
      count: 0,
      names: [],
      rejected: [],
      format: parsed.format
    }
  }

  const s = sessionFor(serviceId)
  const root = new URL(origin)
  const wanted = new Set(parsed.cookies.map((c) => c.name))

  // Drop any existing cookie with an imported name first. Leaving both a
  // host-only and a domain-scoped copy in place means the server receives two
  // values for one name, and it will happily treat that as "not logged in".
  const existing = [
    ...(await s.cookies.get({ url: origin })),
    ...((await parentDomainAsync(s, root.hostname)) ?? [])
  ]
  for (const cookie of existing) {
    if (wanted.has(cookie.name)) {
      await s.cookies.remove(origin, cookie.name).catch(() => {
        /* a cookie scoped to another path/scheme refuses removal by url; fine */
      })
    }
  }

  const names: string[] = []
  const rejected: CookieImportRejection[] = []
  for (const c of parsed.cookies) {
    const domain = c.domain
    const host = (domain ?? root.hostname).replace(/^\./, '')
    const url = `${root.protocol}//${host}${c.path ?? '/'}`
    try {
      await s.cookies.set({
        url,
        name: c.name,
        value: c.value,
        ...(domain ? { domain } : {}),
        path: c.path ?? '/',
        secure: c.secure ?? true,
        httpOnly: c.httpOnly ?? false,
        expirationDate: c.expires && c.expires > 0
          ? c.expires
          : Math.floor(Date.now() / 1000) + IMPORT_COOKIE_TTL_SECONDS,
        ...(c.sameSite ? { sameSite: c.sameSite } : {})
      })
      names.push(c.name)
    } catch (err) {
      // One rejected record (e.g. a Secure flag on an http URL, or an `expires`
      // already in the past) must not abort the rest of the paste — but it must
      // not be swallowed either: a silently dropped cookie is indistinguishable
      // from a paste that never contained it, which is how "imported but still
      // logged out" became a mystery.
      rejected.push({
        name: c.name,
        reason: err instanceof Error ? err.message : String(err)
      })
    }
  }

  // Chromium keeps the jar in memory and writes the SQLite store on a timer or
  // at shutdown. Flushing now means a force-quit right after importing cannot
  // throw away the login this feature exists to install.
  await s.cookies.flushStore().catch(() => undefined)

  return {
    ok: names.length > 0,
    ...(names.length > 0 ? {} : { reason: 'failed' as const }),
    count: names.length,
    names,
    rejected,
    format: parsed.format
  }
}

/** Parent-domain cookies for `host`, so `.patreon.com` records are cleaned too. */
async function parentDomainAsync(
  s: Session,
  host: string
): Promise<Awaited<ReturnType<Session['cookies']['get']>> | null> {
  const parent = parentDomain(host)
  if (!parent) return null
  try {
    return await s.cookies.get({ domain: parent })
  } catch {
    return null
  }
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
    // Settle exactly once and drop the signal listener (a run's signal outlives
    // thousands of requests).
    const onAbort = (): void => request.abort()
    const done = (): void => init.signal?.removeEventListener('abort', onAbort)
    const fail = (err: unknown): void => {
      done()
      reject(err)
    }

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
      init.signal.addEventListener('abort', onAbort, { once: true })
    }
    // Electron reports an aborted request only through an 'abort' event (no
    // 'error', no 'end'), so without this a request cut off by cancellation
    // never settles — and the cancelled run never finishes, leaving the next
    // queued run stuck behind it.
    request.on('abort', () => fail(new DOMException('Aborted', 'AbortError')))

    const chunks: Buffer[] = []
    request.on('response', (response) => {
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        done()
        const buf = Buffer.concat(chunks)
        resolve({
          status: response.statusCode,
          headers: response.headers as Record<string, string | string[]>,
          buffer: () => buf,
          text: async () => buf.toString('utf-8'),
          json: async <T,>() => JSON.parse(buf.toString('utf-8')) as T
        })
      })
      response.on('error', fail)
    })
    request.on('error', fail)

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

/** Reported just before each backoff wait, so the UI can show what's happening. */
export interface RetryNotice {
  /** HTTP status that triggered the wait (e.g. 429, 503); undefined for a
   *  network/socket error. */
  status?: number
  /** 1-based number of the retry about to be made (1 = first retry). */
  attempt: number
  /** Milliseconds we will wait before retrying. */
  waitMs: number
}
export type RetryHook = (notice: RetryNotice) => void

/**
 * Like {@link requestFor}, but transparently retries transient failures —
 * HTTP 429 / 5xx and network errors — with exponential backoff (honouring a
 * `Retry-After` header when present). This is what metadata enumeration uses so
 * a momentary rate-limit doesn't silently truncate a long run. Aborts are never
 * retried. After exhausting retries it returns the last response (so the caller
 * still sees the final status) or rethrows the last network error.
 *
 * `onRetry` is invoked just before each backoff wait (for live UI feedback).
 */
export async function requestForWithRetry(
  serviceId: ServiceId,
  url: string,
  init: RequestInit & {
    signal?: AbortSignal
    onRetry?: RetryHook
    /** Extra statuses to treat as transient for THIS service (e.g. ci-en serves
     *  its rate-limit as 403, which is normally permanent). */
    retriableStatuses?: number[]
  } = {}
): Promise<SessionResponse> {
  const signal = init.signal
  const retriable = (status: number): boolean =>
    isRetriableStatus(status) || (init.retriableStatuses?.includes(status) ?? false)
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const res = await requestFor(serviceId, url, init)
      if (retriable(res.status) && attempt < META_MAX_RETRIES) {
        const wait = parseRetryAfterMs(res.headers) ?? backoffMs(attempt + 1)
        init.onRetry?.({ status: res.status, attempt: attempt + 1, waitMs: wait })
        await sleepMs(wait, signal)
        continue
      }
      return res
    } catch (err) {
      // Aborts and exhausted retries propagate; transient network errors retry.
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) throw err
      if (attempt >= META_MAX_RETRIES) throw err
      const wait = backoffMs(attempt + 1)
      init.onRetry?.({ attempt: attempt + 1, waitMs: wait })
      await sleepMs(wait, signal)
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
