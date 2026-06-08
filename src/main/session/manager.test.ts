import { describe, expect, it } from 'vitest'
import { isRetriableStatus, parseRetryAfterMs } from './manager'

describe('isRetriableStatus', () => {
  it('retries rate-limit, timeout and 5xx', () => {
    for (const s of [408, 425, 429, 500, 502, 503, 504]) expect(isRetriableStatus(s)).toBe(true)
  })
  it('does not retry success or ordinary 4xx', () => {
    for (const s of [200, 301, 400, 401, 403, 404]) expect(isRetriableStatus(s)).toBe(false)
  })
})

describe('parseRetryAfterMs', () => {
  it('returns null when the header is absent', () => {
    expect(parseRetryAfterMs(undefined)).toBeNull()
    expect(parseRetryAfterMs({})).toBeNull()
  })
  it('parses delta-seconds', () => {
    expect(parseRetryAfterMs({ 'retry-after': '120' })).toBe(120_000)
    expect(parseRetryAfterMs({ 'retry-after': '0' })).toBe(0)
  })
  it('parses an HTTP-date relative to now', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(parseRetryAfterMs({ 'retry-after': 'Thu, 01 Jan 2026 00:00:30 GMT' }, now)).toBe(30_000)
    // a past date clamps to 0, never negative
    expect(parseRetryAfterMs({ 'retry-after': 'Thu, 01 Jan 2026 00:00:00 GMT' }, now + 5_000)).toBe(0)
  })
  it('accepts an array-valued header (first entry)', () => {
    expect(parseRetryAfterMs({ 'retry-after': ['30', '60'] })).toBe(30_000)
  })
  it('returns null for an unparseable value', () => {
    expect(parseRetryAfterMs({ 'retry-after': 'soon' })).toBeNull()
  })
})
