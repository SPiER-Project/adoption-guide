/**
 * SPiER's clinical Worker — the two SMART apps, on their own origin.
 *
 * It serves one thing: `web/dist-clinical`, staged into ./web-dist. There is no
 * API here and no rendered IG; see `wrangler.jsonc` for why each is somewhere
 * else. Everything this file does about *being an asset host* — the Static
 * Assets catch-all, the explicit SPA fallback, the `frame-ancestors` CSP — is
 * `packages/worker-http`, shared with `services/cds-hooks`.
 *
 * ⚠️ **The shared module is not a tidiness move.** This is the Worker a real
 * EHR frames, so a `frame-ancestors` list that drifts from the guide Worker's
 * is a clickjacking surface here specifically — and here is the copy nobody
 * thinks to re-read after editing the other one. `scripts/check-worker-csp.mjs`
 * fails if either Worker grows its own.
 *
 * ⚠️ **Hono for one catch-all is deliberate.** It is two lines heavier than a
 * bare `export default { fetch }` and it means the next route added here is
 * added the same way it would be in the other two Workers. A Worker whose shape
 * differs from its siblings for no reason is the thing that makes someone copy
 * the wrong half of one into the other.
 */
import { Hono } from 'hono'
import { serveSpaAsset } from '@spier/worker-http/spaAssets'
import type { SpaAssetsEnv } from '@spier/worker-http/spaAssets'

const app = new Hono<{ Bindings: SpaAssetsEnv }>()

// No `onMiss`: the guide Worker passes one to send an oversized /ig/ download
// to the Pages render, and there is no /ig here to have a miss under. Every
// miss takes the SPA fallback.
app.all('*', (c) => serveSpaAsset(c.req.raw, c.env))

export default app
