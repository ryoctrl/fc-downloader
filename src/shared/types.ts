/**
 * Shared domain types used by both the main process and the renderer.
 * Keep this file free of any Node/Electron/DOM-specific imports so it can be
 * consumed from either side.
 */

/** Stable identifier for a supported support-site service. */
export type ServiceId = 'fantia' | 'fanbox' | 'patreon' | 'cien'

/** Static descriptor for a service, surfaced in the sidebar. */
export interface ServiceDescriptor {
  id: ServiceId
  /** Human-readable name shown in the UI. */
  name: string
  /** URL the embedded WebView opens for login / browsing. */
  homeUrl: string
  /** Whether the user currently appears to be logged in (best-effort). */
  loggedIn: boolean
}

/** A creator / author the user supports on a given service. */
export interface Creator {
  serviceId: ServiceId
  /** Service-native id of the creator (e.g. Fantia fanclub id). */
  creatorId: string
  name: string
  /** Optional avatar/thumbnail URL. */
  iconUrl?: string
}

/** A single post (the unit of dedup and of a viewer folder). */
export interface Post {
  serviceId: ServiceId
  creatorId: string
  postId: string
  title: string
  /** ISO-8601 timestamp of when the post was published. */
  postedAt: string
  /** Derived from postedAt; used for the year/month folder layout. */
  year: number
  month: number
  /** Canonical web page for this post (for "open in browser"), if known. */
  url?: string
  /** Files attached to / embedded in this post. */
  files: PostFile[]
}

export type PostFileKind = 'image' | 'video' | 'audio' | 'file' | 'thumbnail'

/** A downloadable artifact belonging to a post. */
export interface PostFile {
  /** Stable id within the post (service-native or derived). */
  fileId: string
  kind: PostFileKind
  /** Original file name as offered by the service, if any. */
  name: string
  /** Remote URL to fetch. May require the service session cookies. */
  url: string
  /** Size in bytes if known ahead of time. */
  sizeBytes?: number
}

/**
 * Folder layout key. The on-disk path is:
 *   <root>/<serviceId>/<creatorId>/<year>/<month(2)>/<postId>/
 * This same tuple is the dedup key.
 */
export interface PostLocation {
  serviceId: ServiceId
  creatorId: string
  year: number
  month: number
  postId: string
}

export type DownloadStatus =
  | 'pending'
  | 'downloading'
  | 'completed'
  | 'skipped' // already on disk (dedup hit)
  | 'failed'
  | 'canceled'

/** One row in the download queue (per file). */
export interface DownloadItem {
  id: string
  serviceId: ServiceId
  creatorId: string
  postId: string
  fileId: string
  fileName: string
  status: DownloadStatus
  bytesDownloaded: number
  bytesTotal?: number
  error?: string
}

/** Aggregate progress for a download run. */
export interface DownloadProgress {
  total: number
  completed: number
  skipped: number
  failed: number
  inFlight: number
  /** Posts fully processed so far (monotonic; the file total is discovered as
   * the run streams, so this is the stable per-post counter for the UI). */
  postsCompleted: number
  /** Total posts to process, counted up front. 0 when unknown (the service
   * can't be cheaply counted), in which case the UI shows an indeterminate bar. */
  postsTotal: number
  /** Bytes across the whole run. */
  bytesDownloaded: number
  bytesTotal: number
}

/** User-tunable settings for a download run. */
export interface DownloadOptions {
  /** Restrict to specific creators; empty = all the user supports. */
  creatorIds: string[]
  /** Skip posts already fully recorded in the metadata DB. */
  skipExisting: boolean
  /** Max concurrent file downloads. */
  concurrency: number
  /** Which file kinds to include. */
  includeKinds: PostFileKind[]
}

/** Persisted application-wide settings. */
export interface AppSettings {
  /** Root directory all downloads are written under. */
  downloadRoot: string
  defaultConcurrency: number
  /** Last window size/position, restored on launch. */
  windowBounds?: { width: number; height: number; x?: number; y?: number }
}

/**
 * A downloaded post as recorded in the metadata ledger, enriched for the
 * library viewer. This is the real-data replacement for the mock post shape.
 */
export interface LibraryPost {
  serviceId: ServiceId
  creatorId: string
  /** Display name (falls back to creatorId if unknown). */
  creatorName: string
  /** fcfile:// URL of the creator's avatar saved on disk, if any. */
  creatorIconUrl?: string
  /** Canonical web page for this post (for "open in browser"), if known. */
  postUrl?: string
  postId: string
  title: string
  /** ISO-8601 publish timestamp. */
  postedAt: string
  year: number
  month: number
  /** Absolute directory on disk. */
  dirPath: string
  /** Number of files recorded on disk for this post. */
  fileCount: number
  /** Sum of known file sizes, in bytes. */
  sizeBytes: number
  /** Dominant file kind (for icons / filtering). */
  type: PostFileKind
  /** fcfile:// URL of the post's first image on disk, for a real thumbnail. */
  coverUrl?: string
  /** Whether the post's in-scope files are all downloaded. */
  completed: boolean
}

/** A real file inside a downloaded post's folder, for the media viewer. */
export interface LibraryFile {
  name: string
  /** A fcfile:// URL the renderer can load in <img>/<video>/<audio>. */
  url: string
  kind: PostFileKind
  sizeBytes: number
}

/** Result of checking GitHub for a newer release. */
export interface UpdateInfo {
  /** True when the latest published release is newer than the running version. */
  available: boolean
  /** Running app version (e.g. "1.0.1"). */
  current: string
  /** Latest published release version (tag without the leading "v"). */
  latest: string
  /** Release page URL to open. */
  url: string
}

/** A node in the viewer tree (service -> creator -> year -> month -> post). */
export interface ViewerNode {
  key: string
  label: string
  kind: 'service' | 'creator' | 'year' | 'month' | 'post'
  /** Absolute path on disk for leaf (post) nodes. */
  path?: string
  children?: ViewerNode[]
  /** For post nodes: file count on disk. */
  fileCount?: number
}
