/**
 * Per-service session isolation.
 *
 * Each service gets its own persistent Electron `session` via a partition
 * (`persist:<serviceId>`). Cookies set when the user logs in through the
 * embedded WebView live in that partition, and all subsequent authenticated
 * requests for that service reuse them automatically.
 */
import { net, session, type Session } from 'electron'
import type { ServiceId } from '@shared/types'

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

export function requestFor(
  serviceId: ServiceId,
  url: string,
  init: RequestInit & { signal?: AbortSignal } = {}
): Promise<SessionResponse> {
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
