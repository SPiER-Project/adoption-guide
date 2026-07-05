/**
 * SPiER CDS Hooks 2.0 service — Cloudflare Workers entry point.
 *
 * A thin, stateless Hono app over the pure logic in ./service.ts:
 *   GET  /cds-services                     → Discovery
 *   POST /cds-services/spier-patient-view          → patient-view cards
 *   POST /cds-services/spier-patient-view/feedback → feedback (accepted, not stored)
 *
 * CORS is wide open so the service is callable from the public CDS Hooks
 * Sandbox (https://sandbox.cds-hooks.org) and any EHR test harness.
 *
 * Spec: https://cds-hooks.org/specification/current/
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PATIENT_VIEW_SERVICE, SERVICE_ID, buildPatientViewResponse } from './service'
import type { CdsDiscoveryResponse, CdsHookRequest } from './types'

const app = new Hono()

// Wide-open CORS — the Sandbox and EHR test tools call this cross-origin.
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

// Health/landing — not part of the spec, handy for a browser sanity check.
app.get('/', (c) =>
  c.json({
    service: 'SPiER CDS Hooks',
    discovery: '/cds-services',
    spec: 'https://cds-hooks.org/specification/current/',
  }),
)

// Discovery.
app.get('/cds-services', (c) => {
  const body: CdsDiscoveryResponse = { services: [PATIENT_VIEW_SERVICE] }
  return c.json(body)
})

// patient-view invocation.
app.post(`/cds-services/${SERVICE_ID}`, async (c) => {
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

// Feedback — accepted per spec but not persisted (stateless demo service).
app.post(`/cds-services/${SERVICE_ID}/feedback`, (c) => c.body(null, 200))

export default app
