/* Dev-only probe: validate Fantia endpoints with the logged-in persist:fantia session. */
const path = require('node:path')
const { app, session, net } = require('electron')
app.setPath('userData', path.join(app.getPath('appData'), 'fc-downloader'))
const BASE = 'https://fantia.jp'

function req(ses, url, xhr = true, extra = {}) {
  return new Promise((resolve) => {
    const r = net.request({ url, method: 'GET', session: ses, useSessionCookies: true })
    r.setHeader('Accept', 'application/json, text/html, */*')
    r.setHeader('Referer', BASE + '/')
    if (xhr) r.setHeader('X-Requested-With', 'XMLHttpRequest')
    for (const [k, v] of Object.entries(extra)) r.setHeader(k, v)
    const chunks = []
    r.on('response', (res) => {
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () => resolve({ status: res.statusCode, ct: res.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') }))
      res.on('error', (e) => resolve({ error: String(e) }))
    })
    r.on('error', (e) => resolve({ error: String(e) }))
    r.end()
  })
}

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:fantia')
  const show = (label, r, n = 500) => console.log(`\n=== ${label} ===\nstatus=${r.status} ct=${r.ct}\n${(r.body || r.error || '').slice(0, n)}`)

  show('/api/v1/me', await req(ses, `${BASE}/api/v1/me`))
  const fc = await req(ses, `${BASE}/api/v1/me/fanclubs`)
  show('/api/v1/me/fanclubs', fc)
  let ids = []
  try { ids = JSON.parse(fc.body).fanclub_ids || [] } catch {}
  console.log('fanclub_ids:', ids.slice(0, 10).join(', '))
  const id = ids[0]
  if (id) {
    const fcd = await req(ses, `${BASE}/api/v1/fanclubs/${id}`)
    const keys = (() => { try { return Object.keys(JSON.parse(fcd.body).fanclub) } catch { return [] } })()
    console.log(`\nfanclub ${id} keys:`, keys.join(', '))
    // look for recent post ids anywhere in the fanclub detail
    const postIds = [...new Set((fcd.body.match(/"posts?"[^]]*?"id":(\d+)/g) || []))].slice(0, 3)
    console.log('post-ish ids in fanclub detail:', (fcd.body.match(/\/posts\/(\d+)/g) || []).slice(0, 5).join(', '))
    // HTML fanclub posts page WITHOUT the XHR header
    const htmlR = await req(ses, `${BASE}/fanclubs/${id}/posts?page=1`, false)
    const links = [...new Set((htmlR.body.match(/\/posts\/(\d+)/g) || []))]
    console.log(`\nHTML /fanclubs/${id}/posts?page=1 status=${htmlR.status} ct=${htmlR.ct} len=${htmlR.body.length} postLinks=${links.slice(0, 6).join(', ')}`)
    // extract CSRF token from the HTML page
    const csrf = (htmlR.body.match(/<meta name="csrf-token" content="([^"]+)"/) || [])[1] || ''
    console.log('csrf-token:', csrf ? csrf.slice(0, 16) + '…' : '(none)')
    // post detail (needs CSRF + XHR)
    const pid = (links[0] || '').replace('/posts/', '') || '4088936'
    const post = await req(ses, `${BASE}/api/v1/posts/${pid}`, true, { 'X-CSRF-Token': csrf })
    const pb = (() => { try { return JSON.parse(post.body).post } catch { return null } })()
    if (pb) {
      console.log(`\npost ${pid}: title="${pb.title}" posted_at=${pb.posted_at}`)
      console.log('post_contents:', (pb.post_contents || []).map((c) => `${c.category}(photos=${(c.post_content_photos || []).length} dl=${c.download_uri ? 'y' : 'n'})`).join(', '))
      const ph = (pb.post_contents || []).flatMap((c) => c.post_content_photos || [])[0]
      console.log('first photo object keys:', ph ? Object.keys(ph).join(',') : '(none)', '| url keys:', ph && ph.url ? Object.keys(ph.url).join(',') : '(none)')
      const fileC = (pb.post_contents || []).find((c) => c.category === 'file')
      if (fileC) console.log('file content keys: filename=', fileC.filename, '| download_uri=', fileC.download_uri)
      if (ph && ph.url && ph.url.original) {
        const dl = await req(ses, ph.url.original)
        console.log(`photo download: status=${dl.status} bytes=${(dl.body || '').length}`)
      }
    } else {
      console.log('post detail parse failed; raw:', post.status, post.body.slice(0, 200))
    }
  }
  app.exit(0)
})
