import { describe, expect, it } from 'vitest'
import {
  canonicalCreatorId,
  decodeEntities,
  mergeSubscriptionTiers,
  parseArticleDate,
  parseArticleIds,
  parseArticleTitle,
  parseAttachments,
  parseCreatorIcon,
  parseCreatorIds,
  parseCreatorName,
  parseRecentArticleRefs
} from './parse'

const SIG = '?px-time=1&px-hash=0000000000000000'

describe('canonicalCreatorId', () => {
  it('strips leading zeros, keeping a single zero for all-zero', () => {
    expect(canonicalCreatorId('00012345')).toBe('12345')
    expect(canonicalCreatorId('8600')).toBe('8600')
    expect(canonicalCreatorId('0000')).toBe('0')
  })
})

describe('parseCreatorIds', () => {
  it('collects distinct creators, treating padded and bare ids as one', () => {
    const html = `<a href="/creator/12345">x</a><a href="/creator/00012345">y</a>
      <a href="/creator/8600/article/1">z</a>`
    expect(parseCreatorIds(html).sort()).toEqual(['12345', '8600'])
  })
})

describe('mergeSubscriptionTiers', () => {
  it('tags each creator by its tab, in first-seen order', () => {
    const out = mergeSubscriptionTiers([
      { ids: ['1', '2'], supporting: true }, // サポート中
      { ids: ['3'], supporting: false }, // サポート経験あり
      { ids: ['4'], supporting: false } // フォロー
    ])
    expect(out).toEqual([
      { creatorId: '1', supporting: true },
      { creatorId: '2', supporting: true },
      { creatorId: '3', supporting: false },
      { creatorId: '4', supporting: false }
    ])
  })

  it('de-dupes across tabs, letting the paid tier win', () => {
    const out = mergeSubscriptionTiers([
      { ids: ['1'], supporting: true },
      { ids: ['1', '2'], supporting: false }
    ])
    expect(out).toEqual([
      { creatorId: '1', supporting: true },
      { creatorId: '2', supporting: false }
    ])
  })

  it('is empty for no pages', () => {
    expect(mergeSubscriptionTiers([])).toEqual([])
  })
})

describe('parseRecentArticleRefs', () => {
  it('collects (creator, article) pairs newest-first, de-duped and canonicalized', () => {
    const html = `
      <a href="/creator/00008600/article/500">a</a>
      <a href="/creator/8600/article/500">dup</a>
      <a href="/creator/12345/article/900">b</a>
      <a href="/creator/8600/article/499">older</a>`
    expect(parseRecentArticleRefs(html)).toEqual([
      { creatorId: '8600', articleId: '500' },
      { creatorId: '12345', articleId: '900' },
      { creatorId: '8600', articleId: '499' }
    ])
  })

  it('is empty when the feed has no article links', () => {
    expect(parseRecentArticleRefs('<a href="/creator/8600">profile</a>')).toEqual([])
  })
})

describe('parseCreatorName / parseCreatorIcon', () => {
  it('extracts the display name from the profile <title>', () => {
    const html = '<title>SAMPLEプロフィール - Ci-en（シエン）</title>'
    expect(parseCreatorName(html, '12345')).toBe('SAMPLE')
  })

  it('falls back when there is no usable title', () => {
    expect(parseCreatorName('<title>プロフィール - Ci-en（シエン）</title>', '12345')).toBe('12345')
    expect(parseCreatorName('<html></html>', '12345')).toBe('12345')
  })

  it('reads the public icon url when present', () => {
    const html =
      'x <img src="https://media.ci-en.jp/public/icon/creator/00012345/abc/image-200-c.jpg"> y'
    expect(parseCreatorIcon(html)).toBe(
      'https://media.ci-en.jp/public/icon/creator/00012345/abc/image-200-c.jpg'
    )
    expect(parseCreatorIcon('<html></html>')).toBeUndefined()
  })
})

describe('parseArticleIds', () => {
  it('returns distinct article ids in document order', () => {
    const html = `<a href="/creator/12345/article/1000001">a</a>
      <a href="/creator/12345/article/1000001">dup</a>
      <a href="/creator/12345/article/1000002">b</a>`
    expect(parseArticleIds(html)).toEqual(['1000001', '1000002'])
  })
})

describe('parseArticleTitle', () => {
  it('decodes entities and strips the creator + site suffix', () => {
    const html =
      '<title>Sample&#039;s Article - SAMPLE - Ci-en（シエン）</title>'
    expect(parseArticleTitle(html, 'fallback')).toBe("Sample's Article")
  })

  it('falls back when empty', () => {
    expect(parseArticleTitle('<html></html>', 'article-9')).toBe('article-9')
  })
})

describe('parseArticleDate', () => {
  it('prefers a datetime attribute', () => {
    expect(parseArticleDate('<time datetime="2026-05-30T10:00:00+09:00">x</time>')).toBe(
      '2026-05-30T01:00:00.000Z'
    )
  })

  it('falls back to a YYYY/MM/DD date as JST', () => {
    expect(parseArticleDate('<span>2026/06/01</span>')).toBe('2026-05-31T15:00:00.000Z')
  })

  it('falls back to the epoch when no date is present', () => {
    expect(parseArticleDate('<html></html>')).toBe('1970-01-01T00:00:00.000Z')
  })
})

describe('parseAttachments', () => {
  const base = 'https://media.ci-en.jp/private/attachment/creator/00012345'
  const hash = 'aaaa0001'

  it('groups variants by hash and prefers the original upload, decoding its name', () => {
    const html = `
      <img src="${base}/${hash}/image-800.jpg${SIG}">
      <img src="${base}/${hash}/image-web.jpg${SIG}">
      <a href="${base}/${hash}/upload/unamused%20%E6%8B%B7%E8%B4%9D.jpg${SIG}">orig</a>
      <img src="https://media.ci-en.jp/public/article_cover/creator/00012345/zzz/image-1280-c.jpg">
    `
    const files = parseAttachments(html)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({
      fileId: hash,
      kind: 'image',
      name: 'unamused 拷贝.jpg'
    })
    expect(files[0].url).toBe(`${base}/${hash}/upload/unamused%20%E6%8B%B7%E8%B4%9D.jpg${SIG}`)
  })

  it('excludes public covers/icons entirely', () => {
    const html = `<img src="https://media.ci-en.jp/public/icon/creator/00012345/a/image-200-c.jpg">
      <img src="https://media.ci-en.jp/public/cover/creator/00012345/b/image-990-c.jpg">`
    expect(parseAttachments(html)).toEqual([])
  })

  it('falls back to a derived image variant when there is no upload original', () => {
    const h2 = 'bbbb0002'
    const html = `<img src="${base}/${h2}/image-web.jpg${SIG}">
      <img src="${base}/${h2}/image-800.jpg${SIG}">`
    const files = parseAttachments(html)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ fileId: h2, kind: 'image', name: `${h2}.jpg` })
    // image-800 outranks image-web
    expect(files[0].url).toContain('image-800.jpg')
  })

  it('skips cropped thumbnails (image-<N>-c) — shared icons/covers, not content', () => {
    const h = 'cccc0003'
    // A hash whose only variant is a cropped 200px thumbnail (creator icon /
    // recent-article cover that appears on every article page) must be dropped.
    const html = `<img src="${base}/${h}/image-200-c.jpg${SIG}">`
    expect(parseAttachments(html)).toEqual([])
  })

  it('keeps content when a real variant accompanies a cropped thumbnail', () => {
    const h = 'aaaa0001'
    const html = `<img src="${base}/${h}/image-200-c.jpg${SIG}">
      <img src="${base}/${h}/image-800.jpg${SIG}">
      <a href="${base}/${h}/upload/pic.jpg${SIG}">o</a>`
    const files = parseAttachments(html)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ fileId: h, name: 'pic.jpg' })
  })

  it('classifies non-image originals by extension', () => {
    const h3 = 'aaaa1111bbbb2222'
    const html = `<a href="${base}/${h3}/upload/track%20one.mp3${SIG}">audio</a>`
    expect(parseAttachments(html)[0]).toMatchObject({ kind: 'audio', name: 'track one.mp3' })
  })

  it('captures <vue-file-player> videos (signed URL built from base-path + upload + auth-key)', () => {
    const h = 'dddd0004'
    const html = `<p><vue-file-player vue-is="file_player" id="7883955" file-type="video" file-name="sample 1.mp4" base-path="https://media.ci-en.jp/private/attachment/creator/00012345/${h}/" auth-key="px-time=1&amp;px-hash=00000000"></vue-file-player></p>`
    const files = parseAttachments(html)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ fileId: h, kind: 'video', name: 'sample 1.mp4' })
    expect(files[0].url).toBe(
      `https://media.ci-en.jp/private/attachment/creator/00012345/${h}/upload/sample%201.mp4?px-time=1&px-hash=00000000`
    )
  })

  it('does not double-count a file-player whose hash already has a direct URL', () => {
    const h = 'aaaa1111bbbb2222cccc3333'
    const html = `<a href="${base}/${h}/upload/pic.jpg${SIG}">o</a>
      <vue-file-player file-type="image" file-name="pic.jpg" base-path="${base}/${h}/" auth-key="px-time=1&amp;px-hash=z"></vue-file-player>`
    expect(parseAttachments(html)).toHaveLength(1)
  })

  it('matches media URLs embedded with escaped slashes (JSON/JS payloads)', () => {
    const h4 = 'beef1234cafe5678'
    // e.g. inside <script> JSON: "url":"https:\/\/media.ci-en.jp\/private\/..."
    const html = `{"url":"https:\\/\\/media.ci-en.jp\\/private\\/attachment\\/creator\\/00012345\\/${h4}\\/upload\\/clip.mp4${SIG}"}`
    const files = parseAttachments(html)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ fileId: h4, kind: 'video', name: 'clip.mp4' })
  })
})

describe('decodeEntities', () => {
  it('decodes the common entities', () => {
    expect(decodeEntities('a &amp; b &#039;c&#039; &quot;d&quot;')).toBe('a & b \'c\' "d"')
  })
})
