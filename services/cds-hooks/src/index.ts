/**
 * SPiER on Cloudflare Workers — single-Worker entry point.
 *
 * One Worker hosts everything:
 *   - the adoption-guide SPA, served from Static Assets (the `ASSETS` binding,
 *     directory ./web-dist — the web app's `vite build` output at base `/`);
 *   - the CDS Hooks 2.0 API under /cds-services/*;
 *   - the rendered HL7 IG under /ig/*, served from those SAME Static Assets
 *     (rendered by the Java IG Publisher in `deploy.yml` and staged into
 *     ./web-dist/ig by its `cloudflare` job — never built on this Worker).
 *
 * `run_worker_first` (wrangler.jsonc) means this handler sees every request:
 * Hono routes the API, and the catch-all delegates everything else — SPA and
 * IG alike — to ASSETS (which does SPA fallback). App↔API calls are
 * same-origin; external EHR/sandbox calls to /cds-services get the wide-open
 * CORS below.
 *
 * CDS Hooks spec: https://cds-hooks.org/specification/current/
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { cdsJwt } from './auth'
import type { CdsJwtEnv, CdsJwtVariables } from './auth'
import { PATIENT_VIEW_SERVICE, SERVICE_ID, buildPatientViewResponse } from './service'
import type { CdsDiscoveryResponse, CdsHookRequest } from './types'

interface Env extends CdsJwtEnv {
  /** Static Assets binding — serves the built SPA from ./web-dist. */
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  /**
   * Space-separated `frame-ancestors` sources for the SPA. This is what lets
   * the mock EHR embed the app as a SMART panel; see the note below.
   */
  PANEL_FRAME_ANCESTORS?: string
}

/**
 * Who may embed this app in a frame.
 *
 * The embedded-panel work launches the app INSIDE a host chart on a different
 * origin, so framing has to be permitted deliberately. §6 of the panel plan
 * calls this "the first thing that will break", and it is worth knowing which
 * direction the breakage runs: with no CSP at all a browser frames this app
 * from anywhere, so adding this header can only ever REDUCE what works. If the
 * panel renders blank inside the mock EHR, this list is the first thing to
 * check — the browser console names the blocked ancestor exactly.
 *
 * 'self' keeps the app's own same-origin iframes working (the step-0 width spike
 * used one). Deliberately not a wildcard, which would make the header
 * decorative.
 */
const DEFAULT_FRAME_ANCESTORS = "'self' https://spier-mock-ehr.bbthorson.workers.dev"

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

// ── The rendered IG (/ig/*) ──────────────────────────────────────────────────
// No handler. `deploy.yml`'s `cloudflare` job stages the IG Publisher's render
// into ./web-dist/ig, so the catch-all below serves it from Static Assets like
// any other file. Adopted 2026-09-18, reversing the 2026-08-23 decision in
// [`surfaces-and-distribution.md` §4](../../../docs/plans/surfaces-and-distribution.md).
//
// ⚠️ **What reversed it was a measurement, not a preference.** §4 adopted "leave
// the IG on Pages" while flagging that the number which decides it had never
// been taken: Static Assets caps **file count and per-file size**, not total
// bytes. Counted from the published render's own `full-ig.zip`: **4,069 files,
// largest 8.88 MB** against limits of 20,000 files / 25 MiB per file. It fits
// with ~5x headroom, so re-litigating this needs a new count, not an opinion.
//
// ⚠️ A path under /ig/ that does not exist returns the SPA shell with **200**,
// not a 404 — `not_found_handling: "single-page-application"` (wrangler.jsonc)
// applies to every asset path, and GitHub Pages 404'd these. The app's routes
// are all hash routes, so switching to `"none"` would restore real 404s without
// breaking the SPA; that is a deliberate follow-up, not an oversight.

// ── Static SPA (everything else) ─────────────────────────────────────────────
// Delegate to Static Assets; not_found_handling: single-page-application means
// unknown paths return index.html (harmless with the app's HashRouter).
app.all('*', async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw)
  // Re-wrapped rather than returned directly: an asset response from the
  // binding has immutable headers, so the CSP cannot be attached in place.
  const response = new Response(asset.body, asset)
  response.headers.set(
    'content-security-policy',
    `frame-ancestors ${c.env.PANEL_FRAME_ANCESTORS || DEFAULT_FRAME_ANCESTORS}`,
  )
  return response
})

export default app
