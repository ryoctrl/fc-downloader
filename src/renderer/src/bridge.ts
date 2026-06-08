/*
 * Thin, typed wrapper over the preload `window.api`. All renderer ↔ main
 * communication should go through here so screens don't touch `window.api`
 * directly and so the UI degrades gracefully when the backend is absent
 * (e.g. the renderer opened in a plain browser preview, where `window.api`
 * is undefined and there is no preload bridge).
 */
import type { IpcEvents, RendererApi } from '@shared/ipc'
import type {
  AppSettings,
  Creator,
  DownloadOptions,
  LibraryFile,
  LibraryPost,
  ServiceId,
  UpdateInfo,
  ViewerNode
} from '@shared/types'

const api: RendererApi | undefined =
  typeof window !== 'undefined' ? (window as unknown as { api?: RendererApi }).api : undefined

/** True when running inside Electron with the preload bridge available. */
export const hasBackend = !!api

const noop = (): void => {}

export const bridge = {
  hasBackend,

  // settings
  getSettings: (): Promise<AppSettings | null> => api?.['settings:get']() ?? Promise.resolve(null),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings | null> =>
    api?.['settings:update'](patch) ?? Promise.resolve(null),
  pickDownloadRoot: (): Promise<string | null> =>
    api?.['settings:pickDownloadRoot']() ?? Promise.resolve(null),

  // services
  checkAuth: (id: ServiceId): Promise<boolean> =>
    api?.['services:checkAuth'](id) ?? Promise.resolve(false),
  clearSession: (id: ServiceId): Promise<void> =>
    api?.['services:clearSession'](id) ?? Promise.resolve(),
  listCreators: (id: ServiceId): Promise<Creator[]> =>
    api?.['creators:list'](id) ?? Promise.resolve([]),
  onAuthChanged: (cb: (p: IpcEvents['services:authChanged']) => void): (() => void) =>
    api ? api.on('services:authChanged', cb) : noop,

  // downloads
  startDownload: (id: ServiceId, opts: DownloadOptions): Promise<void> =>
    api?.['download:start'](id, opts) ?? Promise.resolve(),
  cancelDownload: (): Promise<void> => api?.['download:cancel']() ?? Promise.resolve(),
  onDownloadProgress: (cb: (p: IpcEvents['download:progress']) => void): (() => void) =>
    api ? api.on('download:progress', cb) : noop,
  onDownloadItem: (cb: (p: IpcEvents['download:item']) => void): (() => void) =>
    api ? api.on('download:item', cb) : noop,
  onDownloadDone: (cb: (p: IpcEvents['download:done']) => void): (() => void) =>
    api ? api.on('download:done', cb) : noop,
  onDownloadQueue: (cb: (p: IpcEvents['download:queue']) => void): (() => void) =>
    api ? api.on('download:queue', cb) : noop,

  // viewer / library
  viewerTree: (): Promise<ViewerNode[]> => api?.['viewer:tree']() ?? Promise.resolve([]),
  openPath: (path: string): Promise<void> => api?.['viewer:openPath'](path) ?? Promise.resolve(),
  openExternal: (url: string): Promise<void> =>
    api?.['shell:openExternal'](url) ?? Promise.resolve(),
  extractArchive: (dirPath: string, fileName: string): Promise<string | null> =>
    api?.['archive:extract'](dirPath, fileName) ?? Promise.resolve(null),
  pinWindowBounds: (): Promise<void> => api?.['window:pinBounds']() ?? Promise.resolve(),
  listPosts: (): Promise<LibraryPost[]> => api?.['posts:list']() ?? Promise.resolve([]),
  listFiles: (dirPath: string): Promise<LibraryFile[]> =>
    api?.['posts:files'](dirPath) ?? Promise.resolve([]),
  backfillAvatars: (): Promise<number> =>
    api?.['library:backfillAvatars']() ?? Promise.resolve(0),
  reconcileLibrary: (): Promise<{ removedPosts: number; updatedPosts: number; removedFiles: number }> =>
    api?.['library:reconcile']() ?? Promise.resolve({ removedPosts: 0, updatedPosts: 0, removedFiles: 0 }),
  checkUpdate: (): Promise<UpdateInfo | null> =>
    api?.['app:checkUpdate']() ?? Promise.resolve(null)
}
