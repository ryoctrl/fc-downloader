/** Builds a ServiceContext bound to a service's isolated session. */
import { requestForWithRetry } from '@main/session/manager'
import { completedPostStub } from '@main/storage/db'
import type { PostFileKind, ServiceId } from '@shared/types'
import type { ServiceContext } from './types'

/**
 * @param skip  When set (skip-existing download runs), wires `completedPostStub`
 *   so adapters can skip the detail fetch for posts already fully downloaded
 *   under `includeKinds`. Omitted for non-download contexts (auth, listing).
 */
export function createServiceContext(
  serviceId: ServiceId,
  signal: AbortSignal,
  skip?: { includeKinds: PostFileKind[] }
): ServiceContext {
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
    },
    ...(skip
      ? {
          completedPostStub: (creatorId: string, postId: string) =>
            completedPostStub(serviceId, creatorId, postId, skip.includeKinds)
        }
      : {})
  }
}
