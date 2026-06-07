import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Post } from '@shared/types'
import {
  closeDb,
  initDb,
  isFileDownloaded,
  isPostComplete,
  listPosts,
  markFileDownloaded,
  refreshPostCompletion,
  upsertPost
} from './db'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-db-'))
  initDb(dir)
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

// A post with one image and one video attachment.
function makePost(): Post {
  return {
    serviceId: 'fantia',
    creatorId: 'c1',
    postId: 'p1',
    title: 'mixed-media',
    postedAt: '2026-06-01T00:00:00Z',
    year: 2026,
    month: 6,
    files: [
      { fileId: 'img', kind: 'image', name: 'a.png', url: 'http://x/a.png' },
      { fileId: 'vid', kind: 'video', name: 'b.mp4', url: 'http://x/b.mp4' }
    ]
  }
}

describe('post completion is scoped to includeKinds', () => {
  it('marks a post complete once every in-scope file is downloaded, ignoring excluded kinds', () => {
    const post = makePost()
    upsertPost(post, '/disk/p1')
    markFileDownloaded(post, 'img', 'a.png')

    // Only images were requested; the un-fetched video must not block completion.
    refreshPostCompletion(post, ['image'])
    expect(isPostComplete(post, ['image'])).toBe(true)
  })

  it('does not skip a post when the scope widens to a kind that was never fetched', () => {
    const post = makePost()
    upsertPost(post, '/disk/p1')
    markFileDownloaded(post, 'img', 'a.png')
    refreshPostCompletion(post, ['image'])

    // A later run that also wants video must re-download it, not fast-path skip.
    expect(isPostComplete(post, ['image', 'video'])).toBe(false)

    markFileDownloaded(post, 'vid', 'b.mp4')
    expect(isPostComplete(post, ['image', 'video'])).toBe(true)
  })

  it('is not complete while an in-scope file is still missing', () => {
    const post = makePost()
    upsertPost(post, '/disk/p1')
    expect(isPostComplete(post, ['image'])).toBe(false)
  })

  it('is never complete when no file kind is in scope', () => {
    const post = makePost()
    upsertPost(post, '/disk/p1')
    markFileDownloaded(post, 'img', 'a.png')
    markFileDownloaded(post, 'vid', 'b.mp4')
    expect(isPostComplete(post, ['audio'])).toBe(false)
  })

  it('returns false for an unknown post', () => {
    expect(isPostComplete(makePost(), ['image'])).toBe(false)
  })
})

describe('listPosts', () => {
  it('returns empty when nothing is recorded', () => {
    expect(listPosts()).toEqual([])
  })

  it('maps a recorded post: file count, size, dominant kind, completion', () => {
    const post: Post = {
      serviceId: 'fanbox',
      creatorId: 'aotsuki',
      postId: '100',
      title: 'gallery',
      postedAt: '2025-06-01T00:00:00.000Z',
      year: 2025,
      month: 6,
      files: [
        { fileId: 'a', kind: 'image', name: 'a.png', url: 'x', sizeBytes: 100 },
        { fileId: 'b', kind: 'image', name: 'b.png', url: 'x', sizeBytes: 200 }
      ]
    }
    upsertPost(post, '/root/fanbox/aotsuki/2025/06/100')
    markFileDownloaded(post, 'a', 'a.png', 100, 'image')
    markFileDownloaded(post, 'b', 'b.png', 200, 'image')
    refreshPostCompletion(post, ['image'])

    const posts = listPosts()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({
      serviceId: 'fanbox',
      creatorId: 'aotsuki',
      postId: '100',
      title: 'gallery',
      year: 2025,
      month: 6,
      fileCount: 2,
      sizeBytes: 300,
      type: 'image',
      completed: true
    })
    expect(isFileDownloaded('fanbox', 'aotsuki', '100', 'a')).toBe(true)
  })

  it('reports the dominant file kind', () => {
    const post: Post = {
      serviceId: 'fanbox',
      creatorId: 'aotsuki',
      postId: '200',
      title: 'mix',
      postedAt: '2025-06-02T00:00:00.000Z',
      year: 2025,
      month: 6,
      files: [
        { fileId: 'v', kind: 'video', name: 'v.mp4', url: 'x' },
        { fileId: 'a1', kind: 'audio', name: 'a1.mp3', url: 'x' },
        { fileId: 'a2', kind: 'audio', name: 'a2.mp3', url: 'x' }
      ]
    }
    upsertPost(post, '/root/200')
    markFileDownloaded(post, 'v', 'v.mp4', undefined, 'video')
    markFileDownloaded(post, 'a1', 'a1.mp3', undefined, 'audio')
    markFileDownloaded(post, 'a2', 'a2.mp3', undefined, 'audio')
    expect(listPosts()[0].type).toBe('audio')
  })

  it('uses the provided creator display name, falling back to the id', () => {
    const base: Post = {
      serviceId: 'fanbox',
      creatorId: 'aotsuki',
      postId: '300',
      title: 't',
      postedAt: '2025-06-03T00:00:00.000Z',
      year: 2025,
      month: 6,
      files: []
    }
    upsertPost(base, '/root/300', '蒼月アート')
    upsertPost({ ...base, postId: '301' }, '/root/301') // no name supplied
    const byId = new Map(listPosts().map((p) => [p.postId, p.creatorName]))
    expect(byId.get('300')).toBe('蒼月アート')
    expect(byId.get('301')).toBe('aotsuki')
  })

  it('preserves a stored creator name across upserts without one', () => {
    const base: Post = {
      serviceId: 'fanbox',
      creatorId: 'aotsuki',
      postId: '302',
      title: 't',
      postedAt: '2025-06-03T00:00:00.000Z',
      year: 2025,
      month: 6,
      files: []
    }
    upsertPost(base, '/root/302', '蒼月アート')
    upsertPost(base, '/root/302') // re-upsert without a name must not clobber it
    expect(listPosts()[0].creatorName).toBe('蒼月アート')
  })

  it('sorts newest first by postedAt', () => {
    const mk = (postId: string, postedAt: string): Post => ({
      serviceId: 'fanbox',
      creatorId: 'aotsuki',
      postId,
      title: 't',
      postedAt,
      year: 2025,
      month: 1,
      files: []
    })
    upsertPost(mk('1', '2024-01-01T00:00:00.000Z'), '/root/1')
    upsertPost(mk('2', '2026-01-01T00:00:00.000Z'), '/root/2')
    expect(listPosts().map((p) => p.postId)).toEqual(['2', '1'])
  })
})
