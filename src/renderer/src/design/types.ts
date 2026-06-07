/* fc-downloader — renderer design-layer types (ported from the design handoff) */
import type { Creator, DownloadOptions, DownloadProgress } from '@shared/types'
import type { ViewPost } from './library'

export type ServiceId = 'fantia' | 'fanbox' | 'patreon' | 'cien'

export interface DesignService {
  id: ServiceId
  name: string
  /** Monogram shown when no brand logo is set. */
  mark: string
  /** Hue used for tinted surfaces / marks. */
  hue: number
  /** Display host (e.g. fantia.jp). */
  note: string
}

export interface DesignCreator {
  id: string
  name: string
}

export type PostType = 'image' | 'video' | 'file'
export type PostStatus = 'done' | 'partial' | 'new'

export interface Post {
  id: number
  service: ServiceId
  creator: string
  creatorName: string
  title: string
  year: number
  month: number
  day: number
  date: string
  type: PostType
  files: number
  sizeMB: number
  status: PostStatus
  fav: boolean
  tags: string[]
  hue: number
}

export type Lang = 'ja' | 'en'
export type Theme = 'system' | 'light' | 'dark'
export type ViewMode = 'grid' | 'list'
export type Density = 'comfy' | 'compact'

/** User preferences (persisted to localStorage in the renderer for now). */
export interface Prefs {
  theme: Theme
  accent: string
  density: Density
  viewerView: ViewMode
  lang: Lang
}

export type Nav =
  | { screen: 'service'; serviceId: ServiceId }
  | { screen: 'progress' }
  | { screen: 'library'; svc?: ServiceId }
  | { screen: 'favorites' }
  | { screen: 'post'; postKey: string; from?: string }
  | { screen: 'settings' }

/** Daily auto-download schedule (runs while the app is open). */
export interface ScheduleConfig {
  enabled: boolean
  /** Local time of day, "HH:MM". */
  time: string
}

/** Persisted, cross-service download-form selections (restored on launch). */
export interface DownloadPrefs {
  image: boolean
  video: boolean
  file: boolean
  /** Skip posts already fully downloaded (dedup). */
  skipDup: boolean
}

/** A live download run, driven by real main-process events. */
export interface DownloadState {
  svcId: ServiceId
  /** The options the run was started with (for retrying). */
  options: DownloadOptions
  startedAt: number
  done: boolean
}

export interface AppState {
  logins: Record<string, boolean>
  /** Cached supported creators per service (avoids re-fetching on revisit). */
  creators: Record<string, Creator[]>
  creatorsLoading: Record<string, boolean>
  /** Favorited post keys (serviceId/creatorId/postId), persisted locally. */
  favs: Set<string>
  download: DownloadState | null
  /** Latest progress snapshot for the active/last run, kept at the app level so
   *  the progress screen can recover it after navigating away and back (the
   *  per-screen subscription misses events while unmounted). */
  lastProgress: DownloadProgress | null
  /** Services waiting in the download queue (behind the active one). */
  queued: ServiceId[]
  saveDir: string
  concurrency: number
  /** Persisted download-form selections (file types + skip-dup). */
  downloadPrefs: DownloadPrefs
  /** Per-service selected creator ids (serviceId -> creatorIds). Absent = all
   *  selected by default. Persisted so the choice survives service switches. */
  creatorSel: Record<string, string[]>
  /** Per-service enabled flag (serviceId -> bool). Absent = enabled. Disabled
   *  services are hidden from the rail and excluded from bulk/scheduled runs;
   *  the login session is kept. */
  enabledServices: Record<string, boolean>
  /** Daily auto-download schedule. */
  schedule: ScheduleConfig
}

export interface AppActions {
  /** Toggle favorite for a post key (serviceId/creatorId/postId). */
  toggleFav: (key: string) => void
  /** Re-fetch the downloaded posts from the metadata ledger (posts:list). */
  reloadPosts: () => void
  /** Re-check the real login state for a service (services:checkAuth). */
  recheckAuth: (id: ServiceId) => void
  /** Clear a service's cookies/session (services:clearSession). */
  clearSession: (id: ServiceId) => void
  /** Load (or, with force, refresh) a service's supported creators into cache. */
  loadCreators: (id: ServiceId, force?: boolean) => void
  /** Kick off a real download run for a service with the given options. */
  startDownload: (svc: DesignService, options: DownloadOptions) => void
  /** Mark the active run as finished (called on the download:done event). */
  markDownloadDone: () => void
  cancelDownload: () => void
  /** Re-run the last download with the same options (dedup re-fetches gaps). */
  retryDownload: () => void
  setConcurrency: (n: number) => void
  /** Open the OS folder picker and persist the chosen download root. */
  pickSaveDir: () => void
  /** Update + persist cross-service download-form selections. */
  setDownloadPrefs: (patch: Partial<DownloadPrefs>) => void
  /** Set + persist the selected creator ids for a service. */
  setCreatorSel: (serviceId: ServiceId, ids: string[]) => void
  /** Enable/disable a service (hide from rail + exclude from bulk/scheduled;
   *  keeps the login session). Persisted. */
  setServiceEnabled: (serviceId: ServiceId, enabled: boolean) => void
  /** Queue a download for every enabled + logged-in service, using each
   *  service's saved settings (creator selection + file types + skip). */
  startBulkDownload: () => void
  /** Update + persist the daily auto-download schedule. */
  setSchedule: (patch: Partial<ScheduleConfig>) => void
}

/** Language dictionary — flat string map (keys defined in i18n.ts). */
export type Dict = Record<string, string>

export interface AppContextValue {
  /** Preferences (named `t` to mirror the design's tweak object). */
  t: Prefs
  setTweak: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  L: Dict
  lang: Lang
  nav: Nav
  go: (nav: Nav) => void
  state: AppState
  actions: AppActions
  /** Downloaded posts (real data), mapped for the library views. */
  posts: ViewPost[]
}
