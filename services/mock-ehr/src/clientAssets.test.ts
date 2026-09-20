/**
 * The three pages ship their behaviour as built modules, not inline scripts —
 * and the Worker serves those modules. See clientAssets.ts for why.
 */
import { describe, expect, it } from 'vitest'
import app from './app'

const BASE = 'https://mock-ehr.test'
const PAGES: Array<[path: string, module: string]> = [
  ['/', 'home'],
  ['/chart/patient-011', 'chart'],
  ['/settings', 'settings'],
]

async function text(path: string) {
  const res = await app.request(`${BASE}${path}`)
  return { res, body: await res.text() }
}

describe('every host page loads one built module and carries no inline script', () => {
  for (const [path, name] of PAGES) {
    it(`${path} → /client/${name}.js?v=<hash>`, async () => {
      const { body } = await text(path)
      const modules = [...body.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map(m => m[1])
      expect(modules).toHaveLength(1)
      expect(modules[0]).toMatch(new RegExp(`^/client/${name}\\.js\\?v=[0-9a-f]{8}$`))
      // ⚠️ The invariant this file exists for: no `<script>` that is neither the
      // JSON config block nor the module tag. An inline script is 400 lines no
      // tool can see into, which is how an innerHTML concatenation lived in one
      // until the 2026-09-20 audit found it by reading.
      expect(body).not.toMatch(/<script(?![^>]*\btype="(?:module|application\/json)")[^>]*>/)
    })
  }

  it('serves each module as JavaScript, immutable for a year, with an ETag matching the URL version', async () => {
    for (const [path, name] of PAGES) {
      const page = await text(path)
      const src = page.body.match(/<script type="module" src="([^"]+)"><\/script>/)![1]!
      const version = new URL(src, BASE).searchParams.get('v')
      const { res, body } = await text(src)
      expect(res.status, name).toBe(200)
      expect(res.headers.get('content-type'), name).toBe('text/javascript; charset=utf-8')
      expect(res.headers.get('cache-control'), name).toBe('public, max-age=31536000, immutable')
      expect(res.headers.get('etag'), name).toBe(`"${version}"`)
      expect(body.length, name).toBeGreaterThan(100)
    }
  })

  it('serves a shared chunk under the same route, so a module that imports one can load it', async () => {
    // Rollup emits `config-<hash>.js` for the helpers chart.ts and settings.ts
    // both import, and each entry `import`s it relatively. If the route did not
    // cover it, the entries would 404 at load time while every test on the
    // entries themselves passed.
    const { body } = await text('/client/chart.js?v=x')
    for (const m of body.matchAll(/from\s+["']\.\/([^"']+)["']/g)) {
      const { res } = await text(`/client/${m[1]}`)
      expect(res.status, m[1]).toBe(200)
    }
  })

  it('404s a module that was never built rather than serving something else', async () => {
    const { res } = await text('/client/nope.js')
    expect(res.status).toBe(404)
  })

  it('hands the chart module its inputs as data, not code', async () => {
    const { body } = await text('/chart/patient-011')
    const m = body.match(/<script id="spier-page-config" type="application\/json">([^<]*)<\/script>/)
    expect(m).not.toBeNull()
    const config = JSON.parse(m![1]!) as Record<string, unknown>
    expect(config.patient).toMatchObject({ id: 'patient-011' })
    expect(config.cdsEndpoint).toMatch(/\/cds-services\/spier-patient-view$/)
    expect(config.panelOrigin).toMatch(/^https:\/\//)
    expect(config.panelWidths).toEqual([380, 470, 700])
    expect(config.defaultPanelWidth).toBe(470)
    expect(config.panelWidthKey).toBe('spier-mock-ehr:panel-width')
  })

  it('escapes `<` in the config block so no value can close it', async () => {
    const { jsonForHtml } = await import('./hostChrome')
    const out = jsonForHtml({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})
