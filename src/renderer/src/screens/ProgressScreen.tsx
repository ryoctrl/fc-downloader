/* fc-downloader — bulk download progress, driven by real main-process events */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DownloadItem, DownloadProgress, ServiceId } from '@shared/types'
import { FC, fmtSize } from '../design/data'
import {
  estimateEtaSec,
  formatEta,
  formatSpeed,
  initSpeed,
  pushSample,
  type SpeedState
} from '../design/metrics'
import { Icon } from '../design/icons'
import { Btn, ServiceMark } from '../design/primitives'
import { useApp } from '../design/context'
import { bridge } from '../bridge'
import { FilterChip } from './LibraryScreen'

/** A post's file results, grouped for the download list. */
interface PostGroup {
  postId: string
  serviceId: ServiceId
  creatorName?: string
  postTitle?: string
  total: number
  items: DownloadItem[]
}

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
  const [speedBps, setSpeedBps] = useState(0)
  const [etaSec, setEtaSec] = useState<number | null>(null)
  const [failedOnly, setFailedOnly] = useState(false)
  const speedRef = useRef<SpeedState>(initSpeed())
  const startRef = useRef<{ t: number; processed: number; started: boolean }>({
    t: 0,
    processed: 0,
    started: false
  })

  // Subscribe to live download events; reset when a new run starts.
  useEffect(() => {
    setProgress(null)
    setItems([])
    setSpeedBps(0)
    setEtaSec(null)
    setFailedOnly(false)
    speedRef.current = initSpeed()
    startRef.current = { t: 0, processed: 0, started: false }

    const offProgress = bridge.onDownloadProgress((p) => {
      setProgress(p)
      const now = Date.now()
      const sample = pushSample(speedRef.current, p.bytesDownloaded, now)
      speedRef.current = sample.state
      setSpeedBps(sample.bps)
      const processed = p.completed + p.skipped + p.failed
      if (!startRef.current.started) startRef.current = { t: now, processed, started: true }
      const elapsed = (now - startRef.current.t) / 1000
      setEtaSec(estimateEtaSec(elapsed, processed, p.total, startRef.current.processed))
    })
    const offItem = bridge.onDownloadItem((it) =>
      setItems((list) => (list.some((i) => i.id === it.id) ? list : [it, ...list].slice(0, 600)))
    )
    const offDone = bridge.onDownloadDone((p) => {
      setProgress(p)
      setSpeedBps(0)
      setEtaSec(null)
      app.actions.markDownloadDone()
    })

    // Restore the file list after navigating away and back: the main process
    // keeps the run's per-file buffer, so seed from it (merging any live items
    // that arrived first, de-duped by id).
    let cancelled = false
    void bridge.downloadStatus().then((buffered) => {
      if (cancelled || buffered.length === 0) return
      setItems((live) => {
        const seen = new Set(live.map((i) => i.id))
        const seed = [...buffered].reverse().filter((i) => !seen.has(i.id))
        return [...live, ...seed].slice(0, 600)
      })
    })

    return () => {
      cancelled = true
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
  // Prefer this screen's live progress; fall back to the app-level snapshot so a
  // run that finished while we were on another screen still shows its result
  // (not 0%) after navigating back.
  const p = progress ??
    app.state.lastProgress ?? {
      total: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      inFlight: 0,
      postsCompleted: 0,
      postsTotal: 0,
      bytesDownloaded: 0,
      bytesTotal: 0
    }
  const processed = p.completed + p.skipped + p.failed
  // Determinate progress once the up-front post count is known.
  const hasTotal = p.postsTotal > 0
  const postPct = hasTotal ? Math.min(100, (p.postsCompleted / p.postsTotal) * 100) : 0
  // A run that hit rate-limiting AND didn't reach every post finished
  // *incomplete* — don't paint it as a clean 100% "complete".
  const incomplete = done && p.rateLimited === true && hasTotal && p.postsCompleted < p.postsTotal
  const pct = done ? (incomplete ? postPct : 100) : postPct
  const headColor = incomplete ? 'var(--warn)' : done ? 'var(--ok)' : 'var(--accent)'

  // Live "what's happening now" line: counting / walking posts / downloading.
  const cur = !done ? p.current : undefined
  const activity = cur
    ? (() => {
        const waiting = cur.phase === 'waiting'
        const label = waiting
          ? L.activityWaiting
          : cur.phase === 'counting'
            ? L.activityCounting
            : cur.phase === 'downloading'
              ? L.activityDownloading
              : L.activityScanning
        let detail = ''
        if (waiting && cur.retry) {
          // e.g. "HTTP 429 · 8s · #3" — what was detected and how long we wait.
          const code = cur.retry.status ? `HTTP ${cur.retry.status}` : L.networkError
          const secs = Math.max(1, Math.ceil(cur.retry.waitMs / 1000))
          detail = `${code} · ${secs}s · #${cur.retry.attempt}`
        } else if (cur.phase === 'downloading' && cur.activeFiles?.length) {
          const fs = cur.activeFiles
          detail = fs.slice(0, 2).join(', ') + (fs.length > 2 ? ` +${fs.length - 2}` : '')
        } else {
          const post = cur.postTitle || (cur.postId ? `#${cur.postId}` : '')
          detail = [cur.creatorName, post].filter(Boolean).join(' — ')
        }
        return { label, detail, color: waiting ? 'var(--warn)' : 'var(--accent)' }
      })()
    : null

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
              {done ? (incomplete ? L.downloadIncomplete : L.downloadComplete) : L.downloading}
              {!done && (
                <span
                  className="fc-pulse"
                  style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent)' }}
                />
              )}
            </div>
            {incomplete && (
              <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 3 }}>{L.rateLimitedHint}</div>
            )}
          </div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 38,
              fontWeight: 700,
              color: headColor,
              fontVariantNumeric: 'tabular-nums',
              display: 'flex',
              alignItems: 'baseline',
              gap: 4
            }}
          >
            {done || hasTotal ? (
              <>
                {Math.round(pct)}
                <span style={{ fontSize: 20 }}>%</span>
              </>
            ) : (
              <>
                {p.postsCompleted}
                <span style={{ fontSize: 15, color: 'var(--text-3)' }}>{L.postsUnit}</span>
              </>
            )}
          </div>
        </div>
        {/* Determinate once the up-front post count is known; otherwise the file
            total is discovered as the run streams, so show an indeterminate bar. */}
        <div
          style={{
            position: 'relative',
            height: 10,
            borderRadius: 99,
            background: 'var(--surface-2)',
            overflow: 'hidden'
          }}
        >
          {done || hasTotal ? (
            <div
              style={{
                height: '100%',
                width: pct + '%',
                borderRadius: 99,
                background: headColor,
                transition: 'width .2s linear'
              }}
            />
          ) : (
            <div
              className="fc-indeterminate"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '35%',
                borderRadius: 99,
                background: 'var(--accent)'
              }}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {stat(L.postsUnit, hasTotal ? `${p.postsCompleted}/${p.postsTotal}` : `${p.postsCompleted}`, 'var(--accent)')}
          {stat(L.filesUnit, `${processed}/${p.total}`)}
          {stat(L.doneShort, `${p.completed}`, 'var(--ok)')}
          {stat(L.skipped, `${p.skipped}`)}
          {stat(L.failed, `${p.failed}`, p.failed > 0 ? 'var(--danger)' : undefined)}
          {stat(L.size, fmtSize(p.bytesDownloaded / (1024 * 1024)))}
          {stat(L.speed, done ? '—' : formatSpeed(speedBps))}
          {stat(L.eta, done ? L.doneShort : formatEta(etaSec))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {done ? (
            <>
              <Btn
                variant="primary"
                icon="library"
                onClick={() => {
                  app.actions.setLibNode({ kind: 'service', service: svc.id })
                  app.go({ screen: 'library' })
                }}
              >
                {L.viewInLibrary}
              </Btn>
              <Btn variant="solid" icon="folder" onClick={() => bridge.openPath(app.state.saveDir)}>
                {L.openFolder}
              </Btn>
              {p.failed > 0 && (
                <Btn variant="solid" icon="refresh" onClick={() => app.actions.retryDownload()}>
                  {L.retryFailed}
                </Btn>
              )}
            </>
          ) : (
            <Btn variant="danger" icon="x" onClick={() => app.actions.cancelDownload()}>
              {L.cancel}
            </Btn>
          )}
        </div>
        {app.state.queued.length > 0 && (
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: 'var(--text-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 7
            }}
          >
            <Icon name="clock" size={13} />
            {L.queued}: {app.state.queued.map((id) => FC.serviceById(id).name).join(', ')}
          </div>
        )}
        {activity && (
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 12px',
              background: 'var(--surface-2)',
              borderRadius: 10,
              minWidth: 0
            }}
          >
            <span
              className="fc-pulse"
              style={{ width: 7, height: 7, borderRadius: 99, background: activity.color, flexShrink: 0 }}
            />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: activity.color, flexShrink: 0 }}>
              {activity.label}
            </span>
            {activity.detail && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-2)',
                  fontFamily: 'var(--mono)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }}
              >
                {activity.detail}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 18px 20px' }}>
        {p.failed > 0 && (
          <div style={{ display: 'flex', gap: 7, padding: '4px 6px 10px' }}>
            <FilterChip active={!failedOnly} onClick={() => setFailedOnly(false)}>
              {L.allStatus}
            </FilterChip>
            <FilterChip active={failedOnly} onClick={() => setFailedOnly(true)} icon="x">
              {L.failedOnly} · {p.failed}
            </FilterChip>
          </div>
        )}
        {(() => {
          // Group the per-file results by post (most recently active first), so
          // the list reads as "service › creator › post (id)  X / Total".
          const order: string[] = []
          const byPost = new Map<string, PostGroup>()
          for (const it of items) {
            let g = byPost.get(it.postId)
            if (!g) {
              g = {
                postId: it.postId,
                serviceId: it.serviceId,
                creatorName: it.creatorName,
                postTitle: it.postTitle,
                total: it.postFileTotal ?? 0,
                items: []
              }
              byPost.set(it.postId, g)
              order.push(it.postId)
            }
            g.items.push(it)
            if (it.postFileTotal && it.postFileTotal > g.total) g.total = it.postFileTotal
          }
          const groups = order
            .map((pid) => byPost.get(pid)!)
            .map((g) => ({ g, rows: failedOnly ? g.items.filter((i) => i.status === 'failed') : g.items }))
            .filter((x) => x.rows.length > 0)

          if (groups.length === 0) {
            return (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                {done ? L.doneShort : activity ? `${activity.label}…` : L.loading}
              </div>
            )
          }
          return groups.map(({ g, rows }) => {
            const svc = FC.serviceById(g.serviceId)
            return (
              <div key={g.postId} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px 5px',
                    minWidth: 0
                  }}
                >
                  <ServiceMark svc={svc} size={16} />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 150,
                      flexShrink: 0
                    }}
                  >
                    {g.creatorName ?? svc.name}
                  </span>
                  <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>›</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-2)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                      minWidth: 0
                    }}
                  >
                    {g.postTitle || `#${g.postId}`}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                    #{g.postId}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--mono)',
                      color: 'var(--text-2)',
                      background: 'var(--surface-2)',
                      borderRadius: 99,
                      padding: '2px 8px',
                      flexShrink: 0
                    }}
                  >
                    {g.items.length}
                    {g.total ? ` / ${g.total}` : ''}
                  </span>
                </div>
                {rows.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 12px 6px 34px',
                      borderRadius: 8
                    }}
                  >
                    <Icon
                      name={it.status === 'failed' ? 'x' : 'check'}
                      size={14}
                      style={{ color: STATUS_COLOR[it.status] ?? 'var(--text-3)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-2)',
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
                        fontSize: 11,
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
                ))}
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
