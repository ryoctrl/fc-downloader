/** Registers all IPC handlers and wires download events back to the renderer. */
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcApi, IpcChannel, IpcEventChannel, IpcEvents } from '@shared/ipc'
import type {
  DownloadItem,
  DownloadOptions,
  DownloadProgress,
  ServiceDescriptor,
  ServiceId
} from '@shared/types'
import { listServices } from '@main/services/registry'
import { createServiceContext } from '@main/services/context'
import { clearSession } from '@main/session/manager'
import { getSettings, updateSettings } from '@main/storage/settings'
import { buildViewerTree } from '@main/storage/viewer'
import { creatorsMissingIcon, listPosts, setCreatorIcon } from '@main/storage/db'
import { listPostFiles } from '@main/storage/files'
import { DownloadEngine } from '@main/download/engine'
import { ensureCreatorAvatar } from '@main/download/avatar'

const engine = new DownloadEngine()
let recentItems: DownloadItem[] = []

/** Type-safe wrapper around ipcMain.handle. */
function handle<C extends IpcChannel>(
  channel: C,
  fn: (...args: IpcApi[C]['args']) => Promise<IpcApi[C]['result']> | IpcApi[C]['result']
): void {
  ipcMain.handle(channel, (_e, ...args) => fn(...(args as IpcApi[C]['args'])))
}

function emit<E extends IpcEventChannel>(win: BrowserWindow, event: E, payload: IpcEvents[E]): void {
  win.webContents.send(event, payload)
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  handle('services:list', async (): Promise<ServiceDescriptor[]> => {
    const result: ServiceDescriptor[] = []
    for (const svc of listServices()) {
      result.push({ id: svc.id, name: svc.name, homeUrl: svc.homeUrl, loggedIn: false })
    }
    return result
  })

  handle('services:openLogin', async (_serviceId) => {
    // Login happens in the renderer's <webview>; nothing to do in main. Kept in
    // the contract so the UI can signal intent / main can react in the future.
  })

  handle('services:checkAuth', async (serviceId) => {
    const svc = listServices().find((s) => s.id === serviceId)
    if (!svc) return false
    const ac = new AbortController()
    const ctx = createServiceContext(serviceId, ac.signal)
    const ok = await svc.checkAuth(ctx)
    const win = getWindow()
    if (win) emit(win, 'services:authChanged', { serviceId, loggedIn: ok })
    return ok
  })

  handle('services:clearSession', async (serviceId) => {
    await clearSession(serviceId)
    const win = getWindow()
    if (win) emit(win, 'services:authChanged', { serviceId, loggedIn: false })
  })

  handle('creators:list', async (serviceId) => {
    const svc = listServices().find((s) => s.id === serviceId)
    if (!svc) return []
    const ac = new AbortController()
    const ctx = createServiceContext(serviceId, ac.signal)
    return svc.listCreators(ctx)
  })

  // Sequential download queue: one service runs at a time; starting another
  // while one is active enqueues it (so the running download is never cut off).
  const queue: { serviceId: ServiceId; options: DownloadOptions }[] = []
  let active: ServiceId | null = null

  const emitQueue = (): void => {
    const win = getWindow()
    if (win) emit(win, 'download:queue', { active, queued: queue.map((q) => q.serviceId) })
  }

  const blankProgress = (): DownloadProgress => ({
    total: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    inFlight: 0,
    bytesDownloaded: 0,
    bytesTotal: 0
  })

  const processNext = (): void => {
    const item = queue.shift()
    if (!item) {
      active = null
      emitQueue()
      return
    }
    active = item.serviceId
    emitQueue()
    recentItems = []
    let lastProgress = blankProgress()
    void engine
      .run(item.serviceId, getSettings().downloadRoot, item.options, {
        onProgress: (progress) => {
          lastProgress = progress
          const win = getWindow()
          if (win) emit(win, 'download:progress', progress)
        },
        onItem: (it) => {
          const win = getWindow()
          const dlItem: DownloadItem = {
            id: `${it.postId}:${it.fileId}`,
            serviceId: it.serviceId,
            creatorId: '',
            postId: it.postId,
            fileId: it.fileId,
            fileName: it.fileName,
            status: it.status,
            bytesDownloaded: 0,
            error: it.error
          }
          recentItems.push(dlItem)
          if (win) emit(win, 'download:item', dlItem)
        }
      })
      .catch((err) => console.error('[download] run failed', err))
      .finally(() => {
        const win = getWindow()
        if (win) emit(win, 'download:done', lastProgress)
        processNext()
      })
  }

  handle('download:start', async (serviceId, options) => {
    queue.push({ serviceId, options })
    emitQueue()
    if (!active) processNext()
  })

  handle('download:cancel', async () => {
    queue.length = 0
    if (engine.isRunning()) engine.cancel()
    else {
      active = null
      emitQueue()
    }
  })

  handle('download:status', async () => recentItems)

  handle('settings:get', async () => getSettings())
  handle('settings:update', async (patch) => updateSettings(patch))
  handle('settings:pickDownloadRoot', async () => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win ?? undefined!, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  handle('viewer:tree', async () => buildViewerTree(getSettings().downloadRoot))
  handle('viewer:openPath', async (path) => {
    await shell.openPath(path)
  })
  handle('shell:openExternal', async (url) => {
    // Only open web URLs in the external browser — never file:// or other schemes.
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url)
  })

  handle('posts:list', async () => listPosts())
  handle('posts:files', async (dirPath) => listPostFiles(dirPath))

  handle('library:backfillAvatars', async () => {
    const missing = creatorsMissingIcon()
    if (missing.length === 0) return 0
    const root = getSettings().downloadRoot
    // Group missing creators by service so listCreators is fetched once each.
    const byService = new Map<ServiceId, Set<string>>()
    for (const m of missing) {
      const set = byService.get(m.serviceId) ?? new Set()
      set.add(m.creatorId)
      byService.set(m.serviceId, set)
    }
    let updated = 0
    for (const [serviceId, creatorIds] of byService) {
      const svc = listServices().find((s) => s.id === serviceId)
      if (!svc) continue
      const ac = new AbortController()
      const ctx = createServiceContext(serviceId, ac.signal)
      // Resolve live icon URLs (needs login; returns [] otherwise — best effort).
      const creators = await svc.listCreators(ctx).catch(() => [])
      const iconById = new Map(creators.map((c) => [c.creatorId, c.iconUrl]))
      for (const creatorId of creatorIds) {
        const iconUrl = iconById.get(creatorId)
        if (!iconUrl) continue
        try {
          const url = await ensureCreatorAvatar(
            serviceId,
            root,
            creatorId,
            iconUrl,
            svc.downloadHeaders,
            ac.signal
          )
          if (url) {
            setCreatorIcon(serviceId, creatorId, url)
            updated++
          }
        } catch (err) {
          console.warn(`[avatar] backfill failed for ${serviceId}/${creatorId}`, err)
        }
      }
    }
    return updated
  })
}
