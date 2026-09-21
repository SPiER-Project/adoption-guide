/**
 * The Worker's two handlers: HTTP, and the nightly Cron Trigger.
 *
 * ⚠️ **Separate from `index.ts` for the reason `store.ts` is separate from
 * `demoStore.ts`.** The entry point has to VALUE-export the Durable Object
 * classes — that is how the runtime resolves `class_name` — and those import
 * `cloudflare:workers`, which does not resolve outside the Workers runtime. A
 * test that imported `index.ts` to check the scheduled handler would fail on
 * "Cannot find package 'cloudflare:workers'", which reads as a missing
 * dependency rather than a missing runtime. Everything testable lives here;
 * `index.ts` is the runtime binding.
 */
import app from './app'
import { storeFor } from './store'
import type { Env } from './env'

/**
 * The nightly reset (Cron Trigger in `wrangler.jsonc`).
 *
 * ⚠️ **Why written data stays on the server at all.** Moving it into the
 * browser would make every chart clean for every visitor and would also delete
 * the demo's point: what it shows is a write landing on a FHIR server, with the
 * host's own write log corroborating the panel's scorecard. Two independent
 * statements about the same event is the difference between a demo and an
 * assertion, and one of the two has to be the server's (Brad, 2026-09-21).
 *
 * The cost is that one visitor's writes are the next visitor's chart: the front
 * door says Marcus Chen has nothing on file and he opens three steps in. That
 * is answered in three places now — this job clears the store each night, the
 * chart says so when it has been written to since its story was true
 * (`client/chart.ts`), and *Reset written data* on `/settings` is still there
 * for a presenter who cannot wait until tomorrow.
 *
 * ⚠️ **It calls the SAME `reset()` the button calls**, rather than reaching
 * into storage. Two paths meaning "forget the writes" are two paths that can
 * disagree about what a write is — and `reset()` carries two decisions a second
 * implementation would be free to get wrong: the id counter is NOT rewound (a
 * stale `srv-1` resolving to a different resource is what makes a demo look
 * haunted) and the capability profile and the CDS signing key survive, because
 * "forget the data" is not "re-arm the ladder" and is certainly not "rotate
 * this host's published identity" — a verifier caches a JWK Set by `kid`.
 *
 * ⚠️ **A missing binding is logged, not thrown.** A scheduled handler that
 * throws is a failed cron invocation Cloudflare retries, which buys nothing
 * here: an unbound namespace is still unbound in an hour. Every request path
 * already reports the missing binding to whoever asked.
 */
export async function scheduledReset(env: Env): Promise<void> {
  const store = storeFor(env)
  if (!store) {
    console.warn('[mock-ehr] nightly reset skipped: no DEMO_STORE binding')
    return
  }
  const discarded = await store.reset()
  console.log(`[mock-ehr] nightly reset: discarded ${discarded} written resource(s)`)
}

/**
 * ⚠️ **A handler OBJECT rather than the Hono app, and the `fetch` property is
 * the whole reason.** A Worker with a Cron Trigger must export a `scheduled`
 * handler; a Hono app is not one, so the app becomes the `fetch` half.
 * `app.fetch` is bound by Hono, so passing the reference is safe — but
 * simplifying this back to `export default app` would drop `scheduled` and the
 * cron would fire into a Worker with no handler for it, which Cloudflare
 * reports in its dashboard and nowhere a developer looks.
 */
export default {
  fetch: app.fetch,
  scheduled: async (_controller, env: Env, _ctx) => { await scheduledReset(env) },
} satisfies ExportedHandler<Env>
