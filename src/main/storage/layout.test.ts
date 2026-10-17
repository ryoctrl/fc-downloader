import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  creatorDir,
  dedupeFileNames,
  pad2,
  patternPostDir,
  postDir,
  sanitizeFileName,
  toLocationParts
} from './layout'

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

describe('dedupeFileNames', () => {
  it('leaves already-distinct names untouched', () => {
    expect(dedupeFileNames(['a.jpg', 'b.png'])).toEqual(['a.jpg', 'b.png'])
  })

  it('suffixes duplicates before the extension, keeping the first as-is', () => {
    expect(dedupeFileNames(['a.jpg', 'a.jpg', 'a.jpg'])).toEqual(['a.jpg', 'a_2.jpg', 'a_3.jpg'])
  })

  it('treats names that sanitize to the same value as collisions', () => {
    // both sanitize to "a_b.jpg" (':' and '?' and '/' all -> '_')
    expect(dedupeFileNames(['a:b.jpg', 'a?b.jpg', 'a/b.jpg'])).toEqual([
      'a_b.jpg',
      'a_b_2.jpg',
      'a_b_3.jpg'
    ])
  })

  it('compares case-insensitively (Windows/macOS file systems)', () => {
    expect(dedupeFileNames(['Photo.JPG', 'photo.jpg'])).toEqual(['Photo.JPG', 'photo_2.jpg'])
  })

  it('handles extensionless names', () => {
    expect(dedupeFileNames(['readme', 'readme'])).toEqual(['readme', 'readme_2'])
  })

  it('produces names that are stable under a further sanitize pass', () => {
    const out = dedupeFileNames(['x y.jpg', 'x y.jpg'])
    expect(out.map(sanitizeFileName)).toEqual(out)
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

describe('patternPostDir / creatorDir', () => {
  const creator = { creatorId: 'c1', creatorName: 'Name' }
  const post = { postId: 'p1', title: 't', postedAt: '2026-05-09T12:00:00.000Z' }

  it('defaults to <service>/<creatorId>/<year>/<month>/<postId>', () => {
    expect(patternPostDir('/root', 'fanbox', {}, creator, post)).toBe(
      join('/root', 'fanbox', 'c1', '2026', '05', 'p1')
    )
    expect(creatorDir('/root', 'fanbox', {}, creator)).toBe(join('/root', 'fanbox', 'c1'))
  })

  it('saves to exactly the postDir folder with the default patterns', () => {
    // Around a month boundary (UTC+9 morning = previous UTC day).
    for (const postedAt of ['2026-07-01T08:00:00+09:00', '2026-12-31T23:59:59Z']) {
      const iso = new Date(postedAt).toISOString()
      const { year, month } = toLocationParts(iso)
      expect(patternPostDir('/root', 'fanbox', {}, creator, { ...post, postedAt: iso })).toBe(
        postDir('/root', { serviceId: 'fanbox', creatorId: 'c1', year, month, postId: 'p1' })
      )
    }
  })

  it('applies the user patterns', () => {
    const patterns = {
      creatorFolderPattern: '{creatorName}({creatorId})',
      postFolderPattern: '[{year}{month}{day}]{postId}'
    }
    expect(patternPostDir('/root', 'fanbox', patterns, creator, post)).toBe(
      join('/root', 'fanbox', 'Name(c1)', '[20260509]p1')
    )
  })
})
