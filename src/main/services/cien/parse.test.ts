import { describe, expect, it } from 'vitest'
import {
  canonicalCreatorId,
  decodeEntities,
  parseArticleDate,
  parseArticleIds,
  parseArticleTitle,
  parseAttachments,
  parseCreatorIcon,
  parseCreatorIds,
  parseCreatorName
} from './parse'

const SIG = '?px-time=1780851066&px-hash=4ac962f10a94ece9d9c481f85294ec4a948eaa66'

describe('canonicalCreatorId', () => {
  it('strips leading zeros, keeping a single zero for all-zero', () => {
    expect(canonicalCreatorId('00023364')).toBe('23364')
    expect(canonicalCreatorId('8600')).toBe('8600')
    expect(canonicalCreatorId('0000')).toBe('0')
  })
})

describe('parseCreatorIds', () => {
  it('collects distinct creators, treating padded and bare ids as one', () => {
    const html = `<a href="/creator/23364">x</a><a href="/creator/00023364">y</a>
      <a href="/creator/8600/article/1">z</a>`
    expect(parseCreatorIds(html).sort()).toEqual(['23364', '8600'])
  })
})

describe('parseCreatorName / parseCreatorIcon', () => {
  it('extracts the display name from the profile <title>', () => {
    const html = '<title>NEKOUJIプロフィール - Ci-en（シエン）</title>'
    expect(parseCreatorName(html, '23364')).toBe('NEKOUJI')
  })

  it('falls back when there is no usable title', () => {
    expect(parseCreatorName('<title>プロフィール - Ci-en（シエン）</title>', '23364')).toBe('23364')
    expect(parseCreatorName('<html></html>', '23364')).toBe('23364')
  })

  it('reads the public icon url when present', () => {
    const html =
      'x <img src="https://media.ci-en.jp/public/icon/creator/00023364/abc/image-200-c.jpg"> y'
    expect(parseCreatorIcon(html)).toBe(
      'https://media.ci-en.jp/public/icon/creator/00023364/abc/image-200-c.jpg'
    )
    expect(parseCreatorIcon('<html></html>')).toBeUndefined()
  })
})

describe('parseArticleIds', () => {
  it('returns distinct article ids in document order', () => {
    const html = `<a href="/creator/23364/article/1832205">a</a>
      <a href="/creator/23364/article/1832205">dup</a>
      <a href="/creator/23364/article/1808059">b</a>`
    expect(parseArticleIds(html)).toEqual(['1832205', '1808059'])
  })
})

describe('parseArticleTitle', () => {
  it('decodes entities and strips the creator + site suffix', () => {
    const html =
      '<title>『SHE SHOULDN&#039;T BE HERE』DEMO版配布のお知らせ - NEKOUJI - Ci-en（シエン）</title>'
    expect(parseArticleTitle(html, 'fallback')).toBe('『SHE SHOULDN\'T BE HERE』DEMO版配布のお知らせ')
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
  const base = 'https://media.ci-en.jp/private/attachment/creator/00023364'
  const hash = '0d4555f428cf1f928c88ddf13692ec7d07bb4382d1fd8362aa7ce34592df7966'

  it('groups variants by hash and prefers the original upload, decoding its name', () => {
    const html = `
      <img src="${base}/${hash}/image-800.jpg${SIG}">
      <img src="${base}/${hash}/image-web.jpg${SIG}">
      <a href="${base}/${hash}/upload/unamused%20%E6%8B%B7%E8%B4%9D.jpg${SIG}">orig</a>
      <img src="https://media.ci-en.jp/public/article_cover/creator/00023364/zzz/image-1280-c.jpg">
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
    const html = `<img src="https://media.ci-en.jp/public/icon/creator/00023364/a/image-200-c.jpg">
      <img src="https://media.ci-en.jp/public/cover/creator/00023364/b/image-990-c.jpg">`
    expect(parseAttachments(html)).toEqual([])
  })

  it('falls back to a derived image variant when there is no upload original', () => {
    const h2 = 'd8cb7ed10446157aae43f6893ffdf2d745fbbab8b91b75e7710da7efbcc996bd'
    const html = `<img src="${base}/${h2}/image-web.jpg${SIG}">
      <img src="${base}/${h2}/image-800.jpg${SIG}">`
    const files = parseAttachments(html)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ fileId: h2, kind: 'image', name: `${h2}.jpg` })
    // image-800 outranks image-web
    expect(files[0].url).toContain('image-800.jpg')
  })

  it('skips cropped thumbnails (image-<N>-c) — shared icons/covers, not content', () => {
    const h = 'fff78a37e14d9450e3e2af89f1de15d21ff7a2c5511476f6d10767d7c0fb8874'
    // A hash whose only variant is a cropped 200px thumbnail (creator icon /
    // recent-article cover that appears on every article page) must be dropped.
    const html = `<img src="${base}/${h}/image-200-c.jpg${SIG}">`
    expect(parseAttachments(html)).toEqual([])
  })

  it('keeps content when a real variant accompanies a cropped thumbnail', () => {
    const h = '0d4555f428cf1f928c88ddf13692ec7d07bb4382d1fd8362aa7ce34592df7966'
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

  it('matches media URLs embedded with escaped slashes (JSON/JS payloads)', () => {
    const h4 = 'beef1234cafe5678'
    // e.g. inside <script> JSON: "url":"https:\/\/media.ci-en.jp\/private\/..."
    const html = `{"url":"https:\\/\\/media.ci-en.jp\\/private\\/attachment\\/creator\\/00023364\\/${h4}\\/upload\\/clip.mp4${SIG}"}`
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
