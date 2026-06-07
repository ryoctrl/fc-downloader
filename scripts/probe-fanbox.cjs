/*
 * Diagnostic probe (dev-only): use the already-logged-in `persist:fanbox`
 * session to hit candidate Fanbox API endpoints and print the real responses,
 * so the adapter can be matched to reality. Run with:
 *   node_modules/electron/dist/electron.exe scripts/probe-fanbox.cjs
 * Everything stays local; it only reads the user's own session.
 */
const path = require('node:path')
const { app, session, net } = require('electron')

// Match the app's userData so we read the same session partition cookies.
app.setPath('userData', path.join(app.getPath('appData'), 'fc-downloader'))

const ORIGIN = 'https://www.fanbox.cc'

function req(ses, url) {
  return new Promise((resolve) => {
    const r = net.request({ url, method: 'GET', session: ses, useSessionCookies: true })
    r.setHeader('Origin', ORIGIN)
    r.setHeader('Referer', ORIGIN + '/')
    r.setHeader('Accept', 'application/json, text/plain, */*')
    const chunks = []
    r.on('response', (res) => {
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
      )
      res.on('error', (e) => resolve({ error: String(e) }))
    })
    r.on('error', (e) => resolve({ error: String(e) }))
    r.end()
  })
}

app.whenReady().then(async () => {
  // Dump cookies across the default + per-service partitions to locate any
  // login session cookie.
  for (const part of ['(default)', 'persist:fanbox', 'persist:fantia']) {
    const s = part === '(default)' ? session.defaultSession : session.fromPartition(part)
    const cs = await s.cookies.get({})
    console.log(
      `\n### ${part}: ${cs.length} cookies\n` +
        cs.map((c) => `  ${c.name} @ ${c.domain}${c.session ? ' [session]' : ''}`).join('\n')
    )
  }

  // Probe the Fanbox API with the service's logged-in session.
  const ses = session.fromPartition(process.env.PROBE_PARTITION || 'persist:fanbox')
  // Full-chain verification mirroring the adapter logic.
  const J = (r) => {
    try {
      return JSON.parse(r.body)
    } catch {
      return null
    }
  }
  const sup = J(await req(ses, 'https://api.fanbox.cc/plan.listSupporting'))
  const creatorId = (sup && sup.body && sup.body[0] && sup.body[0].creatorId) || ''
  console.log('supported creators:', (sup?.body ?? []).map((p) => `${p.creatorId}(${p.user?.name})`).join(', '))
  if (!creatorId) return app.exit(0)

  const pag = J(await req(ses, `https://api.fanbox.cc/post.paginateCreator?creatorId=${creatorId}`))
  const pages = pag?.body ?? []
  console.log(`pages for ${creatorId}: ${pages.length}`)
  const page0 = J(await req(ses, pages[0]))
  const items = page0?.body ?? []
  console.log(`page0 posts: ${items.length}; first: ${items[0]?.id} "${items[0]?.title}" restricted=${items[0]?.isRestricted}`)

  // find an accessible post and pull its images
  for (const it of items) {
    const info = J(await req(ses, `https://api.fanbox.cc/post.info?postId=${it.id}`))
    const b = info?.body
    if (!b || !b.body) {
      console.log(`  post ${it.id}: body=null (restricted/skip)`)
      continue
    }
    const imgs = b.body.images ?? []
    const files = b.body.files ?? []
    console.log(`  post ${it.id} type=${b.type}: ${imgs.length} images, ${files.length} files`)
    if (imgs[0]) {
      const url = imgs[0].originalUrl
      const dl = await req(ses, url) // with Referer header set in req()
      console.log(`  -> download ${url}\n     status=${dl.status} bytes=${dl.body.length}+`)
      break
    }
  }
  app.exit(0)
})
