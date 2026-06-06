import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'

export function SettingsPanel(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void window.api['settings:get']().then(setSettings)
  }, [])

  const pickRoot = async (): Promise<void> => {
    const dir = await window.api['settings:pickDownloadRoot']()
    if (dir) setSettings(await window.api['settings:update']({ downloadRoot: dir }))
  }

  if (!settings) return <p className="muted">読み込み中…</p>

  return (
    <div className="settings">
      <h2>設定</h2>

      <label className="field">
        <span>ダウンロード保存先</span>
        <div className="row">
          <input readOnly value={settings.downloadRoot} />
          <button onClick={pickRoot}>変更…</button>
        </div>
      </label>

      <label className="field">
        <span>既定の同時ダウンロード数</span>
        <input
          type="number"
          min={1}
          max={8}
          value={settings.defaultConcurrency}
          onChange={async (e) =>
            setSettings(
              await window.api['settings:update']({
                defaultConcurrency: Number(e.target.value) || 1
              })
            )
          }
        />
      </label>

      <p className="muted">
        保存レイアウト: <code>保存先 / サービス / ユーザー / 年 / 月 / 投稿ID /</code>
      </p>
    </div>
  )
}
