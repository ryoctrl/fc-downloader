import { describe, expect, it } from 'vitest'
import { estimateEtaSec, formatEta, formatSpeed, initSpeed, pushSample } from './metrics'

describe('pushSample', () => {
  it('primes on the first sample without reporting a rate', () => {
    const r = pushSample(initSpeed(), 1000, 1000)
    expect(r.bps).toBe(0)
    expect(r.state.started).toBe(true)
  })

  it('computes instantaneous bytes/sec on the second sample', () => {
    const a = pushSample(initSpeed(), 0, 1000)
    const b = pushSample(a.state, 1_000_000, 2000) // +1MB over 1s
    expect(b.bps).toBe(1_000_000)
  })

  it('smooths with an EMA and ignores non-advancing time', () => {
    const a = pushSample(initSpeed(), 0, 0)
    const b = pushSample(a.state, 1000, 1000) // 1000 B/s
    const same = pushSample(b.state, 5000, 1000) // dt=0 -> keep ema
    expect(same.bps).toBe(b.bps)
    const c = pushSample(b.state, 1000, 2000) // 0 B/s this interval -> EMA drops
    expect(c.bps).toBeLessThan(b.bps)
  })
})

describe('estimateEtaSec', () => {
  it('estimates from the file processing rate', () => {
    expect(estimateEtaSec(10, 5, 10, 0)).toBe(10) // 0.5 files/s, 5 remaining
  })
  it('returns null when not estimable', () => {
    expect(estimateEtaSec(0, 5, 10, 0)).toBeNull() // no elapsed
    expect(estimateEtaSec(10, 5, 5, 0)).toBeNull() // total not ahead
    expect(estimateEtaSec(10, 3, 10, 3)).toBeNull() // nothing done since start
  })
})

describe('formatSpeed', () => {
  it('formats MB/s and dashes negligible rates', () => {
    expect(formatSpeed(2 * 1024 * 1024)).toBe('2.0 MB/s')
    expect(formatSpeed(0)).toBe('—')
  })
})

describe('formatEta', () => {
  it('formats seconds and minutes, dashes unknown', () => {
    expect(formatEta(12)).toBe('12s')
    expect(formatEta(65)).toBe('1m 5s')
    expect(formatEta(null)).toBe('—')
    expect(formatEta(Infinity)).toBe('—')
  })
})
