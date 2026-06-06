import { useEffect, useState } from 'react'
import type {
  DownloadOptions,
  DownloadProgress,
  PostFileKind,
  ServiceDescriptor
} from '@shared/types'

const ALL_KINDS: PostFileKind[] = ['image', 'video', 'audio', 'file']

interface Props {
  service: ServiceDescriptor
}

/**
 * Per-service panel: an embedded WebView (login / browse) on the left, the
 * download settings + progress on the right. The WebView uses the same session
 * partition (`persist:<id>`) the main process reads cookies from.
 */
export function ServicePanel({ service }: Props): JSX.Element {
  const [loggedIn, setLoggedIn] = useState(service.loggedIn)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [running, setRunning] = useState(false)
  const [options, setOptions] = useState<DownloadOptions>({
    creatorIds: [],
    skipExisting: true,
    concurrency: 3,
    includeKinds: [...ALL_KINDS]
  })

  useEffect(() => {
    const off = window.api.on('download:progress', (p) => {
      setProgress(p)
      const done = p.total > 0 && p.completed + p.skipped + p.failed >= p.total
      if (done) setRunning(false)
    })
    return off
  }, [])

  useEffect(() => {
    const off = window.api.on('services:authChanged', (e) => {
      if (e.serviceId === service.id) setLoggedIn(e.loggedIn)
    })
    return off
  }, [service.id])

  const checkAuth = async (): Promise<void> => {
    const ok = await window.api['services:checkAuth'](service.id)
    setLoggedIn(ok)
  }

  const start = async (): Promise<void> => {
    setRunning(true)
    setProgress(null)
    await window.api['download:start'](service.id, options)
  }

  const cancel = async (): Promise<void> => {
    await window.api['download:cancel']()
    setRunning(false)
  }

  const toggleKind = (kind: PostFileKind): void => {
    setOptions((o) => ({
      ...o,
      includeKinds: o.includeKinds.includes(kind)
        ? o.includeKinds.filter((k) => k !== kind)
        : [...o.includeKinds, kind]
    }))
  }

  return (
    <div className="service">
      <div className="service__browser">
        <div className="service__toolbar">
          <strong>{service.name}</strong>
          <span className={'badge' + (loggedIn ? ' badge--ok' : '')}>
            {loggedIn ? 'ログイン済み' : '未ログイン'}
          </span>
          <button onClick={checkAuth}>ログイン状態を確認</button>
        </div>
        <webview
          className="service__webview"
          src={service.homeUrl}
          partition={`persist:${service.id}`}
          allowpopups={true}
        />
      </div>

      <aside className="service__panel">
        <h2>ダウンロード設定</h2>

        <label className="field">
          <span>同時ダウンロード数</span>
          <input
            type="number"
            min={1}
            max={8}
            value={options.concurrency}
            onChange={(e) =>
              setOptions((o) => ({ ...o, concurrency: Number(e.target.value) || 1 }))
            }
          />
        </label>

        <label className="field field--checkbox">
          <input
            type="checkbox"
            checked={options.skipExisting}
            onChange={(e) => setOptions((o) => ({ ...o, skipExisting: e.target.checked }))}
          />
          <span>既にダウンロード済みのものをスキップ（重複防止）</span>
        </label>

        <fieldset className="field">
          <legend>対象ファイル種別</legend>
          {ALL_KINDS.map((kind) => (
            <label key={kind} className="field--checkbox">
              <input
                type="checkbox"
                checked={options.includeKinds.includes(kind)}
                onChange={() => toggleKind(kind)}
              />
              <span>{kind}</span>
            </label>
          ))}
        </fieldset>

        <div className="service__actions">
          {running ? (
            <button className="btn btn--danger" onClick={cancel}>
              キャンセル
            </button>
          ) : (
            <button className="btn btn--primary" disabled={!loggedIn} onClick={start}>
              一斉ダウンロード開始
            </button>
          )}
        </div>

        {progress && (
          <div className="progress">
            <div className="progress__bar">
              <div
                className="progress__fill"
                style={{
                  width:
                    progress.total > 0
                      ? `${((progress.completed + progress.skipped + progress.failed) / progress.total) * 100}%`
                      : '0%'
                }}
              />
            </div>
            <ul className="progress__stats">
              <li>合計: {progress.total}</li>
              <li>完了: {progress.completed}</li>
              <li>スキップ: {progress.skipped}</li>
              <li>失敗: {progress.failed}</li>
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
