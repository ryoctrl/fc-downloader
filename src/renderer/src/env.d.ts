/// <reference types="vite/client" />
import type { RendererApi } from '@shared/ipc'

declare global {
  interface Window {
    api: RendererApi
  }
  /** App version, injected from package.json at build time (electron.vite.config). */
  const __APP_VERSION__: string
}

export {}
