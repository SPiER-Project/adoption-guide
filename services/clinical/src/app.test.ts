/**
 * HTTP-level tests against the Hono app's `fetch` directly — no Workers
 * runtime, no wrangler. The Static Assets binding is stubbed, which is the only
 * way to control whether a path is a hit or a real 404.
 *
 * Two of these are NEGATIVE assertions about what this Worker does not host,
 * and they are the load-bearing ones. `/cds-services` and `/ig/` both resolve
 * on the adoption-guide Worker, so the failure they guard is someone copying a
 * route across "for parity" — which would put a second CDS endpoint on an
 * origin `CDS_JWT_AUDIENCE` does not name, and ~4,000 files of implementer
 * documentation inside a clinician's app.
 */
import { describe, expect, it } from 'vitest'
import app from './index'
import { DEFAULT_FRAME_ANCESTORS } from '@spier/worker-http/spaAssets'

const BASE = 'http://clinical.test'

/** An index that exists; everything else is a real 404, as `not_found_handling: "none"` gives. */
const indexOnly = {
  fetch: async (req: Request) => new URL(req.url).pathname === '/'
    ? new Response('<!doctype html><title>SPiER</title>', { headers: { 'content-type': 'text/html' } })
    : new Response('not found', { status: 404 }),
}

/** Every path is a hit. */
const everything = {
  fetch: async (req: Request) =>
    new Response(`asset:${new URL(req.url).pathname}`, { headers: { 'content-type': 'text/plain' } }),
}

describe('the SPA', () => {
  it('serves the index', async () => {
    const res = await app.request(`${BASE}/`, {}, { ASSETS: indexOnly })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<!doctype html>')
  })

  it('passes the request path through unchanged, so hashed assets resolve', async () => {
    const res = await app.request(`${BASE}/assets/index-abc123.js`, {}, { ASSETS: everything })
    expect(await res.text()).toBe('asset:/assets/index-abc123.js')
  })

  it('falls back to the index on a miss, because the binding no longer does', async () => {
    const res = await app.request(`${BASE}/some/unknown/path`, {}, { ASSETS: indexOnly })
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.text()).toContain('<!doctype html>')
  })

  it('preserves a non-404 status rather than resetting it to 200', async () => {
    // `new Response(body, { ...asset })` spreads a Response into an empty
    // object and turns a 503 into a 200. The shared module uses
    // `new Response(body, asset)`; this is what says so.
    const broken = { fetch: async () => new Response('upstream boom', { status: 503 }) }
    const res = await app.request(`${BASE}/anything.js`, {}, { ASSETS: broken })
    expect(res.status).toBe(503)
  })
})

describe('frame-ancestors — this is the Worker a real EHR frames', () => {
  it('attaches the shared default to a served asset', async () => {
    const res = await app.request(`${BASE}/`, {}, { ASSETS: indexOnly })
    expect(res.headers.get('content-security-policy')).toBe(`frame-ancestors ${DEFAULT_FRAME_ANCESTORS}`)
  })

  it('attaches it to the SPA fallback too', async () => {
    const res = await app.request(`${BASE}/some/unknown/path`, {}, { ASSETS: indexOnly })
    expect(res.headers.get('content-security-policy')).toContain('frame-ancestors')
  })

  it('is never a wildcard by default', async () => {
    // A `frame-ancestors *` makes the header decorative. Asserted here as well
    // as in the guide Worker's tests: this is the copy that matters.
    const res = await app.request(`${BASE}/`, {}, { ASSETS: indexOnly })
    expect(res.headers.get('content-security-policy')).not.toContain('*')
  })

  it('is overridable per environment', async () => {
    const res = await app.request(`${BASE}/`, {}, {
      ASSETS: indexOnly,
      PANEL_FRAME_ANCESTORS: "'self' https://staging.test",
    })
    expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self' https://staging.test")
  })
})

describe('what this Worker deliberately does not host', () => {
  // Both of these exist on the adoption-guide Worker. The failure being guarded
  // is a route copied across for parity — so the assertion has to be that the
  // path reaches the ASSETS binding like any other, not that it 404s (under the
  // SPA fallback a miss is a 200 either way, which would pass vacuously).
  const seen: string[] = []
  const spy = {
    fetch: async (req: Request) => {
      seen.push(new URL(req.url).pathname)
      return new Response('asset', { headers: { 'content-type': 'text/plain' } })
    },
  }

  it('has no CDS Hooks endpoint — /cds-services is just a path to the binding', async () => {
    seen.length = 0
    const res = await app.request(`${BASE}/cds-services`, {}, { ASSETS: spy })
    expect(seen).toEqual(['/cds-services'])
    expect(res.headers.get('content-type')).not.toContain('application/json')
    expect(await res.text()).toBe('asset')
  })

  it('does not answer a CDS invoke', async () => {
    seen.length = 0
    const res = await app.request(`${BASE}/cds-services/spier-patient-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hook: 'patient-view', hookInstance: 'x', context: { patientId: 'patient-006' } }),
    }, { ASSETS: spy })
    expect(seen).toEqual(['/cds-services/spier-patient-view'])
    expect(await res.text()).not.toContain('cards')
  })

  it('has no /ig route and no Pages redirect', async () => {
    seen.length = 0
    const res = await app.request(`${BASE}/ig/full-ig.zip`, {}, { ASSETS: indexOnly })
    // indexOnly 404s it, so a redirect handler would show up as a 302 here.
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.text()).toContain('<!doctype html>')
  })
})

describe('SMART launch routes are the app’s, not the Worker’s', () => {
  // `main.tsx` bootstraps `?iss=&launch=` into `#/launch` before the router
  // mounts, and OAuth redirect URIs cannot carry a fragment — so the registered
  // URI is the bare base and the Worker must simply serve the index for it,
  // query string and all.
  it('serves the index for a launch, carrying no opinion about the query', async () => {
    const res = await app.request(
      `${BASE}/?iss=https%3A%2F%2Fapi.medplum.com%2Ffhir%2FR4&launch=abc`,
      {},
      { ASSETS: indexOnly },
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<!doctype html>')
  })
})
