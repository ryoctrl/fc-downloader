/* fc-downloader — Service screen: embedded WebView + download settings panel */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PostFileKind } from '@shared/types'
import type { DesignService, Dict, PostType } from '../design/types'
import { FC } from '../design/data'
import { Icon } from '../design/icons'
import { Btn, ServiceMark } from '../design/primitives'
import { useApp } from '../design/context'

/** The subset of Electron's <webview> element API the toolbar drives. */
interface WebviewEl extends HTMLElement {
  src: string
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  loadURL(url: string): Promise<void>
  getURL(): string
}

function NavButton({
  icon,
  disabled,
  onClick,
  title
}: {
  icon: string
  disabled?: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 28,
        height: 28,
        borderRadius: 7,
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--text-3)' : 'var(--text-2)',
        opacity: disabled ? 0.4 : 1
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

/**
 * Embedded Electron <webview> with a single, functional browser toolbar that
 * also merges the service header: real back/forward/reload, a live editable URL
 * bar, the login-status chip, and a re-check action. The per-service session
 * partition means cookies set here are reused by the main-process downloader.
 */
function BrowserPane({
  svc,
  loggedIn,
  onRecheck,
  L
}: {
  svc: DesignService
  loggedIn: boolean
  onRecheck: () => void
  L: Dict
}) {
  const ref = useRef<WebviewEl | null>(null)
  const home = `https://${svc.note}/`
  const [url, setUrl] = useState(home)
  const [draft, setDraft] = useState<string | null>(null)
  const [canBack, setCanBack] = useState(false)
  const [canFwd, setCanFwd] = useState(false)
  // Keep the latest recheck callback without re-running the listener effect.
  const onRecheckRef = useRef(onRecheck)
  onRecheckRef.current = onRecheck

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = (): void => {
      try {
        const u = el.getURL()
        if (u) setUrl(u)
        setCanBack(el.canGoBack())
        setCanFwd(el.canGoForward())
      } catch {
        /* webview not ready yet */
      }
    }
    // When the user logs in, the page navigates; auto re-check auth (debounced)
    // so login state updates without pressing the re-check button manually.
    let recheckTimer: ReturnType<typeof setTimeout> | undefined
    const onNavigate = (): void => {
      sync()
      if (recheckTimer) clearTimeout(recheckTimer)
      recheckTimer = setTimeout(() => onRecheckRef.current(), 1200)
    }
    el.addEventListener('did-navigate', onNavigate)
    el.addEventListener('did-navigate-in-page', sync)
    el.addEventListener('did-stop-loading', sync)
    el.addEventListener('dom-ready', sync)
    return () => {
      if (recheckTimer) clearTimeout(recheckTimer)
      el.removeEventListener('did-navigate', onNavigate)
      el.removeEventListener('did-navigate-in-page', sync)
      el.removeEventListener('did-stop-loading', sync)
      el.removeEventListener('dom-ready', sync)
    }
  }, [])

  const drive = (fn: (el: WebviewEl) => void): void => {
    const el = ref.current
    if (!el) return
    try {
      fn(el)
    } catch {
      /* ignore (webview not ready) */
    }
  }
  const submit = (value: string): void => {
    let u = value.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`
    drive((el) => void el.loadURL(u))
    setDraft(null)
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)'
        }}
      >
        <ServiceMark svc={svc} size={22} active={loggedIn} />
        <div style={{ display: 'flex', gap: 1 }}>
          <NavButton icon="arrowL" title={L.back} disabled={!canBack} onClick={() => drive((el) => el.goBack())} />
          <NavButton icon="arrowR" title={L.next} disabled={!canFwd} onClick={() => drive((el) => el.goForward())} />
          <NavButton icon="refresh" title={L.refresh} onClick={() => drive((el) => el.reload())} />
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '4px 11px',
            background: 'var(--surface-2)',
            borderRadius: 8
          }}
        >
          <Icon
            name={url.startsWith('https://') ? 'lock' : 'globe'}
            size={12}
            style={{ color: url.startsWith('https://') ? 'var(--ok)' : 'var(--text-3)', flexShrink: 0 }}
          />
          <input
            value={draft ?? url}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => {
              setDraft(url)
              e.target.select()
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submit(draft ?? url)
                ;(e.target as HTMLInputElement).blur()
              } else if (e.key === 'Escape') {
                setDraft(null)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: 'var(--text-2)'
            }}
          />
        </div>
        <span
          title={loggedIn ? L.loggedIn : L.notLoggedIn}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 500,
            color: loggedIn ? 'var(--ok)' : 'var(--text-3)',
            padding: '3px 8px',
            borderRadius: 99,
            background: 'var(--surface-2)',
            whiteSpace: 'nowrap'
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: loggedIn ? 'var(--ok)' : 'var(--text-3)'
            }}
          />
          {loggedIn ? L.loggedIn : L.notLoggedIn}
        </span>
        <Btn size="sm" variant="ghost" icon="refresh" onClick={onRecheck} title={L.recheck} />
      </div>
      <webview
        ref={(el) => {
          ref.current = el as unknown as WebviewEl | null
        }}
        src={home}
        partition={`persist:${svc.id}`}
        allowpopups={true}
        style={{ flex: 1, width: '100%', border: 'none', background: 'var(--surface)' }}
      />
    </div>
  )
}

function Check({
  on,
  onClick,
  label,
  count
}: {
  on: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <label
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', cursor: 'pointer' }}
    >
      <span
        style={{
          width: 17,
          height: 17,
          borderRadius: 5,
          flexShrink: 0,
          border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--text-3)'),
          background: on ? 'var(--accent)' : 'transparent',
          color: '#fff',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        {on && <Icon name="check" size={12} strokeWidth={2.6} />}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{label}</span>
      {count != null && (
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          {count}
        </span>
      )}
    </label>
  )
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '4px 0 9px'
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: 'var(--text-3)'
        }}
      >
        {children}
      </div>
      {action}
    </div>
  )
}

function OptToggle({
  on,
  onClick,
  icon,
  label,
  hint
}: {
  on: boolean
  onClick: () => void
  icon: string
  label: string
  hint: string
}) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 4px', cursor: 'pointer' }}
    >
      <Icon name={icon} size={16} style={{ color: on ? 'var(--accent)' : 'var(--text-3)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{hint}</div>
      </div>
      <span
        style={{
          width: 34,
          height: 20,
          borderRadius: 99,
          flexShrink: 0,
          position: 'relative',
          background: on ? 'var(--accent)' : 'var(--border-2)',
          transition: 'background .15s'
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: 99,
            background: '#fff',
            transition: 'left .15s',
            boxShadow: '0 1px 3px rgba(0,0,0,.25)'
          }}
        />
      </span>
    </div>
  )
}

function SettingsPanel({ svc, loggedIn }: { svc: DesignService; loggedIn: boolean }) {
  const app = useApp()
  const L = app.L
  // Creators come from the app-level cache (survives service switches).
  const creators = useMemo(
    () => app.state.creators[svc.id] ?? [],
    [app.state.creators, svc.id]
  )
  const loadingCreators = !!app.state.creatorsLoading[svc.id]
  // File-type + skip selections persist across services and launches.
  const prefs = app.state.downloadPrefs
  const types: Record<PostType, boolean> = { image: prefs.image, video: prefs.video, file: prefs.file }
  const skipDup = prefs.skipDup
  const [sel, setSel] = useState<Set<string>>(new Set())

  // Trigger a (cached) load when logged in.
  useEffect(() => {
    if (loggedIn) app.actions.loadCreators(svc.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc.id, loggedIn])

  // Default-select all whenever the creator list (re)loads.
  useEffect(() => {
    setSel(new Set(creators.map((c) => c.creatorId)))
  }, [creators])

  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allSel = creators.length > 0 && sel.size === creators.length
  const anyType = types.image || types.video || types.file
  const canStart = loggedIn && anyType && sel.size > 0

  const start = (): void => {
    if (!canStart) return
    const includeKinds: PostFileKind[] = []
    if (types.image) includeKinds.push('image')
    if (types.video) includeKinds.push('video')
    if (types.file) includeKinds.push('file', 'audio')
    app.actions.startDownload(svc, {
      creatorIds: [...sel],
      skipExisting: skipDup,
      concurrency: app.state.concurrency,
      includeKinds
    })
  }

  const typeRow: [PostType, string, string][] = [
    ['image', L.images, 'image'],
    ['video', L.videos, 'play'],
    ['file', L.filesType, 'file']
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <ServiceMark svc={svc} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>
              {L.downloadSettings}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: loggedIn ? 'var(--ok)' : 'var(--warn)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: loggedIn ? 'var(--ok)' : 'var(--warn)'
                }}
              />
              {loggedIn ? L.loggedIn : L.notLoggedIn} · {svc.name}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}
      >
        <div>
          <SectionLabel
            action={
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {creators.length > 0 && (
                  <span
                    onClick={() =>
                      setSel(allSel ? new Set() : new Set(creators.map((c) => c.creatorId)))
                    }
                    style={{ fontSize: 11.5, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {allSel ? L.deselectAll : L.selectAll}
                  </span>
                )}
                {loggedIn && (
                  <span
                    onClick={() => app.actions.loadCreators(svc.id, true)}
                    title={L.recheck}
                    style={{ display: 'flex', color: 'var(--text-3)', cursor: 'pointer' }}
                  >
                    <Icon name="refresh" size={13} style={loadingCreators ? { animation: 'fc-spin .8s linear infinite' } : undefined} />
                  </span>
                )}
              </span>
            }
          >
            {L.creators}
            {creators.length > 0 ? ` · ${sel.size}/${creators.length}` : ''}
          </SectionLabel>
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '4px 12px' }}>
            {!loggedIn ? (
              <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-3)' }}>
                {L.loginToSeeCreators}
              </div>
            ) : loadingCreators ? (
              <div
                style={{
                  padding: '12px 0',
                  fontSize: 12,
                  color: 'var(--text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9
                }}
              >
                <span
                  className="fc-spin"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 99,
                    border: '2px solid var(--border-2)',
                    borderTopColor: 'var(--accent)'
                  }}
                />
                {L.loading}
              </div>
            ) : creators.length === 0 ? (
              <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-3)' }}>{L.noCreators}</div>
            ) : (
              creators.map((c) => (
                <Check
                  key={c.creatorId}
                  on={sel.has(c.creatorId)}
                  onClick={() => toggleSel(c.creatorId)}
                  label={c.name}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <SectionLabel>{L.fileTypes}</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {typeRow.map(([k, lbl, ic]) => (
              <div
                key={k}
                onClick={() => app.actions.setDownloadPrefs({ [k]: !types[k] })}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 6px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: '1px solid ' + (types[k] ? 'var(--accent)' : 'var(--border)'),
                  background: types[k] ? 'var(--accent-tint)' : 'transparent',
                  color: types[k] ? 'var(--accent)' : 'var(--text-3)'
                }}
              >
                <Icon name={ic} size={18} />
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>{L.options}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <OptToggle
              on={skipDup}
              onClick={() => app.actions.setDownloadPrefs({ skipDup: !skipDup })}
              icon="refresh"
              label={L.skipDuplicates}
              hint={L.skipDupHint}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button
          onClick={start}
          disabled={!canStart}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 11,
            border: 'none',
            cursor: canStart ? 'pointer' : 'not-allowed',
            fontSize: 14.5,
            fontWeight: 700,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            background: canStart ? 'var(--accent)' : 'var(--surface-2)',
            color: canStart ? '#fff' : 'var(--text-3)',
            boxShadow: canStart ? '0 4px 16px var(--accent-shadow)' : 'none'
          }}
        >
          <Icon name="download" size={18} strokeWidth={2.2} />
          {loggedIn ? L.startDownload : L.loginRequired}
        </button>
      </div>
    </div>
  )
}

export function ServiceScreen({ serviceId }: { serviceId: DesignService['id'] }) {
  const app = useApp()
  const L = app.L
  const svc = FC.serviceById(serviceId)
  const loggedIn = !!app.state.logins[serviceId]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 16, gap: 14 }}>
        <BrowserPane
          svc={svc}
          loggedIn={loggedIn}
          L={L}
          onRecheck={() => app.actions.recheckAuth(serviceId)}
        />
        <div
          style={{
            width: 366,
            flexShrink: 0,
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--surface)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <SettingsPanel svc={svc} loggedIn={loggedIn} />
        </div>
      </div>
    </div>
  )
}
