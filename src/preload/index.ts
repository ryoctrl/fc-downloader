import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcEventChannel, IpcEvents, RendererApi } from '@shared/ipc'

const invokeChannels: IpcChannel[] = [
  'services:list',
  'services:openLogin',
  'services:checkAuth',
  'services:clearSession',
  'creators:list',
  'download:start',
  'download:cancel',
  'download:status',
  'settings:get',
  'settings:update',
  'settings:pickDownloadRoot',
  'viewer:tree',
  'viewer:openPath',
  'shell:openExternal',
  'posts:list',
  'posts:files',
  'library:backfillAvatars'
]

const api = {
  on<E extends IpcEventChannel>(event: E, listener: (payload: IpcEvents[E]) => void): () => void {
    const handler = (_e: unknown, payload: IpcEvents[E]): void => listener(payload)
    ipcRenderer.on(event, handler)
    return () => ipcRenderer.removeListener(event, handler)
  }
} as Record<string, unknown>

for (const channel of invokeChannels) {
  api[channel] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('api', api as unknown as RendererApi)
