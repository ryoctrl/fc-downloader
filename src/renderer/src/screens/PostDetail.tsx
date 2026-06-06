/* fc-downloader — post detail */
import type { ReactNode } from 'react'
import { FC, fmtSize } from '../design/data'
import { Icon } from '../design/icons'
import { Btn, ServiceMark, StatusBadge, Thumb } from '../design/primitives'
import { useApp } from '../design/context'

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

export function PostDetail() {
  const app = useApp()
  const L = app.L
  const postId = app.nav.screen === 'post' ? app.nav.postId : -1
  const from = app.nav.screen === 'post' ? app.nav.from : undefined
  const post = FC.POSTS.find((p) => p.id === postId)
  if (!post) return null
  const svc = FC.serviceById(post.service)
  const fav = app.state.favs.has(post.id)
  const idx = FC.POSTS.findIndex((p) => p.id === post.id)
  const prev = FC.POSTS[idx - 1]
  const next = FC.POSTS[idx + 1]
  const back = () =>
    app.go(from === 'favorites' ? { screen: 'favorites' } : { screen: 'library' })

  const preview = (): ReactNode => {
    if (post.type === 'video') {
      return (
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <Thumb post={post} radius={0} ratio="16 / 9" label={`MOV · id_${post.id}`} />
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
                boxShadow: '0 8px 30px rgba(0,0,0,.25)',
                cursor: 'pointer'
              }}
            >
              <Icon name="play" size={26} style={{ color: 'var(--text)' }} />
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '20px 16px 12px',
              background: 'linear-gradient(transparent, rgba(0,0,0,.5))',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <Icon name="play" size={16} style={{ color: '#fff' }} />
            <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.3)' }}>
              <div style={{ width: '30%', height: '100%', borderRadius: 99, background: '#fff' }} />
            </div>
            <span style={{ color: '#fff', fontSize: 11, fontFamily: 'var(--mono)' }}>03:12 / 10:48</span>
          </div>
        </div>
      )
    }
    if (post.type === 'file') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: post.files }).map((_, i) => (
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
              <Icon name="file" size={20} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>
                {['linework', 'psd_pack', 'settei', 'bonus'][i % 4]}_{String(i + 1).padStart(2, '0')}.
                {['psd', 'zip', 'clip', 'pdf'][i % 4]}
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-3)' }}>
                {fmtSize(Math.round(post.sizeMB / post.files))}
              </span>
              <Icon name="download" size={16} style={{ color: 'var(--text-3)' }} />
            </div>
          ))}
        </div>
      )
    }
    const n = Math.min(post.files, 12)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i}>
            <Thumb post={post} radius={10} ratio="3 / 4" label={`IMG_${String(i + 1).padStart(3, '0')}`} />
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
          onClick={() => prev && app.go({ screen: 'post', postId: prev.id, from })}
          style={{ opacity: prev ? 1 : 0.35 }}
        >
          {L.prev}
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => next && app.go({ screen: 'post', postId: next.id, from })}
          style={{ opacity: next ? 1 : 0.35 }}
        >
          {L.next}
          <Icon name="arrowR" size={16} />
        </Btn>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 26px', minWidth: 0 }}>{preview()}</div>
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
              onClick={() => app.actions.toggleFav(post.id)}
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
            <Btn variant="solid" icon="folder" style={{ padding: '10px 13px' }} title={L.openFolder} />
          </div>
          {post.status !== 'done' && (
            <button
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px',
                borderRadius: 11,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                background: 'var(--accent)',
                color: '#fff',
                marginBottom: 20,
                boxShadow: '0 3px 12px var(--accent-shadow)'
              }}
            >
              <Icon name="download" size={17} strokeWidth={2.2} />
              {L.downloadThis}
            </button>
          )}
          <MetaRow label={L.posted}>{post.date}</MetaRow>
          <MetaRow label={L.type}>{post.type}</MetaRow>
          <MetaRow label={L.filesUnit}>{post.files}</MetaRow>
          <MetaRow label={L.size}>{fmtSize(post.sizeMB)}</MetaRow>
          <MetaRow label="ID">id_{post.id}</MetaRow>
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
            {post.service}/{post.creator}/<br />
            {post.year}/{String(post.month).padStart(2, '0')}/id_{post.id}/
          </div>
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
            {L.tags}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {post.tags.map((t) => (
              <span
                key={t}
                style={{
                  padding: '4px 10px',
                  borderRadius: 99,
                  background: 'var(--surface-2)',
                  fontSize: 11.5,
                  color: 'var(--text-2)'
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
