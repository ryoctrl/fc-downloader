/* Dev-only probe: verify the ci-en (ci-en.net) adapter flow against the
 * logged-in persist:cien session. ci-en renders HTML (no JSON API), so the
 * adapter scrapes it. This mirrors src/main/services/cien.
 *
 * Verified end-to-end 2026-06-08 (checkAuth -> subscriptions -> articles ->
 * gated attachment download returning HTTP 200).
 *
 * Run: node_modules/electron/dist/electron.exe scripts/probe-cien.cjs
 */
const path = require('node:path')
const { app, session, net } = require('electron')
app.setPath('userData', path.join(app.getPath('appData'), 'fc-downloader'))
const BASE = 'https://ci-en.net'

function req(ses, url, bin = false) {
  return new Promise((resolve) => {
    const r = net.request({ url, method: 'GET', session: ses, useSessionCookies: true })
    r.setHeader('Referer', BASE + '/')
    const c = []
    r.on('response', (p) => {
      p.on('data', (d) => c.push(Buffer.from(d)))
      p.on('end', () =>
        resolve({
          status: p.statusCode,
          ct: p.headers['content-type'],
          len: Buffer.concat(c).length,
          body: bin ? null : Buffer.concat(c).toString('utf8')
        })
      )
      p.on('error', (e) => resolve({ error: String(e) }))
    })
    r.on('error', (e) => resolve({ error: String(e) }))
    r.end()
  })
}
const uniq = (a) => [...new Set(a)]

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:cien')

  // 1) checkAuth: authed /mypage carries the user-menu links.
  const mp = await req(ses, `${BASE}/mypage`)
  const authed = mp.body.includes('/logout') && mp.body.includes('/mypage/setting')
  console.log('checkAuth:', authed)

  // 2) listCreators: subscribed creators (ids appear padded + bare).
  const sub = await req(ses, `${BASE}/mypage/subscription`)
  const cids = uniq(
    (sub.body.match(/\/creator\/(\d+)/g) || []).map((s) => s.replace('/creator/', '').replace(/^0+/, ''))
  )
  console.log('subscribed creators:', cids.join(', ') || '(none)')
  const cid = cids[0]
  if (!cid) return app.exit(0)

  // 3) listPosts: /creator/<id>/article?page=N paginates (15/page).
  const list = await req(ses, `${BASE}/creator/${cid}/article?page=1`)
  const aids = uniq((list.body.match(/\/creator\/\d+\/article\/(\d+)/g) || []).map((s) => s.replace(/.*article\//, '')))
  console.log(`articles (page 1) for ${cid}:`, aids.length, '| first:', aids[0])
  if (!aids[0]) return app.exit(0)

  // 4) article media: gated /private/attachment, prefer the upload/ original.
  const ad = await req(ses, `${BASE}/creator/${cid}/article/${aids[0]}`)
  const re =
    /https:\/\/media\.ci-en\.jp\/private\/(?:attachment|file)\/creator\/\d+\/([0-9a-f]+)\/([^"'\\ )]+)/gi
  const byHash = new Map()
  for (const m of ad.body.matchAll(re)) {
    const v = m[2].split('?')[0]
    if (!v) continue
    const l = byHash.get(m[1]) || []
    l.push({ v, url: m[0].replace(/&amp;/g, '&') })
    byHash.set(m[1], l)
  }
  const score = (v) => (v.startsWith('upload/') ? 100 : v.startsWith('image-800') ? 30 : v.startsWith('image-web') ? 20 : 10)
  console.log('gated attachments in article:', byHash.size)
  const first = [...byHash.values()][0]
  if (first) {
    first.sort((a, b) => score(b.v) - score(a.v))
    const best = first[0]
    console.log('best variant:', best.v)
    const dl = await req(ses, best.url, true)
    console.log(`download: status=${dl.status} ct=${dl.ct} bytes=${dl.len}`)
  }
  app.exit(0)
})
