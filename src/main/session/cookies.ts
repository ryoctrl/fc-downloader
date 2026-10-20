/**
 * Manual cookie import — the escape hatch for services whose sign-in cannot
 * complete inside an embedded Chromium.
 *
 * Patreon's "Continue with Google" is the motivating case: Google signs the
 * user in (its SID/SSID cookies land in the partition) and Cloudflare's
 * challenge passes (cf_clearance is stored), yet the handoff back to Patreon
 * never yields a Patreon `session_id` — the page shows its generic "something
 * went wrong" screen. The jar itself is fine (the popup and the <webview>
 * share it), so the fallback is to bring cookies in from a browser that can
 * finish the flow.
 *
 * So the user logs in with a normal browser and pastes the resulting cookie
 * into the app; this module turns whatever they paste into cookie records and
 * `importCookies` installs them into the service's partition. The renderer then
 * verifies them with the service's real `checkAuth`, so a bad paste is reported
 * as "imported but not logged in" instead of silently working.
 *
 * Parsing is kept free of Electron imports so it can be unit-tested. Accepted
 * inputs, all of which people actually paste:
 *   - Netscape `cookies.txt` (what most exporter extensions write)
 *   - JSON arrays from Cookie-Editor / EditThisCookie
 *   - a plain `Cookie:` header string (`a=b; c=d`)
 *   - a JSON object map (`{"a":"b"}`)
 */

/** `sameSite` in the shape Electron's `cookies.set` accepts. */
export type CookieSameSite = 'unspecified' | 'no_restriction' | 'lax' | 'strict'

export interface ParsedCookie {
  name: string
  value: string
  /** Leading dot means "subdomains too". Absent for header-string input. */
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  /** Unix seconds; 0 means a session cookie. */
  expires?: number
  sameSite?: CookieSameSite
}

/** Which syntax the input looked like — surfaced in the log line. */
export type CookieInputFormat = 'netscape' | 'json' | 'header'

export interface ParseResult {
  cookies: ParsedCookie[]
  format: CookieInputFormat | null
  /** Non-fatal reasons a line/entry was skipped (first few only). */
  skipped: string[]
}

function normaliseSameSite(raw: unknown): CookieSameSite | undefined {
  if (typeof raw !== 'string') return undefined
  switch (raw.toLowerCase().replace(/[-_]/g, '')) {
    case 'strict':
      return 'strict'
    case 'lax':
      return 'lax'
    case 'none':
    case 'norestriction':
      return 'no_restriction'
    default:
      return undefined
  }
}

function asBool(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw
  if (raw === 1 || raw === '1' || raw === 'true') return true
  if (raw === 0 || raw === '0' || raw === 'false') return false
  return undefined
}

/**
 * A cookie value arrives as whatever the user's exporter wrote. Coerce it to a
 * trimmed string so a numeric-looking value isn't silently dropped.
 */
function cleanValue(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim()
}

/** `a=b; c=d` — a raw Cookie header. */
function parseHeader(raw: string, skipped: string[]): ParsedCookie[] {
  const out: ParsedCookie[] = []
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) {
      // `skipped` is handed back to the renderer, so never echo the fragment:
      // a part with no `=` can still be (a slice of) a real token.
      if (part.trim()) skipped.push('header part without "="')
      continue
    }
    const name = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (!name) continue
    out.push({ name, value })
  }
  return out
}

/**
 * Strip the lead-in around a pasted header.
 *
 * People copy the whole line from DevTools (`cookie: a=b; c=d`), or use "Copy as
 * cURL" and hand over `-H 'Cookie: a=b'`. Either way the first real cookie would
 * otherwise be parsed as one named `cookie: a` — and that is exactly the cookie
 * a session depends on, so the import would look successful while logging in
 * nobody.
 */
function stripHeaderLead(text: string): string {
  let t = text.trim()
  const shell = /^-H\s+(['"])([\s\S]*)\1$/i.exec(t)
  if (shell) t = shell[2].trim()
  if (/^['"]/.test(t) && t.length > 1) t = t.slice(1, t.endsWith(t[0]) ? -1 : undefined).trim()
  t = t.replace(/^cookie\s*:\s*/i, '')
  return t.trim()
}

interface JsonCookie {
  name?: unknown
  key?: unknown
  value?: unknown
  domain?: unknown
  host_only?: unknown
  path?: unknown
  secure?: unknown
  httpOnly?: unknown
  httponly?: unknown
  expirationDate?: unknown
  expires?: unknown
  sameSite?: unknown
}

function fromJsonObject(entry: JsonCookie, skipped: string[], index: number): ParsedCookie | null {
  const name = typeof entry.name === 'string' ? entry.name : typeof entry.key === 'string' ? entry.key : ''
  if (!name.trim()) {
    skipped.push(`JSON entry ${index} has no name`)
    return null
  }
  const hostOnly = asBool(entry.host_only)
  const domain = typeof entry.domain === 'string' && entry.domain ? entry.domain : undefined
  const expiresRaw = entry.expirationDate ?? entry.expires
  const expires = typeof expiresRaw === 'number' && Number.isFinite(expiresRaw) ? expiresRaw : undefined
  const sameSite = normaliseSameSite(entry.sameSite)
  const secure = asBool(entry.secure)
  return {
    name: name.trim(),
    value: cleanValue(entry.value),
    // A host-only cookie must be stored without a domain, or Chromium will send
    // it to subdomains it was never issued for.
    domain: hostOnly ? undefined : domain,
    path: typeof entry.path === 'string' && entry.path ? entry.path : undefined,
    secure: secure === undefined ? undefined : secure,
    httpOnly: asBool(entry.httpOnly ?? entry.httponly),
    expires,
    // `no_restriction` is only valid on a secure cookie; drop it otherwise so
    // cookies.set doesn't reject the record.
    sameSite: sameSite === 'no_restriction' && secure !== true ? undefined : sameSite
  }
}

/** Netscape `cookies.txt`: `domain \t includeSubdomains \t path \t secure \t expiry \t name \t value`. */
function parseNetscape(raw: string, skipped: string[]): ParsedCookie[] {
  const out: ParsedCookie[] = []
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let record = trimmed
    let httpOnly = false
    // Exporters prefix HttpOnly rows with `#HttpOnly_`, which would otherwise
    // look like a comment.
    if (record.startsWith('#HttpOnly_')) {
      httpOnly = true
      record = record.slice('#HttpOnly_'.length)
    } else if (record.startsWith('#')) {
      continue
    }
    const f = record.split('\t')
    if (f.length < 7) {
      // Field count only — the line itself would be cookie material.
      skipped.push(`netscape line has ${f.length} of 7 fields`)
      continue
    }
    const name = f[5].trim()
    if (!name) {
      skipped.push('netscape line without a name')
      continue
    }
    const expiry = Number(f[4])
    out.push({
      name,
      value: f.slice(6).join('\t').trim(),
      domain: f[0].trim() || undefined,
      path: f[2].trim() || undefined,
      secure: f[3].trim().toUpperCase() === 'TRUE',
      httpOnly,
      expires: Number.isFinite(expiry) && expiry > 0 ? expiry : undefined
    })
  }
  return out
}

/** Parse any of the supported paste formats. Never throws. */
export function parseCookieInput(raw: string): ParseResult {
  const skipped: string[] = []
  const text = (raw ?? '').trim()
  if (!text) return { cookies: [], format: null, skipped }

  // JSON first: a pasted array/object is unambiguous and would otherwise be
  // mis-read as a header string by the `=` heuristic.
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const data: unknown = JSON.parse(text)
      const list: JsonCookie[] = Array.isArray(data)
        ? (data as JsonCookie[])
        : Object.entries(data as Record<string, unknown>).map(([name, value]) => ({ name, value }))
      const cookies = list
        .map((entry, i) => fromJsonObject(entry ?? {}, skipped, i))
        .filter((c): c is ParsedCookie => !!c)
      if (cookies.length > 0) return { cookies, format: 'json', skipped }
      skipped.push('JSON contained no usable cookies')
    } catch {
      // Fall through: a Cookie header can legitimately contain '{' in a value
      // (JWT payloads are base64 with dots, but some tokens do carry braces).
    }
  }

  // Netscape: every record line is tab-separated with 7 fields.
  const looksNetscape = text
    .split(/\r?\n/)
    .some((l) => (l.startsWith('#HttpOnly_') || !l.startsWith('#')) && l.split('\t').length >= 7)
  if (looksNetscape) {
    const cookies = parseNetscape(text, skipped)
    if (cookies.length > 0) return { cookies, format: 'netscape', skipped }
  }

  const cookies = parseHeader(stripHeaderLead(text), skipped)
  return { cookies, format: cookies.length ? 'header' : null, skipped }
}

/** The registrable-ish parent domain of a host: `www.patreon.com` -> `.patreon.com`. */
export function parentDomain(host: string): string | null {
  const labels = host.toLowerCase().split('.')
  // Needs at least three labels for a parent to be meaningful on these sites
  // (`patreon.com` has no useful parent).
  if (labels.length < 3) return null
  return `.${labels.slice(-2).join('.')}`
}
