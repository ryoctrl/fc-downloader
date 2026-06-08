/**
 * Render the mock (content-safe) screenshots used in the README, from the app's
 * real design tokens. No real data — fake creators / gradient thumbnails — so
 * nothing private ends up in this public repo. Re-run to refresh the images:
 *   node_modules/electron/dist/electron.exe scripts/gen-mock-screenshots.cjs
 * Output: docs/images/{library,progress,settings}.png
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.resolve(__dirname, '..', 'docs', 'images')
const W = 1320
const H = 860

const TOKENS = `
  --sans:'IBM Plex Sans',system-ui,'Segoe UI',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  --bg:oklch(0.168 0.012 262); --surface:oklch(0.213 0.014 262); --surface-2:oklch(0.262 0.016 262);
  --border:oklch(0.3 0.014 262); --border-2:oklch(0.38 0.016 262);
  --text:oklch(0.95 0.006 262); --text-2:oklch(0.74 0.012 262); --text-3:oklch(0.56 0.014 262);
  --ok:oklch(0.72 0.14 155); --warn:oklch(0.78 0.13 72); --danger:oklch(0.66 0.17 25);
  --accent:#2f6df0; --accent-tint:color-mix(in srgb,#2f6df0 16%,transparent);
  --accent-shadow:color-mix(in srgb,#2f6df0 34%,transparent);
  --shadow-sm:0 1px 2px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.2);
`

const SERVICES = [
  ['F', 'oklch(0.62 0.16 16)'],
  ['fb', 'oklch(0.62 0.14 250)'],
  ['P', 'oklch(0.62 0.15 30)'],
  ['ci', 'oklch(0.66 0.15 145)']
]

// Neutral, SFW mock creators + illustration-ish gradient covers.
const CREATORS = [
  ['あおいスタジオ', 'oklch(0.6 0.16 250)', 'oklch(0.7 0.15 200)'],
  ['Mocha Works', 'oklch(0.66 0.14 30)', 'oklch(0.72 0.13 60)'],
  ['こもれび工房', 'oklch(0.62 0.15 145)', 'oklch(0.72 0.12 170)'],
  ['Yuzu Atelier', 'oklch(0.64 0.16 300)', 'oklch(0.72 0.14 330)'],
  ['Pixel Garden', 'oklch(0.6 0.15 220)', 'oklch(0.7 0.14 260)'],
  ['ほしぞら制作', 'oklch(0.58 0.16 280)', 'oklch(0.68 0.13 240)']
]
const TITLES = [
  '春の新作イラスト集', 'メイキング動画 #12', '高解像度 壁紙パック',
  '線画＆PSD 配布', 'ボイスドラマ 第3話', '設定資料まとめ'
]

function rail(active) {
  const item = (inner, on, ring) => `
    <div style="width:44px;height:44px;border-radius:13px;display:grid;place-items:center;margin:0 auto;
      background:${on ? 'var(--accent-tint)' : 'transparent'};
      box-shadow:${ring ? 'inset 0 0 0 1.5px var(--border-2)' : 'none'};position:relative">
      ${on ? '<span style="position:absolute;left:-10px;top:11px;width:3px;height:22px;border-radius:9px;background:var(--accent)"></span>' : ''}
      ${inner}</div>`
  const svc = SERVICES.map(([t, c]) =>
    item(`<span style="width:30px;height:30px;border-radius:9px;background:${c};color:#fff;font-weight:700;font-size:12px;display:grid;place-items:center">${t}</span>`, false, true)
  ).join('<div style="height:10px"></div>')
  const navIcon = (d, on) => item(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${on ? 'var(--accent)' : 'var(--text-3)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`, on)
  return `<div style="width:72px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);
      display:flex;flex-direction:column;padding:16px 0;gap:0">
      ${svc}
      <div style="height:1px;background:var(--border);margin:16px 14px"></div>
      ${navIcon('<path d="M4 5h16M4 12h16M4 19h16"/>', active === 'library')}
      <div style="height:10px"></div>
      ${navIcon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.5 1-1a5.5 5.5 0 0 0 0-7.9z"/>', active === 'fav')}
      <div style="height:10px"></div>
      ${navIcon('<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/>', active === 'download')}
      <div style="flex:1"></div>
      ${navIcon('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z"/>', active === 'settings')}
  </div>`
}

function shell(active, content) {
  return `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>:root{${TOKENS}} *{box-sizing:border-box} html,body{margin:0;height:100%} body{font-family:var(--sans);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}</style></head>
  <body><div style="display:flex;height:100vh">${rail(active)}<div style="flex:1;min-width:0;display:flex;flex-direction:column">${content}</div></div></body></html>`
}

function avatar(i, size = 26) {
  const [, a, b] = CREATORS[i]
  return `<span style="width:${size}px;height:${size}px;border-radius:99px;flex-shrink:0;background:linear-gradient(135deg,${a},${b})"></span>`
}

function libraryScreen() {
  const cards = CREATORS.map((c, i) => {
    const [a, b] = [c[1], c[2]]
    const done = i % 3 !== 1
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:var(--shadow-sm)">
      <div style="height:150px;background:linear-gradient(135deg,${a},${b});position:relative">
        <span style="position:absolute;top:10px;right:10px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;background:rgba(0,0,0,.35);color:#fff;backdrop-filter:blur(4px)">${(i % 4) + 3} ファイル</span>
        <span style="position:absolute;bottom:10px;left:10px;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;background:${done ? 'color-mix(in srgb,var(--ok) 88%,#000)' : 'color-mix(in srgb,var(--warn) 86%,#000)'};color:#fff">${done ? '取得済み' : '一部'}</span>
      </div>
      <div style="padding:11px 13px 13px">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${TITLES[i]}</div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:8px">${avatar(i, 22)}
          <span style="font-size:11.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c[0]}</span>
          <span style="margin-left:auto;font-size:10.5px;color:var(--text-3);font-family:var(--mono)">${(i + 2) * 7}.${i}MB</span>
        </div>
      </div></div>`
  }).join('')
  const topbar = `<div style="height:60px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;padding:0 24px;background:var(--surface)">
      <div style="font-size:16px;font-weight:700">ライブラリ</div>
      <div style="flex:1"></div>
      <div style="display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:7px 12px;width:240px;color:var(--text-3);font-size:12.5px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>検索…</div>
      <div style="display:flex;gap:4px;background:var(--surface-2);border-radius:9px;padding:3px">
        <span style="padding:6px 13px;border-radius:7px;background:var(--surface);color:var(--accent);font-size:12px;font-weight:600;box-shadow:var(--shadow-sm)">新しい順</span>
        <span style="padding:6px 13px;border-radius:7px;color:var(--text-3);font-size:12px;font-weight:600">古い順</span></div>
  </div>`
  const body = `<div style="flex:1;overflow:hidden;padding:22px 24px">
      <div style="display:flex;gap:8px;margin-bottom:18px">
        ${['すべて', 'Fantia', 'FANBOX', 'ci-en', 'Patreon'].map((t, i) => `<span style="padding:7px 15px;border-radius:99px;font-size:12.5px;font-weight:600;border:1px solid ${i === 0 ? 'transparent' : 'var(--border)'};background:${i === 0 ? 'var(--accent)' : 'transparent'};color:${i === 0 ? '#fff' : 'var(--text-2)'}">${t}</span>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">${cards}</div>
  </div>`
  return shell('library', topbar + body)
}

function progressScreen() {
  const stat = (l, v, c) => `<div style="flex:1"><div style="font-size:11px;color:var(--text-3);margin-bottom:5px;font-weight:500">${l}</div><div style="font-family:var(--mono);font-size:19px;font-weight:600;color:${c || 'var(--text)'}">${v}</div></div>`
  const row = (name, status) => {
    const map = { done: ['取得済み', 'var(--ok)'], dl: ['ダウンロード中', 'var(--accent)'], skip: ['スキップ', 'var(--text-3)'] }
    const [lbl, col] = map[status]
    return `<div style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${status === 'dl' ? '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/>' : '<path d="M20 6 9 17l-5-5"/>'}</svg>
      <div style="flex:1;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
      <span style="font-size:11.5px;font-weight:600;color:${col};font-family:var(--mono)">${lbl}</span></div>`
  }
  const header = `<div style="padding:26px 30px 22px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <span style="width:42px;height:42px;border-radius:12px;background:oklch(0.62 0.16 16);color:#fff;font-weight:700;display:grid;place-items:center">F</span>
        <div style="flex:1"><div style="font-size:12.5px;color:var(--text-3);font-weight:500">Fantia</div>
          <div style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px">ダウンロード中
            <span style="width:8px;height:8px;border-radius:99px;background:var(--accent)"></span></div></div>
        <div style="font-family:var(--mono);font-size:38px;font-weight:700;color:var(--accent)">41<span style="font-size:20px">%</span></div>
      </div>
      <div style="height:10px;border-radius:99px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:41%;border-radius:99px;background:var(--accent)"></div></div>
      <div style="display:flex;gap:8px;margin-top:22px">
        ${stat('投稿', '4612/11185', 'var(--accent)')}${stat('ファイル', '8230/8412')}${stat('完了', '512', 'var(--ok)')}${stat('スキップ', '7701')}${stat('失敗', '0')}${stat('サイズ', '1.8 GB')}${stat('速度', '6.4 MB/s')}${stat('残り', '7分')}
      </div>
      <div style="display:flex;gap:10px;margin-top:20px"><span style="padding:8px 16px;border-radius:9px;background:color-mix(in srgb,var(--danger) 90%,#000);color:#fff;font-size:12.5px;font-weight:600;display:inline-flex;gap:6px;align-items:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>キャンセル</span></div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:9px;padding:9px 12px;background:var(--surface-2);border-radius:10px">
        <span style="width:7px;height:7px;border-radius:99px;background:var(--accent)"></span>
        <span style="font-size:11.5px;font-weight:700;color:var(--accent)">ダウンロード中</span>
        <span style="font-size:12px;color:var(--text-2);font-family:var(--mono)">あおいスタジオ — 春の新作イラスト集 / illust_07.png</span></div>
  </div>`
  const list = `<div style="flex:1;overflow:hidden;padding:8px 18px">
      ${row('illust_07.png', 'dl')}${row('illust_06.png', 'dl')}${row('cover.png', 'done')}${row('making_12.mp4', 'done')}${row('wallpaper_4k_03.png', 'skip')}${row('lineart.psd', 'skip')}${row('voice_ep3.mp3', 'done')}</div>`
  return shell('download', header + list)
}

function settingsScreen() {
  const card = (title, desc, inner) => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 22px;box-shadow:var(--shadow-sm);margin-bottom:18px">
      <div style="font-size:14.5px;font-weight:700">${title}</div>${desc ? `<div style="font-size:12px;color:var(--text-3);margin-top:3px">${desc}</div>` : ''}<div style="margin-top:16px">${inner}</div></div>`
  const toggle = (on) => `<span style="width:40px;height:23px;border-radius:99px;position:relative;display:inline-block;background:${on ? 'var(--accent)' : 'var(--border-2)'}"><span style="position:absolute;top:2px;left:${on ? 19 : 2}px;width:19px;height:19px;border-radius:99px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25)"></span></span>`
  const svcRow = (mark, color, name, on) => `<div style="display:flex;align-items:center;gap:13px;padding:12px 4px;border-bottom:1px solid var(--border)">
      <span style="width:34px;height:34px;border-radius:10px;background:${color};color:#fff;font-weight:700;font-size:13px;display:grid;place-items:center">${mark}</span>
      <div style="flex:1"><div style="font-size:13.5px;font-weight:600">${name}</div>
        <div style="font-size:11.5px;color:${on ? 'var(--ok)' : 'var(--text-3)'};display:flex;align-items:center;gap:6px;font-family:var(--mono);margin-top:2px"><span style="width:6px;height:6px;border-radius:99px;background:${on ? 'var(--ok)' : 'var(--text-3)'}"></span>${on ? '接続済み' : '未接続'}</div></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:10px;color:var(--text-3)">有効</span>${toggle(true)}</div>
      <span style="padding:6px 13px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border);font-size:12px;color:var(--text-2);font-weight:600">${on ? 'Cookie を削除' : 'ログイン'}</span></div>`
  const setRow = (label, hint, ctl, last) => `<div style="display:flex;align-items:center;gap:16px;padding:13px 0;border-bottom:${last ? 'none' : '1px solid var(--border)'}">
      <div style="flex:1"><div style="font-size:13px;font-weight:500">${label}</div><div style="font-size:11.5px;color:var(--text-3);margin-top:2px">${hint}</div></div>${ctl}</div>`
  const services = svcRow('F', 'oklch(0.62 0.16 16)', 'Fantia', true) + svcRow('fb', 'oklch(0.62 0.14 250)', 'pixiv FANBOX', true) + svcRow('ci', 'oklch(0.66 0.15 145)', 'ci-en', false)
  const general = setRow('同時ダウンロード数', '並行して取得するファイル数', '<span style="font-family:var(--mono);font-size:13px;color:var(--text-2)">3</span>') +
    setRow('重複をスキップ', '取得済みの投稿は再取得しない', toggle(true)) +
    setRow('スタートアップ起動', 'PC へのログイン時にアプリを自動起動', toggle(true), true)
  const body = `<div style="height:100%;overflow:hidden;padding:28px 28px"><div style="max-width:760px;margin:0 auto">
      <div style="font-size:22px;font-weight:700;margin-bottom:18px">設定</div>
      ${card('アカウント / Cookie', 'WebView のログイン状態と Cookie をサービスごとに管理します', services)}
      ${card('一般', '', general)}
  </div></div>`
  return shell('settings', body)
}

const SCREENS = [
  ['library', libraryScreen()],
  ['progress', progressScreen()],
  ['settings', settingsScreen()]
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadOnce(win, tmp) {
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve() }
    const bad = (_e, code, desc) => { cleanup(); reject(new Error(`${code} ${desc}`)) }
    const cleanup = () => {
      win.webContents.off('did-finish-load', ok)
      win.webContents.off('did-fail-load', bad)
    }
    win.webContents.once('did-finish-load', ok)
    win.webContents.once('did-fail-load', bad)
    win.loadFile(tmp).catch(() => { /* did-fail-load handles it */ })
  })
}

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const win = new BrowserWindow({
    width: W, height: H, show: false, frame: false,
    backgroundColor: '#221c2b', webPreferences: { offscreen: false }
  })
  for (const [name, html] of SCREENS) {
    const tmp = path.join(OUT, `_${name}.html`)
    fs.writeFileSync(tmp, html)
    let loaded = false
    for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
      try {
        await loadOnce(win, tmp)
        loaded = true
      } catch (e) {
        console.log(`RESULT retry ${name} (${e.message})`)
        await sleep(300)
      }
    }
    await sleep(1600) // webfonts + layout settle
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG())
    console.log(`RESULT wrote docs/images/${name}.png`)
    fs.rmSync(tmp, { force: true })
  }
  win.destroy()
  app.quit()
})
