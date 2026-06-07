import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fcfileUrl, isWithinRoot, kindForName, listPostFiles, mimeForName } from './files'
import { initSettings } from './settings'

describe('kindForName', () => {
  it('classifies by extension, case-insensitive', () => {
    expect(kindForName('a.png')).toBe('image')
    expect(kindForName('b.JPG')).toBe('image')
    expect(kindForName('clip.MP4')).toBe('video')
    expect(kindForName('voice.mp3')).toBe('audio')
    expect(kindForName('pack.zip')).toBe('file')
    expect(kindForName('noext')).toBe('file')
  })
})

describe('mimeForName', () => {
  it('maps known extensions and falls back to octet-stream', () => {
    expect(mimeForName('a.png')).toBe('image/png')
    expect(mimeForName('v.mp4')).toBe('video/mp4')
    expect(mimeForName('x.unknown')).toBe('application/octet-stream')
  })
})

describe('isWithinRoot', () => {
  const root = join('/srv', 'downloads')
  it('accepts the root itself and descendants', () => {
    expect(isWithinRoot(root, root)).toBe(true)
    expect(isWithinRoot(root, join(root, 'fanbox', 'a', 'x.png'))).toBe(true)
  })
  it('rejects siblings and traversal escapes', () => {
    expect(isWithinRoot(root, join('/srv', 'downloads-evil', 'x'))).toBe(false)
    expect(isWithinRoot(root, join(root, '..', 'etc', 'passwd'))).toBe(false)
    expect(isWithinRoot(root, join('/etc', 'passwd'))).toBe(false)
  })
})

describe('fcfileUrl', () => {
  it('builds a fixed-host, percent-encoded url with forward slashes', () => {
    expect(fcfileUrl('fanbox/aotsuki/2025/06/100/a.png')).toBe(
      'fcfile://fc/fanbox/aotsuki/2025/06/100/a.png'
    )
    expect(fcfileUrl('fanbox\\x\\a b.png')).toBe('fcfile://fc/fanbox/x/a%20b.png')
  })
})

describe('listPostFiles', () => {
  let root = ''
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fc-files-'))
    initSettings(root, root)
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('lists completed files but skips in-progress .part downloads', async () => {
    const dir = join(root, 'fanbox', 'c', '2025', '06', '1')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.png'), 'img')
    writeFileSync(join(dir, 'b.mp3'), 'snd')
    writeFileSync(join(dir, 'big.zip.part'), 'partial') // crash leftover

    const files = await listPostFiles(dir)
    expect(files.map((f) => f.name)).toEqual(['a.png', 'b.mp3'])
  })

  it('refuses directories outside the download root', async () => {
    expect(await listPostFiles(join(root, '..', 'elsewhere'))).toEqual([])
  })
})
