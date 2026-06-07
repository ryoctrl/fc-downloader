/**
 * Per-service session isolation.
 *
 * Each service gets its own persistent Electron `session` via a partition
 * (`persist:<serviceId>`). Cookies set when the user logs in through the
 * embedded WebView live in that partition, and all subsequent authenticated
 * requests for that service reuse them automatically.
 */
import { createWriteStream } from 'node:fs'
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
 * Stream a URL straight to `destPath` using the service's session (cookies
 * applied), without buffering the whole body in memory. Resolves with the
 * number of bytes written. Throws an Error carrying a numeric `.status` on HTTP
 * errors, or an AbortError if the signal fires.
 */
export async function downloadToFile(
  serviceId: ServiceId,
  url: string,
  destPath: string,
  init: DownloadFileInit = {}
): Promise<number> {
  await awaitPoliteSlot(serviceId, init.signal)
  const s = sessionFor(serviceId)
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET', session: s, useSessionCookies: true })
    request.setHeader('Accept', '*/*')
    if (init.headers) {
      for (const [k, v] of Object.entries(init.headers)) request.setHeader(k, v)
    }

    let settled = false
    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      reject(err)
    }
    const succeed = (bytes: number): void => {
      if (settled) return
      settled = true
      resolve(bytes)
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
      const out = createWriteStream(destPath)
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
