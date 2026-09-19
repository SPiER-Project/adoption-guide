/**
 * @vitest-environment jsdom
 *
 * `SmartProvider`'s callback identities — the thing that caused an infinite
 * navigation loop in production.
 *
 * ⚠️ **This asserts a reference, which normally would not be worth a test.** It
 * is worth one here because a consumer's effect depends on it. `SmartRedirect`
 * lists `setSmartData` in its dependency array, as the lint rule requires, and
 * that made the identity part of the contract:
 *
 *     effect runs → setSmartData(...) → this provider re-renders
 *       → new function identity → dependencies changed → effect runs again
 *
 * On the deployed worklist launch that pushed **20,464 history entries in four
 * seconds** before Chrome's IPC-flooding protection stepped in, leaving the user
 * on "Connected. Opening the caseload…" while the URL already read
 * `#/population/caseload`.
 *
 * ⚠️ **Neither `npm run verify` nor a local browser pass caught it**, and the
 * reason is worth recording. The unit suite had no test that re-rendered this
 * provider; the local browser check verified the URL and the network (the roster
 * request went out, 14 patients came back) but never that the destination
 * actually *rendered*; and the one visible symptom — `/token` replying "This
 * authorization code has already been redeemed" — was attributed to React
 * StrictMode double-invoking an effect in dev, which is a real phenomenon and
 * was the wrong explanation. The loop was redeeming the code twice.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useContext, useEffect } from 'react'
import { SmartProvider } from './SmartProvider'
import { SmartContext } from './SmartContext'

/**
 * Records `setSmartData`'s identity on every render, and forces a re-render of
 * the PROVIDER — not of itself.
 *
 * ⚠️ **The first version of this probe bumped its own state, and the test could
 * not fail.** Re-rendering a child does not re-render its parent, so
 * `setSmartData`'s identity was never re-derived and the assertion passed with
 * `useCallback` removed. Caught by planting exactly that.
 *
 * `setError` is the lever: it writes provider state, which is what the real loop
 * does through `setSmartData`. Using it here needs no `Client` stub, and it
 * exercises the same re-render.
 */
function IdentityProbe({ onSample }: { onSample: (fn: unknown) => void }) {
  const ctx = useContext(SmartContext)

  onSample(ctx?.setSmartData)

  useEffect(() => {
    // One provider state change, the way a real consumer's would arrive.
    ctx?.setError(new Error('probe'))
    // Deliberately once: the point is a re-render, not a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

describe('SmartProvider — context identities are stable', () => {
  afterEach(() => cleanup())

  it('hands out the SAME setSmartData across a provider re-render', () => {
    const samples: unknown[] = []
    render(
      <SmartProvider>
        <IdentityProbe onSample={fn => samples.push(fn)} />
      </SmartProvider>,
    )

    // More than one render of the provider actually happened — otherwise the
    // comparison below is vacuous, which is how the first draft passed.
    expect(samples.length).toBeGreaterThan(1)
    // ⚠️ Identity IS the assertion. Without `useCallback` each entry here is a
    // different function, and a consumer effect depending on it re-runs forever.
    for (const sample of samples) {
      expect(sample).toBe(samples[0])
    }
  })

  it('hands out the same setError too', () => {
    // The sibling callback, for the same reason.
    const samples: unknown[] = []
    function ErrorProbe() {
      const ctx = useContext(SmartContext)
      samples.push(ctx?.setError)
      useEffect(() => {
        ctx?.setError(new Error('probe'))
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    }
    render(
      <SmartProvider>
        <ErrorProbe />
      </SmartProvider>,
    )
    expect(samples.length).toBeGreaterThan(1)
    for (const sample of samples) {
      expect(sample).toBe(samples[0])
    }
  })
})
