/**
 * The nightly reset — the Cron Trigger's handler, and the config that fires it.
 *
 * ⚠️ **The property worth holding is that the cron and the button are the SAME
 * reset**, not that a reset exists. Written data stays on this server because
 * the demo's claim is a write landing on a FHIR server (Brad, 2026-09-21), so
 * "forget the writes" now has two callers — and a second implementation of it
 * would be free to disagree about the two decisions `reset()` carries: the id
 * counter is not rewound, and the capability profile and the CDS signing key
 * survive. Those are asserted here THROUGH the scheduled path rather than
 * trusted because `write.test.ts` asserts them through the button.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import app from './app'
import worker, { scheduledReset } from './worker'
import { fakeStore } from './__fixtures__/store'
import type { Env } from './env'

describe('the nightly reset', () => {
  it('discards every written resource', async () => {
    const env = fakeStore()
    await env.state.add('patient-002', { resourceType: 'QuestionnaireResponse' })
    await env.state.add('patient-011', { resourceType: 'Observation' })
    expect((await env.state.list()).length).toBe(2)

    await scheduledReset(env as unknown as Env)

    expect(await env.state.list()).toEqual([])
  })

  it('leaves the capability profile alone, exactly as the button does', async () => {
    // A nightly job that silently re-armed the ladder would undo a degradation
    // a presenter set up the evening before — and would do it at 09:00 UTC,
    // invisibly. Same intention split the button's behaviour; same answer.
    const env = fakeStore()
    await env.state.setProfile('no-observation')
    await env.state.add('patient-011', { resourceType: 'Observation' })

    await scheduledReset(env as unknown as Env)

    expect(await env.state.getProfile()).toBe('no-observation')
  })

  it('leaves the CDS signing key alone — a nightly identity rotation is not a reset', async () => {
    // A verifier caches a JWK Set by `kid`. Rotating the key each night would
    // reject the host's first signed CDS call of the day until that cache
    // expired, which reads as a broken service.
    const env = fakeStore()
    const key = { kid: 'k1' } as unknown as Awaited<ReturnType<typeof env.state.getCdsKey>>
    await env.state.putCdsKeyIfAbsent(key!)

    await scheduledReset(env as unknown as Env)

    expect(await env.state.getCdsKey()).toEqual(key)
  })

  it('does not reuse ids afterwards', async () => {
    const env = fakeStore()
    const first = await env.state.add('patient-011', { resourceType: 'Observation' })
    await scheduledReset(env as unknown as Env)
    const next = await env.state.add('patient-011', { resourceType: 'Observation' })
    expect(next.id).not.toBe(first.id)
  })

  it('logs and returns when there is no DEMO_STORE binding, rather than throwing', async () => {
    // A thrown scheduled handler is a failed cron invocation Cloudflare retries,
    // and retrying buys nothing: an unbound namespace is still unbound in an
    // hour. Every request path already reports the missing binding to its caller.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(scheduledReset({} as Env)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DEMO_STORE'))
    warn.mockRestore()
  })
})

describe('the Worker still exports both halves', () => {
  it('exports a scheduled handler, which is what the cron needs', async () => {
    // ⚠️ `export default app` is the shape this replaced, and it is what a
    // later tidy-up would restore. A Hono app has `fetch` and no `scheduled`,
    // so the cron would fire into a Worker with no handler — an error in the
    // Cloudflare dashboard and nowhere a developer looks.
    expect(typeof worker.scheduled).toBe('function')
    const env = fakeStore()
    await env.state.add('patient-011', { resourceType: 'Observation' })
    await worker.scheduled!(
      null as unknown as Parameters<NonNullable<typeof worker.scheduled>>[0],
      env as unknown as Env,
      null as unknown as ExecutionContext,
    )
    expect(await env.state.list()).toEqual([])
  })

  it('still serves HTTP — the app is the fetch half, not a casualty of the object literal', async () => {
    const res = await worker.fetch!(
      new Request('https://mock-ehr.test/'),
      {} as Env,
      null as unknown as ExecutionContext,
    )
    expect(res.status).toBe(200)
  })
})

describe('the entry point still reaches it', () => {
  it('index.ts re-exports the handler object, not the Hono app', async () => {
    // ⚠️ Read as TEXT rather than imported, and that is forced rather than
    // lazy: `index.ts` value-exports the two Durable Object classes, which
    // import `cloudflare:workers` — unresolvable under Node, which is why
    // `worker.ts` exists at all. So the one thing no other assertion in this
    // file can see is whether the entry point still points at `worker.ts`, and
    // this is the only way left to look.
    const text = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(text).toMatch(/import worker from '\.\/worker'/)
    expect(text).toMatch(/export default worker/)
    expect(text).not.toMatch(/^export default app$/m)
  })
})

describe('the pages say so', () => {
  // ⚠️ A job nobody is told about is indistinguishable from data loss. A
  // presenter who set up a degraded chart last night and finds it clean this
  // morning needs the page to have said it would be, and a visitor who finds a
  // chart three steps past its story needs to know that tomorrow fixes it.
  /**
   * The page's HTML with runs of whitespace collapsed. A sentence in a template
   * literal is wrapped wherever the source line ran out, so asserting on a
   * phrase means asserting on today's line breaks unless this is done first.
   */
  async function bodyOf(path: string) {
    const res = await app.request(`https://mock-ehr.test${path}`)
    expect(res.status).toBe(200)
    return (await res.text()).replace(/\s+/g, ' ')
  }

  it('the front door\'s drawer says written data clears nightly, and points at the button', async () => {
    const body = await bodyOf('/')
    expect(body).toContain('cleared automatically every night')
    expect(body).toContain('Reset written data')
  })

  it('/settings says it beside the button that does it now', async () => {
    const body = await bodyOf('/settings')
    expect(body).toContain('cleared automatically every night')
    // Both statements on one page: the nightly job and the manual control are
    // the same clearance, and the page has to read that way.
    expect(body).toContain('id="reset-writes"')
  })
})

describe('the Cron Trigger itself', () => {
  it('is declared in wrangler.jsonc, or the handler never runs', async () => {
    // The handler above is testable and the schedule is not, so this is the
    // half a test can hold: a `scheduled` export with no `triggers.crons` is
    // dead code that every assertion in this file passes against.
    const text = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
    const config = JSON.parse(
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
    ) as { triggers?: { crons?: string[] } }
    const crons = config.triggers?.crons ?? []
    expect(crons.length).toBe(1)
    // Five fields, once a day, at a fixed hour — not a wildcard minute that
    // would clear the store mid-demo sixty times an hour.
    expect(crons[0]).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/)
  })
})
