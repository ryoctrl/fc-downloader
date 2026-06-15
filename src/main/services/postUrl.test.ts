import { describe, expect, it } from 'vitest'
import { webPostUrl } from './postUrl'

describe('webPostUrl', () => {
  it('builds the canonical web page per service', () => {
    expect(webPostUrl('fanbox', 'aotsuki', '100')).toBe('https://www.fanbox.cc/@aotsuki/posts/100')
    expect(webPostUrl('fantia', '123', '4088936')).toBe('https://fantia.jp/posts/4088936')
    expect(webPostUrl('cien', '23364', '1832205')).toBe(
      'https://ci-en.dlsite.com/creator/23364/article/1832205'
    )
    expect(webPostUrl('patreon', 'camp9', '777')).toBe('https://www.patreon.com/posts/777')
  })
})
