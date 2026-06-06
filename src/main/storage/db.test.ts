import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Post } from '@shared/types'
import {
  closeDb,
  initDb,
  isPostComplete,
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
