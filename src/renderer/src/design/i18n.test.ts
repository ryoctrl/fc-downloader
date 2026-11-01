import { describe, expect, it } from 'vitest'
import { LANG } from './i18n'
import { LANGUAGE_OPTIONS, resolveLanguage } from './language'

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map((m) => m[1]).sort()
}

describe('Simplified Chinese translations', () => {
  it('covers exactly the same keys as Japanese and English', () => {
    const keys = Object.keys(LANG.ja).sort()
    expect(Object.keys(LANG.en).sort()).toEqual(keys)
    expect(Object.keys(LANG['zh-CN']).sort()).toEqual(keys)
  })

  it('preserves interpolation and folder-pattern placeholders', () => {
    for (const [key, original] of Object.entries(LANG.ja)) {
      expect(placeholders(LANG['zh-CN'][key]), key).toEqual(placeholders(original))
    }
  })

  it('provides nonempty Chinese text without untranslated Japanese kana', () => {
    for (const [key, value] of Object.entries(LANG['zh-CN'])) {
      expect(value.trim(), key).not.toBe('')
      expect(value, key).not.toMatch(/[\u3040-\u30ff]/u)
    }
  })

  it('offers a dictionary for every language in the settings selector', () => {
    expect(LANGUAGE_OPTIONS.map(([code]) => code).sort()).toEqual(Object.keys(LANG).sort())
    expect(LANGUAGE_OPTIONS).toContainEqual(['zh-CN', '简体中文'])
  })
})

describe('language preferences', () => {
  it.each(['ja', 'en', 'zh-CN'] as const)('preserves saved %s across restarts', (saved) => {
    expect(resolveLanguage(saved, ['zh-CN', 'en-US'])).toBe(saved)
  })

  it.each(['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-HK', 'zh-TW', 'ZH-cn'])(
    'uses Simplified Chinese for a new profile with system language %s',
    (language) => {
      expect(resolveLanguage(undefined, [language])).toBe('zh-CN')
    }
  )

  it('uses the first supported preferred language', () => {
    expect(resolveLanguage(undefined, ['fr-FR', 'en-GB', 'zh-CN'])).toBe('en')
    expect(resolveLanguage(undefined, ['ja-JP', 'en-US'])).toBe('ja')
  })

  it.each([null, '', 'fr', 'constructor', '__proto__', {}, 42])(
    'recovers an unsupported saved preference (%j) using system languages',
    (saved) => {
      expect(resolveLanguage(saved, ['zh-CN'])).toBe('zh-CN')
    }
  )

  it('keeps Japanese as the fallback when no supported language is available', () => {
    expect(resolveLanguage(undefined, ['fr-FR'])).toBe('ja')
    expect(resolveLanguage(undefined, [])).toBe('ja')
  })
})
