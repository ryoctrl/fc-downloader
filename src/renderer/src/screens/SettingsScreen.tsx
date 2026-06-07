/* fc-downloader — settings: cookies/account, storage, general */
import { useState, type ReactNode } from 'react'
import { FC, fmtSize } from '../design/data'
import { countsForService } from '../design/library'
import { Icon } from '../design/icons'
import { Btn, ServiceMark } from '../design/primitives'
import { useApp } from '../design/context'
import { bridge } from '../bridge'

function SettingsCard({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '20px 22px',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, marginBottom: 4 }}>{desc}</div>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  )
}

function Setting({
  label,
  hint,
  children,
  last
}: {
  label: string
  hint?: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '13px 0',
        borderBottom: last ? 'none' : '1px solid var(--border)'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Seg({
  value,
  options,
  onChange
}: {
  value: string
  options: [string, string][]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 9, padding: 3 }}>
      {options.map(([v, lbl]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '6px 16px',
            borderRadius: 7,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            background: value === v ? 'var(--surface)' : 'transparent',
            color: value === v ? 'var(--accent)' : 'var(--text-3)',
            boxShadow: value === v ? 'var(--shadow-sm)' : 'none'
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        width: 40,
        height: 23,
        borderRadius: 99,
        position: 'relative',
        cursor: 'pointer',
        background: on ? 'var(--accent)' : 'var(--border-2)',
        transition: 'background .15s',
        flexShrink: 0
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 19 : 2,
          width: 19,
          height: 19,
          borderRadius: 99,
          background: '#fff',
          transition: 'left .15s',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)'
        }}
      />
    </span>
  )
}

export function SettingsScreen() {
  const app = useApp()
  const L = app.L
  const { state, actions, setTweak, t } = app

  const totalUsed = app.posts.reduce((s, p) => s + p.sizeMB, 0)
  // No real disk-capacity probe yet; show usage relative to a nominal 512 GB.
  const diskTotal = 512 * 1024

  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)
  const runVerify = async (): Promise<void> => {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const r = await bridge.reconcileLibrary()
      actions.reloadPosts()
      setVerifyResult(
        r.removedFiles === 0
          ? L.verifyClean
          : `${L.verifyRepaired}: -${r.removedFiles} ${L.filesUnit} / -${r.removedPosts} ${L.postsUnit}`
      )
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '28px 28px 48px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{L.settings}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{L.settingsSub}</div>
        </div>

        <SettingsCard title={L.accountsCookies} desc={L.accountsDesc}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FC.SERVICES.map((svc) => {
              const on = !!state.logins[svc.id]
              const enabled = state.enabledServices[svc.id] !== false
              return (
                <div
                  key={svc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 13,
                    padding: '12px 4px',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <ServiceMark svc={svc} size={34} active={on} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{svc.name}</div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: on ? 'var(--ok)' : 'var(--text-3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'var(--mono)'
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: on ? 'var(--ok)' : 'var(--text-3)'
                        }}
                      />
                      {on ? L.connected : L.disconnected}
                    </div>
                  </div>
                  <div
                    title={L.serviceEnabledHint}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{L.serviceEnabled}</span>
                    <Toggle
                      on={enabled}
                      onClick={() => actions.setServiceEnabled(svc.id, !enabled)}
                    />
                  </div>
                  {on ? (
                    <Btn size="sm" variant="ghost" icon="trash" onClick={() => actions.clearSession(svc.id)}>
                      {L.clearCookies}
                    </Btn>
                  ) : (
                    <Btn
                      size="sm"
                      variant="solid"
                      icon="external"
                      onClick={() => app.go({ screen: 'service', serviceId: svc.id })}
                    >
                      {L.logIn}
                    </Btn>
                  )}
                </div>
              )
            })}
          </div>
        </SettingsCard>

        <SettingsCard title={L.storage} desc={L.storageDesc}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 13px',
              background: 'var(--surface-2)',
              borderRadius: 10,
              marginBottom: 16
            }}
          >
            <Icon name="hdd" size={16} style={{ color: 'var(--text-3)' }} />
            <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--text)' }}>
              {state.saveDir}
            </span>
            <Btn size="sm" variant="solid" icon="folder" onClick={() => actions.pickSaveDir()}>
              {L.browse}
            </Btn>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
              color: 'var(--text-3)',
              marginBottom: 7,
              fontFamily: 'var(--mono)'
            }}
          >
            <span>
              {fmtSize(totalUsed)} {L.used}
            </span>
            <span>512 GB</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 99,
              background: 'var(--surface-2)',
              overflow: 'hidden',
              display: 'flex'
            }}
          >
            {FC.SERVICES.map((svc) => {
              const sz = countsForService(app.posts, svc.id).sizeMB
              return (
                <div
                  key={svc.id}
                  title={svc.name}
                  style={{ width: (sz / diskTotal) * 100 + '%', background: `oklch(0.62 0.14 ${svc.hue})` }}
                />
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {FC.SERVICES.map((svc) => (
              <div
                key={svc.id}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-2)' }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 3, background: `oklch(0.62 0.14 ${svc.hue})` }} />
                {svc.name}{' '}
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                  {fmtSize(countsForService(app.posts, svc.id).sizeMB)}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid var(--border)'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{L.verifyLibrary}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                {verifyResult ?? L.verifyLibraryHint}
              </div>
            </div>
            <Btn
              size="sm"
              variant="solid"
              icon="refresh"
              onClick={() => {
                if (!verifying) void runVerify()
              }}
            >
              {verifying ? L.verifying : L.verifyRun}
            </Btn>
          </div>
        </SettingsCard>

        <SettingsCard title={L.general}>
          <Setting label={L.language} hint={L.languageHint}>
            <Seg
              value={t.lang}
              options={[
                ['ja', '日本語'],
                ['en', 'English']
              ]}
              onChange={(v) => setTweak('lang', v as typeof t.lang)}
            />
          </Setting>
          <Setting label={L.theme} hint={L.themeHint}>
            <Seg
              value={t.theme}
              options={[
                ['system', L.system],
                ['light', L.light],
                ['dark', L.dark]
              ]}
              onChange={(v) => setTweak('theme', v as typeof t.theme)}
            />
          </Setting>
          <Setting label={L.concurrency} hint={L.concurrencyHint}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 200 }}>
              <input
                type="range"
                min={1}
                max={8}
                value={state.concurrency}
                onChange={(e) => actions.setConcurrency(+e.target.value)}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', width: 16 }}>
                {state.concurrency}
              </span>
            </div>
          </Setting>
          <Setting label={L.skipDuplicates} hint={L.skipDupHint} last>
            <Toggle
              on={state.downloadPrefs.skipDup}
              onClick={() => actions.setDownloadPrefs({ skipDup: !state.downloadPrefs.skipDup })}
            />
          </Setting>
        </SettingsCard>

        <SettingsCard title={L.about}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5, color: 'var(--text-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>fc-downloader</span>
              <span style={{ fontFamily: 'var(--mono)' }}>v0.4.0</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 13px',
                background: 'var(--surface-2)',
                borderRadius: 9
              }}
            >
              <Icon name="lock" size={15} style={{ color: 'var(--ok)' }} />
              <span style={{ fontSize: 12 }}>{L.localOnly}</span>
            </div>
          </div>
        </SettingsCard>
      </div>
    </div>
  )
}
