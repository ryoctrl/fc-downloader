/* fc-downloader — bulk download progress, driven by real main-process events */
import { useEffect, useState, type ReactNode } from 'react'
import type { DownloadItem, DownloadProgress } from '@shared/types'
import { FC, fmtSize } from '../design/data'
import { Icon } from '../design/icons'
import { Btn, ServiceMark } from '../design/primitives'
import { useApp } from '../design/context'
import { bridge } from '../bridge'

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--ok)',
  skipped: 'var(--text-3)',
  failed: 'var(--danger)',
  downloading: 'var(--accent)',
  pending: 'var(--text-3)',
  canceled: 'var(--text-3)'
}

export function ProgressScreen() {
  const app = useApp()
  const L = app.L
  const dl = app.state.download
  const svc = dl ? FC.serviceById(dl.svcId) : null
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [items, setItems] = useState<DownloadItem[]>([])

  // Subscribe to live download events; reset when a new run starts.
  useEffect(() => {
    setProgress(null)
    setItems([])
    const offProgress = bridge.onDownloadProgress((p) => setProgress(p))
    const offItem = bridge.onDownloadItem((it) => setItems((list) => [it, ...list].slice(0, 300)))
    const offDone = bridge.onDownloadDone((p) => {
      setProgress(p)
      app.actions.markDownloadDone()
    })
    return () => {
      offProgress()
      offItem()
      offDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dl?.startedAt])

  if (!dl || !svc) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        <div style={{ textAlign: 'center' }}>
          <Icon name="download" size={40} style={{ margin: '0 auto 14px', opacity: 0.4 }} />
          <div style={{ fontSize: 15 }}>{L.noActiveDownload}</div>
        </div>
      </div>
    )
  }

  const done = dl.done
  const p = progress ?? { total: 0, completed: 0, skipped: 0, failed: 0, inFlight: 0, bytesDownloaded: 0, bytesTotal: 0 }
  const processed = p.completed + p.skipped + p.failed
  const pct = done ? 100 : p.total > 0 ? Math.min(100, (processed / p.total) * 100) : 0

  const stat = (label: string, value: string, color?: string): ReactNode => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 19,
          fontWeight: 600,
          color: color ?? 'var(--text)'
        }}
      >
        {value}
      </div>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '26px 30px 22px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <ServiceMark svc={svc} size={42} active />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500 }}>{svc.name}</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              {done ? L.downloadComplete : L.downloading}
              {!done && (
                <span
                  className="fc-pulse"
                  style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent)' }}
                />
              )}
            </div>
          </div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 38,
              fontWeight: 700,
              color: done ? 'var(--ok)' : 'var(--accent)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {Math.round(pct)}
            <span style={{ fontSize: 20 }}>%</span>
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: pct + '%',
              borderRadius: 99,
              background: done ? 'var(--ok)' : 'var(--accent)',
              transition: 'width .2s linear'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {stat(L.filesUnit, `${processed}/${p.total}`)}
          {stat(L.doneShort, `${p.completed}`, 'var(--ok)')}
          {stat(L.skipped, `${p.skipped}`)}
          {stat(L.failed, `${p.failed}`, p.failed > 0 ? 'var(--danger)' : undefined)}
          {stat(L.size, fmtSize(p.bytesDownloaded / (1024 * 1024)))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {done ? (
            <>
              <Btn variant="primary" icon="library" onClick={() => app.go({ screen: 'library', svc: svc.id })}>
                {L.viewInLibrary}
              </Btn>
              <Btn variant="solid" icon="folder" onClick={() => bridge.openPath(app.state.saveDir)}>
                {L.openFolder}
              </Btn>
            </>
          ) : (
            <Btn variant="danger" icon="x" onClick={() => app.actions.cancelDownload()}>
              {L.cancel}
            </Btn>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 18px 20px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            {done ? L.doneShort : L.loading}
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                borderRadius: 10
              }}
            >
              <Icon
                name={it.status === 'failed' ? 'x' : it.status === 'skipped' ? 'check' : 'check'}
                size={15}
                style={{ color: STATUS_COLOR[it.status] ?? 'var(--text-3)' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {it.fileName}
                </div>
                {it.error && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--danger)',
                      fontFamily: 'var(--mono)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {it.error}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: STATUS_COLOR[it.status] ?? 'var(--text-3)',
                  fontFamily: 'var(--mono)',
                  flexShrink: 0
                }}
              >
                {it.status === 'completed'
                  ? L.doneShort
                  : it.status === 'skipped'
                    ? L.skipped
                    : it.status === 'failed'
                      ? L.failed
                      : it.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
