/* fc-downloader — post detail (real data) */
import type { ReactNode } from 'react'
import { FC, fmtSize } from '../design/data'
import type { ViewPost } from '../design/library'
import { Icon } from '../design/icons'
import { Btn, ServiceMark, StatusBadge, Thumb } from '../design/primitives'
import { useApp } from '../design/context'
import { bridge } from '../bridge'

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12.5,
          color: 'var(--text)',
          fontWeight: 500,
          textAlign: 'right',
          fontFamily: 'var(--mono)'
        }}
      >
        {children}
      </span>
    </div>
  )
}

function preview(post: ViewPost): ReactNode {
  if (post.type === 'video') {
    return (
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <Thumb hue={post.hue} type="video" radius={0} ratio="16 / 9" label={`MOV · id_${post.postId}`} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 99,
              background: 'rgba(255,255,255,.85)',
              display: 'grid',
              placeItems: 'center',
              paddingLeft: 5,
              boxShadow: '0 8px 30px rgba(0,0,0,.25)'
            }}
          >
            <Icon name="play" size={26} style={{ color: 'var(--text)' }} />
          </div>
        </div>
      </div>
    )
  }
  if (post.type === 'file' || post.type === 'audio') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: Math.max(1, post.files) }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 16px',
              borderRadius: 11,
              background: 'var(--surface)',
              border: '1px solid var(--border)'
            }}
          >
            <Icon name={post.type === 'audio' ? 'play' : 'file'} size={20} style={{ color: 'var(--accent)' }} />
            <div style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>
              {post.type === 'audio' ? 'track' : 'file'}_{String(i + 1).padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
    )
  }
  const n = Math.min(post.files, 12)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {Array.from({ length: Math.max(1, n) }).map((_, i) => (
        <div key={i}>
          <Thumb hue={post.hue} type="image" radius={10} ratio="3 / 4" label={`IMG_${String(i + 1).padStart(3, '0')}`} />
        </div>
      ))}
      {post.files > n && (
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            borderRadius: 10,
            background: 'var(--surface-2)',
            aspectRatio: '3 / 4',
            color: 'var(--text-3)',
            fontFamily: 'var(--mono)',
            fontSize: 13
          }}
        >
          +{post.files - n}
        </div>
      )}
    </div>
  )
}

export function PostDetail() {
  const app = useApp()
  const L = app.L
  const key = app.nav.screen === 'post' ? app.nav.postKey : ''
  const from = app.nav.screen === 'post' ? app.nav.from : undefined
  const idx = app.posts.findIndex((p) => p.key === key)
  const post = app.posts[idx]
  if (!post) return null
  const svc = FC.serviceById(post.service)
  const fav = app.state.favs.has(post.key)
  const prev = app.posts[idx - 1]
  const next = app.posts[idx + 1]
  const back = () => app.go(from === 'favorites' ? { screen: 'favorites' } : { screen: 'library' })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <Btn size="sm" variant="ghost" icon="arrowL" onClick={back}>
          {L.back}
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn
          size="sm"
          variant="ghost"
          icon="arrowL"
          onClick={() => prev && app.go({ screen: 'post', postKey: prev.key, from })}
          style={{ opacity: prev ? 1 : 0.35 }}
        >
          {L.prev}
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => next && app.go({ screen: 'post', postKey: next.key, from })}
          style={{ opacity: next ? 1 : 0.35 }}
        >
          {L.next}
          <Icon name="arrowR" size={16} />
        </Btn>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 26px', minWidth: 0 }}>{preview(post)}</div>
        <div
          style={{
            width: 332,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            overflow: 'auto',
            padding: '24px 22px',
            background: 'var(--surface)'
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <StatusBadge status={post.status} L={L} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 }}>
            {post.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '14px 0 18px' }}>
            <ServiceMark svc={svc} size={32} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{post.creatorName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{svc.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => app.actions.toggleFav(post.key)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                padding: '10px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                border: '1px solid ' + (fav ? 'transparent' : 'var(--border)'),
                background: fav ? 'var(--fav-tint)' : 'transparent',
                color: fav ? 'var(--fav)' : 'var(--text-2)'
              }}
            >
              <Icon name="heart" size={16} fill={fav} />
              {fav ? L.favorited : L.favorite}
            </button>
            <Btn
              variant="solid"
              icon="folder"
              style={{ padding: '10px 13px' }}
              title={L.openFolder}
              onClick={() => bridge.openPath(post.dirPath)}
            />
          </div>
          <MetaRow label={L.posted}>{post.date}</MetaRow>
          <MetaRow label={L.type}>{post.type}</MetaRow>
          <MetaRow label={L.filesUnit}>{post.files}</MetaRow>
          <MetaRow label={L.size}>{fmtSize(post.sizeMB)}</MetaRow>
          <MetaRow label="ID">id_{post.postId}</MetaRow>
          <div
            style={{
              margin: '18px 0 8px',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)'
            }}
          >
            {L.folderPath}
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 9,
              background: 'var(--surface-2)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text-2)',
              lineHeight: 1.7,
              wordBreak: 'break-all'
            }}
          >
            {post.dirPath}
          </div>
        </div>
      </div>
    </div>
  )
}
