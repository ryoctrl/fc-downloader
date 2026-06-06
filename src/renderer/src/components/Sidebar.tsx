import type { ServiceDescriptor } from '@shared/types'
import type { View } from '../App'

interface Props {
  services: ServiceDescriptor[]
  view: View
  onNavigate: (view: View) => void
}

export function Sidebar({ services, view, onNavigate }: Props): JSX.Element {
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">fc-downloader</div>

      <div className="sidebar__section">サービス</div>
      {services.map((s) => (
        <button
          key={s.id}
          className={
            'sidebar__item' +
            (view.kind === 'service' && view.serviceId === s.id ? ' is-active' : '')
          }
          onClick={() => onNavigate({ kind: 'service', serviceId: s.id })}
          title={s.name}
        >
          <span className="sidebar__icon" aria-hidden>
            {s.name.charAt(0)}
          </span>
          <span className="sidebar__label">{s.name}</span>
          <span className={'sidebar__dot' + (s.loggedIn ? ' is-on' : '')} />
        </button>
      ))}

      <div className="sidebar__section">ライブラリ</div>
      <button
        className={'sidebar__item' + (view.kind === 'viewer' ? ' is-active' : '')}
        onClick={() => onNavigate({ kind: 'viewer' })}
      >
        <span className="sidebar__icon" aria-hidden>
          ▦
        </span>
        <span className="sidebar__label">ビューワー</span>
      </button>

      <div className="sidebar__spacer" />
      <button
        className={'sidebar__item' + (view.kind === 'settings' ? ' is-active' : '')}
        onClick={() => onNavigate({ kind: 'settings' })}
      >
        <span className="sidebar__icon" aria-hidden>
          ⚙
        </span>
        <span className="sidebar__label">設定</span>
      </button>
    </nav>
  )
}
