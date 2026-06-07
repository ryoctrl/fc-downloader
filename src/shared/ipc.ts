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
  ViewerNode
} from './types'

/** Channel name -> { args; result } for invoke/handle calls. */
export interface IpcApi {
  'services:list': { args: []; result: ServiceDescriptor[] }
  'services:openLogin': { args: [serviceId: ServiceId]; result: void }
  'services:checkAuth': { args: [serviceId: ServiceId]; result: boolean }
  'services:clearSession': { args: [serviceId: ServiceId]; result: void }

  'creators:list': { args: [serviceId: ServiceId]; result: Creator[] }

  'download:start': { args: [serviceId: ServiceId, options: DownloadOptions]; result: void }
  'download:cancel': { args: []; result: void }
  'download:status': { args: []; result: DownloadItem[] }

  'settings:get': { args: []; result: AppSettings }
  'settings:update': { args: [patch: Partial<AppSettings>]; result: AppSettings }
  'settings:pickDownloadRoot': { args: []; result: string | null }

  'viewer:tree': { args: []; result: ViewerNode[] }
  'viewer:openPath': { args: [path: string]; result: void }

  'posts:list': { args: []; result: LibraryPost[] }
  'posts:files': { args: [dirPath: string]; result: LibraryFile[] }
  /** Fetch avatars for already-downloaded creators that lack one. Returns the
   * number of creators updated (0 if none missing or not logged in). */
  'library:backfillAvatars': { args: []; result: number }
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
}

export type IpcEventChannel = keyof IpcEvents

/** Shape exposed on `window.api` in the renderer (see preload). */
export type RendererApi = {
  [K in IpcChannel]: (...args: IpcApi[K]['args']) => Promise<IpcApi[K]['result']>
} & {
  /** Subscribe to a push event; returns an unsubscribe function. */
  on<E extends IpcEventChannel>(event: E, listener: (payload: IpcEvents[E]) => void): () => void
}
