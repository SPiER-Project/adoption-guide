/**
 * HTTP-level tests against the Hono app's `fetch` directly — no Workers runtime,
 * no Vite dev server.
 *
 * ⚠️ The CDS Hooks tests left with the API on 2026-09-20 (services/cds). What
 * stays is this Worker's real job — the frame-ancestors header, the rendered IG,
 * and the oversized-download fallback — plus the NEGATIVE test that it hosts no
 * CDS endpoint, mirroring the one services/clinical already carried. "Someone
 * copies a route across for parity" is the failure both are guarding.
 */
import { describe, expect, it } from 'vitest'
import app from './index'

const BASE = 'http://guide.test'

describe('frame-ancestors (the SMART panel is embedded cross-origin)', () => {
  const ASSETS = { fetch: async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }) }

  it('lets the mock EHR frame the app, and nobody else by default', async () => {
    const res = await app.request(`${BASE}/`, {}, { ASSETS })
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
      ASSETS,
      PANEL_FRAME_ANCESTORS: "'self' https://staging.test",
    })
    expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self' https://staging.test")
  })

  it('still serves the asset body', async () => {
    const res = await app.request(`${BASE}/`, {}, { ASSETS })
    expect(await res.text()).toContain('<!doctype html>')
  })
})

describe('the rendered IG is served, not redirected', () => {
  // Until 2026-09-18 these paths 302'd to GitHub Pages, which was the IG's only
  // host. `deploy.yml`'s `cloudflare` job now stages the render into web-dist/ig,
  // so they must resolve through the ASSETS binding like any other file.
  //
  // This is a ROUTING assertion, and the thing it guards is a re-added handler:
  // `run_worker_first` means Hono sees every request, so any `app.get('/ig...')`
  // registered before the catch-all silently shadows ~4,000 real files.
  const igAsset = { fetch: async () => new Response('<html>IG page</html>', { headers: { 'content-type': 'text/html' } }) }

  it('serves /ig/ from Static Assets', async () => {
    const res = await app.request(`${BASE}/ig/index.html`, {}, { ASSETS: igAsset })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('IG page')
  })

  it('does not redirect a file it holds', async () => {
    for (const path of ['/ig', '/ig/', '/ig/StructureDefinition-spier-phq9.html']) {
      const res = await app.request(`${BASE}${path}`, {}, { ASSETS: igAsset })
      expect(res.status, path).toBe(200)
      expect(res.headers.get('location'), path).toBeNull()
    }
  })

  it('passes the request through unchanged, so nested IG paths resolve', async () => {
    let seen = ''
    const spy = { fetch: async (req: Request) => { seen = new URL(req.url).pathname; return new Response('ok') } }
    await app.request(`${BASE}/ig/assets/js/mermaid.js`, {}, { ASSETS: spy })
    expect(seen).toBe('/ig/assets/js/mermaid.js')
  })
})

describe('oversized IG downloads fall back to Pages', () => {
  // ig/output/full-ig.zip is 36.8 MiB against a 25 MiB per-file cap, so the
  // stage step drops it and this is what keeps its link working. #533 deployed
  // without this and wrangler refused the whole upload.
  //
  // The binding is asked for the file FIRST and only a real 404 triggers the
  // fallback — which is why wrangler.jsonc sets `not_found_handling: "none"`.
  // Under the previous "single-page-application" the binding answered a missing
  // download with index.html and a 200, and the browser saved HTML as a .zip.
  const missing = { fetch: async (req: Request) => new URL(req.url).pathname === '/'
    ? new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
    : new Response('not found', { status: 404 }) }

  it('redirects an IG file this deploy does not hold to the Pages render', async () => {
    const res = await app.request(`${BASE}/ig/full-ig.zip`, {}, { ASSETS: missing })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://spier-project.github.io/adoption-guide/ig/full-ig.zip')
  })

  it('carries the query string across', async () => {
    const res = await app.request(`${BASE}/ig/full-ig.zip?v=2`, {}, { ASSETS: missing })
    expect(res.headers.get('location')).toBe('https://spier-project.github.io/adoption-guide/ig/full-ig.zip?v=2')
  })

  it('does NOT send a non-IG miss to the IG host — that keeps the SPA fallback', async () => {
    const res = await app.request(`${BASE}/some/unknown/path`, {}, { ASSETS: missing })
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.text()).toContain('<!doctype html>')
  })

  it('still attaches the CSP to the fallback index', async () => {
    const res = await app.request(`${BASE}/some/unknown/path`, {}, { ASSETS: missing })
    expect(res.headers.get('content-security-policy')).toContain('frame-ancestors')
  })

  it('preserves a non-404 status rather than resetting it to 200', async () => {
    // The re-wrap used to be written as `new Response(body, { ...asset })`,
    // which spreads a Response into an empty object and turns a 500 into a 200.
    const broken = { fetch: async () => new Response('upstream boom', { status: 503 }) }
    const res = await app.request(`${BASE}/anything.js`, {}, { ASSETS: broken })
    expect(res.status).toBe(503)
  })
})

describe('the CDS Hooks API is NOT on this Worker', () => {
  /**
   * The mirror of the test in services/clinical. `/cds-services` must reach the
   * asset binding like any other path — never a JSON handler. A second endpoint
   * here would sit on an origin `CDS_JWT_AUDIENCE` no longer names.
   */
  it('treats /cds-services as just a path to the binding', async () => {
    const seen: string[] = []
    const spy = {
      fetch: async (req: Request) => {
        seen.push(new URL(req.url).pathname)
        return new Response('asset', { headers: { 'content-type': 'text/html' } })
      },
    }
    const res = await app.request(`${BASE}/cds-services`, {}, { ASSETS: spy })
    expect(seen).toEqual(['/cds-services'])
    expect(res.headers.get('content-type')).not.toContain('application/json')
    expect(await res.text()).toBe('asset')
  })
})
