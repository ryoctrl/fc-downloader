import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POST_FOLDER_PATTERN,
  creatorFolderName,
  postFolderSegments,
  sanitizeFolderName,
  validateCreatorFolderPattern,
  validatePostFolderPattern
} from './folderPattern'

const post = { postId: '67890', title: 'A title', postedAt: '2026-01-23T12:00:00.000Z' }

describe('creatorFolderName', () => {
  it('defaults to the creator id', () => {
    expect(creatorFolderName(undefined, { creatorId: '123', creatorName: 'Name' })).toBe('123')
  })

  it('renders name and id', () => {
    expect(
      creatorFolderName('{creatorName}({creatorId})', { creatorId: '123', creatorName: 'Name' })
    ).toBe('Name(123)')
  })

  it('sanitizes the name and keeps it one folder', () => {
    expect(creatorFolderName('{creatorName}', { creatorId: '1', creatorName: 'a/b:c?' })).toBe(
      'a_b_c_'
    )
  })

  it('uses the id when the name is unknown or renders empty', () => {
    expect(creatorFolderName('{creatorName}', { creatorId: '1' })).toBe('1')
    expect(creatorFolderName('{creatorName}', { creatorId: '1', creatorName: '...' })).toBe('1')
  })

  it('falls back to the default for an invalid pattern', () => {
    expect(creatorFolderName('{nope}', { creatorId: '1', creatorName: 'N' })).toBe('1')
  })
})

describe('postFolderSegments', () => {
  it('reproduces the original year/month/postId layout by default', () => {
    expect(postFolderSegments(undefined, post)).toEqual(['2026', '01', '67890'])
    expect(postFolderSegments(DEFAULT_POST_FOLDER_PATTERN, post)).toEqual(['2026', '01', '67890'])
  })

  it('renders a single dated folder from the UTC date', () => {
    expect(postFolderSegments('[{year}{month}{day}]{postId}', post)).toEqual(['[20260123]67890'])
    // 2026-03-01 00:30 in UTC+9 is still Feb 28 in UTC: UTC wins, as for the
    // year/month folders.
    const early = { ...post, postedAt: '2026-03-01T00:30:00+09:00' }
    expect(postFolderSegments('{year}{month}{day}{postId}', early)).toEqual(['2026022867890'])
  })

  it('keeps the default pattern on the original folders at a month boundary', () => {
    // 2026-07-01 08:00 in UTC+9 = 2026-06-30 23:00 UTC -> the 06 folder, as before.
    const edge = { ...post, postedAt: '2026-07-01T08:00:00+09:00' }
    expect(postFolderSegments(undefined, edge)).toEqual(['2026', '06', '67890'])
  })

  it('sanitizes and caps the title, never nesting through it', () => {
    const p = { ...post, title: 'a/b\\c: ' + 'x'.repeat(200) }
    const [seg] = postFolderSegments('{postId} {title}', p)
    expect(seg.startsWith('67890 a_b_c_ ')).toBe(true)
    expect(seg.length).toBeLessThanOrEqual(6 + 80)
  })

  it('drops empty segments and path tricks', () => {
    expect(postFolderSegments('{title}/{postId}', { ...post, title: '..' })).toEqual(['67890'])
    expect(postFolderSegments('{title}/{postId}', { ...post, title: '' })).toEqual(['67890'])
  })

  it('falls back to the default for a pattern without {postId}', () => {
    expect(postFolderSegments('{year}', post)).toEqual(['2026', '01', '67890'])
  })
})

describe('validation', () => {
  it('creator pattern', () => {
    expect(validateCreatorFolderPattern('{creatorName}')).toBeNull()
    expect(validateCreatorFolderPattern('  ')).toBe('empty')
    expect(validateCreatorFolderPattern('{postId}')).toBe('unknownToken')
  })

  it('post pattern', () => {
    expect(validatePostFolderPattern('[{year}{month}{day}]{postId}')).toBeNull()
    expect(validatePostFolderPattern('{year}/{title}')).toBe('missingPostId')
    expect(validatePostFolderPattern('{postid}')).toBe('unknownToken')
    expect(validatePostFolderPattern('')).toBe('empty')
  })
})

describe('sanitizeFolderName', () => {
  it('escapes Windows device names and trailing dots', () => {
    expect(sanitizeFolderName('CON')).toBe('CON_')
    expect(sanitizeFolderName('nul.txt')).toBe('nul.txt_')
    expect(sanitizeFolderName('name. ')).toBe('name')
  })
})
