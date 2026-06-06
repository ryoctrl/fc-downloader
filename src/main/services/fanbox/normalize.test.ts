import { describe, expect, it } from 'vitest'
import { collectFiles, normalizePost, type RawFanboxPost } from './normalize'

const base = {
  creatorId: 'aotsuki',
  publishedDatetime: '2025-06-01T12:00:00+09:00'
}

describe('normalizePost', () => {
  it('returns null for an inaccessible post (null body)', () => {
    const raw: RawFanboxPost = { ...base, id: '1', title: 'locked', type: 'image', body: null }
    expect(normalizePost(raw)).toBeNull()
  })

  it('derives year/month from publishedDatetime (UTC)', () => {
    const raw: RawFanboxPost = {
      ...base,
      id: '2',
      title: 'p',
      type: 'image',
      // 2025-06-01T12:00+09:00 == 2025-06-01T03:00Z
      body: { images: [] }
    }
    const post = normalizePost(raw)!
    expect(post.year).toBe(2025)
    expect(post.month).toBe(6)
    expect(post.serviceId).toBe('fanbox')
    expect(post.creatorId).toBe('aotsuki')
  })

  it('normalizes an image post', () => {
    const raw: RawFanboxPost = {
      ...base,
      id: '10',
      title: 'gallery',
      type: 'image',
      body: {
        images: [
          { id: 'img1', extension: 'png', originalUrl: 'https://x/img1.png' },
          { id: 'img2', extension: 'jpg', originalUrl: 'https://x/img2.jpg' }
        ]
      }
    }
    const files = normalizePost(raw)!.files
    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({ fileId: 'img1', kind: 'image', name: 'img1.png', url: 'https://x/img1.png' })
  })

  it('maps file extensions to kinds', () => {
    const raw: RawFanboxPost = {
      ...base,
      id: '11',
      title: 'files',
      type: 'file',
      body: {
        files: [
          { id: 'f1', name: 'linework', extension: 'psd', url: 'https://x/f1', size: 1000 },
          { id: 'f2', name: 'clip', extension: 'mp4', url: 'https://x/f2' },
          { id: 'f3', name: 'voice', extension: 'mp3', url: 'https://x/f3' }
        ]
      }
    }
    const files = normalizePost(raw)!.files
    expect(files.map((f) => f.kind)).toEqual(['file', 'video', 'audio'])
    expect(files[0]).toMatchObject({ name: 'linework.psd', sizeBytes: 1000 })
  })

  it('walks article blocks in order via imageMap/fileMap', () => {
    const raw: RawFanboxPost = {
      ...base,
      id: '12',
      title: 'article',
      type: 'article',
      body: {
        blocks: [
          { type: 'p', text: 'intro' },
          { type: 'image', imageId: 'a' },
          { type: 'file', fileId: 'z' },
          { type: 'image', imageId: 'b' }
        ],
        imageMap: {
          a: { id: 'a', extension: 'png', originalUrl: 'https://x/a.png' },
          b: { id: 'b', extension: 'png', originalUrl: 'https://x/b.png' }
        },
        fileMap: {
          z: { id: 'z', name: 'bonus', extension: 'zip', url: 'https://x/z' }
        }
      }
    }
    const files = collectFiles(raw.body!)
    expect(files.map((f) => f.fileId)).toEqual(['a', 'z', 'b'])
  })

  it('de-dupes files referenced both by a block and present in the map', () => {
    const raw: RawFanboxPost = {
      ...base,
      id: '13',
      title: 'dup',
      type: 'article',
      body: {
        blocks: [{ type: 'image', imageId: 'a' }],
        imageMap: { a: { id: 'a', extension: 'png', originalUrl: 'https://x/a.png' } }
      }
    }
    expect(collectFiles(raw.body!)).toHaveLength(1)
  })

  it('drops entries without a usable url', () => {
    const raw: RawFanboxPost = {
      ...base,
      id: '14',
      title: 'empty',
      type: 'image',
      body: { images: [{ id: 'x', extension: 'png', originalUrl: '' }] }
    }
    expect(collectFiles(raw.body!)).toHaveLength(0)
  })
})
