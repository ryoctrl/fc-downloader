import { describe, expect, it } from 'vitest'
import {
  collectFiles,
  mediaMapFromIncluded,
  normalizePost,
  type RawPatreonMedia,
  type RawPatreonPost
} from './normalize'

function media(id: string, attrs: Partial<RawPatreonMedia['attributes']>): RawPatreonMedia {
  return { id, type: 'media', attributes: attrs }
}

function post(rel: RawPatreonPost['relationships'], attrs?: Partial<RawPatreonPost['attributes']>): RawPatreonPost {
  return {
    id: '1001',
    type: 'post',
    attributes: { title: 'Hello', published_at: '2025-06-01T12:00:00.000+00:00', ...attrs },
    relationships: rel
  }
}

describe('mediaMapFromIncluded', () => {
  it('keeps only media resources, keyed by id', () => {
    const map = mediaMapFromIncluded([
      { id: 'm1', type: 'media' },
      { id: 'c1', type: 'campaign' },
      { id: 'u1', type: 'user' }
    ])
    expect([...map.keys()]).toEqual(['m1'])
  })
})

describe('collectFiles', () => {
  it('resolves linkages via the media map and hints kind by relationship', () => {
    const map = new Map<string, RawPatreonMedia>([
      ['m1', media('m1', { download_url: 'https://x/a.png', file_name: 'a.png', mimetype: 'image/png', size_bytes: 10 })],
      ['m2', media('m2', { download_url: 'https://x/b.mp3', file_name: 'b.mp3', mimetype: 'audio/mpeg' })]
    ])
    const files = collectFiles(
      post({
        images: { data: [{ id: 'm1', type: 'media' }] },
        audio: { data: { id: 'm2', type: 'media' } }
      }),
      map
    )
    expect(files).toEqual([
      { fileId: 'm1', kind: 'image', name: 'a.png', url: 'https://x/a.png', sizeBytes: 10 },
      { fileId: 'm2', kind: 'audio', name: 'b.mp3', url: 'https://x/b.mp3', sizeBytes: undefined }
    ])
  })

  it('derives kind from mimetype for attachments and post_file', () => {
    const map = new Map<string, RawPatreonMedia>([
      ['z1', media('z1', { download_url: 'https://x/clip.mp4', file_name: 'clip.mp4', mimetype: 'video/mp4' })],
      ['z2', media('z2', { download_url: 'https://x/doc.zip', file_name: 'doc.zip', mimetype: 'application/zip' })]
    ])
    const files = collectFiles(
      post({
        attachments_media: { data: [{ id: 'z2', type: 'media' }] },
        media: { data: [{ id: 'z1', type: 'media' }] }
      }),
      map
    )
    expect(files.map((f) => [f.fileId, f.kind])).toEqual([
      ['z2', 'file'],
      ['z1', 'video']
    ])
  })

  it('falls back to the original image url when there is no download_url', () => {
    const map = new Map<string, RawPatreonMedia>([
      ['i1', media('i1', { file_name: 'pic.jpg', mimetype: 'image/jpeg', image_urls: { default: 'https://x/d.jpg', original: 'https://x/o.jpg' } })]
    ])
    const [f] = collectFiles(post({ images: { data: [{ id: 'i1', type: 'media' }] } }), map)
    expect(f.url).toBe('https://x/o.jpg')
  })

  it('dedupes media referenced through multiple relationships and skips unknown ids', () => {
    const map = new Map<string, RawPatreonMedia>([
      ['m1', media('m1', { download_url: 'https://x/a.png', file_name: 'a.png', mimetype: 'image/png' })]
    ])
    const files = collectFiles(
      post({
        images: { data: [{ id: 'm1', type: 'media' }] },
        media: { data: [{ id: 'm1', type: 'media' }, { id: 'missing', type: 'media' }] }
      }),
      map
    )
    expect(files).toHaveLength(1)
  })
})

describe('normalizePost', () => {
  const map = new Map<string, RawPatreonMedia>([
    ['m1', media('m1', { download_url: 'https://x/a.png', file_name: 'a.png', mimetype: 'image/png' })]
  ])
  const rel = { images: { data: [{ id: 'm1', type: 'media' }] } } satisfies RawPatreonPost['relationships']

  it('maps a viewable post with files, deriving year/month from published_at', () => {
    const p = normalizePost(post(rel), map, 'camp9')
    expect(p).toMatchObject({
      serviceId: 'patreon',
      creatorId: 'camp9',
      postId: '1001',
      title: 'Hello',
      year: 2025,
      month: 6,
      files: [{ fileId: 'm1', kind: 'image' }]
    })
    expect(p?.postedAt).toBe('2025-06-01T12:00:00.000Z')
  })

  it('returns null when the viewer cannot see the post', () => {
    expect(normalizePost(post(rel, { current_user_can_view: false }), map, 'camp9')).toBeNull()
  })

  it('returns null when the post has no downloadable files', () => {
    expect(normalizePost(post({}), new Map(), 'camp9')).toBeNull()
  })

  it('falls back to a synthetic title when none is given', () => {
    const p = normalizePost(post(rel, { title: null }), map, 'camp9')
    expect(p?.title).toBe('post-1001')
  })
})
