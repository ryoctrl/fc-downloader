/** Central registry of all available services. */
import type { ServiceId } from '@shared/types'
import type { Service } from './types'
import { fantiaService } from './fantia'

const services = new Map<ServiceId, Service>()

function register(service: Service): void {
  services.set(service.id, service)
}

// Register implemented services here. Stubs for fanbox/patreon/cien will be
// added as they are implemented (see docs/roadmap.md).
register(fantiaService)

export function getService(id: ServiceId): Service {
  const svc = services.get(id)
  if (!svc) throw new Error(`Unknown or unimplemented service: ${id}`)
  return svc
}

export function listServices(): Service[] {
  return [...services.values()]
}

export function hasService(id: ServiceId): boolean {
  return services.has(id)
}
