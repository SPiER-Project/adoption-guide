/**
 * SPiER's adoption-guide Worker — the `demo` surface, the API and the IG.
 *
 * One Worker hosts three tenants:
 *   - the adoption-guide SPA, served from Static Assets (the `ASSETS` binding,
 *     directory ./web-dist — the web app's `vite build` output at base `/`);
 *   - the CDS Hooks 2.0 API under /cds-services/*;
 *   - the rendered HL7 IG under /ig/*, served from those SAME Static Assets
 *     (rendered by the Java IG Publisher in `deploy.yml` and staged into
 *     ./web-dist/ig by its `cloudflare` job — never built on this Worker).
 *
 * ⚠️ **This is no longer the only Worker serving a SPiER SMART surface.**
 * `services/clinical` serves the `clinical` build (`dist-clinical`) on its
 * own origin — the two SMART apps, no guide routes, no synthetic patient. It
 * deliberately hosts NEITHER /cds-services nor /ig: the endpoint's only runtime
 * caller is `CdsServiceGuide.tsx`, a guide page that is not in that build, and
 * `CDS_JWT_AUDIENCE` is baked to this Worker's published URL. Everything the
 * two DO share about being an asset host lives in `packages/worker-http`.
 *
 * `run_worker_first` (wrangler.jsonc) means this handler sees every request:
 * Hono routes the API, and the catch-all delegates everything else — SPA and
 * IG alike — to ASSETS. App↔API calls are same-origin; external EHR/sandbox
 * calls to /cds-services get the wide-open CORS below.
 *
 * CDS Hooks spec: https://cds-hooks.org/specification/current/
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { cdsJwt } from './auth'
import type { CdsJwtEnv, CdsJwtVariables } from './auth'
import { PATIENT_VIEW_SERVICE, SERVICE_ID, buildPatientViewResponse } from './service'
import type { CdsDiscoveryResponse, CdsHookRequest } from './types'
import { serveSpaAsset } from '@spier/worker-http/spaAssets'
import type { SpaAssetsEnv } from '@spier/worker-http/spaAssets'

/**
 * `SpaAssetsEnv` carries the Static Assets binding and the `frame-ancestors`
 * override. Both are shared with `services/clinical` through
 * `packages/worker-http` rather than declared twice — the clinical Worker is
 * the one a real EHR frames, so a policy that can differ between the two is a
 * clickjacking surface on exactly the copy nobody re-reads.
 */
interface Env extends CdsJwtEnv, SpaAssetsEnv {}

const app = new Hono<{ Bindings: Env; Variables: CdsJwtVariables }>()

// Wide-open CORS on the API only (assets don't need it) — the CDS Hooks Sandbox
// and EHR test tools call /cds-services cross-origin. Applied to both the bare
// discovery path and the sub-routes ('/cds-services/*' alone misses '/cds-services').
const apiCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
})
app.use('/cds-services', apiCors)
app.use('/cds-services/*', apiCors)

// ── CDS Hooks API ────────────────────────────────────────────────────────────

// Discovery.
app.get('/cds-services', (c) => {
  const body: CdsDiscoveryResponse = { services: [PATIENT_VIEW_SERVICE] }
  return c.json(body)
})

// patient-view invocation — bearer JWT validated per CDS_JWT_ENFORCE policy
// (discovery above stays open; feedback below is likewise guarded).
app.post(`/cds-services/${SERVICE_ID}`, cdsJwt(), async (c) => {
  let request: CdsHookRequest
  try {
    request = await c.req.json<CdsHookRequest>()
  } catch {
    return c.json({ error: 'Request body must be valid JSON.' }, 400)
  }
  if (request?.hook !== 'patient-view') {
    return c.json({ error: `This service handles the 'patient-view' hook, got '${request?.hook}'.` }, 400)
  }
  // The app's launch_uri is this Worker's own root — one Worker serves the SPA
  // and this API, so the origin of the request that reached us IS the app's
  // origin. Derived rather than configured: a wrong value here would produce
  // cards that launch someone else's app, and there is no second place for it to
  // go stale.
  const smartLaunchUrl = new URL('/', c.req.url).toString()
  return c.json(buildPatientViewResponse(request, { smartLaunchUrl }))
})

// Feedback — accepted per spec but not persisted (stateless service).
app.post(`/cds-services/${SERVICE_ID}/feedback`, cdsJwt(), (c) => c.body(null, 200))

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
const IG_FALLBACK_BASE = 'https://spier-project.github.io/adoption-guide/ig/'

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
