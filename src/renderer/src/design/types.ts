/* fc-downloader — renderer design-layer types (ported from the design handoff) */

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
  | { screen: 'post'; postId: number; from?: string }
  | { screen: 'settings' }

export interface DownloadPlan {
  items: Post[]
  dup?: number
}

export interface DownloadState {
  svcId: ServiceId
  items: Post[]
  dup: number
  done: boolean
  startedAt: number
}

export interface AppState {
  logins: Record<string, boolean>
  favs: Set<number>
  download: DownloadState | null
  saveDir: string
  concurrency: number
  skipDupDefault: boolean
  brandLogos: Record<string, string>
}

export interface AppActions {
  toggleFav: (id: number) => void
  /** Re-check the real login state for a service (services:checkAuth). */
  recheckAuth: (id: ServiceId) => void
  /** Clear a service's cookies/session (services:clearSession). */
  clearSession: (id: ServiceId) => void
  startDownload: (svc: DesignService, plan: DownloadPlan) => void
  markDownloadDone: () => void
  cancelDownload: () => void
  setConcurrency: (n: number) => void
  /** Open the OS folder picker and persist the chosen download root. */
  pickSaveDir: () => void
  toggleSkipDefault: () => void
  setBrandLogo: (id: ServiceId, dataUrl: string) => void
  clearBrandLogo: (id: ServiceId) => void
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
}
