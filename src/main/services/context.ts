/** Builds a ServiceContext bound to a service's isolated session. */
import { requestForWithRetry } from '@main/session/manager'
import type { ServiceId } from '@shared/types'
import type { ServiceContext } from './types'

export function createServiceContext(serviceId: ServiceId, signal: AbortSignal): ServiceContext {
  const log: ServiceContext['log'] = (level, msg, meta) => {
    const line = `[${serviceId}] ${msg}`
    if (level === 'error') console.error(line, meta ?? '')
    else if (level === 'warn') console.warn(line, meta ?? '')
    else console.log(line, meta ?? '')
  }

  return {
    signal,
    log,
    async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
      const res = await requestForWithRetry(serviceId, url, { ...init, signal })
      if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`)
      return res.json<T>()
    },
    async fetchText(url: string, init?: RequestInit): Promise<string> {
      const res = await requestForWithRetry(serviceId, url, { ...init, signal })
      if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`)
      return res.text()
    }
  }
}
