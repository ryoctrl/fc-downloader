/* fc-downloader — favorites */
import { useMemo, useState } from 'react'
import { FC } from '../design/data'
import { Icon } from '../design/icons'
import { useApp } from '../design/context'
import { FilterChip, PostCard } from './LibraryScreen'

export function FavoritesScreen() {
  const app = useApp()
  const L = app.L
  const [svcFilter, setSvcFilter] = useState('all')
  const [q, setQ] = useState('')
  const favPosts = useMemo(() => {
    let ps = FC.POSTS.filter((p) => app.state.favs.has(p.id))
    if (svcFilter !== 'all') ps = ps.filter((p) => p.service === svcFilter)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      ps = ps.filter((p) => p.title.toLowerCase().includes(k) || p.creatorName.toLowerCase().includes(k))
    }
    return ps
  }, [app.state.favs, svcFilter, q])
  const density = app.t.density
  const minW = density === 'compact' ? 168 : 210

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="heart" size={22} fill style={{ color: 'var(--fav)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{L.favorites}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{L.favSubtitle}</div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '7px 12px',
              background: 'var(--surface-2)',
              borderRadius: 9,
              width: 200
            }}
          >
            <Icon name="search" size={15} style={{ color: 'var(--text-3)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={L.search}
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
                minWidth: 0
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
          <FilterChip active={svcFilter === 'all'} onClick={() => setSvcFilter('all')}>
            {L.allServices} · {FC.POSTS.filter((p) => app.state.favs.has(p.id)).length}
          </FilterChip>
          {FC.SERVICES.map((s) => {
            const c = FC.POSTS.filter((p) => p.service === s.id && app.state.favs.has(p.id)).length
            if (!c) return null
            return (
              <FilterChip key={s.id} active={svcFilter === s.id} onClick={() => setSvcFilter(s.id)}>
                {s.name} · {c}
              </FilterChip>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px 28px' }}>
        {favPosts.length === 0 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
            <div style={{ textAlign: 'center' }}>
              <Icon name="heart" size={36} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
              <div>{L.noFavorites}</div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))`,
              gap: density === 'compact' ? 12 : 16
            }}
          >
            {favPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                density={density}
                onOpen={() => app.go({ screen: 'post', postId: p.id, from: 'favorites' })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
