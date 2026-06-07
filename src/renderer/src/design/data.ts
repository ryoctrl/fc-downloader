/*
 * fc-downloader — static design metadata for the supported services.
 *
 * The post/creator content is no longer mocked here — the library reads real
 * downloaded posts via posts:list (see design/library.ts). Only the per-service
 * branding (hue / monogram / host) and small utilities remain.
 */
import type { DesignService, ServiceId } from './types'

const SERVICES: DesignService[] = [
  { id: 'fantia', name: 'Fantia', mark: 'ƒ', hue: 348, note: 'fantia.jp' },
  { id: 'fanbox', name: 'pixiv FANBOX', mark: 'B', hue: 205, note: 'fanbox.cc' },
  { id: 'patreon', name: 'Patreon', mark: 'P', hue: 14, note: 'patreon.com' },
  { id: 'cien', name: 'ci-en', mark: 'C', hue: 150, note: 'ci-en.net' }
]

export const fmtSize = (mb: number): string =>
  mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB'

export const FC = {
  SERVICES,
  fmtSize,
  serviceById: (id: ServiceId): DesignService => SERVICES.find((s) => s.id === id) ?? SERVICES[0]
}
