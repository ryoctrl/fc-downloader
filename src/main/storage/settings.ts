/** Simple JSON-file-backed application settings. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings } from '@shared/types'

let settingsPath = ''
let cache: AppSettings | null = null

export function initSettings(userDataDir: string, defaultDownloadRoot: string): void {
  settingsPath = join(userDataDir, 'settings.json')
  const defaults: AppSettings = { downloadRoot: defaultDownloadRoot, defaultConcurrency: 3 }
  if (existsSync(settingsPath)) {
    try {
      cache = { ...defaults, ...JSON.parse(readFileSync(settingsPath, 'utf-8')) }
    } catch {
      cache = defaults
    }
  } else {
    cache = defaults
    persist()
  }
}

export function getSettings(): AppSettings {
  if (!cache) throw new Error('Settings not initialized')
  return cache
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  cache = { ...getSettings(), ...patch }
  persist()
  return cache
}

function persist(): void {
  if (cache) writeFileSync(settingsPath, JSON.stringify(cache, null, 2), 'utf-8')
}
