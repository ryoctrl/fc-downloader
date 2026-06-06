/* fc-downloader — app context (tweaks/prefs, language, navigation, state) */
import { createContext, useContext } from 'react'
import type { AppContextValue } from './types'

export const AppCtx = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within <AppCtx.Provider>')
  return ctx
}
