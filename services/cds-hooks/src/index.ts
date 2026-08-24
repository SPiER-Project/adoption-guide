/**
 * SPiER on Cloudflare Workers — single-Worker entry point.
 *
 * One Worker hosts everything:
 *   - the adoption-guide SPA, served from Static Assets (the `ASSETS` binding,
 *     directory ./web-dist — the web app's `vite build` output at base `/`);
 *   - the CDS Hooks 2.0 API under /cds-services/*;
 *   - a permanent /ig/* redirect to the rendered HL7 IG on GitHub Pages, which
 *     is its only host — see CANONICAL_IG_BASE
 *     (the IG is built there by the Java IG Publisher, not on this Worker).
 *
 * `run_worker_first` (wrangler.jsonc) means this handler sees every request:
 * Hono routes the API + redirect, and the catch-all delegates to ASSETS (which
 * does SPA fallback). App↔API calls are same-origin; external EHR/sandbox calls
 * to /cds-services get the wide-open CORS below.
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

/**
 * Canonical GitHub Pages home of the rendered IG (see the /ig redirect below).
 *
 * ⚠️ **This Worker does not and will not serve the IG, and that is a decision
 * rather than a pending migration.** `deploy.yml` runs the Java IG Publisher and
 * nests the render into the Pages artifact; the Cloudflare build only runs
 * `npm run build` here, so there is nothing to serve.
 * [`surfaces-and-distribution.md` §4](../../../docs/plans/surfaces-and-distribution.md)
 * recommends keeping it that way — Pages is free, the 254 MB render would be
 * pushed on every deploy, and `deploy.yml` uploads the SPA and the IG as ONE
 * Pages artifact, so moving the IG means unpicking a coupling for little gain.
 *
 * ⚠️ It also names the number nobody has measured: Static Assets caps **file
 * count**, not total bytes, and `find ig/output -type f | wc -l` has never been
 * run. So "it would fit" is not currently a claim anyone can make.
 */
const CANONICAL_IG_BASE = 'https://spier-project.github.io/adoption-guide/ig/'

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

// ── IG redirect (permanent) ──────────────────────────────────────────────────
// The rendered IG lives only on the canonical GitHub Pages site; the app's /ig/
// links (import.meta.env.BASE_URL + 'ig/') land here.
//
// ⚠️ **This said "transitional" and "during the migration" for a plan nobody
// held**, which is precisely what `surfaces-and-distribution.md` §4 warned the
// word would do: it invites the reader to assume the IG is on its way here. It
// was read that way and the question had to be answered by curling the live host.
// §4's recommendation is to treat the redirect as the permanent answer or file
// the move deliberately; this takes the first option. Filing the move is still
// open — it just needs to be a decision with the file-count measurement behind
// it, not an adjective.
app.get('/ig', (c) => c.redirect(CANONICAL_IG_BASE, 302))
app.get('/ig/*', (c) => {
  const rest = c.req.path.slice('/ig/'.length)
  return c.redirect(CANONICAL_IG_BASE + rest, 302)
})

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
