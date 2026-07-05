/**
 * HTTP-level tests against the Hono app's `fetch` directly — no Workers runtime,
 * no Vite dev server. This is the authoritative check of routing + CORS as the
 * deployed Worker will behave (the `vite dev` server answers OPTIONS with its
 * own default CORS, so a live curl against :5173 is not representative).
 */
import { describe, expect, it } from 'vitest'
import app from './index'
import type { CdsDiscoveryResponse } from './types'
import type { CdsServiceResponse } from '../../../web/src/lib/cdsHooks/types'

const BASE = 'http://cds.test'

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
    })
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
    })
    expect(res.status).toBe(400)
  })

  it('rejects a wrong hook with 400', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook: 'order-select', hookInstance: 'x', context: {} }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST feedback', () => {
  it('accepts feedback with 200', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: [{ card: 'abc', outcome: 'accepted' }] }),
    })
    expect(res.status).toBe(200)
  })
})
