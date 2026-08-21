/**
 * HTTP-level tests against the Hono app's `fetch` directly — no Workers runtime,
 * no Vite dev server. This is the authoritative check of routing + CORS as the
 * deployed Worker will behave (the `vite dev` server answers OPTIONS with its
 * own default CORS, so a live curl against :5173 is not representative).
 */
import { describe, expect, it } from 'vitest'
import app from './index'
import type { CdsDiscoveryResponse } from './types'
import type { CdsServiceResponse } from '@spier/core/lib/cdsHooks/types'

const BASE = 'http://cds.test'

// These tests exercise routing / CORS / card derivation, not auth — pin the JWT
// policy to `off` (with a stub ASSETS binding) so a bearer token is never
// required here. Bearer-JWT behavior is covered in auth.test.ts.
const NO_AUTH = { ASSETS: { fetch: async () => new Response(null) }, CDS_JWT_ENFORCE: 'off' }

describe('GET /cds-services (discovery)', () => {
  it('returns the patient-view service with CORS', async () => {
    const res = await app.request(`${BASE}/cds-services`, {
      headers: { Origin: 'https://sandbox.cds-hooks.org' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = (await res.json()) as CdsDiscoveryResponse
    expect(body.services).toHaveLength(1)
    expect(body.services[0]?.hook).toBe('patient-view')
  })
})

describe('OPTIONS preflight', () => {
  it('answers with the configured origin, methods, and headers', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://sandbox.cds-hooks.org',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,OPTIONS')
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type,Authorization')
  })
})

describe('POST /cds-services/spier-patient-view', () => {
  it('returns cards for a bundled patient with CORS', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://sandbox.cds-hooks.org' },
      body: JSON.stringify({
        hook: 'patient-view',
        hookInstance: 'test',
        context: { patientId: 'patient-006' },
      }),
    }, NO_AUTH)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = (await res.json()) as CdsServiceResponse
    expect(body.cards.length).toBeGreaterThan(0)
  })

  it('rejects a non-JSON body with 400', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }, NO_AUTH)
    expect(res.status).toBe(400)
  })

  it('rejects a wrong hook with 400', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook: 'order-select', hookInstance: 'x', context: {} }),
    }, NO_AUTH)
    expect(res.status).toBe(400)
  })
})

describe('POST feedback', () => {
  it('accepts feedback with 200', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: [{ card: 'abc', outcome: 'accepted' }] }),
    }, NO_AUTH)
    expect(res.status).toBe(200)
  })
})

describe('frame-ancestors (the SMART panel is embedded cross-origin)', () => {
  const ASSETS = { fetch: async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }) }

  it('lets the mock EHR frame the app, and nobody else by default', async () => {
    const res = await app.request(`${BASE}/`, {}, { ...NO_AUTH, ASSETS })
    const csp = res.headers.get('content-security-policy')
    expect(csp).toContain('frame-ancestors')
    expect(csp).toContain('https://spier-mock-ehr.bbthorson.workers.dev')
    expect(csp).toContain("'self'")
    // Deliberately NOT a wildcard: a `frame-ancestors *` would let anything
    // embed the app, which is the shortcut that makes the header decorative.
    expect(csp).not.toContain('*')
  })

  it('is overridable per environment', async () => {
    const res = await app.request(`${BASE}/`, {}, {
      ...NO_AUTH,
      ASSETS,
      PANEL_FRAME_ANCESTORS: "'self' https://staging.test",
    })
    expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self' https://staging.test")
  })

  it('still serves the asset body', async () => {
    const res = await app.request(`${BASE}/`, {}, { ...NO_AUTH, ASSETS })
    expect(await res.text()).toContain('<!doctype html>')
  })
})

describe('SMART launch links come from the request origin', () => {
  /**
   * The launch URL is DERIVED from the request rather than configured, and this
   * is the assertion that keeps it that way. One Worker serves the SPA and this
   * API, so the origin that reached us *is* the app's origin; a second env var
   * would be a place for the two to disagree after a redeploy.
   */
  it('points card launches at this Worker’s own root', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hook: 'patient-view',
        hookInstance: 'test',
        context: { patientId: 'patient-006' },
      }),
    }, NO_AUTH)
    const body = (await res.json()) as CdsServiceResponse
    const links = body.cards.flatMap(c => c.links ?? [])
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.type).toBe('smart')
      expect(link.url).toBe(`${BASE}/`)
      // The CDS client appends these; a service that invents them is
      // fabricating a launch context it does not have.
      expect(link.url).not.toContain('iss=')
      expect(link.url).not.toContain('launch=')
    }
  })
})
