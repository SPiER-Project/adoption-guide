/**
 * SPiER's Adoption Guide Worker — the guide SPA and the rendered IG.
 *
 * One Worker hosts two tenants, both from the SAME Static Assets binding
 * (`ASSETS`, directory ./web-dist — the `vite build` output at base `/`):
 *   - the Adoption Guide SPA;
 *   - the rendered HL7 IG under /ig/*, rendered by the Java IG Publisher in
 *     `deploy.yml` and staged into ./web-dist/ig by its `cloudflare` job —
 *     never built on this Worker.
 *
 * ⚠️ **The CDS Hooks API is NOT here any more (2026-09-20).** It moved to
 * `services/cds` on its own origin, because the IG, the Adoption Guide and the
 * clinical product demonstration are three separate offerings and the CDS
 * service is a fourth — something SPiER publishes for an adopter to configure
 * inside their own EHR, not a path on a documentation host. `app.test.ts`
 * asserts this Worker answers no `/cds-services` route, the same negative test
 * `services/clinical` already carried: "someone copies a route across for
 * parity" is the failure both are guarding against.
 *
 * ⚠️ **This is not the only Worker serving a SPiER SMART surface.**
 * `services/clinical` serves the `clinical` build (`dist-clinical`) on its own
 * origin — the two SMART apps, no guide routes, no synthetic patient. What the
 * two share about being an asset host lives in `packages/worker-http`.
 *
 * `run_worker_first` (wrangler.jsonc) means this handler sees every request,
 * and the catch-all delegates everything — SPA and IG alike — to ASSETS.
 */
import { Hono } from 'hono'
import origins from '../../../deploy-origins.json'
import { serveSpaAsset } from '@spier/worker-http/spaAssets'
import type { SpaAssetsEnv } from '@spier/worker-http/spaAssets'

/**
 * `SpaAssetsEnv` carries the Static Assets binding and the `frame-ancestors`
 * override. Both are shared with `services/clinical` through
 * `packages/worker-http` rather than declared twice — the clinical Worker is
 * the one a real EHR frames, so a policy that can differ between the two is a
 * clickjacking surface on exactly the copy nobody re-reads.
 */
type Env = SpaAssetsEnv

const app = new Hono<{ Bindings: Env }>()

// ── The rendered IG, the SPA, and what happens when neither has the file ────
//
// No /ig route. `deploy.yml`'s `cloudflare` job stages the IG Publisher's render
// into ./web-dist/ig, so the catch-all below serves it from Static Assets like
// any other file. Adopted 2026-09-18 (#533), reversing the 2026-08-23 decision
// in [`surfaces-and-distribution.md` §4](../../../docs/plans/surfaces-and-distribution.md).
//
// ⚠️ **`run_worker_first` means a re-added `app.get('/ig…')` silently shadows
// ~4,000 real files.** app.test.ts asserts none comes back.
//
// ⚠️ **A handful of IG files are too big for Static Assets and are NOT here.**
// The per-file cap is 25 MiB and `ig/output/full-ig.zip` is 36.8 MiB, so the
// stage step drops anything over the cap. It is dropped BY SIZE, never by name:
// #533 failed precisely because a by-name reading of the render ("the largest
// file is 8.88 MB") was measuring inside that zip rather than beside it, and a
// filename list would have encoded the same guess. Whatever is dropped falls
// back to Pages below, so every link on the IG's Downloads page still resolves.
//
// ⚠️ **This makes GitHub Pages a dependency, not a spare copy.** Retiring the
// Pages deploy breaks every URL this line redirects to — silently, because the
// target just stops answering. `surfaces-and-distribution.md` §4 justified
// keeping Pages on "it is free" for one PR after this became true; it now says
// what has to change before Pages can go.
//
// The Pages host itself comes from deploy-origins.json at the repo root — the
// one file every hosted origin is read from — imported relatively because this
// Worker deliberately has no `@spier/core` alias (it imports the asset layer
// and nothing else). `npm run check:origins` at the root fails a literal here.
const IG_FALLBACK_BASE = `${origins.pages}/ig/`

app.all('*', (c) => serveSpaAsset(c.req.raw, c.env, (url) =>
  // An IG path we do not hold is an oversized download; the canonical Pages
  // render has it. 302 rather than 301: what is too big is a property of this
  // deploy, not of the URL, and a permanent redirect would outlive it in
  // browser caches after the file shrinks or the cap rises.
  //
  // Returning `undefined` for everything else takes the shared SPA fallback.
  url.pathname.startsWith('/ig/')
    ? Response.redirect(IG_FALLBACK_BASE + url.pathname.slice('/ig/'.length) + url.search, 302)
    : undefined))

export default app
