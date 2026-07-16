/**
 * Typed IPC contract between the renderer and the main process.
 *
 * - `IpcApi` describes request/response (invoke/handle) channels.
 * - `IpcEvents` describes main -> renderer push events (download progress, etc).
 *
 * The preload script exposes a `window.api` object implementing `RendererApi`,
 * which is the renderer-facing shape derived from `IpcApi`.
 */
import type {
  AppSettings,
  Creator,
  DownloadItem,
  DownloadOptions,
  DownloadProgress,
  LibraryFile,
  LibraryPost,
  ServiceDescriptor,
  ServiceId,
  UpdateInfo,
  ViewerNode
} from './types'

/** Channel name -> { args; result } for invoke/handle calls. */
export interface IpcApi {
  'services:list': { args: []; result: ServiceDescriptor[] }
  'services:openLogin': { args: [serviceId: ServiceId]; result: void }
  'services:checkAuth': { args: [serviceId: ServiceId]; result: boolean }
  'services:clearSession': { args: [serviceId: ServiceId]; result: void }

  'creators:list': { args: [serviceId: ServiceId]; result: Creator[] }
  /** Creator ids that have a downloadable post newer than what's on disk (a
   * "new posts" indicator). Walks the service's recent feed; [] when the
   * service has no feed or nothing is new. */
  'creators:checkNew': { args: [serviceId: ServiceId]; result: string[] }

  'download:start': { args: [serviceId: ServiceId, options: DownloadOptions]; result: void }
  'download:cancel': { args: []; result: void }
  'download:status': { args: []; result: DownloadItem[] }

  'settings:get': { args: []; result: AppSettings }
  'settings:update': { args: [patch: Partial<AppSettings>]; result: AppSettings }
  'settings:pickDownloadRoot': { args: []; result: string | null }

  'viewer:tree': { args: []; result: ViewerNode[] }
  'viewer:openPath': { args: [path: string]; result: void }
  /** Read a downloaded file's raw bytes (within the download root only), for the
   * PSD viewer to parse. Null if outside the root or unreadable. */
  'psd:read': { args: [dirPath: string, fileName: string]; result: Uint8Array | null }
  /** Save an exported image (e.g. a PSD layer composite) to disk via a save
   * dialog defaulted to `suggestedPath`. Returns the saved path, or null if the
   * user cancelled. */
  'psd:exportImage': {
    args: [suggestedPath: string, data: Uint8Array]
    result: string | null
  }
  /** Save a generated thumbnail (JPEG bytes) for a specific .psd as a sidecar in
   * its post folder (within the download root only). Returns the fcfile:// URL of
   * the saved thumbnail, or null if outside the root / on failure. */
  'psd:saveThumb': {
    args: [dirPath: string, psdFileName: string, data: Uint8Array]
    result: string | null
  }
  /** Open an http(s) URL in the user's default browser. */
  'shell:openExternal': { args: [url: string]; result: void }
  /** Extract a downloaded .zip (within the download root) into a sibling folder
   * and reveal it. Returns the folder path, or null on failure. */
  'archive:extract': { args: [dirPath: string, fileName: string]; result: string | null }
  /** Capture the window's current bounds before a service <webview> mounts, so
   * the main process can restore them if the attach un-snaps the window. */
  'window:pinBounds': { args: []; result: void }

  'posts:list': { args: []; result: LibraryPost[] }
  'posts:files': { args: [dirPath: string]; result: LibraryFile[] }
  /** Delete a non-recorded file from a post's folder (within the download root) —
   * e.g. a PSD export the user saved. Refuses to delete recorded downloads.
   * Returns true if the file was removed. */
  'posts:deleteFile': { args: [dirPath: string, fileName: string]; result: boolean }
  /** Fetch avatars for already-downloaded creators that lack one. Returns the
   * number of creators updated (0 if none missing or not logged in). */
  'library:backfillAvatars': { args: []; result: number }
  /** Reconcile the ledger with disk: drop records for files deleted outside the
   * app, removing now-empty posts. Returns what changed. */
  'library:reconcile': {
    args: []
    result: { removedPosts: number; updatedPosts: number; removedFiles: number }
  }
  /** Check GitHub for a newer release. Null when the check fails. */
  'app:checkUpdate': { args: []; result: UpdateInfo | null }
  /** Whether the app is registered to launch at login (OS login item). */
  'app:getStartupEnabled': { args: []; result: boolean }
  /** Enable/disable launch-at-login; returns the resulting OS state. */
  'app:setStartupEnabled': { args: [enabled: boolean]; result: boolean }
}

export type IpcChannel = keyof IpcApi

/** Main -> renderer push events. */
export interface IpcEvents {
  'download:progress': DownloadProgress
  'download:item': DownloadItem
  /** Emitted once when a download run finishes (completed, failed, or canceled). */
  'download:done': DownloadProgress
  /** Current download queue state (active run + pending services). */
  'download:queue': { active: ServiceId | null; queued: ServiceId[] }
  'services:authChanged': { serviceId: ServiceId; loggedIn: boolean }
  /** Progress while enumerating a service's creator list. `total` is 0 until the
   *  count is known (indeterminate). Emitted during `creators:list`. */
  'creators:progress': { serviceId: ServiceId; done: number; total: number }
}

export type IpcEventChannel = keyof IpcEvents

/** Shape exposed on `window.api` in the renderer (see preload). */
export type RendererApi = {
  [K in IpcChannel]: (...args: IpcApi[K]['args']) => Promise<IpcApi[K]['result']>
} & {
  /** Subscribe to a push event; returns an unsubscribe function. */
  on<E extends IpcEventChannel>(event: E, listener: (payload: IpcEvents[E]) => void): () => void
}
