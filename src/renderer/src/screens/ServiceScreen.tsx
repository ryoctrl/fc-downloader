/* fc-downloader — Service screen: embedded WebView + download settings panel */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PostFileKind, ServiceId } from '@shared/types'
import type { DesignService, Dict, PostType } from '../design/types'
import { FC } from '../design/data'
import { Icon } from '../design/icons'
import { Btn, ServiceMark } from '../design/primitives'
import { useApp } from '../design/context'

/** Public web page for a creator, for jumping the embedded browser to it.
 *  Patreon's creatorId is a campaign id with no clean public URL → not linkable. */
function creatorPageUrl(serviceId: ServiceId, creatorId: string): string | null {
  const id = encodeURIComponent(creatorId)
  switch (serviceId) {
    case 'fanbox':
      return `https://www.fanbox.cc/@${id}`
    case 'fantia':
      return `https://fantia.jp/fanclubs/${id}`
    case 'cien':
      return `https://ci-en.dlsite.com/creator/${id}`
    default:
      return null
  }
}

/** Imperative handle the creator list uses to drive the embedded browser. */
type WebviewNavRef = React.MutableRefObject<((url: string) => void) | null>

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
  navRef,
  L
}: {
  svc: DesignService
  loggedIn: boolean
  onRecheck: () => void
  navRef: WebviewNavRef
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

  // Let the creator list drive this webview (jump to a creator's page).
  navRef.current = (url: string): void => {
    setUrl(url)
    drive((el) => void el.loadURL(url))
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
        // NOTE: must be the string "true", not the boolean {true}. React sets a
        // boolean prop as a DOM *property* the <webview> ignores, leaving the
        // `allowpopups` *attribute* absent — which silently blocks window.open /
        // target=_blank (external links did nothing). The string renders the
        // real attribute, which Electron reads before the guest attaches.
        allowpopups={'true' as unknown as boolean}
        style={{ flex: 1, width: '100%', border: 'none', background: 'var(--surface)' }}
      />
    </div>
  )
}

/** Creator avatar for the download settings — the remote icon proxied through
 *  the service session (fcicon://), with a folder fallback on error. */
function CreatorIcon({ serviceId, iconUrl }: { serviceId: ServiceId; iconUrl?: string }) {
  const [failed, setFailed] = useState(false)
  if (iconUrl && !failed) {
    const src = `fcicon://i/?s=${encodeURIComponent(serviceId)}&u=${encodeURIComponent(iconUrl)}`
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          objectFit: 'cover',
          flexShrink: 0,
          background: 'var(--surface-2)'
        }}
      />
    )
  }
  return <Icon name="folder" size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
}

function Check({
  on,
  onToggle,
  onOpen,
  openTitle,
  label,
  sub,
  mark,
  badge,
  count
}: {
  on: boolean
  /** Toggle DL selection (the checkbox only). */
  onToggle: () => void
  /** Open this creator's page in the left browser (the name area). Absent =
   *  not navigable (e.g. Patreon), and the name is not clickable. */
  onOpen?: () => void
  openTitle?: string
  label: string
  sub?: string
  mark?: React.ReactNode
  badge?: React.ReactNode
  count?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px' }}>
      <span
        onClick={onToggle}
        role="checkbox"
        aria-checked={on}
        style={{
          width: 17,
          height: 17,
          borderRadius: 5,
          flexShrink: 0,
          cursor: 'pointer',
          border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--text-3)'),
          background: on ? 'var(--accent)' : 'transparent',
          color: '#fff',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        {on && <Icon name="check" size={12} strokeWidth={2.6} />}
      </span>
      <div
        onClick={onOpen}
        title={onOpen ? openTitle : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          cursor: onOpen ? 'pointer' : 'default'
        }}
      >
        {mark}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 13,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {label}
          </span>
          {sub && (
            <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{sub}</span>
          )}
        </span>
        {badge}
      </div>
      {count != null && (
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
          {count}
        </span>
      )}
    </div>
  )
}

type TierFilter = 'all' | 'paid' | 'free'

/** Small pill marking a creator as 支援中 (paid) or フォロー中 (free). */
function TierBadge({ supporting, L }: { supporting: boolean; L: Dict }) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1,
        padding: '3px 6px',
        borderRadius: 99,
        whiteSpace: 'nowrap',
        color: supporting ? 'var(--accent)' : 'var(--text-3)',
        background: supporting ? 'var(--accent-tint)' : 'var(--surface)',
        border: '1px solid ' + (supporting ? 'var(--accent)' : 'var(--border)')
      }}
    >
      {supporting ? L.tierPaid : L.tierFree}
    </span>
  )
}

/** Segmented [すべて|支援中|フォロー中] filter for the creator list. */
function TierTabs({
  value,
  onChange,
  counts,
  L
}: {
  value: TierFilter
  onChange: (v: TierFilter) => void
  counts: Record<TierFilter, number>
  L: Dict
}) {
  const tabs: [TierFilter, string][] = [
    ['all', L.tierAll],
    ['paid', L.tierPaid],
    ['free', L.tierFree]
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: 2,
        marginBottom: 8,
        background: 'var(--surface-2)',
        borderRadius: 8
      }}
    >
      {tabs.map(([k, lbl]) => {
        const active = value === k
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            style={{
              flex: 1,
              padding: '5px 4px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: active ? 700 : 500,
              fontFamily: 'inherit',
              color: active ? 'var(--text)' : 'var(--text-3)',
              background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? 'var(--shadow-sm)' : 'none'
            }}
          >
            {lbl} <span style={{ fontFamily: 'var(--mono)', opacity: 0.7 }}>{counts[k]}</span>
          </button>
        )
      })}
    </div>
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

function SettingsPanel({
  svc,
  loggedIn,
  navRef
}: {
  svc: DesignService
  loggedIn: boolean
  navRef: WebviewNavRef
}) {
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

  // Creator selection is persisted per service (survives switches/launches).
  // Absent saved state = all selected by default; saved state is intersected
  // with the current creators so stale ids are ignored.
  const savedSel = app.state.creatorSel[svc.id]
  const sel = useMemo<Set<string>>(() => {
    const all = creators.map((c) => c.creatorId)
    if (!savedSel) return new Set(all)
    const present = new Set(all)
    return new Set(savedSel.filter((id) => present.has(id)))
  }, [savedSel, creators])
  const persistSel = (next: Set<string>): void => app.actions.setCreatorSel(svc.id, [...next])

  // Trigger a (cached) load when logged in.
  useEffect(() => {
    if (loggedIn) app.actions.loadCreators(svc.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc.id, loggedIn])

  const toggleSel = (id: string): void => {
    const n = new Set(sel)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    persistSel(n)
  }

  // Paid(支援中) vs free(フォロー中) filter. Tabs only appear when the service
  // reports both kinds; otherwise the flat list (matching services that can't
  // tell tiers apart, e.g. ci-en/Patreon) is shown as before.
  const [tier, setTier] = useState<TierFilter>('all')
  const tierCounts: Record<TierFilter, number> = {
    all: creators.length,
    paid: creators.filter((c) => c.supporting === true).length,
    free: creators.filter((c) => c.supporting === false).length
  }
  const showTabs = tierCounts.paid > 0 && tierCounts.free > 0
  const visible =
    showTabs && tier !== 'all'
      ? creators.filter((c) => (tier === 'paid' ? c.supporting === true : c.supporting === false))
      : creators

  // Select-all operates on the currently-visible (filtered) creators.
  const allSel = visible.length > 0 && visible.every((c) => sel.has(c.creatorId))
  const toggleAll = (): void => {
    const next = new Set(sel)
    if (allSel) visible.forEach((c) => next.delete(c.creatorId))
    else visible.forEach((c) => next.add(c.creatorId))
    persistSel(next)
  }
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
                {visible.length > 0 && (
                  <span
                    onClick={toggleAll}
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
            {loadingCreators && creators.length > 0 && (
              // Background refresh over cached creators — a live "updating" hint.
              <span
                className="fc-spin"
                title={L.loading}
                style={{
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  marginLeft: 7,
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  border: '1.5px solid var(--border-2)',
                  borderTopColor: 'var(--accent)'
                }}
              />
            )}
          </SectionLabel>
          {loggedIn && showTabs && creators.length > 0 && (
            <TierTabs value={tier} onChange={setTier} counts={tierCounts} L={L} />
          )}
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '4px 12px' }}>
            {!loggedIn ? (
              <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-3)' }}>
                {L.loginToSeeCreators}
              </div>
            ) : loadingCreators && creators.length === 0 ? (
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
            ) : visible.length === 0 ? (
              <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--text-3)' }}>{L.noCreators}</div>
            ) : (
              visible.map((c) => {
                const url = creatorPageUrl(c.serviceId, c.creatorId)
                return (
                  <Check
                    key={c.creatorId}
                    on={sel.has(c.creatorId)}
                    onToggle={() => toggleSel(c.creatorId)}
                    onOpen={url ? () => navRef.current?.(url) : undefined}
                    openTitle={L.openCreatorPage}
                    mark={<CreatorIcon serviceId={c.serviceId} iconUrl={c.iconUrl} />}
                    label={c.name === c.creatorId ? c.creatorId : c.name}
                    sub={c.name === c.creatorId ? undefined : c.creatorId}
                    badge={
                      c.supporting === undefined ? undefined : (
                        <TierBadge supporting={c.supporting} L={L} />
                      )
                    }
                  />
                )
              })
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
  // Bridge: SettingsPanel's creator names drive BrowserPane's <webview>.
  const navRef = useRef<((url: string) => void) | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 16, gap: 14 }}>
        <BrowserPane
          svc={svc}
          loggedIn={loggedIn}
          L={L}
          navRef={navRef}
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
          <SettingsPanel svc={svc} loggedIn={loggedIn} navRef={navRef} />
        </div>
      </div>
    </div>
  )
}
