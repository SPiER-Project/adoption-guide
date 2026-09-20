/**
 * app — the mock EHR's HTTP surface.
 *
 *   GET  /fhir/.well-known/smart-configuration  discovery
 *   GET  /fhir/metadata           CapabilityStatement (the degradation switch)
 *   GET  /fhir/{Type}/{id}        read
 *   GET  /fhir/{Type}?patient=…   patient-scoped search → searchset Bundle
 *   POST /fhir/{Type}             create — capability-gated and VALIDATED
 *   PUT  /fhir/{Type}/{id}        update an EXISTING resource — 404 otherwise
 *   GET  /authorize               SMART authorization (PKCE S256 required)
 *   POST /token                   authorization_code → access token
 *   GET  /                        control page: capability profile + launch
 *   GET  /chart                   host chrome: the patient list
 *   GET  /chart/{id}              host chrome: one chart, with the panel framed
 *   GET  /_admin/capabilities     the profile, as JSON
 *   PUT  /_admin/capabilities     set it
 *   POST /_admin/launch           mint a launch context + the app's launch URL
 *   GET  /_admin/writes           what has been written, as JSON
 *   POST /_admin/reset            discard every write
 *   POST /fhircast                FHIRcast subscription (websocket channel)
 *   GET  /fhircast/ws             the subscribed WebSocket channel
 *   POST /fhircast/{topic}        publish a context change; hub fans it out
 *   GET  /_admin/fhircast         live hub stats
 *
 * ── Deliberately absent ─────────────────────────────────────────────────────
 * No `id_token` and no scope enforcement — see the header of smart.ts, which
 * says exactly what the auth stub does and does not prove. No update, no delete,
 * no transaction Bundle: the writeback ladder POSTs one resource at a time, and
 * an endpoint nothing exercises is an endpoint nobody has watched reject
 * anything.
 *
 * ── CORS is not optional here ───────────────────────────────────────────────
 * The panel is a browser app on a DIFFERENT origin talking to this server
 * directly — that cross-origin split is the point of the exercise, not an
 * accident. Without these headers every read fails in the browser while every
 * curl succeeds, which is the most misleading way for this to break.
 */
import { Hono } from 'hono'
import type { AppEnv } from './env'
import { FHIR_JSON, operationOutcome } from './fhirResponses'
import { fhirRoutes } from './routes/fhir'
import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { fhircastRoutes } from './routes/fhircast'
import { cdsRoutes } from './routes/cds'
import { pageRoutes } from './routes/pages'

// The profile seam the tests reach through this module, as they always have.
export { getProfile, setProfile, resetProfile } from './profile'
export type { Env } from './env'

/*
 * ⚠️ **This file composes; it does not handle.** Until 2026-09-20 it was 1,185
 * lines — CORS, the bearer check, the FHIR API, SMART auth, the operator
 * surface, the FHIRcast hub, the CDS client and the HTML pages in one module,
 * with 29 routes and every shared helper between them. The six modules under
 * `routes/` each own one of those surfaces; `env.ts`, `profile.ts` and
 * `fhirResponses.ts` hold what more than one of them needs.
 *
 * Each route module is a `Hono<AppEnv>` mounted at `/` with its FULL paths, not
 * a sub-app mounted at a prefix. That is deliberate: Hono's `/fhir/*` does not
 * match `/fhir` itself, which is why the FHIR module registers both, and a
 * prefix mount would have re-opened exactly that question for every module.
 * Mounting at `/` keeps each path identical to what the 1,185-line file
 * registered, so the tests — which drive `app.request()` against those paths —
 * are the proof the split changed nothing.
 *
 * Order matters in two places and both are preserved here: the FHIR module's
 * literal paths (`/metadata`, discovery) are registered before its `:type`
 * params inside that module, and the 404 catch-all below is registered last.
 */
const app = new Hono<AppEnv>()

app.route('/', fhirRoutes)
app.route('/', authRoutes)
app.route('/', adminRoutes)
app.route('/', fhircastRoutes)
app.route('/', cdsRoutes)
app.route('/', pageRoutes)

app.all('*', (c) => {
  c.header('content-type', FHIR_JSON)
  return c.body(
    JSON.stringify(operationOutcome('error', 'not-found', `No route for ${c.req.method} ${new URL(c.req.url).pathname}. The FHIR base is /fhir.`)),
    404,
  )
})

export default app
