/* Dev-only probe: validate Patreon endpoints with the logged-in persist:patreon session.
 * Patreon's web client talks to a JSON:API at https://www.patreon.com/api/*.
 * Run: node_modules/electron/dist/electron.exe scripts/probe-patreon.cjs
 */
const path = require('node:path')
const { app, session, net } = require('electron')
app.setPath('userData', path.join(app.getPath('appData'), 'fc-downloader'))
const BASE = 'https://www.patreon.com'

function req(ses, url, extra = {}) {
  return new Promise((resolve) => {
    const r = net.request({ url, method: 'GET', session: ses, useSessionCookies: true })
    r.setHeader('Accept', 'application/json, text/plain, */*')
    r.setHeader('Referer', BASE + '/')
    for (const [k, v] of Object.entries(extra)) r.setHeader(k, v)
    const chunks = []
    r.on('response', (res) => {
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () =>
        resolve({ status: res.statusCode, ct: res.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') })
      )
      res.on('error', (e) => resolve({ error: String(e) }))
    })
    r.on('error', (e) => resolve({ error: String(e) }))
    r.end()
  })
}

const J = (s) => {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:patreon')
  const show = (label, r, n = 700) =>
    console.log(`\n=== ${label} ===\nstatus=${r.status} ct=${r.ct}\n${(r.body || r.error || '').slice(0, n)}`)

  // 1) Identity check.
  const me = await req(ses, `${BASE}/api/current_user?json-api-version=1.0`)
  show('/api/current_user', me)
  const meJ = J(me.body)
  console.log('current_user.data.id:', meJ?.data?.id, '| type:', meJ?.data?.type)

  // 2) Supported campaigns: pull memberships + pledges + their campaigns.
  const inc = [
    'memberships.campaign.creator',
    'pledges.campaign.creator',
    'follows.followed'
  ].join(',')
  const fields = [
    'fields[campaign]=name,url,avatar_photo_url,creation_name,vanity',
    'fields[user]=full_name,image_url,url,vanity'
  ].join('&')
  const meFull = await req(
    ses,
    `${BASE}/api/current_user?json-api-version=1.0&include=${encodeURIComponent(inc)}&${fields}`
  )
  const fullJ = J(meFull.body)
  if (fullJ?.included) {
    const byType = {}
    for (const x of fullJ.included) byType[x.type] = (byType[x.type] || 0) + 1
    console.log('\ncurrent_user included types:', JSON.stringify(byType))
    const campaigns = fullJ.included.filter((x) => x.type === 'campaign')
    console.log('campaigns found:', campaigns.length)
    for (const c of campaigns.slice(0, 8)) {
      console.log(`  campaign id=${c.id} name="${c.attributes?.name}" vanity=${c.attributes?.vanity} url=${c.attributes?.url}`)
    }
    // 3) Posts for the first campaign.
    const camp = campaigns[0]
    if (camp) {
      const pInc = 'attachments_media,images,audio,media,user'
      const pFields = [
        'fields[post]=title,published_at,post_type,url,current_user_can_view',
        'fields[media]=download_url,file_name,mimetype,size_bytes,image_urls'
      ].join('&')
      const postsUrl =
        `${BASE}/api/posts?json-api-version=1.0` +
        `&filter[campaign_id]=${camp.id}&filter[contains_exclusive_posts]=true` +
        `&sort=-published_at&include=${encodeURIComponent(pInc)}&${pFields}&page[count]=5`
      const posts = await req(ses, postsUrl)
      show(`/api/posts campaign=${camp.id}`, posts, 500)
      const postsJ = J(posts.body)
      const list = postsJ?.data || []
      console.log('posts returned:', list.length, '| has links.next:', !!postsJ?.links?.next)
      const p0 = list[0]
      if (p0) {
        console.log(`\npost id=${p0.id} title="${p0.attributes?.title}" type=${p0.attributes?.post_type} canView=${p0.attributes?.current_user_can_view}`)
        const media = (postsJ.included || []).filter((x) => x.type === 'media')
        console.log('media included:', media.length)
        const m0 = media[0]
        if (m0) {
          console.log('media[0] attrs:', JSON.stringify(m0.attributes).slice(0, 300))
          if (m0.attributes?.download_url) {
            const dl = await req(ses, m0.attributes.download_url)
            console.log(`media download: status=${dl.status} ct=${dl.ct} bytes=${(dl.body || '').length}`)
          }
        }
      }
    }
  } else {
    show('/api/current_user (full include)', meFull)
  }

  app.exit(0)
})
