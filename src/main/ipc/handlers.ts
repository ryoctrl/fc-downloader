/** Registers all IPC handlers and wires download events back to the renderer. */
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcApi, IpcChannel, IpcEventChannel, IpcEvents } from '@shared/ipc'
import type { DownloadItem, ServiceDescriptor } from '@shared/types'
import { listServices } from '@main/services/registry'
import { createServiceContext } from '@main/services/context'
import { clearSession } from '@main/session/manager'
import { getSettings, updateSettings } from '@main/storage/settings'
import { buildViewerTree } from '@main/storage/viewer'
import { DownloadEngine } from '@main/download/engine'

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

  handle('download:start', async (serviceId, options) => {
    const { downloadRoot } = getSettings()
    recentItems = []
    void engine.run(serviceId, downloadRoot, options, {
      onProgress: (progress) => {
        const win = getWindow()
        if (win) emit(win, 'download:progress', progress)
      },
      onItem: (item) => {
        const win = getWindow()
        const dlItem: DownloadItem = {
          id: `${item.postId}:${item.fileId}`,
          serviceId: item.serviceId,
          creatorId: '',
          postId: item.postId,
          fileId: item.fileId,
          fileName: item.fileName,
          status: item.status,
          bytesDownloaded: 0,
          error: item.error
        }
        recentItems.push(dlItem)
        if (win) emit(win, 'download:item', dlItem)
      }
    })
  })

  handle('download:cancel', async () => {
    engine.cancel()
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
}
