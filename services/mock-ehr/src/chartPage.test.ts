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

  it('embeds the caseload SUMMARY, not the whole lens — one patient list on the page', async () => {
    // ⚠️ This is the regression, and the hash is the whole assertion. Framing
    // `#/population` puts SPiER's sortable caseload inside the iframe next to
    // the host's own table: two patient lists on one page, and the better-looking
    // one navigates *within the frame* rather than opening a chart here.
    // `#/population/summary` is the part a host cannot compute for itself.
    const { body } = await html('/')
    const frame = /<iframe src="([^"]+)" title="SPiER caseload summary/.exec(body)
    expect(frame).not.toBeNull()
    const url = new URL(frame![1])
    expect(url.searchParams.get('embed')).toBe('1')
    expect(url.hash).toBe('#/population/summary')
    // Not merely "starts with" — that would pass for the full lens again.
    expect(url.hash).not.toBe('#/population')
    // No launch context: this is deliberately not a SMART launch.
    expect(url.searchParams.has('iss')).toBe(false)
    expect(url.searchParams.has('launch')).toBe(false)
    expect(body).toContain('not a SMART launch')
  })

  it('puts the embedded activity ABOVE the host\u2019s own list', async () => {
    // Where an EHR hangs a hosted activity on a worklist page, and the order the
    // page is meant to be read in: what needs attention, then who.
    const { body } = await html('/')
    expect(body.indexOf('<iframe')).toBeLessThan(body.indexOf('<table'))
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

describe('the chart leads with the launch, and carries no controls', () => {
  it('puts the launch CTA directly under the banner, before everything else', async () => {
    // ⚠️ The property, stated as an ordering rather than as styling. This button
    // used to be the LAST element on the page — below the CDS cards, the
    // capability switch and the FHIRcast log, under an <h2>Activity</h2>. Same
    // defect as the old front door: the one thing to do here was the last thing
    // you would find.
    const { body } = await html('/chart/patient-011')
    const launch = body.indexOf('id="open-panel"')
    expect(launch).toBeGreaterThan(-1)
    expect(launch).toBeGreaterThan(body.indexOf('class="banner"'))
    expect(launch).toBeLessThan(body.indexOf('Clinical decision support'))
    expect(launch).toBeLessThan(body.indexOf('Shared context'))
  })

  it('offers NO capability switch — that is operator equipment, and lives on /settings', async () => {
    // ⚠️ This inverts an earlier decision on purpose, and the reason it is safe
    // now is the Durable Object. When the switch was added here the live profile
    // lived in module memory (per-isolate), so flipping it elsewhere could leave
    // the panel told something different from what the presenter said. It is
    // durable now, so a second tab on /settings changes what THIS chart's panel
    // reads from /metadata.
    const chart = await html('/chart/patient-011')
    const settings = await html('/settings')
    expect(chart.body).not.toContain('data-profile=')
    expect(chart.body).not.toContain('/_admin/capabilities')
    expect(settings.body).toContain('data-profile="full"')
    expect(settings.body).toContain('/_admin/capabilities')
    // …and the chart says where the controls went, rather than dropping them.
    expect(chart.body).toContain('href="/settings"')
  })

  it('offers no panel-width switcher; /settings owns the preference', async () => {
    const chart = await html('/chart/patient-011')
    const settings = await html('/settings')
    expect(chart.body).not.toContain('data-width=')
    for (const px of [380, 470, 700]) {
      expect(settings.body).toContain(`data-width="${px}"`)
    }
    // Every viewer who never opens /settings gets the middle one.
    expect(chart.body).toContain('spier-mock-ehr:panel-width')
    expect(chart.body).toContain('470')
    // ⚠️ A TEXT assertion on the guard, and labelled as one: the stored value is
    // interpolated into an inline style, so an unvalidated read is how a
    // preference becomes a style injection. Only the three measured widths are
    // honored. Verified for real in a browser (a stored
    // `999px; background:url(x)` renders at 470px); this is what keeps the guard
    // from being deleted as noise.
    expect(chart.body).toContain('PANEL_WIDTHS.indexOf(raw) === -1')
  })

  it('keeps the server’s own account of what was written — a readout, not a control', async () => {
    // Deliberately a second statement about the same event: the panel's
    // scorecard is SPiER reporting on itself, and one source cannot corroborate
    // anything. So this survived the controls' removal while the reset button,
    // which is an action, did not.
    const chart = await html('/chart/patient-011')
    expect(chart.body).toContain('id="writes-summary"')
    expect(chart.body).toContain('/_admin/writes')
    expect(chart.body).not.toContain('id="reset-writes"')
    expect((await html('/settings')).body).toContain('id="reset-writes"')
  })
})
