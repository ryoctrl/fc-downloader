import { describe, expect, it } from 'vitest'
import { allLoginsSettled, dayKey, isScheduleDue, minutesOf } from './schedule'

const at = (h: number, m: number): Date => new Date(2026, 5, 10, h, m, 0)
const TODAY = dayKey(at(0, 0))

describe('minutesOf', () => {
  it('parses HH:MM, defaulting a malformed value to 0', () => {
    expect(minutesOf('03:00')).toBe(180)
    expect(minutesOf('23:59')).toBe(1439)
    expect(minutesOf('')).toBe(0)
  })
})

describe('isScheduleDue', () => {
  const sch = { enabled: true, time: '03:00' }

  it('is not due when disabled', () => {
    expect(isScheduleDue({ enabled: false, time: '03:00' }, '', at(9, 0))).toBe(false)
  })

  it('is not due when already run today', () => {
    expect(isScheduleDue(sch, TODAY, at(9, 0))).toBe(false)
  })

  it('is due once the time has passed and today has not run', () => {
    expect(isScheduleDue(sch, '', at(9, 0))).toBe(true)
    expect(isScheduleDue(sch, '2026-6-9', at(3, 0))).toBe(true) // boundary: == time
  })

  it('is not due before the configured time', () => {
    expect(isScheduleDue(sch, '', at(2, 59))).toBe(false)
  })
})

describe('allLoginsSettled', () => {
  const IDS = ['fantia', 'fanbox', 'cien', 'patreon']

  it('is false while any enabled service login is still undefined', () => {
    // Fantia resolved, the rest still loading — the daily run must wait.
    expect(allLoginsSettled(IDS, {}, { fantia: true })).toBe(false)
  })

  it('is true once every enabled service has a defined login', () => {
    expect(
      allLoginsSettled(IDS, {}, { fantia: true, fanbox: true, cien: false, patreon: false })
    ).toBe(true)
  })

  it('ignores disabled services (they need not have settled)', () => {
    expect(
      allLoginsSettled(IDS, { patreon: false, cien: false }, { fantia: true, fanbox: false })
    ).toBe(true)
  })

  it('treats a false login as settled (logged out is a known state)', () => {
    expect(allLoginsSettled(['fantia'], {}, { fantia: false })).toBe(true)
  })
})
