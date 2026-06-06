/* fc-downloader — shared UI primitives: Thumb, ServiceMark, StatusDot, Btn */
import type { CSSProperties, ReactNode } from 'react'
import type { DesignService, Dict, Post, PostStatus } from './types'
import { Icon } from './icons'
import { useApp } from './context'

// ── striped placeholder thumbnail (no hand-drawn art) ──
export function Thumb({
  post,
  label,
  radius = 8,
  ratio
}: {
  post?: Post
  label?: string
  radius?: number
  ratio?: string
}) {
  const hue = post ? post.hue : 220
  const type = post ? post.type : 'image'
  const cap =
    label ||
    (post ? `${type === 'video' ? 'MOV' : type === 'file' ? 'ZIP' : 'IMG'} · ${post.id}` : 'asset')
  const stripe = `repeating-linear-gradient(135deg, oklch(0.62 0.10 ${hue} / 0.16) 0 7px, transparent 7px 14px)`
  const base = `linear-gradient(150deg, oklch(0.70 0.09 ${hue} / 0.22), oklch(0.58 0.11 ${hue} / 0.30))`
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: ratio || '4 / 3',
        borderRadius: radius,
        overflow: 'hidden',
        background: base,
        boxShadow: 'inset 0 0 0 1px var(--hairline)'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: stripe }} />
      {type === 'video' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'oklch(0.30 0.05 ' + hue + ')'
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 99,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(255,255,255,.7)',
              backdropFilter: 'blur(2px)',
              paddingLeft: 3
            }}
          >
            <Icon name="play" size={16} />
          </div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: 7,
          bottom: 6,
          fontFamily: 'var(--mono)',
          fontSize: 9.5,
          letterSpacing: '.02em',
          color: 'oklch(0.30 0.06 ' + hue + ')',
          background: 'rgba(255,255,255,.55)',
          padding: '1px 5px',
          borderRadius: 4
        }}
      >
        {cap}
      </div>
    </div>
  )
}

// ── service badge: user-supplied logo if present, else monogram ──
export function ServiceMark({
  svc,
  size = 34,
  active = false,
  logo
}: {
  svc: DesignService
  size?: number
  active?: boolean
  logo?: string | null
}) {
  const app = useApp()
  const src = logo !== undefined ? logo : app.state.brandLogos[svc.id] || null
  const radius = size * 0.28
  if (src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          flexShrink: 0,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: active
            ? `0 4px 12px oklch(0.58 0.15 ${svc.hue} / 0.4)`
            : 'inset 0 0 0 1px var(--hairline)',
          transition: 'all .18s ease'
        }}
      >
        <img
          src={src}
          alt={svc.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        fontFamily: 'var(--mono)',
        fontWeight: 600,
        fontSize: size * 0.46,
        color: active ? '#fff' : `oklch(0.55 0.13 ${svc.hue})`,
        background: active ? `oklch(0.58 0.15 ${svc.hue})` : `oklch(0.70 0.08 ${svc.hue} / 0.16)`,
        boxShadow: active ? `0 4px 12px oklch(0.58 0.15 ${svc.hue} / 0.4)` : 'none',
        transition: 'all .18s ease'
      }}
    >
      {svc.mark}
    </div>
  )
}

export function StatusDot({ status, size = 7 }: { status: PostStatus; size?: number }) {
  const c = status === 'done' ? 'var(--ok)' : status === 'partial' ? 'var(--warn)' : 'var(--accent)'
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: c,
        flexShrink: 0,
        display: 'inline-block'
      }}
    />
  )
}

export function StatusBadge({ status, L }: { status: PostStatus; L: Dict }) {
  const map: Record<PostStatus, [string, string]> = {
    done: [L.downloaded, 'var(--ok)'],
    partial: [L.partial, 'var(--warn)'],
    new: [L.notDownloaded, 'var(--accent)']
  }
  const [lbl, c] = map[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 99,
        background: 'rgba(255,255,255,.85)',
        fontSize: 10.5,
        fontWeight: 600,
        color: c,
        backdropFilter: 'blur(4px)'
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: c }} />
      {lbl}
    </span>
  )
}

type BtnVariant = 'primary' | 'solid' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

export function Btn({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  icon,
  active,
  style,
  title
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  size?: BtnSize
  icon?: string
  active?: boolean
  style?: CSSProperties
  title?: string
}) {
  const pads = size === 'sm' ? '5px 9px' : size === 'lg' ? '11px 18px' : '7px 13px'
  const fs = size === 'sm' ? 12 : size === 'lg' ? 14.5 : 13
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    padding: pads,
    fontSize: fs,
    fontWeight: 500,
    lineHeight: 1,
    cursor: 'pointer',
    borderRadius: 9,
    border: '1px solid transparent',
    fontFamily: 'inherit',
    transition: 'background .15s, border-color .15s, color .15s',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  }
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px var(--accent-shadow)' },
    solid: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost: {
      background: active ? 'var(--surface-2)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-2)'
    },
    danger: { background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border)' }
  }
  return (
    <button
      title={title}
      onClick={onClick}
      className={'fc-btn fc-btn-' + variant}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}
