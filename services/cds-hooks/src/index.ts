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

app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const asset = await c.env.ASSETS.fetch(c.req.raw)

  // `not_found_handling: "none"` (wrangler.jsonc) means a miss is a real 404,
  // which is what lets these two cases be told apart at all.
  if (asset.status === 404) {
    // An IG path we do not hold is an oversized download; the canonical Pages
    // render has it. 302 rather than 301: what is too big is a property of this
    // deploy, not of the URL, and a permanent redirect would outlive it in
    // browser caches after the file shrinks or the cap rises.
    if (url.pathname.startsWith('/ig/')) {
      return c.redirect(IG_FALLBACK_BASE + url.pathname.slice('/ig/'.length) + url.search, 302)
    }
    // Everything else keeps the SPA fallback the binding used to do for us.
    // The app is a HashRouter, so this is near-vestigial — but removing it would
    // turn a stray /foo from "the app loads" into a 404, which is a user-visible
    // change this file has no reason to make while fixing downloads.
    // A plain GET, not a clone of the inbound request: this path is reached by
    // any method, and replaying a POST at the index is not what SPA fallback
    // meant. Status is whatever the index asset returns, so a missing index
    // surfaces as an error rather than a 200 with no body.
    const index = await c.env.ASSETS.fetch(new Request(new URL('/', url).toString()))
    return withCsp(index, c.env)
  }

  return withCsp(asset, c.env)
})

/**
 * Re-wrap an asset response so the CSP can be attached: a response from the
 * binding has immutable headers, so it cannot be set in place.
 *
 * ⚠️ `new Response(body, asset)` rather than `{ ...asset }` — a Response's
 * status/headers live on the prototype as getters, so spreading one yields an
 * empty object and silently resets the status to 200.
 */
function withCsp(asset: Response, env: Env): Response {
  const response = new Response(asset.body, asset)
  response.headers.set(
    'content-security-policy',
    `frame-ancestors ${env.PANEL_FRAME_ANCESTORS || DEFAULT_FRAME_ANCESTORS}`,
  )
  return response
}

export default app
