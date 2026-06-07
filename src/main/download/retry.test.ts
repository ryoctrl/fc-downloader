import { describe, expect, it } from 'vitest'
import { backoffDelayMs, isRetriableError } from './retry'

describe('backoffDelayMs', () => {
  it('doubles each attempt and caps at maxMs', () => {
    expect(backoffDelayMs(1)).toBe(500)
    expect(backoffDelayMs(2)).toBe(1000)
    expect(backoffDelayMs(3)).toBe(2000)
    expect(backoffDelayMs(4)).toBe(4000)
    expect(backoffDelayMs(5)).toBe(8000)
    expect(backoffDelayMs(6)).toBe(8000) // capped
  })

  it('treats attempt < 1 as the first retry', () => {
    expect(backoffDelayMs(0)).toBe(500)
  })

  it('honors custom base/max', () => {
    expect(backoffDelayMs(1, { baseMs: 100, maxMs: 300 })).toBe(100)
    expect(backoffDelayMs(2, { baseMs: 100, maxMs: 300 })).toBe(200)
    expect(backoffDelayMs(3, { baseMs: 100, maxMs: 300 })).toBe(300) // capped
  })
})

describe('isRetriableError', () => {
  it('never retries aborts', () => {
    expect(isRetriableError(new DOMException('Aborted', 'AbortError'))).toBe(false)
    expect(isRetriableError({ name: 'AbortError' })).toBe(false)
  })

  it('retries transient HTTP statuses (408/429/5xx)', () => {
    expect(isRetriableError({ status: 500 })).toBe(true)
    expect(isRetriableError({ status: 503 })).toBe(true)
    expect(isRetriableError({ status: 429 })).toBe(true)
    expect(isRetriableError({ status: 408 })).toBe(true)
  })

  it('does not retry permanent 4xx', () => {
    expect(isRetriableError({ status: 400 })).toBe(false)
    expect(isRetriableError({ status: 403 })).toBe(false)
    expect(isRetriableError({ status: 404 })).toBe(false)
  })

  it('retries network/unknown errors without a status', () => {
    expect(isRetriableError(new Error('ECONNRESET'))).toBe(true)
    expect(isRetriableError(undefined)).toBe(true)
  })
})
