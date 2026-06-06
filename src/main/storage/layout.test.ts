import { describe, expect, it } from 'vitest'
import { pad2, postDir, sanitizeFileName, toLocationParts } from './layout'

describe('toLocationParts', () => {
  it('derives year/month from an ISO timestamp', () => {
    expect(toLocationParts('2026-06-07T12:34:56Z')).toEqual({ year: 2026, month: 6 })
    expect(toLocationParts('2024-01-01T00:00:00Z')).toEqual({ year: 2024, month: 1 })
  })
})

describe('pad2', () => {
  it('zero-pads single-digit months', () => {
    expect(pad2(6)).toBe('06')
    expect(pad2(12)).toBe('12')
  })
})

describe('sanitizeFileName', () => {
  it('replaces filesystem-illegal characters', () => {
    expect(sanitizeFileName('a/b\\c:d*e?.png')).not.toMatch(/[/\\:*?]/)
  })
  it('falls back to a name for empty input', () => {
    expect(sanitizeFileName('')).toBe('unnamed')
  })
})

describe('postDir', () => {
  it('builds the service/creator/year/month/post layout', () => {
    const dir = postDir('/root', {
      serviceId: 'fantia',
      creatorId: '123',
      year: 2026,
      month: 6,
      postId: '999'
    })
    // Normalize separators for cross-platform assertion.
    expect(dir.replace(/\\/g, '/')).toBe('/root/fantia/123/2026/06/999')
  })
})
