import type { Lang } from './types'

export const LANGUAGE_OPTIONS: [Lang, string][] = [
  ['ja', '日本語'],
  ['en', 'English'],
  ['zh-CN', '简体中文']
]

/** Keep an explicit preference; otherwise use the first supported system language. */
export function resolveLanguage(saved: unknown, preferred: readonly string[]): Lang {
  const known = LANGUAGE_OPTIONS.find(([code]) => code === saved)
  if (known) return known[0]

  for (const language of preferred) {
    const base = language.toLowerCase().split('-')[0]
    if (base === 'zh') return 'zh-CN'
    if (base === 'en') return 'en'
    if (base === 'ja') return 'ja'
  }
  return 'ja'
}
