/**
 * Manual session-cookie import: the fallback for a sign-in flow the embedded
 * webview cannot finish (e.g. Patreon's "Continue with Google"). The user logs
 * in with a normal browser and copies ONE value — the service's session cookie
 * — which the app stores in that service's partition. The cookie name and
 * domain are fixed here per service, so a paste can never install an unrelated
 * cookie or one for another site.
 *
 * Shared by both processes — keep it free of Node/Electron/DOM imports.
 */
import type { ServiceId } from './types'

export interface SessionCookieSpec {
  /** The cookie the service authenticates with. */
  name: string
  /** Stored for the whole site (`.example.com`) so its API hosts get it too. */
  domain: string
  /** Where the user finds it in DevTools (Application → Cookies → <host>). */
  host: string
}

/** Services whose session can be imported. ci-en: cookie name not confirmed yet. */
export const SESSION_COOKIES: Partial<Record<ServiceId, SessionCookieSpec>> = {
  patreon: { name: 'session_id', domain: '.patreon.com', host: 'https://www.patreon.com' },
  fanbox: { name: 'FANBOXSESSID', domain: '.fanbox.cc', host: 'https://www.fanbox.cc' },
  fantia: { name: '_session_id', domain: '.fantia.jp', host: 'https://fantia.jp' }
}

/** The service's spec, or undefined (own keys only: the id may come over IPC). */
export function sessionCookieSpec(serviceId: string): SessionCookieSpec | undefined {
  return Object.prototype.hasOwnProperty.call(SESSION_COOKIES, serviceId)
    ? SESSION_COOKIES[serviceId as ServiceId]
    : undefined
}

/** Longest value accepted (session ids are far shorter; this only bounds junk). */
const MAX_VALUE_LENGTH = 4096

/** RFC 6265 cookie-octet: no whitespace, `"`, `,`, `;`, `\` or control chars. */
const COOKIE_OCTETS = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/

/**
 * The cookie value to store, or null when the input can't be one. Surrounding
 * whitespace and quotes are dropped, and a leading `<name>=` is accepted (a
 * copy of the whole `name=value` pair); anything else that isn't a single
 * cookie value — empty, several cookies, spaces inside — is rejected.
 */
export function normalizeSessionValue(spec: SessionCookieSpec, raw: string): string | null {
  let v = raw.trim()
  if (v.startsWith(`${spec.name}=`)) v = v.slice(spec.name.length + 1).trim()
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
  if (v.length === 0 || v.length > MAX_VALUE_LENGTH) return null
  return COOKIE_OCTETS.test(v) ? v : null
}
