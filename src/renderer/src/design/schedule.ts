/* Pure helpers for the daily auto-download scheduler (testable, no React). */
import type { ScheduleConfig } from './types'

/**
 * Whether every enabled service's login state has settled — i.e. each service
 * is either disabled or has a defined (true/false) login, not a still-loading
 * `undefined`. The daily run must wait for this so the fastest service to
 * authenticate doesn't fire the run (and consume the day's slot) before the
 * slower ones' logins are known, which would download only that one service.
 */
export function allLoginsSettled(
  serviceIds: readonly string[],
  enabled: Record<string, boolean>,
  logins: Record<string, boolean>
): boolean {
  return serviceIds.every((id) => enabled[id] === false || logins[id] !== undefined)
}

/** Minutes-since-midnight for a "HH:MM" string (0 on a malformed value). */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Local day key "YYYY-M-D" used to fire the schedule at most once per day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/**
 * Whether the schedule should run now: it's enabled, today hasn't run yet, and
 * the local clock is at or past the configured time. Note this only decides
 * *eligibility by time* — the caller must still confirm a run actually started
 * (e.g. a service is logged in) before marking the day as done, so a launch
 * "catch-up" isn't consumed while login state is still loading.
 */
export function isScheduleDue(schedule: ScheduleConfig, lastRunDay: string, now: Date): boolean {
  if (!schedule.enabled) return false
  if (lastRunDay === dayKey(now)) return false
  return now.getHours() * 60 + now.getMinutes() >= minutesOf(schedule.time)
}
