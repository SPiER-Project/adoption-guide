/**
 * The host chrome — panel step 5.
 *
 * These are HTML-shape assertions, which are weak tests of a page and the right
 * tests for *these* properties: each one below is a thing that would break the
 * embedded launch silently, and none of them is visible in a screenshot.
 *
 * The claim step 5 exists to settle — that the panel renders inside a
 * cross-origin iframe — cannot be made here at all. It needs a browser, two
 * origins and a real OAuth round trip; see `docs/plans/embedded-panel-smart-launch.md`
 * §6 for what was actually observed. What this file protects is everything that
 * has to be right *before* a browser can prove anything.
 */
import { describe, expect, it } from 'vitest'
import app from './app'
import { DEMO_PATIENTS, DEMO_PATIENTS_BY_ID } from './fixtures'
import { SERVICE_ID } from '../../cds-hooks/src/service'

const BASE = 'https://mock-ehr.test'

async function html(path: string) {
  const res = await app.request(`${BASE}${path}`)
  return { res, body: await res.text() }
}

describe('the front door', () => {
  it('lists every demo patient, with a way into each chart', async () => {
    // ⚠️ On `/`, not `/chart`. The list IS the front door now — the operator's
    // bench moved to /settings after the old root proved undiscoverable.
    const { res, body } = await html('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(DEMO_PATIENTS.length).toBe(14)
    for (const patient of DEMO_PATIENTS) {
      expect(body).toContain(`href="/chart/${patient.id}"`)
      expect(body).toContain(patient.name)
    }
  })

  it('says what this server is, and that it is not SPiER', async () => {
    // The reported defect was not knowing what to do here. The front door has to
    // answer that in its first sentence.
    const { body } = await html('/')
    expect(body).toContain('not\n    SPiER')
    expect(body).toContain('Open a chart')
  })

  it('embeds the population dashboard WITHOUT claiming it is a SMART launch', async () => {
    // ⚠️ The label is the point. The population view imports localDataSource
    // directly, so the frame renders its own demo registry — calling it a SMART
    // view would be the claim §1 guardrail 3 exists to stop.
    const { body } = await html('/')
    const frame = /<iframe src="([^"]+)" title="SPiER population dashboard/.exec(body)
    expect(frame).not.toBeNull()
    const url = new URL(frame![1])
    expect(url.searchParams.get('embed')).toBe('1')
    expect(url.hash).toBe('#/population')
    // No launch context: this is deliberately not a SMART launch.
    expect(url.searchParams.has('iss')).toBe(false)
    expect(url.searchParams.has('launch')).toBe(false)
    expect(body).toContain('not a SMART launch')
  })

  it('keeps the operator bench reachable, off the front door', async () => {
    expect((await html('/')).body).toContain('href="/settings"')
    const settings = await html('/settings')
    expect(settings.res.status).toBe(200)
    expect(settings.body).toContain('data-profile="full"')
  })

  it('redirects the old /chart list URL rather than 404ing it', async () => {
    // It is in the README, in two plan docs, and in anyone's history.
    const res = await app.request(`${BASE}/chart`)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/')
  })
})

describe('one patient chart', () => {
  it('draws the host banner from the Patient resource', async () => {
    const maria = DEMO_PATIENTS_BY_ID.get('patient-011')!
    const { res, body } = await html('/chart/patient-011')
    expect(res.status).toBe(200)
    expect(body).toContain(maria.name)
    // ⚠️ The MRN, specifically. The deployed panel showed "MRN patient-011" for
    // this patient (#369) because the reader fell back to the resource id, and
    // the host banner is now the thing the panel is being compared against — so
    // a host that made the same mistake would make the panel's fix invisible.
    expect(maria.mrn).toBe('11011')
    expect(body).toContain('MRN 11011')
    expect(body).not.toContain('MRN patient-011')
  })

  it('frames the panel rather than linking to it', async () => {
    // The whole point of the step. A page that opened a new tab would prove
    // nothing about `frame-ancestors`.
    const { body } = await html('/chart/patient-011')
    expect(body).toContain('<iframe')
    expect(body).toContain('id="panel"')
  })

  it('points the CDS call at the panel’s own origin', async () => {
    const { body } = await html('/chart/patient-011')
    // Default panel base is the deployed Worker; the service lives on the same
    // origin because one Worker serves both.
    expect(body).toContain('https://spier-adoption-guide.bbthorson.workers.dev/cds-services/spier-patient-view')
  })

  it('404s a patient this server does not hold', async () => {
    const { res } = await html('/chart/patient-999')
    expect(res.status).toBe(404)
  })

  it('names the CDS service path the panel host actually serves', async () => {
    // The path is hand-written in app.ts to keep the card builder out of this
    // Worker's bundle (see the comment on CDS_SERVICE_PATH). This is the gate
    // that makes that safe: a renamed service fails here rather than in a
    // browser.
    const { body } = await html('/chart/patient-011')
    expect(body).toContain(`/cds-services/${SERVICE_ID}`)
  })
})

describe('POST /_admin/launch — the embed flag', () => {
  async function mint(payload: Record<string, unknown>) {
    const res = await app.request(`${BASE}/_admin/launch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { res, body: (await res.json()) as { launchUrl?: string; error?: string } }
  }

  it('puts embed=1 in the QUERY, before the fragment', async () => {
    // ⚠️ The trap this pins. The app reads the embed flag from
    // `location.search` on purpose (PresentationProvider) — under HashRouter
    // that is what makes it survive in-app navigation. Appended after the `#`
    // it becomes part of the route and is silently ignored, and the panel would
    // render full EHR chrome inside the host's iframe with nothing failing.
    const { body } = await mint({ patient: 'patient-011', embed: true })
    const url = new URL(body.launchUrl!)
    expect(url.searchParams.get('embed')).toBe('1')
    expect(url.hash).toBe('#/launch')
    // Belt and braces: the literal ordering, since a URL object would happily
    // parse a query that came after the hash as part of the hash.
    expect(body.launchUrl!.indexOf('embed=1')).toBeLessThan(body.launchUrl!.indexOf('#'))
  })

  it('omits embed entirely when not asked, so a top-level launch is unaffected', async () => {
    const { body } = await mint({ patient: 'patient-011' })
    expect(new URL(body.launchUrl!).searchParams.has('embed')).toBe(false)
  })

  it('still carries iss and launch, which are what make it a SMART launch', async () => {
    const { body } = await mint({ patient: 'patient-011', embed: true })
    const url = new URL(body.launchUrl!)
    expect(url.searchParams.get('iss')).toBe(`${BASE}/fhir`)
    expect(url.searchParams.get('launch')).toBeTruthy()
  })

  it('rejects an unknown patient rather than minting a launch for nobody', async () => {
    const { res, body } = await mint({ patient: 'patient-999', embed: true })
    expect(res.status).toBe(400)
    expect(body.error).toContain('patient-999')
  })
})

describe('demographics are derived, not restated', () => {
  it('reads the MRN from Patient.identifier for every patient', async () => {
    // If this ever falls back to the resource id for anyone, the host banner
    // starts disagreeing with the panel's — which is exactly the two-sources
    // disagreement #369 found on the deployed chart.
    for (const patient of DEMO_PATIENTS) {
      expect(patient.mrn).not.toBe(patient.id)
      expect(patient.mrn).toMatch(/^\d+$/)
      expect(patient.name).not.toBe('—')
      expect(patient.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('the chart carries the degradation demo (step 4)', () => {
  it('offers every capability profile, marking the live one', async () => {
    const { body } = await html('/chart/patient-011')
    for (const profile of ['full', 'no-observation', 'documents-only', 'read-only']) {
      expect(body).toContain(`data-profile="${profile}"`)
    }
    // The default profile is `full` with no env var and no durable value set.
    expect(body).toContain('data-profile="full" aria-pressed="true"')
  })

  it('shows the server’s own account of what was written', async () => {
    // Deliberately a second statement about the same event: the panel's
    // scorecard is SPiER reporting on itself, and one source cannot corroborate
    // anything.
    const { body } = await html('/chart/patient-011')
    expect(body).toContain('id="writes-summary"')
    expect(body).toContain('id="reset-writes"')
    expect(body).toContain('/_admin/writes')
  })

  it('puts the switch where the demo happens, not only on the operator page', async () => {
    // Both pages carry it on purpose: flipping the profile mid-demo should not
    // mean leaving the chart. The operator's copy is on /settings now.
    const chart = await html('/chart/patient-011')
    const settings = await html('/settings')
    expect(chart.body).toContain('/_admin/capabilities')
    expect(settings.body).toContain('/_admin/capabilities')
  })
})
