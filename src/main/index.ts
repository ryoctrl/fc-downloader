import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { registerIpcHandlers } from './ipc/handlers'
import { initDb, closeDb } from './storage/db'
import { getSettings, initSettings, updateSettings } from './storage/settings'
import { registerFcfileHandler, registerFcfileScheme } from './protocol/fcfile'
import { registerFciconHandler, registerFciconScheme } from './protocol/fcicon'

// Privileged-scheme registration must happen before the app is ready.
registerFcfileScheme()
registerFciconScheme()

let mainWindow: BrowserWindow | null = null

// Attaching a <webview> drops the window out of a Windows "snapped" (Aero Snap
// half-screen) state, resetting its size/position. When the renderer is about
// to mount a service <webview> it calls window:pinBounds; for a short window
// after that we restore the captured bounds instead of saving the un-snapped
// ones, so a snapped layout survives navigating to a service screen.
let pinnedBounds: { x: number; y: number; width: number; height: number } | null = null
let pinUntil = 0

function createWindow(): void {
  // Restore the last window size/position so it never reverts to a default size.
  const saved = getSettings().windowBounds
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 800,
    x: saved?.x,
    y: saved?.y,
    minWidth: 640,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    // Dev: show the app icon on the window/taskbar (packaged builds use the exe
    // icon from electron-builder, where build/ isn't bundled).
    icon: process.env.ELECTRON_RENDERER_URL ? join(__dirname, '../../build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Required so the renderer can embed <webview> tags for service logins.
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Persist size/position (debounced) so it's restored on the next launch.
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const saveBounds = (): void => {
    if (!mainWindow || mainWindow.isMinimized() || mainWindow.isMaximized()) return
    const b = mainWindow.getBounds()
    updateSettings({ windowBounds: { width: b.width, height: b.height, x: b.x, y: b.y } })
  }
  const scheduleSaveBounds = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveBounds, 500)
  }
  const onBoundsChanged = (): void => {
    if (!mainWindow) return
    // During the post-navigation pin window, a bounds change is the webview
    // attach un-snapping us — restore the pinned bounds instead of saving.
    if (pinnedBounds && Date.now() < pinUntil) {
      const b = mainWindow.getBounds()
      if (
        b.x !== pinnedBounds.x ||
        b.y !== pinnedBounds.y ||
        b.width !== pinnedBounds.width ||
        b.height !== pinnedBounds.height
      ) {
        mainWindow.setBounds(pinnedBounds)
      }
      return
    }
    scheduleSaveBounds()
  }
  mainWindow.on('resize', onBoundsChanged)
  mainWindow.on('move', onBoundsChanged)
  mainWindow.on('close', saveBounds)

  // Open target=_blank links in the system browser, not new Electron windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Same for links inside the embedded service <webview>s (e.g. a creator's
  // X / social link). A target=_blank / window.open there otherwise does
  // nothing — the popup is swallowed — so route it to the system browser.
  // Regular in-webview navigation (logins, OAuth redirects, browsing) is left
  // untouched so those flows keep working.
  mainWindow.webContents.on('did-attach-webview', (_event, guest) => {
    guest.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const userData = app.getPath('userData')
  // Default under Documents (not the noisy Downloads folder).
  const defaultDownloadRoot = join(app.getPath('documents'), 'fc-downloader')
  initDb(userData)
  initSettings(userData, defaultDownloadRoot)
  registerFcfileHandler() // after settings: the handler reads the download root
  registerFciconHandler()
  registerIpcHandlers(() => mainWindow)

  // Capture the current (possibly snapped) bounds just before the renderer
  // mounts a service <webview>, so onBoundsChanged can restore them if the
  // attach un-snaps the window.
  ipcMain.handle('window:pinBounds', () => {
    if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized()) return
    pinnedBounds = mainWindow.getBounds()
    pinUntil = Date.now() + 1500
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => closeDb())
