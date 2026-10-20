/* fc-downloader — settings: cookies/account, storage, general */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_CREATOR_FOLDER_PATTERN,
  DEFAULT_POST_FOLDER_PATTERN,
  creatorFolderName,
  postFolderSegments,
  validateCreatorFolderPattern,
  validatePostFolderPattern,
  type FolderPatternError
} from '@shared/folderPattern'
import { FC, fmtSize } from '../design/data'
import type { ServiceId } from '@shared/types'
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

/**
 * A folder-name pattern field that commits on blur / Enter. An invalid entry is
 * kept for editing (with the reason shown) and not saved; committing the
 * default clears the setting. "Reset" (shown only off the default) clears it
 * too, so the default never has to be retyped — and it types the default in as
 * an ordinary edit, so Ctrl+Z brings the previous pattern back.
 */
function PatternInput({
  value,
  defaultPattern,
  validate,
  errorText,
  resetLabel,
  onCommit
}: {
  value: string | undefined
  defaultPattern: string
  validate: (pattern: string) => FolderPatternError | null
  errorText: (err: FolderPatternError) => string
  resetLabel: string
  onCommit: (pattern: string | undefined) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const shown = draft ?? value ?? defaultPattern
  const error = validate(shown)
  const commit = (): void => {
    if (draft === null || error) return
    setDraft(null)
    const p = draft.trim()
    onCommit(p === defaultPattern ? undefined : p)
  }
  const reset = (): void => {
    // Replace the text through the browser's editing command rather than by
    // setting the value: an edit made that way joins the undo history, so the
    // previous pattern is one Ctrl+Z away (a scripted value change can't be
    // undone). The setting is saved right away, as a commit would.
    // (execCommand is deprecated but still the only way to make an undoable
    // edit; if it does nothing, the reset below still applies.)
    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
      document.execCommand('insertText', false, defaultPattern)
    }
    setDraft(null)
    onCommit(undefined)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
      <input
        ref={inputRef}
        type="text"
        spellCheck={false}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12.5,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid ' + (error ? 'var(--warn)' : 'var(--border)'),
          background: 'var(--surface-2)',
          color: 'var(--text)'
        }}
      />
      {(error || shown.trim() !== defaultPattern) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {error && (
            <span style={{ flex: 1, fontSize: 11, color: 'var(--warn)' }}>{errorText(error)}</span>
          )}
          {shown.trim() !== defaultPattern && (
            <span
              role="button"
              // Keep the input's blur from committing a half-typed value first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={reset}
              title={defaultPattern}
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {resetLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Sample values for the folder-name preview. */
const PREVIEW_CREATOR = { creatorId: '12345', creatorName: 'Creator' }
const PREVIEW_POST = {
  postId: '67890',
  title: 'Post title',
  postedAt: '2026-01-23T12:00:00.000Z'
}

export function SettingsScreen() {
  const app = useApp()
  const L = app.L
  const { state, actions, setTweak, t } = app

  const totalUsed = app.posts.reduce((s, p) => s + p.sizeMB, 0)
  // No real disk-capacity probe yet; show usage relative to a nominal 512 GB.
  const diskTotal = 512 * 1024

  // Services eligible for a bulk run: enabled + logged in.
  const eligibleCount = FC.SERVICES.filter(
    (s) => state.enabledServices[s.id] !== false && state.logins[s.id]
  ).length

  // Folder-name patterns (AppSettings.creatorFolderPattern / postFolderPattern).
  const [patterns, setPatterns] = useState<{ creator?: string; post?: string }>({})
  useEffect(() => {
    void bridge
      .getSettings()
      .then((s) => s && setPatterns({ creator: s.creatorFolderPattern, post: s.postFolderPattern }))
  }, [])
  const setCreatorPattern = (p: string | undefined): void => {
    setPatterns((cur) => ({ ...cur, creator: p }))
    void bridge.updateSettings({ creatorFolderPattern: p })
  }
  const setPostPattern = (p: string | undefined): void => {
    setPatterns((cur) => ({ ...cur, post: p }))
    void bridge.updateSettings({ postFolderPattern: p })
  }
  const patternError = (err: FolderPatternError): string =>
    err === 'empty'
      ? L.folderErrEmpty
      : err === 'missingPostId'
        ? L.folderErrMissingPostId
        : L.folderErrUnknownToken
  const folderPreview = [
    creatorFolderName(patterns.creator, PREVIEW_CREATOR),
    ...postFolderSegments(patterns.post, PREVIEW_POST)
  ].join('/')
  const creatorPatternLacksId = !(patterns.creator ?? DEFAULT_CREATOR_FOLDER_PATTERN).includes(
    '{creatorId}'
  )

  // Manual cookie import (see src/main/session/cookies.ts): the fallback for a
  // sign-in flow the embedded Chromium cannot finish, e.g. Patreon's Google SSO
  // — Google authenticates and Cloudflare passes, but Patreon never issues its
  // own session cookie to an embedded webview.
  const [importFor, setImportFor] = useState<ServiceId | null>(null)
  const [importText, setImportText] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importMsgOk, setImportMsgOk] = useState(false)
  /** Which cookies actually landed, plus anything Chromium refused — the two
   *  facts needed to tell "wrong paste" from "app bug". */
  const [importDetail, setImportDetail] = useState<string | null>(null)
  const runImport = async (serviceId: ServiceId): Promise<void> => {
    setImportBusy(true)
    setImportMsg(null)
    setImportDetail(null)
    try {
      const r = await bridge.importCookies(serviceId, importText)
      if (!r.ok) {
        setImportMsgOk(false)
        setImportMsg(
          r.reason === 'empty'
            ? L.importCookiesEmpty
            : r.reason === 'unparsable'
              ? L.importCookiesUnparsable
              : L.importCookiesFailed
        )
        return
      }
      const shown = r.names.slice(0, 14).join(', ') + (r.names.length > 14 ? ' …' : '')
      const rejected = r.rejected.length
        ? ` · ${L.importCookiesRejected.replace(
            '{list}',
            r.rejected
              .slice(0, 2)
              .map((x) => `${x.name}: ${x.reason}`)
              .join('; ')
          )}`
        : ''
      setImportDetail(
        `${L.importCookiesNames.replace('{n}', String(r.count))}: ${shown}${rejected}`
      )
      // Stored but still logged out is the common failure (a paste without the
      // HttpOnly session cookie); say so instead of closing the panel on a
      // false success.
      if (r.loggedIn) {
        setImportMsgOk(true)
        setImportMsg(
          `${L.importCookiesStored.replace('{n}', String(r.count))} · ${L.importCookiesOk}`
        )
        setImportText('')
        setImportFor(null)
      } else {
        setImportMsgOk(false)
        setImportMsg(L.importCookiesNotLoggedIn)
      }
    } finally {
      setImportBusy(false)
    }
  }

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
              const editing = importFor === svc.id
              return (
                <div key={svc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 4px' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Btn
                          size="sm"
                          variant="ghost"
                          icon="cookie"
                          active={editing}
                          onClick={() => setImportFor(editing ? null : svc.id)}
                          title={L.importCookiesHint}
                        >
                          {L.importCookies}
                        </Btn>
                        <Btn
                          size="sm"
                          variant="solid"
                          icon="external"
                          onClick={() => app.go({ screen: 'service', serviceId: svc.id })}
                        >
                          {L.logIn}
                        </Btn>
                      </div>
                    )}
                  </div>
                  {editing && (
                    <div style={{ padding: '2px 4px 14px' }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-3)',
                          lineHeight: 1.55,
                          marginBottom: 8
                        }}
                      >
                        {L.importCookiesHint}
                      </div>
                      <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder={L.importCookiesPlaceholder}
                        spellCheck={false}
                        style={{
                          width: '100%',
                          minHeight: 92,
                          boxSizing: 'border-box',
                          padding: '9px 11px',
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          color: 'var(--text)',
                          fontFamily: 'var(--mono)',
                          fontSize: 11.5,
                          lineHeight: 1.5,
                          resize: 'vertical'
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <Btn
                          size="sm"
                          variant="solid"
                          icon="check"
                          style={importBusy ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                          onClick={() => {
                            if (!importBusy) void runImport(svc.id)
                          }}
                        >
                          {L.importCookiesRun}
                        </Btn>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setImportFor(null)
                            setImportMsg(null)
                            setImportDetail(null)
                          }}
                        >
                          {L.importCookiesCancel}
                        </Btn>
                        {importMsg && (
                          <span
                            style={{
                              fontSize: 11.5,
                              color: importMsgOk ? 'var(--ok)' : 'var(--warn)',
                              lineHeight: 1.4
                            }}
                          >
                            {importMsg}
                          </span>
                        )}
                      </div>
                      {importDetail && (
                        <div
                          style={{
                            marginTop: 7,
                            fontSize: 10.5,
                            color: 'var(--text-3)',
                            fontFamily: 'var(--mono)',
                            lineHeight: 1.5,
                            wordBreak: 'break-word'
                          }}
                        >
                          {importDetail}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </SettingsCard>

        <SettingsCard title={L.bulkDownload} desc={L.bulkDownloadDesc}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>
              {eligibleCount > 0
                ? `${eligibleCount} ${L.servicesTargeted}`
                : L.bulkNoServices}
            </div>
            <Btn
              variant="primary"
              icon="download"
              onClick={() => {
                if (eligibleCount > 0) actions.startBulkDownload()
              }}
            >
              {L.bulkDownloadRun}
            </Btn>
          </div>
        </SettingsCard>

        <SettingsCard title={L.schedule} desc={L.scheduleDesc}>
          <Setting label={L.scheduleEnabled} hint={L.scheduleEnabledHint}>
            <Toggle
              on={state.schedule.enabled}
              onClick={() => actions.setSchedule({ enabled: !state.schedule.enabled })}
            />
          </Setting>
          <Setting label={L.scheduleTime} hint={L.scheduleTimeHint} last>
            <input
              type="time"
              value={state.schedule.time}
              onChange={(e) => actions.setSchedule({ time: e.target.value })}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 13,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                colorScheme: 'inherit'
              }}
            />
          </Setting>
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

        <SettingsCard title={L.folderNames} desc={L.folderNamesDesc}>
          <Setting label={L.creatorFolder} hint={L.creatorFolderHint}>
            <PatternInput
              value={patterns.creator}
              defaultPattern={DEFAULT_CREATOR_FOLDER_PATTERN}
              validate={validateCreatorFolderPattern}
              errorText={patternError}
              resetLabel={L.folderReset}
              onCommit={setCreatorPattern}
            />
          </Setting>
          <Setting label={L.postFolder} hint={L.postFolderHint}>
            <PatternInput
              value={patterns.post}
              defaultPattern={DEFAULT_POST_FOLDER_PATTERN}
              validate={validatePostFolderPattern}
              errorText={patternError}
              resetLabel={L.folderReset}
              onCommit={setPostPattern}
            />
          </Setting>
          <div style={{ paddingTop: 13, fontSize: 11.5, color: 'var(--text-3)' }}>
            {L.folderPreview}:{' '}
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
              …/fanbox/{folderPreview}/
            </span>
            {creatorPatternLacksId && (
              <div style={{ marginTop: 6, color: 'var(--warn)' }}>{L.creatorFolderNoIdWarn}</div>
            )}
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
          <Setting label={L.skipDuplicates} hint={L.skipDupHint}>
            <Toggle
              on={state.downloadPrefs.skipDup}
              onClick={() => actions.setDownloadPrefs({ skipDup: !state.downloadPrefs.skipDup })}
            />
          </Setting>
          <Setting label={L.launchAtStartup} hint={L.launchAtStartupHint} last>
            <Toggle
              on={state.launchAtStartup}
              onClick={() => actions.setLaunchAtStartup(!state.launchAtStartup)}
            />
          </Setting>
        </SettingsCard>

        <SettingsCard title={L.about}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5, color: 'var(--text-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>fc-downloader</span>
              <span style={{ fontFamily: 'var(--mono)' }}>v{__APP_VERSION__}</span>
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
