/**
 * controlPage — the mock's own tiny UI. Two jobs:
 *
 *   1. **The capability switch.** Flipping the profile here and relaunching the
 *      panel is the capability-degradation demo; without a control surface the
 *      switch is a curl command, which is not something you perform in front of
 *      an audience.
 *   2. **Launching the panel.** Pick a patient, optionally an `intent`, and get
 *      the SMART EHR-launch URL. This is the engine of step 5's launch button,
 *      not the button: no patient list, no chart, no encounter page.
 *
 * Deliberately one self-contained string: this Worker has no Static Assets
 * binding and no build step beyond the Vite bundle.
 *
 * ⚠️ **This is the operator's page, not the demo.** Host chrome — the patient
 * list, a chart, and the panel framed inside it — landed in step 5 and lives in
 * `chartPage.ts`; the launch form below stays because it can mint a launch this
 * page's own controls cover (an arbitrary `intent`, banner on or off) and
 * because a TOP-LEVEL launch is the useful thing to compare an embedded one
 * against. Demonstrate from `/` (the patient list); debug from here.
 */
import { CAPABILITY_PROFILES, PROFILE_DESCRIPTIONS, type CapabilityProfile } from './capability'
// Palette shared with the host-chrome pages — one definition, not three.
import { PLUM, RASPBERRY } from './hostChrome'
// The chart owns the dock, so it owns these; this page owns the CONTROL. Imported
// rather than restated so the whitelist the chart validates against and the
// options offered here cannot drift into a preference the chart refuses.
import { DEFAULT_PANEL_WIDTH, PANEL_WIDTHS, PANEL_WIDTH_KEY } from './chartPage'

/**
 * Why each width is on the list. The numbers come from the step-0 spike (panel
 * plan §9.1); this is the one-liner a presenter needs to choose between them.
 */
const WIDTH_NOTES: Record<number, string> = {
  380: 'the floor — narrower than anything was measured at, kept so the demo can show it rather than claim it',
  470: 'the default — the repo\u2019s longest instrument with zero horizontal overflow',
  700: 'one-line option labels and ~14% less scrolling, at the cost of chart width',
}

export function controlPage(
  active: CapabilityProfile,
  fhirBase: string,
  resourceCount: number,
  patientIds: string[],
  authRequired: boolean,
): string {
  const buttons = CAPABILITY_PROFILES.map(profile => `
      <li>
        <button type="button" data-profile="${profile}" aria-pressed="${profile === active}">
          <strong>${profile}</strong>
          <span>${PROFILE_DESCRIPTIONS[profile]}</span>
        </button>
      </li>`).join('')

  const widthButtons = PANEL_WIDTHS.map(w => `
      <li><button type="button" data-width="${w}">
        <strong>${w}px</strong>
        <span>${WIDTH_NOTES[w]}</span>
      </button></li>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SPiER mock EHR</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem 1.5rem; max-width: 46rem; color: ${PLUM}; background: #fff; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  p.lede { margin: 0 0 1.5rem; color: #5c4a54; }
  code { background: #f3eef1; padding: .1em .35em; border-radius: 3px; }
  ul { list-style: none; padding: 0; display: grid; gap: .5rem; }
  button { width: 100%; text-align: left; display: grid; gap: .2rem; padding: .75rem 1rem; border: 1px solid #d8cdd4; border-radius: 6px; background: #fff; cursor: pointer; font: inherit; color: inherit; }
  button[aria-pressed="true"] { border-color: ${RASPBERRY}; box-shadow: inset 3px 0 0 ${RASPBERRY}; background: #fdf5f8; }
  button span { font-size: .875rem; color: #5c4a54; }
  form { display: grid; gap: .75rem; margin: 0 0 1rem; }
  label { display: grid; gap: .25rem; font-size: .9rem; }
  label.checkbox { grid-template-columns: auto 1fr; align-items: start; gap: .5rem; }
  select, input[type="text"] { font: inherit; padding: .4rem .5rem; border: 1px solid #d8cdd4; border-radius: 4px; }
  button.primary { background: ${RASPBERRY}; color: #fff; border-color: ${RASPBERRY}; font-weight: 600; text-align: center; display: block; }
  #launch-result { padding: .75rem 1rem; background: #f3eef1; border-radius: 6px; overflow-wrap: anywhere; font-size: .9rem; }
  .warn { margin-top: 1.5rem; padding: .75rem 1rem; border-left: 3px solid ${RASPBERRY}; background: #fdf5f8; font-size: .9rem; }
</style>
</head>
<body>
  <h1>SPiER mock EHR</h1>
  <p class="lede">
    FHIR base <code>${fhirBase}</code> — ${resourceCount} synthetic resources across 14 demo patients,
    read straight from the app's own population scenarios.
  </p>

  <h2>Back to the demo</h2>
  <p>
    <a href="/">The patient list &rarr;</a> — open a chart and the SPiER panel is launched
    <strong>inside</strong> it. That is the demo; everything on this page is the operator's bench,
    which is why it no longer sits on the front door.
  </p>

  <h2>Launch the panel top-level</h2>
  <p>
    Mints a SMART launch context and opens the app's <code>launch_uri</code> with
    <code>iss</code> and <code>launch</code>, the way an EHR would.
    Authorization is <strong>${authRequired ? 'required' : 'OFF'}</strong> on <code>/fhir</code>.
  </p>
  <form id="launch-form">
    <label>Patient
      <select name="patient">${patientIds.map(id => `<option value="${id}">${id}</option>`).join('')}</select>
    </label>
    <label>intent <small>(optional — e.g. <code>open-cssrs-full</code>)</small>
      <input name="intent" type="text" placeholder="">
    </label>
    <label class="checkbox">
      <input name="needPatientBanner" type="checkbox">
      <span><code>need_patient_banner: false</code> — the host draws the banner, so the panel should not</span>
    </label>
    <button type="submit" class="primary">Mint launch URL</button>
  </form>
  <p id="launch-result" hidden></p>

  <h2>Panel width</h2>
  <p>
    How wide the dock is on a chart. A <strong>presentation preference</strong>, not server state:
    it is stored in this browser, and every viewer who never opens this page gets
    <code>${DEFAULT_PANEL_WIDTH}px</code> — the middle one, and the width the step-0 spike measured
    the repo's longest instrument at with zero horizontal overflow.
  </p>
  <p>
    ⚠️ These were three buttons on the chart itself. A presentation control on the demo surface is a
    decision every viewer has to make before they can look at the thing, so it moved here and the
    chart just reads the answer.
  </p>
  <ul>${widthButtons}</ul>

  <h2>Capability profile</h2>
  <p>
    What <code>/fhir/metadata</code> advertises, and therefore how far the writeback ladder climbs.
    This is <strong>server</strong> state, held in the Durable Object — so flipping it here changes
    what a chart open in another tab is told, and the chart no longer carries a copy of the switch.
  </p>
  <ul>${buttons}</ul>

  <h2>Demo data</h2>
  <p>
    Everything written by the panel's writeback ladder, held in a Durable Object.
    Reset discards the writes and <strong>leaves the capability profile alone</strong> — "reset the
    data" and "put the server back to full capability" are different intentions.
  </p>
  <p id="writes-summary">Loading…</p>
  <p><button type="button" id="reset-writes">Reset written data</button></p>

  <p class="warn">
    <strong>Demonstration host only.</strong> This server is controlled by the same project it is
    demonstrating, so nothing observed here is evidence of interoperability — that claim is only made
    against a public sandbox. Accepting a write is not evidence either: the mock validates against
    SPiER's own profiles, which is a guardrail against leniency, not a conformance statement.
  </p>

<script>
  document.getElementById('launch-form').addEventListener('submit', async function (e) {
    e.preventDefault()
    const data = new FormData(e.target)
    const res = await fetch('/_admin/launch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        patient: data.get('patient'),
        intent: data.get('intent') || undefined,
        // Checked means the host draws the banner, i.e. need_patient_banner:false.
        needPatientBanner: data.get('needPatientBanner') ? false : undefined,
      }),
    })
    const out = document.getElementById('launch-result')
    out.hidden = false
    if (!res.ok) { out.textContent = 'Could not mint a launch: HTTP ' + res.status; return }
    const body = await res.json()
    out.innerHTML = ''
    const a = document.createElement('a')
    a.href = body.launchUrl
    a.target = '_blank'
    a.rel = 'noopener'
    a.textContent = 'Launch the panel for ' + body.patient + ' →'
    out.appendChild(a)
  })

  function refreshWrites() {
    return fetch('/_admin/writes').then(function (res) {
      return res.ok ? res.json() : null
    }).then(function (body) {
      var out = document.getElementById('writes-summary')
      if (!body) { out.textContent = 'No DEMO_STORE binding — this deployment cannot persist writes.'; return }
      if (body.count === 0) { out.textContent = 'Nothing written yet.'; return }
      var byType = Object.keys(body.byType).sort().map(function (t) {
        return body.byType[t] + ' ' + t
      }).join(', ')
      out.textContent = body.count + ' resource(s) written: ' + byType
    }).catch(function () {
      document.getElementById('writes-summary').textContent = 'Could not read the write log.'
    })
  }
  refreshWrites()

  document.getElementById('reset-writes').addEventListener('click', function () {
    fetch('/_admin/reset', { method: 'POST' }).then(function (res) {
      if (!res.ok) { alert('Could not reset: HTTP ' + res.status); return }
      refreshWrites()
    })
  })

  // ── Panel width: a per-browser preference the chart page reads ────────────
  var WIDTH_KEY = ${JSON.stringify(PANEL_WIDTH_KEY)};
  var WIDTHS = ${JSON.stringify(PANEL_WIDTHS)};
  function markWidth(px) {
    document.querySelectorAll('button[data-width]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.width) === px))
    })
  }
  function readWidth() {
    try {
      var raw = Number(localStorage.getItem(WIDTH_KEY))
      return WIDTHS.indexOf(raw) === -1 ? ${DEFAULT_PANEL_WIDTH} : raw
    } catch (e) {
      return ${DEFAULT_PANEL_WIDTH}
    }
  }
  markWidth(readWidth())
  document.querySelectorAll('button[data-width]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var px = Number(btn.dataset.width)
      try {
        localStorage.setItem(WIDTH_KEY, String(px))
      } catch (e) {
        alert('This browser refused to store the preference; the chart will use ' + ${DEFAULT_PANEL_WIDTH} + 'px.')
        return
      }
      markWidth(px)
    })
  })

  document.querySelectorAll('button[data-profile]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const res = await fetch('/_admin/capabilities', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: btn.dataset.profile }),
      })
      if (!res.ok) { alert('Could not switch profile: HTTP ' + res.status); return }
      document.querySelectorAll('button[data-profile]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn))
      })
    })
  })
</script>
</body>
</html>`
}
