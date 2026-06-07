import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_GAP_MS, awaitPoliteSlot, resetThrottle } from './throttle'

beforeEach(() => {
  resetThrottle()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('awaitPoliteSlot', () => {
  it('resolves the first request for a service immediately', async () => {
    let done = false
    void awaitPoliteSlot('fantia').then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('spaces successive requests for the same service by MIN_GAP_MS', async () => {
    const order: number[] = []
    void awaitPoliteSlot('fantia').then(() => order.push(1))
    void awaitPoliteSlot('fantia').then(() => order.push(2))
    void awaitPoliteSlot('fantia').then(() => order.push(3))

    await vi.advanceTimersByTimeAsync(0)
    expect(order).toEqual([1]) // first is immediate, rest are queued

    await vi.advanceTimersByTimeAsync(MIN_GAP_MS)
    expect(order).toEqual([1, 2])

    await vi.advanceTimersByTimeAsync(MIN_GAP_MS)
    expect(order).toEqual([1, 2, 3])
  })

  it('throttles each service independently', async () => {
    let a = false
    let b = false
    // Burn fantia's immediate slot so its next call must wait.
    void awaitPoliteSlot('fantia')
    void awaitPoliteSlot('fantia').then(() => {
      a = true
    })
    // A different service is unaffected and resolves immediately.
    void awaitPoliteSlot('fanbox').then(() => {
      b = true
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(a).toBe(false)
    expect(b).toBe(true)
  })

  it('rejects a queued request if its signal aborts before the slot opens', async () => {
    const ac = new AbortController()
    void awaitPoliteSlot('cien') // take the immediate slot
    const queued = awaitPoliteSlot('cien', ac.signal)
    const caught = queued.catch((e: unknown) => (e as Error).name)

    ac.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(await caught).toBe('AbortError')
  })
})
