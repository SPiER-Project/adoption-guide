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
import { TRY_IT_ORDER, storyOf } from './demoStories'
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

  it('says what to do in its first paragraph, and that this host is not SPiER', async () => {
    // The reported defect was not knowing what to do here. The front door has to
    // answer that in its first paragraph — and the instruction comes BEFORE the
    // disclaimer, not after it. The first version led with "This is not SPiER"
    // and put the instruction under the caseload frame and a warning box.
    const { body } = await html('/')
    expect(body).toContain('This host is not SPiER')
    expect(body).toContain('Open a chart')
    expect(body.indexOf('Open a chart')).toBeLessThan(body.indexOf('This host is not SPiER'))
  })

  it('leads with "Start here": three named charts, each with a reason and a thing to notice', async () => {
    // Fourteen names with demographics gave a viewer no reason to open one chart
    // over another, and the natural first click was a finished episode with
    // nothing left to do. The picks are where the demo has something to do.
    const { body } = await html('/')
    expect(body).toContain('<h2>Start here</h2>')
    for (const id of TRY_IT_ORDER) {
      const patient = DEMO_PATIENTS_BY_ID.get(id)!
      const { tryIt } = storyOf(id)
      expect(body).toContain(`<h3 class="try__name">${patient.name}</h3>`)
      expect(body).toContain(tryIt!.why)
      expect(body).toContain(`class="btn btn--primary" href="/chart/${id}"`)
    }
    // Before the full list, before the caseload frame, before the drawer.
    expect(body.indexOf('Start here')).toBeLessThan(body.indexOf('<table'))
    expect(body.indexOf('Start here')).toBeLessThan(body.indexOf('<iframe'))
  })

  it('gives every row a one-line story and drops the FHIR id column', async () => {
    const { body } = await html('/')
    for (const patient of DEMO_PATIENTS) {
      expect(body).toContain(`<td class="story">${storyOf(patient.id).story}`)
    }
    expect(body).not.toContain('<th>FHIR id</th>')
  })

  it('embeds the caseload SUMMARY, not the whole lens — one patient list on the page', async () => {
    // ⚠️ This is the regression, and the hash is the whole assertion. Framing
    // `#/population` puts SPiER's sortable caseload inside the iframe next to
    // the host's own table: two patient lists on one page, and the better-looking
    // one navigates *within the frame* rather than opening a chart here.
    // `#/population/summary` is the part a host cannot compute for itself.
    const { body } = await html('/')
    // Matched by the title rather than by attribute ORDER: the first version of
    // this regex read `<iframe src="…" title="SPiER caseload summary`, so adding
    // a class attribute in front of `src` made it match nothing and the whole
    // assertion below evaporated into `expect(null).not.toBeNull()`. Anchoring
    // on the one attribute that identifies the frame keeps it a test of the URL.
    const frame = /<iframe[^>]*\stitle="SPiER caseload summary[^>]*>/.exec(body)
    expect(frame).not.toBeNull()
    const src = /\ssrc="([^"]+)"/.exec(frame![0])
    expect(src).not.toBeNull()
    const url = new URL(src![1])
    expect(url.searchParams.get('embed')).toBe('1')
    expect(url.hash).toBe('#/population/summary')
    // Not merely "starts with" — that would pass for the full lens again.
    expect(url.hash).not.toBe('#/population')
    // No launch context: this is deliberately not a SMART launch.
    expect(url.searchParams.has('iss')).toBe(false)
    expect(url.searchParams.has('launch')).toBe(false)
    expect(body).toContain('not a SMART launch')
  })

  it('puts the embedded activity BELOW the host\u2019s own list, and the caveats in a closed drawer', async () => {
    // \u26a0\ufe0f This inverts the previous assertion on purpose. The widget sat first
    // because that is where an EHR hangs a hosted activity \u2014 and a first-time
    // viewer then met a dense registry widget and a warning box saying it proved
    // nothing before reaching the instruction to open a chart. The one thing the
    // page disclaims was the first thing on it. The picks and the list come
    // first now; the frame follows; every caveat is one click away in `.hood`,
    // still on the page, because the panel plan \u00a71 requires the page to SAY what
    // it does not prove \u2014 not that it say so first.
    const { body } = await html('/')
    expect(body.indexOf('<table')).toBeLessThan(body.indexOf('<iframe'))
    const hood = body.indexOf('<details class="hood"')
    expect(hood).toBeGreaterThan(body.indexOf('<iframe'))
    // Closed by default: `<details open>` would put the caveats back on screen.
    expect(body).not.toMatch(/<details class="hood"[^>]*\sopen/)
    // \u2026and the disclaimer lives inside it rather than being dropped.
    expect(body.indexOf('Demonstration host only')).toBeGreaterThan(hood)
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
    expect(launch).toBeLessThan(body.indexOf('Recommendations from SPiER'))
    expect(launch).toBeLessThan(body.indexOf('Shared context'))
  })

  it('says what launching does, in the host’s words, with the patient’s story', async () => {
    // The lede used to describe the protocol ("over a real SMART handshake —
    // authorize, read this server's FHIR API…"). A viewer needs the task: what
    // opens, what it shows, what happens to what they record.
    const { body } = await html('/chart/patient-011')
    expect(body).toContain('Open SPiER for Maria Alvarez')
    expect(body).toContain('written\n            back to this chart')
    expect(body).toContain(storyOf('patient-011').story)
  })

  it('keeps the evidence — endpoint, write log, FHIRcast — in a closed "under the hood" drawer', async () => {
    // Nothing removed, everything demoted. The endpoint URL, the hub topic and
    // the announce control used to sit inline at the same weight as the launch
    // button; they are all still on the page, one click away.
    const { body } = await html('/chart/patient-011')
    const hood = body.indexOf('<details class="hood"')
    expect(hood).toBeGreaterThan(body.indexOf('id="cds-cards"'))
    expect(body).not.toMatch(/<details class="hood"[^>]*\sopen/)
    for (const evidence of ['id="dock-sent"', 'id="writes-summary"', 'id="cast-status"', 'id="cast-form"', 'id="cast-log"', 'Demonstration host only']) {
      expect(body.indexOf(evidence), evidence).toBeGreaterThan(hood)
    }
    // The launch-context readout (#dock-sent) is evidence too, and it used to be a
    // permanent footer INSIDE the dock — 73px of the panel's height spent on
    // `patient=… hub.topic=…` for the whole session. It lives in the drawer now;
    // the dock keeps only the frame and a place for a launch error to show.
    const dockStart = body.indexOf('<aside class="panel-dock')
    const dockEnd = body.indexOf('</aside>', dockStart)
    expect(dockStart).toBeGreaterThan(-1)
    expect(body.slice(dockStart, dockEnd)).not.toContain('id="dock-sent"')
    expect(body.slice(dockStart, dockEnd)).toContain('id="dock-error"')
    // The CDS cards themselves stay OUT of the drawer: they are the second
    // launch path, and a launch path is not evidence.
    expect(body.indexOf('id="cds-cards"')).toBeLessThan(hood)
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
