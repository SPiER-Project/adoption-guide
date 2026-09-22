/**
 * SPiER's CDS Hooks Worker — the decision-support service, on its own origin.
 *
 * This serves the CDS Hooks 2.0 API under `/cds-services/*` and **nothing
 * else**: no SPA, no Static Assets binding, no `/ig/`. Every response is JSON.
 *
 * ─── Why this is its own Worker (2026-09-20) ────────────────────────────────
 *
 * It lived inside the adoption-guide Worker until now, and the recorded
 * position was that splitting it out "only becomes worth it when a real adopter
 * needs the endpoint URL". What changed is the framing: the IG, the Adoption
 * Guide and the clinical product demonstration are three **offerings**, and the
 * CDS service is a fourth thing — part of what SPiER *publishes*, not part of
 * either demo. Its URL is an integration contract an adopter configures inside
 * their own EHR, so it should not be a path on a Worker whose job is hosting a
 * documentation site and ~4,000 rendered IG files.
 *
 * Two concrete smells the move fixes:
 *
 *   - `CDS_JWT_AUDIENCE` was baked to the *adoption-guide* Worker's URL. A
 *     service's audience is its own identity; pointing it at the site that
 *     happened to host it is how that value goes stale unnoticed.
 *   - Every guide deploy redeployed the endpoint, and vice versa.
 *
 * ⚠️ **NOT folded into `services/clinical`, deliberately.** That Worker is the
 * one a real EHR frames, and `services/clinical/src/app.test.ts` carries a
 * NEGATIVE test that it hosts no `/cds-services` — because "someone copies a
 * route across for parity" is the failure this is guarding. A clinician-facing
 * SMART surface and a machine-facing API have different audiences, different
 * auth and different URLs. `services/guide/src/app.test.ts` now carries the
 * same negative test, for the same reason.
 *
 * ─── ⚠️ SMART_LAUNCH_URL is REQUIRED, and that is the point ─────────────────
 *
 * The invoke handler used to derive the launch URL from its own request:
 *
 *     const smartLaunchUrl = new URL('/', c.req.url).toString()
 *
 * justified by "one Worker serves the SPA and this API, so the origin of the
 * request that reached us IS the app's origin". The apps/ split (#552) made
 * that false and nothing noticed: the cards' intents target
 * `/patient/assessments/*`, which exist ONLY in `apps/clinical` — the guide app
 * has no `/patient` route at all — so every card's SMART launch had been
 * pointing at an origin that cannot route it. `check:surface-links` reads
 * in-app links and `check:catalog` resolves paths against route tables; neither
 * knows which WORKER serves a launch, so both stayed green.
 *
 * So it is configuration now, and it **throws when unset** rather than falling
 * back to this Worker's origin — which serves no app at all, and would turn a
 * missing variable into cards that launch nothing.
 *
 * CDS Hooks spec: https://cds-hooks.org/specification/current/
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { cdsJwt } from './auth'
import type { CdsJwtEnv, CdsJwtVariables } from './auth'
import { PATIENT_VIEW_SERVICE, SERVICE_ID, buildPatientViewResponse } from './service'
import type { CdsDiscoveryResponse, CdsHookRequest } from './types'

interface Env extends CdsJwtEnv {
  /** Origin of the SMART app a card's `type: "smart"` link launches. */
  SMART_LAUNCH_URL?: string
}

const app = new Hono<{ Bindings: Env; Variables: CdsJwtVariables }>()

// Wide-open CORS — the CDS Hooks Sandbox, EHR test tools and the guide's
// CdsServiceGuide page all call this cross-origin. Applied to both the bare
// discovery path and the sub-routes ('/cds-services/*' alone misses
// '/cds-services').
//
// ⚠️ The guide page's fetch became cross-origin at this split. It already
// worked, because this header was always `*` for the sandbox's benefit — but
// that is now load-bearing rather than incidental.
const apiCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
})
app.use('/cds-services', apiCors)
app.use('/cds-services/*', apiCors)

// Discovery.
//
// ⚠️ **Both spellings, and the slash is not pedantry.** The spec's path is
// `/cds-services`, and Hono matches it exactly — `/cds-services/` was a 404 with
// a 200 one character away. A person pasting the URL into a browser, a client
// that normalizes a base URL by appending a separator, and a proxy that
// canonicalizes a path all arrive at the second spelling, and the 404 they get
// is indistinguishable from "this service does not exist". Reported from a
// browser 2026-09-22.
const discovery = (c: Context) => {
  const body: CdsDiscoveryResponse = { services: [PATIENT_VIEW_SERVICE] }
  return c.json(body)
}
app.get('/cds-services', discovery)
app.get('/cds-services/', discovery)

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

  // ⚠️ 500 rather than a fallback. See the header: there is no origin this
  // Worker could substitute that would serve the app, so a quiet default would
  // ship cards whose only action is broken.
  const smartLaunchUrl = c.env.SMART_LAUNCH_URL
  if (!smartLaunchUrl) {
    return c.json(
      { error: 'SMART_LAUNCH_URL is not configured for this deployment; cards would launch nothing.' },
      500,
    )
  }
  return c.json(buildPatientViewResponse(request, { smartLaunchUrl }))
})

// Feedback — accepted per spec but not persisted (stateless service).
app.post(`/cds-services/${SERVICE_ID}/feedback`, cdsJwt(), (c) => c.body(null, 200))

// ⚠️ No catch-all, and no Static Assets binding. This Worker publishes an API;
// anything else is a 404 from Hono, which is the correct answer for a request
// that has wandered to the wrong origin. Adding an asset route here would also
// pull it into `check-worker-csp.mjs`'s rules 3 and 4, which exist for Workers
// that serve a framed SMART surface — this one never does.
export default app
