/* fc-downloader — left navigation rail */
import type { ReactNode } from 'react'
import { FC } from '../design/data'
import { SHORT } from '../design/i18n'
import { Icon } from '../design/icons'
import { ServiceMark } from '../design/primitives'
import { useApp } from '../design/context'

function RailItem({
  active,
  onClick,
  mark,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  mark?: ReactNode
  icon?: string
  label: string
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="fc-rail-item"
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '9px 4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 12,
        color: active ? 'var(--text)' : 'var(--text-3)'
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: -8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3.5,
            height: 22,
            borderRadius: 99,
            background: 'var(--accent)'
          }}
        />
      )}
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 38,
          height: 38,
          borderRadius: 11,
          background: active && !mark ? 'var(--accent-tint)' : 'transparent',
          color: active && !mark ? 'var(--accent)' : 'inherit',
          transition: 'background .15s'
        }}
      >
        {mark || (icon && <Icon name={icon} size={21} />)}
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.01em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}

export function Rail() {
  const app = useApp()
  const L = app.L
  const nav = app.nav
  return (
    <div
      style={{
        width: 72,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 8px',
        gap: 2,
        overflow: 'auto'
      }}
    >
      {FC.SERVICES.map((svc) => {
        const active = nav.screen === 'service' && nav.serviceId === svc.id
        return (
          <RailItem
            key={svc.id}
            label={SHORT[svc.id]}
            active={active}
            onClick={() => app.go({ screen: 'service', serviceId: svc.id })}
            mark={<ServiceMark svc={svc} size={34} active={active} />}
          />
        )
      })}
      <div style={{ height: 1, background: 'var(--border)', margin: '8px 6px' }} />
      <RailItem
        label={L.library}
        icon="library"
        active={
          nav.screen === 'library' || (nav.screen === 'post' && nav.from === 'library')
        }
        onClick={() => app.go({ screen: 'library' })}
      />
      <RailItem
        label={L.favorites}
        icon="heart"
        active={
          nav.screen === 'favorites' || (nav.screen === 'post' && nav.from === 'favorites')
        }
        onClick={() => app.go({ screen: 'favorites' })}
      />
      <div style={{ flex: 1 }} />
      <RailItem
        label={L.settings}
        icon="gear"
        active={nav.screen === 'settings'}
        onClick={() => app.go({ screen: 'settings' })}
      />
    </div>
  )
}
