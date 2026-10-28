import { describe, expect, it } from 'vitest'
import { normalizeSessionValue, sessionCookieSpec, type SessionCookieSpec } from './sessionCookie'

const spec: SessionCookieSpec = {
  name: 'session_id',
  domain: '.example.invalid',
  host: 'https://www.example.invalid'
}

describe('sessionCookieSpec', () => {
  it('knows the importable services only', () => {
    expect(sessionCookieSpec('patreon')?.name).toBe('session_id')
    expect(sessionCookieSpec('fanbox')?.name).toBe('FANBOXSESSID')
    expect(sessionCookieSpec('fantia')?.name).toBe('_session_id')
    expect(sessionCookieSpec('cien')).toBeUndefined()
  })

  it('ignores inherited keys', () => {
    for (const id of ['__proto__', 'constructor', 'toString', '']) {
      expect(sessionCookieSpec(id)).toBeUndefined()
    }
  })
})

describe('normalizeSessionValue', () => {
  it.each([
    ['fakeSessionValue123', 'fakeSessionValue123'],
    ['  fakeSessionValue123 \n', 'fakeSessionValue123'],
    ['"fakeSessionValue123"', 'fakeSessionValue123'],
    ['session_id=fakeSessionValue123', 'fakeSessionValue123'],
    ['abc-_.%2F~=', 'abc-_.%2F~=']
  ])('accepts %j', (raw, value) => {
    expect(normalizeSessionValue(spec, raw)).toBe(value)
  })

  it.each([
    '',
    '   ',
    '""',
    'session_id=',
    'fake value',
    'a=1; b=2',
    'fake,value',
    'fake\value',
    'fake"value',
    'fake\tvalue',
    'fake\u0000value',
    'ｆａｋｅ',
    'x'.repeat(4097)
  ])('rejects %j', (raw) => {
    expect(normalizeSessionValue(spec, raw)).toBeNull()
  })
})
