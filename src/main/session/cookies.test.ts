import { describe, expect, it } from 'vitest'
import { parentDomain, parseCookieInput } from './cookies'

describe('parseCookieInput', () => {
  it('parses a Cookie header string', () => {
    const r = parseCookieInput('session_id=abc123; a_csrf=xyz')
    expect(r.format).toBe('header')
    expect(r.cookies).toHaveLength(2)
    expect(r.cookies[0]).toMatchObject({ name: 'session_id', value: 'abc123' })
    // No domain in a header, so the cookie is left host-only.
    expect(r.cookies[0].domain).toBeUndefined()
  })

  it('keeps "=" inside a value', () => {
    const r = parseCookieInput('token=a=b=c')
    expect(r.cookies[0]).toMatchObject({ name: 'token', value: 'a=b=c' })
  })

  it('parses a Netscape cookies.txt, including HttpOnly rows', () => {
    const txt = [
      '# Netscape HTTP Cookie File',
      '.patreon.com\tTRUE\t/\tTRUE\t1893456000\tsession_id\tsecret',
      '#HttpOnly_.patreon.com\tTRUE\t/\tTRUE\t0\ta_csrf\ttok'
    ].join('\n')
    const r = parseCookieInput(txt)
    expect(r.format).toBe('netscape')
    expect(r.cookies).toHaveLength(2)
    expect(r.cookies[0]).toMatchObject({
      name: 'session_id',
      value: 'secret',
      domain: '.patreon.com',
      secure: true,
      expires: 1893456000
    })
    expect(r.cookies[1]).toMatchObject({ name: 'a_csrf', httpOnly: true })
    // A zero expiry means "session cookie"; left undefined, not 0.
    expect(r.cookies[1].expires).toBeUndefined()
  })

  it('parses a Cookie-Editor style JSON array', () => {
    const json = JSON.stringify([
      {
        domain: '.patreon.com',
        name: 'session_id',
        value: 'abc',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'no_restriction',
        expirationDate: 1893456000
      }
    ])
    const r = parseCookieInput(json)
    expect(r.format).toBe('json')
    expect(r.cookies[0]).toMatchObject({
      name: 'session_id',
      domain: '.patreon.com',
      httpOnly: true,
      sameSite: 'no_restriction',
      secure: true
    })
  })

  it('drops no_restriction from a non-secure cookie, and respects host_only', () => {
    const json = JSON.stringify([
      { name: 'a', value: '1', domain: 'www.patreon.com', host_only: true },
      { name: 'b', value: '2', domain: '.patreon.com', sameSite: 'none', secure: false }
    ])
    const r = parseCookieInput(json)
    expect(r.cookies[0].domain).toBeUndefined()
    expect(r.cookies[1].sameSite).toBeUndefined()
  })

  it('parses a JSON object map', () => {
    const r = parseCookieInput('{"session_id":"v1","other":"v2"}')
    expect(r.format).toBe('json')
    expect(r.cookies.map((c) => c.name)).toEqual(['session_id', 'other'])
  })

  it('reports empty input instead of throwing', () => {
    expect(parseCookieInput('')).toMatchObject({ cookies: [], format: null })
    expect(parseCookieInput('   \n ')).toMatchObject({ cookies: [], format: null })
  })

  it('skips junk without discarding the good entries', () => {
    const r = parseCookieInput('garbage; good=1')
    expect(r.cookies).toHaveLength(1)
    expect(r.cookies[0].name).toBe('good')
    expect(r.skipped.length).toBeGreaterThan(0)
  })

  it('ignores comment-only Netscape input', () => {
    const r = parseCookieInput('# just a comment\n#another')
    expect(r.cookies).toHaveLength(0)
  })

  // `skipped` is rendered in the UI and can end up in a bug report, so the
  // diagnostics must describe the shape of the input and never its contents.
  it('never echoes cookie material in skip reasons', () => {
    const secret = 'SUPERSECRETTOKENVALUE0123456789'
    const header = parseCookieInput(`ok=1; ${secret}`)
    const netscape = parseCookieInput(
      `.patreon.com\tTRUE\t/\tTRUE\t0\ta\t1\n.patreon.com\tTRUE\t${secret}`
    )
    for (const r of [header, netscape]) {
      expect(JSON.stringify(r.skipped)).not.toContain(secret)
    }
    expect(header.skipped.length + netscape.skipped.length).toBeGreaterThan(0)
  })

  // People copy the whole header line, or use "Copy as cURL". The lead-in must
  // not swallow the first cookie — on these sites that is the session cookie.
  it('strips a pasted "Cookie:" header label', () => {
    const r = parseCookieInput('Cookie: session_id=abc; a_csrf=def')
    expect(r.cookies.map((c) => c.name)).toEqual(['session_id', 'a_csrf'])
    expect(r.cookies[0].value).toBe('abc')
  })

  it('strips a curl -H wrapper around the header', () => {
    const r = parseCookieInput(`-H 'Cookie: session_id=abc; x=y'`)
    expect(r.cookies.map((c) => c.name)).toEqual(['session_id', 'x'])
  })

  it('strips surrounding quotes from a copied value', () => {
    const r = parseCookieInput('"session_id=abc; x=y"')
    expect(r.cookies.map((c) => c.name)).toEqual(['session_id', 'x'])
  })
})

describe('parentDomain', () => {
  it('derives the registrable-ish parent', () => {
    expect(parentDomain('www.patreon.com')).toBe('.patreon.com')
    expect(parentDomain('a.b.c.example.com')).toBe('.example.com')
  })

  it('returns null when there is no useful parent', () => {
    expect(parentDomain('patreon.com')).toBeNull()
    expect(parentDomain('localhost')).toBeNull()
  })
})
