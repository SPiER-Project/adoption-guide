import { describe, expect, it, vi } from 'vitest'
import { defaultBackoff, retrySync } from './retry.mjs'

// `backoffMs: () => 0` throughout: these assert the retry LOOP, and a real
// backoff would make the suite take 40s to prove something that does not depend
// on the wait. `defaultBackoff` is checked directly at the bottom instead.
const noWait = { backoffMs: () => 0 }

describe('retrySync', () => {
  it('does not retry a step that succeeds first time', () => {
    const attempt = vi.fn(() => ({ ok: true, status: 0 }))
    const result = retrySync(attempt, { attempts: 3, ...noWait })
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ ok: true, status: 0, attemptsUsed: 1 })
  })

  it('retries until it succeeds, and reports how many attempts that took', () => {
    // The case this file exists for: the registry flakes, then recovers.
    let calls = 0
    const attempt = vi.fn(() => {
      calls++
      return calls < 3 ? { ok: false, status: 1 } : { ok: true, status: 0 }
    })
    const result = retrySync(attempt, { attempts: 3, ...noWait })
    expect(attempt).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ ok: true, attemptsUsed: 3 })
  })

  it('gives up after the last attempt and hands back that attempt’s result', () => {
    // A genuinely broken FSH file: it fails every time, and the caller still
    // needs the real exit status to propagate rather than a synthesised one.
    const attempt = vi.fn(() => ({ ok: false, status: 7 }))
    const result = retrySync(attempt, { attempts: 3, ...noWait })
    expect(attempt).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ ok: false, status: 7, attemptsUsed: 3 })
  })

  it('announces every retry, and never announces one after the last attempt', () => {
    // A build log that silently runs the same command three times is worse than
    // one that failed once — so the announcement is part of the contract, and
    // the OFF-BY-ONE is the bit worth pinning: 3 attempts means 2 retries.
    const onRetry = vi.fn()
    retrySync(() => ({ ok: false }), { attempts: 3, onRetry, ...noWait })
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry.mock.calls.map(([e]) => e.attempt)).toEqual([1, 2])
    expect(onRetry.mock.calls.every(([e]) => e.attempts === 3)).toBe(true)
  })

  it('waits the backoff the caller asked for, between attempts only', () => {
    const backoffMs = vi.fn(n => n * 5)
    const waits = []
    retrySync(() => ({ ok: false }), {
      attempts: 3,
      backoffMs,
      onRetry: ({ waitMs }) => waits.push(waitMs),
    })
    expect(waits).toEqual([5, 10])
  })

  // ⚠️ The rest of this block is about a miscounted config not silently
  // deleting the work. `attempts: 0` reading as "run it zero times" would make
  // copy-fhir skip the SUSHI compile and march on to copy a tree that was never
  // built — a far worse failure than the flake this file is for.
  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 2.5],
    ['nonsense', 'three'],
  ])('still runs the step exactly once when attempts is %s', (_label, attempts) => {
    const attempt = vi.fn(() => ({ ok: false, status: 1 }))
    const result = retrySync(attempt, { attempts, ...noWait })
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ ok: false, attemptsUsed: 1 })
  })

  it('falls back to the default of 3 when attempts is omitted entirely', () => {
    // NOT one of the nonsense cases above, and the distinction is the whole
    // point: `undefined` hits the default parameter and means "use the default",
    // where `0` and `'three'` are a caller who meant something and got it wrong.
    // Lumping them together (as the first version of this suite did) would have
    // asserted that omitting the option disables retrying.
    const attempt = vi.fn(() => ({ ok: false }))
    retrySync(attempt, { ...noWait })
    expect(attempt).toHaveBeenCalledTimes(3)
  })

  it('treats a step that returns nothing as a failure rather than throwing', () => {
    // Defensive: `attempt` is supplied by a caller in another file, and a
    // TypeError here would replace a readable "sushi failed" with a stack trace.
    const attempt = vi.fn(() => undefined)
    expect(() => retrySync(attempt, { attempts: 2, ...noWait })).not.toThrow()
    expect(attempt).toHaveBeenCalledTimes(2)
  })
})

describe('defaultBackoff', () => {
  it('waits 10s then 30s, sized against the outage that motivated it', () => {
    // The observed registry degradation ran a little over two minutes; 10s + 30s
    // spans enough of that to clear a blip without turning a real outage into a
    // build that hangs around pretending it might recover.
    expect(defaultBackoff(1)).toBe(10_000)
    expect(defaultBackoff(2)).toBe(30_000)
    expect(defaultBackoff(3)).toBe(30_000)
  })
})
