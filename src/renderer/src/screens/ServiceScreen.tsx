/* fc-downloader — Service screen: embedded WebView + download settings panel */
import { useEffect, useMemo, useState } from 'react'
import type { DesignService, Dict, PostType } from '../design/types'
import { FC, fmtSize } from '../design/data'
import { Icon } from '../design/icons'
import { Btn, ServiceMark } from '../design/primitives'
import { useApp } from '../design/context'

function UrlBar({ svc, loggedIn }: { svc: DesignService; loggedIn: boolean }) {
  return (
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
      <div style={{ display: 'flex', gap: 4, color: 'var(--text-3)' }}>
        <Icon name="arrowL" size={16} />
        <Icon name="arrowR" size={16} />
        <Icon name="refresh" size={15} />
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 11px',
          background: 'var(--surface-2)',
          borderRadius: 8,
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: 'var(--text-2)'
        }}
      >
        <Icon name="lock" size={12} style={{ color: 'var(--ok)' }} />
        https://{svc.note}/{loggedIn ? '' : 'login'}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          fontWeight: 500,
          color: loggedIn ? 'var(--ok)' : 'var(--text-3)',
          fontFamily: 'var(--mono)',
          padding: '3px 8px',
          borderRadius: 99,
          background: 'var(--surface-2)'
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
        WebView
      </div>
    </div>
  )
}

/**
 * Real Electron <webview> for login/browsing. Uses the per-service session
 * partition so cookies set here are reused by the main-process downloader.
 */
function ServiceWebView({ svc }: { svc: DesignService }) {
  return (
    <webview
      src={`https://${svc.note}/`}
      partition={`persist:${svc.id}`}
      allowpopups={true}
      style={{ flex: 1, width: '100%', border: 'none', background: 'var(--surface)' }}
    />
  )
}

function MonthField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          color: 'var(--text-3)'
        }}
      >
        {label}
      </span>
      <input
        type="month"
        min="2023-01"
        max="2026-05"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          outline: 'none'
        }}
      />
    </label>
  )
}

function RangePicker({
  since,
  until,
  setSince,
  setUntil,
  L
}: {
  since: string
  until: string
  setSince: (v: string) => void
  setUntil: (v: string) => void
  L: Dict
}) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 13px',
        borderRadius: 10,
        background: 'var(--accent-tint)',
        border: '1px solid var(--accent)'
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <MonthField label={L.from} value={since} onChange={setSince} />
        <span style={{ paddingBottom: 9, color: 'var(--text-3)' }}>–</span>
        <MonthField label={L.to} value={until} onChange={setUntil} />
      </div>
    </div>
  )
}

function ScopeRadio({
  value,
  onChange,
  L
}: {
  value: string
  onChange: (v: string) => void
  L: Dict
}) {
  const opts: [string, string][] = [
    ['all', L.allPosts],
    ['new', L.newOnly],
    ['range', L.dateRange]
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {opts.map(([v, lbl]) => (
        <label
          key={v}
          onClick={() => onChange(v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            cursor: 'pointer',
            borderRadius: 9,
            border: '1px solid ' + (value === v ? 'var(--accent)' : 'var(--border)'),
            background: value === v ? 'var(--accent-tint)' : 'transparent'
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 99,
              flexShrink: 0,
              border: '2px solid ' + (value === v ? 'var(--accent)' : 'var(--text-3)'),
              display: 'grid',
              placeItems: 'center'
            }}
          >
            {value === v && (
              <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)' }} />
            )}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lbl}</span>
        </label>
      ))}
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
  const allPosts = useMemo(() => FC.POSTS.filter((p) => p.service === svc.id), [svc.id])
  const creators = FC.CREATORS[svc.id] || []
  const [scope, setScope] = useState('new')
  const [types, setTypes] = useState<Record<PostType, boolean>>({ image: true, video: true, file: true })
  const [sel, setSel] = useState<Set<string>>(() => new Set(creators.map((c) => c.id)))
  const [skipDup, setSkipDup] = useState(true)
  const [foldering, setFoldering] = useState(true)
  const [since, setSince] = useState('2025-01')
  const [until, setUntil] = useState('2026-05')

  useEffect(() => {
    setSel(new Set(creators.map((c) => c.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc.id])

  const plan = useMemo(() => {
    let ps = allPosts.filter((p) => sel.has(p.creator) && types[p.type])
    if (scope === 'new') ps = ps.filter((p) => p.status !== 'done')
    if (scope === 'range')
      ps = ps.filter((p) => {
        const ym = `${p.year}-${String(p.month).padStart(2, '0')}`
        return ym >= since && ym <= until
      })
    const dup = skipDup ? ps.filter((p) => p.status === 'done').length : 0
    const toGet = skipDup ? ps.filter((p) => p.status !== 'done') : ps
    return {
      total: ps.length,
      dup,
      posts: toGet.length,
      files: toGet.reduce((s, p) => s + p.files, 0),
      sizeMB: toGet.reduce((s, p) => s + p.sizeMB, 0),
      items: toGet
    }
  }, [allPosts, sel, types, scope, skipDup, since, until])

  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allSel = sel.size === creators.length

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
          <SectionLabel>{L.scope}</SectionLabel>
          <ScopeRadio value={scope} onChange={setScope} L={L} />
          {scope === 'range' && (
            <RangePicker since={since} until={until} setSince={setSince} setUntil={setUntil} L={L} />
          )}
        </div>

        <div>
          <SectionLabel
            action={
              <span
                onClick={() => setSel(allSel ? new Set() : new Set(creators.map((c) => c.id)))}
                style={{ fontSize: 11.5, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
              >
                {allSel ? L.deselectAll : L.selectAll}
              </span>
            }
          >
            {L.creators} · {sel.size}/{creators.length}
          </SectionLabel>
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '4px 12px' }}>
            {creators.map((c) => (
              <Check
                key={c.id}
                on={sel.has(c.id)}
                onClick={() => toggleSel(c.id)}
                label={c.name}
                count={allPosts.filter((p) => p.creator === c.id).length}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>{L.fileTypes}</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {typeRow.map(([k, lbl, ic]) => (
              <div
                key={k}
                onClick={() => setTypes((t) => ({ ...t, [k]: !t[k] }))}
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
              onClick={() => setSkipDup(!skipDup)}
              icon="refresh"
              label={L.skipDuplicates}
              hint={L.skipDupHint}
            />
            <OptToggle
              on={foldering}
              onClick={() => setFoldering(!foldering)}
              icon="folder"
              label={L.folderByDate}
              hint="service / user / YYYY / MM / id"
            />
          </div>
        </div>

        <div>
          <SectionLabel
            action={
              <span style={{ fontSize: 11.5, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                {L.change}
              </span>
            }
          >
            {L.saveLocation}
          </SectionLabel>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'var(--surface-2)',
              borderRadius: 9,
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              color: 'var(--text-2)'
            }}
          >
            <Icon name="hdd" size={14} style={{ color: 'var(--text-3)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {app.state.saveDir}/{svc.id}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 11,
            fontSize: 12
          }}
        >
          <span style={{ color: 'var(--text-3)' }}>{L.estimate}</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600 }}>
            {plan.posts} {L.postsUnit} · {plan.files} {L.filesUnit} · {fmtSize(plan.sizeMB)}
          </span>
        </div>
        {skipDup && plan.dup > 0 && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-3)',
              marginBottom: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Icon name="check" size={12} style={{ color: 'var(--ok)' }} />
            {plan.dup} {L.dupSkipped}
          </div>
        )}
        <button
          onClick={() => loggedIn && plan.posts > 0 && app.actions.startDownload(svc, plan)}
          disabled={!loggedIn || plan.posts === 0}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 11,
            border: 'none',
            cursor: loggedIn && plan.posts ? 'pointer' : 'not-allowed',
            fontSize: 14.5,
            fontWeight: 700,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            background: loggedIn && plan.posts ? 'var(--accent)' : 'var(--surface-2)',
            color: loggedIn && plan.posts ? '#fff' : 'var(--text-3)',
            boxShadow: loggedIn && plan.posts ? '0 4px 16px var(--accent-shadow)' : 'none'
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)'
        }}
      >
        <ServiceMark svc={svc} size={26} active={loggedIn} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{svc.name}</div>
        <div style={{ flex: 1 }} />
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            fontWeight: 500,
            color: loggedIn ? 'var(--ok)' : 'var(--text-3)',
            fontFamily: 'var(--mono)'
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: loggedIn ? 'var(--ok)' : 'var(--text-3)'
            }}
          />
          {loggedIn ? L.loggedIn : L.notLoggedIn}
        </span>
        <Btn size="sm" variant="ghost" icon="refresh" onClick={() => app.actions.recheckAuth(serviceId)}>
          {L.recheck}
        </Btn>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 16, gap: 14 }}>
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
          <UrlBar svc={svc} loggedIn={loggedIn} />
          <ServiceWebView svc={svc} />
        </div>
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
