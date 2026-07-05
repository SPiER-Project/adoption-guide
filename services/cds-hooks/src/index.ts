/**
 * SPiER on Cloudflare Workers — single-Worker entry point.
 *
 * One Worker hosts everything:
 *   - the adoption-guide SPA, served from Static Assets (the `ASSETS` binding,
 *     directory ./web-dist — the web app's `vite build` output at base `/`);
 *   - the CDS Hooks 2.0 API under /cds-services/*;
 *   - a transitional /ig/* redirect to the rendered HL7 IG on GitHub Pages
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
}

/** Canonical GitHub Pages home of the rendered IG (see /ig redirect below). */
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
  return c.json(buildPatientViewResponse(request))
})

// Feedback — accepted per spec but not persisted (stateless service).
app.post(`/cds-services/${SERVICE_ID}/feedback`, cdsJwt(), (c) => c.body(null, 200))

// ── IG redirect (transitional) ───────────────────────────────────────────────
// The rendered IG lives only on the canonical GitHub Pages site during the
// migration; the app's /ig/ links (import.meta.env.BASE_URL + 'ig/') land here.
app.get('/ig', (c) => c.redirect(CANONICAL_IG_BASE, 302))
app.get('/ig/*', (c) => {
  const rest = c.req.path.slice('/ig/'.length)
  return c.redirect(CANONICAL_IG_BASE + rest, 302)
})

// ── Static SPA (everything else) ─────────────────────────────────────────────
// Delegate to Static Assets; not_found_handling: single-page-application means
// unknown paths return index.html (harmless with the app's HashRouter).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
