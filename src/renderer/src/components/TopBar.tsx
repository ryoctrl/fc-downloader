/* fc-downloader — top bar (plain cross-platform chrome) */
import { fmtSize } from '../design/data'
import { Icon } from '../design/icons'
import { useApp } from '../design/context'

export function TopBar() {
  const app = useApp()
  const L = app.L
  const dl = app.state.download
  const dlActive = dl && !dl.done
  const totalMB = app.posts.reduce((s, p) => s + p.sizeMB, 0)
  return (
    <div
      style={{
        height: 46,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff'
          }}
        >
          <Icon name="download" size={15} strokeWidth={2.4} />
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text-2)',
            letterSpacing: '.01em'
          }}
        >
          fc-downloader
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {dlActive ? (
          <button
            onClick={() => app.go({ screen: 'progress' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              borderRadius: 99,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--accent-tint)',
              color: 'var(--accent)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit'
            }}
          >
            <span
              className="fc-spin"
              style={{
                width: 12,
                height: 12,
                borderRadius: 99,
                border: '2px solid currentColor',
                borderTopColor: 'transparent'
              }}
            />
            {L.downloading}
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 12px',
              borderRadius: 99,
              background: 'var(--surface-2)',
              color: 'var(--text-3)',
              fontSize: 11.5,
              fontFamily: 'var(--mono)'
            }}
          >
            <Icon name="hdd" size={13} />
            {fmtSize(totalMB)}
          </div>
        )}
      </div>
    </div>
  )
}
