/**
 * Render the mock (content-safe) screenshots used in the README, from the app's
 * real design tokens. No real data — fake creators / gradient thumbnails — so
 * nothing private ends up in this public repo. Re-run to refresh the images:
 *   node_modules/electron/dist/electron.exe scripts/gen-mock-screenshots.cjs
 * Output: docs/images/{library,progress}.png
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
  --border:oklch(0.3 0.014 262); --border-2:oklch(0.38 0.016 262); --hairline:oklch(0.4 0.012 262 / 0.4);
  --text:oklch(0.95 0.006 262); --text-2:oklch(0.74 0.012 262); --text-3:oklch(0.56 0.014 262);
  --ok:oklch(0.72 0.14 155); --warn:oklch(0.78 0.13 72); --danger:oklch(0.66 0.17 25);
  --accent:#2f6df0; --accent-tint:color-mix(in srgb,#2f6df0 16%,transparent);
  --accent-shadow:color-mix(in srgb,#2f6df0 34%,transparent);
  --shadow-sm:0 1px 2px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.2);
`

// Real bundled service logos (read from the app's assets so the rail matches).
const LOGO_DIR = path.resolve(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'logos')
function logoUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(path.join(LOGO_DIR, file)).toString('base64')}`
}
const LOGOS = {
  fantia: logoUri('fantia.png', 'image/png'),
  fanbox: logoUri('fanbox.png', 'image/png'),
  patreon: logoUri('patreon.png', 'image/png'),
  cien: logoUri('cien.ico', 'image/x-icon')
}
// The exact icon paths the app uses (src/renderer/src/design/icons.tsx).
const ICON = {
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M5 19h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z',
  hdd: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3zM3 10v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M7 15h.01',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM17 5l3 .6-2.3 14.2-3-.6z',
  check: 'M5 12l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  chevR: 'M9 6l6 6-6 6',
  chevD: 'M6 9l6 6 6-6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  play: 'M7 4v16l13-8z',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 16l-5-5L5 21',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  sort: 'M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 4l-3 3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'
}
const FILLED = new Set(['heart', 'play'])
function icon(name, size, color, sw = 1.7) {
  const d = ICON[name]
  const fill = FILLED.has(name)
  const paths = d
    .split(' M')
    .map((seg, i) => `<path d="${i === 0 ? seg : 'M' + seg}"/>`)
    .join('')
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? color : 'none'}" stroke="${fill ? 'none' : color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="display:block">${paths}</svg>`
}

// The user supports 3 services, several creators each.
const SERVICES = [
  ['fantia', 'Fantia'],
  ['fanbox', 'pixiv FANBOX'],
  ['cien', 'ci-en']
]

// Neutral, SFW mock creators: [name, serviceKey, gradientA, gradientB].
const CREATORS = [
  ['あおいスタジオ', 'fantia', 'oklch(0.6 0.16 250)', 'oklch(0.7 0.15 200)'],
  ['Mocha Works', 'fantia', 'oklch(0.66 0.14 30)', 'oklch(0.72 0.13 60)'],
  ['こもれび工房', 'fantia', 'oklch(0.62 0.15 145)', 'oklch(0.72 0.12 170)'],
  ['Yuzu Atelier', 'fanbox', 'oklch(0.64 0.16 300)', 'oklch(0.72 0.14 330)'],
  ['Pixel Garden', 'fanbox', 'oklch(0.6 0.15 220)', 'oklch(0.7 0.14 260)'],
  ['ほしぞら制作', 'cien', 'oklch(0.58 0.16 280)', 'oklch(0.68 0.13 240)'],
  ['Studio Komorebi', 'cien', 'oklch(0.62 0.15 160)', 'oklch(0.72 0.13 130)']
]
// Posts in the grid: [title, creatorIndex, fileCount, type, status, 'YYYY/MM/DD'].
const POSTS = [
  ['春の新作イラスト集', 0, 12, 'image', 'done', '2026/05/24'],
  ['立ち絵差分セット', 0, 8, 'image', 'done', '2026/04/30'],
  ['メイキング動画 #12', 1, 3, 'video', 'partial', '2026/05/17'],
  ['線画＆PSD 配布', 2, 6, 'file', 'done', '2026/03/08'],
  ['高解像度 壁紙パック', 3, 5, 'image', 'done', '2026/05/02'],
  ['ボイスドラマ 第3話', 4, 4, 'audio', 'partial', '2026/04/12'],
  ['設定資料まとめ', 5, 9, 'file', 'done', '2026/05/21'],
  ['月例レポート 5月号', 6, 2, 'file', 'done', '2026/05/01']
]

// A white rounded logo tile (used in the rail, tree and post cards).
function logoImg(key, size) {
  return `<div style="width:${size}px;height:${size}px;border-radius:${(size * 0.28).toFixed(1)}px;overflow:hidden;flex-shrink:0;background:#fff;box-shadow:inset 0 0 0 1px var(--hairline)"><img src="${LOGOS[key]}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
}

// One rail button: a 38x38 icon box (logo or nav icon) + label below, with the
// accent bar + tint when active — matching src/renderer/src/components/Rail.tsx.
function railItem({ mark, iconName, label, on, busy }) {
  const box = `<div style="position:relative;display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:${on && !mark ? 'var(--accent-tint)' : 'transparent'}">
      ${mark || icon(iconName, 21, on ? 'var(--accent)' : 'var(--text-3)')}
      ${busy ? '<span style="position:absolute;top:1px;right:1px;width:12px;height:12px;border-radius:99px;border:2px solid var(--accent);border-top-color:transparent"></span>' : ''}
    </div>`
  return `<div style="position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 4px;border-radius:12px;color:${on ? 'var(--text)' : 'var(--text-3)'}">
      ${on ? '<span style="position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:3.5px;height:22px;border-radius:99px;background:var(--accent)"></span>' : ''}
      ${box}
      <span style="font-size:9.5px;font-weight:600;letter-spacing:.01em;white-space:nowrap">${label}</span>
    </div>`
}

function svcMark(key, on) {
  return `<div style="width:34px;height:34px;border-radius:9.5px;overflow:hidden;background:#fff;box-shadow:${on ? '0 4px 12px rgba(0,0,0,.4)' : 'inset 0 0 0 1px var(--hairline)'}">
      <img src="${LOGOS[key]}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`
}

function rail(active) {
  const svc = SERVICES.map(([k, l]) =>
    railItem({ mark: svcMark(k, active === 'svc-' + k), label: l, on: active === 'svc-' + k })
  ).join('')
  const storage = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 2px 8px;color:var(--text-3)">
      ${icon('hdd', 13, 'var(--text-3)')}<span style="font-size:9px;font-family:var(--mono)">12.4 GB</span></div>`
  return `<div style="width:72px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);
      display:flex;flex-direction:column;padding:10px 8px;gap:2px">
      ${svc}
      <div style="height:1px;background:var(--border);margin:8px 6px"></div>
      ${railItem({ iconName: 'library', label: 'ライブラリ', on: active === 'library' })}
      ${railItem({ iconName: 'heart', label: 'お気に入り', on: active === 'fav' })}
      ${railItem({ iconName: 'download', label: 'ダウンロード', on: active === 'download', busy: active === 'download' })}
      <div style="flex:1"></div>
      ${storage}
      ${railItem({ iconName: 'gear', label: '設定', on: active === 'settings' })}
  </div>`
}

function shell(active, content) {
  return `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>:root{${TOKENS}} *{box-sizing:border-box} html,body{margin:0;height:100%} body{font-family:var(--sans);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}</style></head>
  <body><div style="display:flex;height:100vh">${rail(active)}<div style="flex:1;min-width:0;display:flex;flex-direction:column">${content}</div></div></body></html>`
}

function treeAvatar(i) {
  const c = CREATORS[i]
  return `<span style="width:18px;height:18px;border-radius:99px;flex-shrink:0;background:linear-gradient(135deg,${c[2]},${c[3]})"></span>`
}

// A tree row (service → creator), matching LibraryScreen's TreeRow.
function treeRow({ depth = 0, mark, iconName, label, sub, count, size, selected, expandable, open }) {
  const rowColor = selected ? 'var(--accent)' : 'var(--text-2)'
  const chev = expandable ? icon(open ? 'chevD' : 'chevR', 13, 'var(--text-3)') : ''
  // Fixed-width right-aligned columns so counts align regardless of size width.
  const meta =
    count != null || size != null
      ? `<span style="display:flex;font-size:10.5px;font-family:var(--mono);color:var(--text-3);flex-shrink:0;font-variant-numeric:tabular-nums">${count != null ? `<span style="min-width:${size != null ? '4ch' : 'auto'};text-align:right">${count}</span>` : ''}${size ? `<span style="min-width:7ch;text-align:right;opacity:.9">${size}</span>` : ''}</span>`
      : ''
  const subLine = sub
    ? `<span style="font-size:9.5px;color:var(--text-3);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${sub}</span>`
    : ''
  return `<div style="display:flex;align-items:center;gap:7px;padding:6px 8px;padding-left:${8 + depth * 15}px;border-radius:8px;background:${selected ? 'var(--accent-tint)' : 'transparent'};color:${rowColor}">
      <span style="width:14px;display:grid;place-items:center;flex-shrink:0">${chev}</span>
      ${mark || ''}${iconName ? icon(iconName, 15, rowColor) : ''}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column">
        <span style="font-size:12.5px;font-weight:${selected ? 600 : 500};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>
        ${subLine}
      </span>
      ${meta}
    </div>`
}

function postCard(p) {
  const [title, ci, files, type, status, ym] = p
  const c = CREATORS[ci]
  const tIcon = type === 'video' || type === 'audio' ? 'play' : type === 'file' ? 'file' : 'image'
  const [sl, sc] = status === 'done' ? ['取得済み', 'var(--ok)'] : ['一部', 'var(--warn)']
  return `<div style="border-radius:13px;overflow:hidden;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-sm);display:flex;flex-direction:column">
      <div style="position:relative">
        <div style="aspect-ratio:4/3;background:linear-gradient(135deg,${c[2]},${c[3]})"></div>
        <div style="position:absolute;top:8px;right:8px;display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:99px;background:rgba(20,20,28,.62);color:#fff;font-size:10.5px;font-family:var(--mono)">${icon(tIcon, 11, '#fff')}${files}</div>
        <div style="position:absolute;top:8px;left:8px;width:26px;height:26px;border-radius:99px;display:grid;place-items:center;background:rgba(20,20,28,.5);color:#fff">${icon('heart', 14, '#fff')}</div>
        <div style="position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.85);font-size:10.5px;font-weight:600;color:${sc}"><span style="width:6px;height:6px;border-radius:99px;background:${sc}"></span>${sl}</div>
      </div>
      <div style="padding:11px 12px">
        <div style="font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
          ${logoImg(c[1], 15)}
          <span style="flex:1;font-size:11.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c[0]}</span>
          <span style="font-size:10.5px;color:var(--text-3);font-family:var(--mono)">${ym}</span>
        </div>
      </div></div>`
}

function chip(label, on, iconName) {
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:99px;font-size:12px;font-weight:500;border:1px solid ${on ? 'transparent' : 'var(--border)'};background:${on ? 'var(--accent)' : 'transparent'};color:${on ? '#fff' : 'var(--text-2)'}">${iconName ? icon(iconName, 13, on ? '#fff' : 'var(--text-2)') : ''}${label}</span>`
}

function libraryScreen() {
  // Tree: 3 services, Fantia expanded to show its creators (with total sizes).
  const creatorSizes = ['180 MB', '64 MB', '68 MB']
  const fantiaCreators = [0, 1, 2].map((i) =>
    treeRow({
      depth: 1,
      mark: treeAvatar(i),
      label: CREATORS[i][0],
      count: i === 0 ? 2 : 1,
      size: creatorSizes[i],
      expandable: true
    })
  ).join('')
  const tree = `<div style="width:246px;flex-shrink:0;border-right:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;min-height:0">
      <div style="padding:16px 16px 10px"><div style="font-size:15px;font-weight:700">ライブラリ</div>
        <div style="font-size:11.5px;color:var(--text-3);font-family:var(--mono);margin-top:2px">${POSTS.length} 投稿 · 558 MB</div></div>
      <div style="flex:1;overflow:hidden;padding:0 8px 14px">
        ${treeRow({ iconName: 'library', label: 'すべての投稿', count: POSTS.length, selected: true })}
        ${treeRow({ mark: logoImg('fantia', 20), label: 'Fantia', sub: '2026/06/10 03:00', count: 4, size: '312 MB', expandable: true, open: true })}
        ${fantiaCreators}
        ${treeRow({ mark: logoImg('fanbox', 20), label: 'pixiv FANBOX', sub: '2026/06/09 21:12', count: 2, size: '150 MB', expandable: true })}
        ${treeRow({ mark: logoImg('cien', 20), label: 'ci-en', sub: '2026/06/08 18:45', count: 2, size: '96 MB', expandable: true })}
      </div>
    </div>`

  const header = `<div style="padding:14px 20px 10px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
          <span style="font-size:17px;font-weight:700;color:var(--text);white-space:nowrap">すべての投稿</span>
          <span style="font-size:12px;color:var(--text-3);font-family:var(--mono);margin-left:4px">· ${POSTS.length}</span>
        </div>
        <div style="display:flex;align-items:center;gap:9px;padding:7px 12px;background:var(--surface-2);border-radius:9px;width:220px;color:var(--text-3);font-size:13px">${icon('search', 15, 'var(--text-3)')}検索…</div>
        <button style="display:inline-flex;align-items:center;gap:7px;padding:5px 9px;font-size:12px;font-weight:500;border-radius:9px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-family:inherit">${icon('sort', 14, 'var(--text)')}新しい順</button>
        <div style="display:flex;background:var(--surface-2);border-radius:9px;padding:3px">
          <span style="width:32px;height:28px;border-radius:7px;display:grid;place-items:center;background:var(--surface);box-shadow:var(--shadow-sm)">${icon('grid', 16, 'var(--accent)')}</span>
          <span style="width:32px;height:28px;border-radius:7px;display:grid;place-items:center">${icon('list', 16, 'var(--text-3)')}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:12px">
        ${chip('すべて', true)}${chip('取得済み', false, 'check')}${chip('一部', false)}
        <span style="width:1px;height:18px;background:var(--border);margin:0 3px"></span>
        ${chip('全種別', true)}${chip('画像', false, 'image')}${chip('動画', false, 'play')}${chip('ファイル', false, 'file')}
      </div>
    </div>`

  const grid = `<div style="flex:1;overflow:hidden;padding:18px 20px 28px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px">${POSTS.map(postCard).join('')}</div>
    </div>`

  const content = `<div style="flex:1;display:flex;min-height:0;min-width:0">${tree}
      <div style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0">${header}${grid}</div>
    </div>`
  return shell('library', content)
}

function progressScreen() {
  const stat = (l, v, c) => `<div style="flex:1"><div style="font-size:11px;color:var(--text-3);margin-bottom:5px;font-weight:500">${l}</div><div style="font-family:var(--mono);font-size:19px;font-weight:600;color:${c || 'var(--text)'}">${v}</div></div>`
  const row = (name, status) => {
    const map = { done: ['取得済み', 'var(--ok)'], dl: ['ダウンロード中', 'var(--accent)'], skip: ['スキップ', 'var(--text-3)'] }
    const [lbl, col] = map[status]
    return `<div style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:10px">
      ${icon(status === 'dl' ? 'download' : 'check', 15, col)}
      <div style="flex:1;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
      <span style="font-size:11.5px;font-weight:600;color:${col};font-family:var(--mono)">${lbl}</span></div>`
  }
  const header = `<div style="padding:26px 30px 22px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:42px;height:42px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.35)"><img src="${LOGOS.fantia}" style="width:100%;height:100%;object-fit:cover;display:block"></div>
        <div style="flex:1"><div style="font-size:12.5px;color:var(--text-3);font-weight:500">Fantia</div>
          <div style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:10px">ダウンロード中
            <span style="width:8px;height:8px;border-radius:99px;background:var(--accent)"></span></div></div>
        <div style="font-family:var(--mono);font-size:38px;font-weight:700;color:var(--accent)">41<span style="font-size:20px">%</span></div>
      </div>
      <div style="height:10px;border-radius:99px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:41%;border-radius:99px;background:var(--accent)"></div></div>
      <div style="display:flex;gap:8px;margin-top:22px">
        ${stat('投稿', '4612/11185', 'var(--accent)')}${stat('ファイル', '8230/8412')}${stat('完了', '512', 'var(--ok)')}${stat('スキップ', '7701')}${stat('失敗', '0')}${stat('サイズ', '1.8 GB')}${stat('速度', '6.4 MB/s')}${stat('残り', '7分')}
      </div>
      <div style="display:flex;gap:10px;margin-top:20px"><span style="padding:8px 16px;border-radius:9px;background:color-mix(in srgb,var(--danger) 90%,#000);color:#fff;font-size:12.5px;font-weight:600;display:inline-flex;gap:6px;align-items:center">${icon('x', 14, '#fff')}キャンセル</span></div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:9px;padding:9px 12px;background:var(--surface-2);border-radius:10px">
        <span style="width:7px;height:7px;border-radius:99px;background:var(--accent)"></span>
        <span style="font-size:11.5px;font-weight:700;color:var(--accent)">ダウンロード中</span>
        <span style="font-size:12px;color:var(--text-2);font-family:var(--mono)">あおいスタジオ — 春の新作イラスト集 / illust_07.png</span></div>
  </div>`
  const list = `<div style="flex:1;overflow:hidden;padding:8px 18px">
      ${row('illust_07.png', 'dl')}${row('illust_06.png', 'dl')}${row('cover.png', 'done')}${row('making_12.mp4', 'done')}${row('wallpaper_4k_03.png', 'skip')}${row('lineart.psd', 'skip')}${row('voice_ep3.mp3', 'done')}</div>`
  return shell('download', header + list)
}

const SCREENS = [
  ['library', libraryScreen()],
  ['progress', progressScreen()]
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
