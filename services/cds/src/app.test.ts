/**
 * HTTP-level tests against the Hono app's `fetch` directly — no Workers runtime,
 * no Vite dev server. This is the authoritative check of routing + CORS as the
 * deployed Worker will behave (the `vite dev` server answers OPTIONS with its
 * own default CORS, so a live curl against :5173 is not representative).
 *
 * ⚠️ These moved out of the adoption-guide Worker on 2026-09-20 with the API
 * itself. There is no ASSETS binding here — this Worker serves JSON only.
 */
import { describe, expect, it } from 'vitest'
import app from './index'
import type { CdsDiscoveryResponse } from './types'
import type { CdsServiceResponse } from '@spier/core/lib/cdsHooks/types'

const BASE = 'http://cds.test'

/**
 * These tests exercise routing / CORS / card derivation, not auth — pin the JWT
 * policy to `off` so a bearer token is never required here. Bearer-JWT behavior
 * is covered in auth.test.ts.
 *
 * ⚠️ `SMART_LAUNCH_URL` is REQUIRED by the invoke route, which 500s without it
 * rather than falling back to this Worker's own origin — see src/index.ts. The
 * dedicated test below covers that branch.
 */
const NO_AUTH = { CDS_JWT_ENFORCE: 'off', SMART_LAUNCH_URL: 'https://clinical.test/' }

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
        context: { patientId: 'patient-003' },
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

describe('SMART_LAUNCH_URL is required', () => {
  /**
   * ⚠️ The regression this pins. The handler used to derive the launch URL from
   * its own request origin, which was right while one Worker served both the
   * API and the app and became wrong at the apps/ split (#552) without anything
   * going red. On a JSON-only Worker there is no origin worth substituting, so
   * an unset variable must fail loudly rather than ship cards that launch
   * nothing.
   */
  it('fails the invocation rather than guessing an origin', async () => {
    const res = await app.request(
      `${BASE}/cds-services/spier-patient-view`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hook: 'patient-view', hookInstance: 'x', context: { patientId: 'patient-001' } }),
      },
      { CDS_JWT_ENFORCE: 'off' },
    )
    expect(res.status).toBe(500)
    expect((await res.json<{ error: string }>()).error).toContain('SMART_LAUNCH_URL')
  })
})

describe('SMART launch links come from configuration, not the request origin', () => {
  /**
   * ⚠️ **This replaces a test that asserted the opposite, and the replaced one
   * is why the bug survived.** It read "SMART launch links come from the
   * request origin", justified by "one Worker serves the SPA and this API, so
   * the origin that reached us *is* the app's origin" — true when written, and
   * false from the apps/ split (#552) onward, because the cards' intents target
   * `/patient/assessments/*` and only `apps/clinical` registers `/patient`.
   *
   * It kept passing throughout: it checked the link URL equalled the REQUEST
   * origin, which stayed true, and never that the origin could route the
   * launch. An assertion that encodes an assumption cannot notice the
   * assumption expiring — so this one pins the configured value instead, and
   * asserts it is NOT the request origin.
   */
  it('points card launches at SMART_LAUNCH_URL, not at this Worker', async () => {
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hook: 'patient-view',
        hookInstance: 'test',
        context: { patientId: 'patient-003' },
      }),
    }, NO_AUTH)
    const body = (await res.json()) as CdsServiceResponse
    const links = body.cards.flatMap((c) => c.links ?? [])
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.type).toBe('smart')
      expect(link.url).toBe(NO_AUTH.SMART_LAUNCH_URL)
      expect(link.url).not.toContain(BASE)
      // The CDS client appends these; a service that invents them is
      // fabricating a launch context it does not have.
      expect(link.url).not.toContain('iss=')
      expect(link.url).not.toContain('launch=')
    }
  })
})
