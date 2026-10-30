import { describe, expect, it, vi } from 'vitest'
import { compareVersions } from './check'

// See manager.test.ts: keep the real `electron` package (and its lazy binary
// download) out of this pure-helper test.
vi.mock('electron', () => ({}))

describe('compareVersions', () => {
  it('orders by major, minor, then patch', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('treats missing components as 0', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.1', '1.2')).toBeGreaterThan(0)
  })

  it('does not flag an equal or older latest as an update', () => {
    // available = compareVersions(latest, current) > 0
    expect(compareVersions('1.0.1', '1.0.1') > 0).toBe(false)
    expect(compareVersions('1.0.0', '1.0.1') > 0).toBe(false)
  })
})
