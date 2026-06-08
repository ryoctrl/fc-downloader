/**
 * "Launch at login" toggle. The OS login-item registry (Windows Run key /
 * macOS LaunchAgents) is the single source of truth — we don't persist this in
 * settings.json, we just read/write the OS state via Electron. Supported on
 * Windows and macOS; on Linux Electron treats it as a no-op (openAtLogin stays
 * false), so the toggle reflects reality there too.
 */
import { app } from 'electron'

/** Whether the app is currently registered to launch at login. */
export function isStartupEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

/** Register/unregister launch-at-login; returns the resulting OS state. */
export function setStartupEnabled(enabled: boolean): boolean {
  app.setLoginItemSettings({ openAtLogin: enabled })
  return app.getLoginItemSettings().openAtLogin
}
