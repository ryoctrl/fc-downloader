/*
 * Bundled brand logos for each service. These ship with the app (offline) so
 * the sidebar / library show real service marks with no network access and no
 * user configuration. Sourced from each service's own favicon / touch icon.
 */
import type { ServiceId } from '@shared/types'
import fantia from '../assets/logos/fantia.png'
import fanbox from '../assets/logos/fanbox.png'
import patreon from '../assets/logos/patreon.png'
import cien from '../assets/logos/cien.ico'

export const SERVICE_LOGOS: Record<ServiceId, string> = {
  fantia,
  fanbox,
  patreon,
  cien
}

export function serviceLogo(id: ServiceId): string | undefined {
  return SERVICE_LOGOS[id]
}
