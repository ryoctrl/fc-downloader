/*
 * fc-downloader — MOCK data layer (ported from the design handoff).
 *
 * ⚠️ This is demo content so the UI is fully browsable before the backend can
 * provide real data. In M2 (see docs/roadmap.md) this module is replaced by
 * calls to `window.api` (services:list / creators:list / posts, viewer:tree).
 * Keep the exported shape (FC.*) stable so screens don't need to change.
 */
import type { DesignCreator, DesignService, Post, PostStatus, PostType, ServiceId } from './types'

// deterministic PRNG so the dataset is stable across reloads
function mulberry(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]
const range = (rng: () => number, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1))

const SERVICES: DesignService[] = [
  { id: 'fantia', name: 'Fantia', mark: 'ƒ', hue: 348, note: 'fantia.jp' },
  { id: 'fanbox', name: 'pixiv FANBOX', mark: 'B', hue: 205, note: 'fanbox.cc' },
  { id: 'patreon', name: 'Patreon', mark: 'P', hue: 14, note: 'patreon.com' },
  { id: 'cien', name: 'ci-en', mark: 'C', hue: 150, note: 'ci-en.net' }
]

const CREATORS: Record<ServiceId, DesignCreator[]> = {
  fantia: [
    { id: 'sora_atelier', name: 'sora_atelier' },
    { id: 'mikazuki', name: 'みかづき工房' },
    { id: 'nekoworks', name: 'NEKO.WORKS' },
    { id: 'lili', name: 'Lili' }
  ],
  fanbox: [
    { id: 'aotsuki', name: '蒼月アート' },
    { id: 'pino', name: 'pino_draws' },
    { id: 'kanade', name: 'studio_kanade' }
  ],
  patreon: [
    { id: 'maplerender', name: 'MapleRender' },
    { id: 'kaiconcept', name: 'KaiConcept' }
  ],
  cien: [
    { id: 'hachi', name: 'ドット工房 hachi' },
    { id: 'gearlab', name: 'GEAR/lab' }
  ]
}

const TITLES = [
  '線画 + PSD セット',
  '今月の差分まとめ',
  'ラフ画アーカイブ',
  '立ち絵 表情差分',
  '背景イラスト 4K',
  'メイキング動画',
  'ボイス付き動画',
  '設定資料 zip',
  '壁紙パック 12月',
  'ミニ漫画 第3話',
  'スケッチログ',
  'キャラデザ案 v2',
  '塗り工程タイムラプス',
  '限定イラスト',
  'コンセプトアート集'
]
const TAGS = ['イラスト', '差分', 'PSD', '動画', '限定', 'ラフ', '背景', '壁紙', 'メイキング', 'ボイス']
const TYPES: PostType[] = ['image', 'image', 'image', 'image', 'file', 'file', 'video']

let pid = 8000
const POSTS: Post[] = []
SERVICES.forEach((svc, si) => {
  const list = CREATORS[svc.id] || []
  list.forEach((cr, ci) => {
    const rng = mulberry(si * 100 + ci * 7 + 13)
    const n = range(rng, 9, 22)
    for (let k = 0; k < n; k++) {
      const year = pick(rng, [2023, 2024, 2024, 2025, 2025, 2025, 2026])
      const month = range(rng, 1, year === 2026 ? 5 : 12)
      const day = range(rng, 1, 28)
      const type = pick(rng, TYPES)
      const files =
        type === 'video' ? range(rng, 1, 2) : type === 'file' ? range(rng, 1, 4) : range(rng, 3, 28)
      const sizeMB =
        type === 'video'
          ? range(rng, 80, 720)
          : type === 'file'
            ? range(rng, 12, 240)
            : range(rng, 4, 60)
      const r = rng()
      const status: PostStatus = r < 0.62 ? 'done' : r < 0.74 ? 'partial' : 'new'
      const ntags = range(rng, 1, 3)
      const tags: string[] = []
      for (let t = 0; t < ntags; t++) {
        const tg = pick(rng, TAGS)
        if (!tags.includes(tg)) tags.push(tg)
      }
      pid += range(rng, 3, 40)
      POSTS.push({
        id: pid,
        service: svc.id,
        creator: cr.id,
        creatorName: cr.name,
        title: pick(rng, TITLES),
        year,
        month,
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        type,
        files,
        sizeMB,
        status,
        fav: rng() < 0.16,
        tags,
        hue: (svc.hue + range(rng, -24, 24) + 360) % 360
      })
    }
  })
})
POSTS.sort((a, b) => b.date.localeCompare(a.date))

export interface ServiceCounts {
  posts: number
  done: number
  newCount: number
  creators: number
  sizeMB: number
}

function countsForService(id: ServiceId): ServiceCounts {
  const ps = POSTS.filter((p) => p.service === id)
  return {
    posts: ps.length,
    done: ps.filter((p) => p.status === 'done').length,
    newCount: ps.filter((p) => p.status !== 'done').length,
    creators: (CREATORS[id] || []).length,
    sizeMB: ps.reduce((s, p) => s + p.sizeMB, 0)
  }
}

export const fmtSize = (mb: number): string =>
  mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB'

export const FC = {
  SERVICES,
  CREATORS,
  POSTS,
  TAGS,
  countsForService,
  fmtSize,
  serviceById: (id: ServiceId): DesignService =>
    SERVICES.find((s) => s.id === id) ?? SERVICES[0],
  totals: {
    posts: POSTS.length,
    done: POSTS.filter((p) => p.status === 'done').length,
    fav: POSTS.filter((p) => p.fav).length,
    sizeMB: POSTS.reduce((s, p) => s + p.sizeMB, 0)
  }
}
