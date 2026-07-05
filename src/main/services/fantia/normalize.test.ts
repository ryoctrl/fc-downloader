import { describe, expect, it } from 'vitest'
import {
  absolutize,
  collectFiles,
  fanclubSupporting,
  normalizePost,
  type RawFantiaPost
} from './normalize'

describe('fanclubSupporting', () => {
  it('is paid(true) when the joined plan has a price', () => {
    expect(
      fanclubSupporting([
        { price: 500, order: { status: 'joined' } },
        { price: 1000, order: { status: 'change' } }
      ])
    ).toBe(true)
  })

  it('is free(false) when only a ¥0 plan is joined', () => {
    expect(
      fanclubSupporting([
        { price: 0, order: { status: 'joined' } },
        { price: 500, order: { status: 'change' } }
      ])
    ).toBe(false)
  })

  it('is unknown(undefined) when no plan is joined', () => {
    expect(fanclubSupporting([{ price: 500, order: { status: 'change' } }])).toBeUndefined()
    expect(fanclubSupporting([])).toBeUndefined()
    expect(fanclubSupporting(undefined)).toBeUndefined()
  })
})

describe('absolutize', () => {
  it('prefixes the Fantia origin onto relative paths', () => {
    expect(absolutize('/posts/1/download/2')).toBe('https://fantia.jp/posts/1/download/2')
    expect(absolutize('uploads/x.jpg')).toBe('https://fantia.jp/uploads/x.jpg')
    expect(absolutize('https://cdn.fantia.jp/a.jpg')).toBe('https://cdn.fantia.jp/a.jpg')
    expect(absolutize('')).toBe('')
  })
})

describe('collectFiles', () => {
  it('extracts photo_gallery images with derived names', () => {
    const post: RawFantiaPost = {
      id: 1,
      title: 'gallery',
      posted_at: '2025-06-01T00:00:00.000Z',
      post_contents: [
        {
          id: 10,
          category: 'photo_gallery',
          post_content_photos: [
            { id: 100, url: { original: 'https://cdn.fantia.jp/a.png?sig=1' } },
            { id: 101, url: { main: 'https://cdn.fantia.jp/b.jpg' } }
          ]
        }
      ]
    }
    const files = collectFiles(post)
    expect(files).toEqual([
      { fileId: '10-100', kind: 'image', name: '100.png', url: 'https://cdn.fantia.jp/a.png?sig=1' },
      { fileId: '10-101', kind: 'image', name: '101.jpg', url: 'https://cdn.fantia.jp/b.jpg' }
    ])
  })

  it('extracts file contents and maps kind by extension', () => {
    const post: RawFantiaPost = {
      id: 2,
      title: 'files',
      posted_at: '2025-06-01T00:00:00.000Z',
      post_contents: [
        { id: 20, category: 'file', filename: 'linework.psd', download_uri: '/posts/2/download/20' },
        { id: 21, category: 'file', filename: 'clip.mp4', download_uri: '/posts/2/download/21' }
      ]
    }
    const files = collectFiles(post)
    expect(files).toMatchObject([
      { fileId: '20', kind: 'file', name: 'linework.psd', url: 'https://fantia.jp/posts/2/download/20' },
      { fileId: '21', kind: 'video', name: 'clip.mp4', url: 'https://fantia.jp/posts/2/download/21' }
    ])
  })

  it('ignores non-downloadable content and url-less entries', () => {
    const post: RawFantiaPost = {
      id: 3,
      title: 'mixed',
      posted_at: '2025-06-01T00:00:00.000Z',
      post_contents: [
        { id: 30, category: 'blog' },
        { id: 31, category: 'file', filename: 'x.zip' }, // no download_uri -> skipped
        { id: 32, category: 'photo_gallery', post_content_photos: [{ id: 320, url: {} }] }
      ]
    }
    expect(collectFiles(post)).toEqual([])
  })
})

describe('normalizePost', () => {
  it('returns null for an empty response', () => {
    expect(normalizePost('c1', {})).toBeNull()
  })

  it('normalizes a post under the enumeration creator id', () => {
    const post = normalizePost('fanclub-9', {
      post: {
        id: 555,
        title: 'p',
        posted_at: '2025-06-07T12:00:00.000Z',
        fanclub: { id: 9 },
        post_contents: [
          {
            id: 1,
            category: 'photo_gallery',
            post_content_photos: [{ id: 2, url: { original: 'https://cdn/x.jpg' } }]
          }
        ]
      }
    })!
    expect(post).toMatchObject({
      serviceId: 'fantia',
      creatorId: 'fanclub-9',
      postId: '555',
      year: 2025,
      month: 6
    })
    expect(post.files).toHaveLength(1)
  })
})
