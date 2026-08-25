/**
 * controlPage — the operator's bench. Two jobs:
 *
 *   1. **The capability switch.** Flipping the profile here and relaunching the
 *      panel is the capability-degradation demo; without a control surface the
 *      switch is a curl command, which is not something you perform in front of
 *      an audience.
 *   2. **Launching the panel top-level.** Pick a patient, optionally an
 *      `intent`, and get the SMART EHR-launch URL — the useful thing to compare
 *      an embedded launch against, and the only way to send an arbitrary intent.
 *
 * ⚠️ **This is the operator's page, not the demo.** Host chrome — the patient
 * list, a chart, and the panel framed inside it — lives in `chartPage.ts`.
 * Demonstrate from `/`; debug from here.
 *
 * ⚠️ **This file used to build its own `<!doctype>` document**, with its own
 * copy of the palette (`#5c4a54`, `#f3eef1`, `#d8cdd4`, `#fdf5f8` typed as
 * literals) and its own `button`, `.warn`, `code` and `h1` rules — which is
 * doubly pointed, because `hostChrome.ts` was extracted *from this file* to stop
 * exactly that. The extraction happened and the adoption did not, and nothing
 * could see the difference. It renders through `page()` now, and
 * `npm run check:host-css` is what would have caught the original.
 */
import { CAPABILITY_PROFILES, PROFILE_DESCRIPTIONS, type CapabilityProfile } from './capability'
import { esc, page } from './hostChrome'
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
  470: 'the default — the repo’s longest instrument with zero horizontal overflow',
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
        <button type="button" class="btn option" data-profile="${profile}" aria-pressed="${profile === active}">
          <strong>${esc(profile)}</strong>
          <span>${esc(PROFILE_DESCRIPTIONS[profile])}</span>
        </button>
      </li>`).join('')

  const widthButtons = PANEL_WIDTHS.map(w => `
      <li><button type="button" class="btn option" data-width="${w}">
        <strong>${w}px</strong>
        <span>${esc(WIDTH_NOTES[w])}</span>
      </button></li>`).join('')

  return page({
    title: 'Settings — SPiER mock EHR',
    nav: 'settings',
    variant: 'prose',
    body: `
  <h1>Server settings and controls</h1>
  <p class="lede">
    FHIR base <code>${esc(fhirBase)}</code> — ${resourceCount} synthetic resources across 14 demo
    patients, read straight from the app's own population scenarios.
    <a href="/">Back to the patient list &rarr;</a>
  </p>

  <h2>Launch the panel top-level</h2>
  <p class="lede">
    Mints a SMART launch context and opens the app's <code>launch_uri</code> with
    <code>iss</code> and <code>launch</code>, the way an EHR would. A top-level launch is the useful
    thing to compare the chart's embedded one against. Authorization is
    <strong>${authRequired ? 'required' : 'OFF'}</strong> on <code>/fhir</code>.
  </p>
  <form id="launch-form" class="form">
    <label class="field"><span>Patient</span>
      <select name="patient">${patientIds.map(id => `<option value="${esc(id)}">${esc(id)}</option>`).join('')}</select>
    </label>
    <label class="field"><span>intent <small>(optional — e.g. <code>open-cssrs-full</code>)</small></span>
      <input name="intent" type="text" placeholder="">
    </label>
    <label class="field field--check">
      <input name="needPatientBanner" type="checkbox">
      <span><code>need_patient_banner: false</code> — the host draws the banner, so the panel should not</span>
    </label>
    <div><button type="submit" class="btn btn--primary btn--smart">Mint launch URL</button></div>
  </form>
  <p id="launch-result" class="callout" hidden></p>

  <h2>Panel width</h2>
  <p class="lede">
    How wide the dock is on a chart. A <strong>presentation preference</strong>, not server state:
    it is stored in this browser, and every viewer who never opens this page gets
    <code>${DEFAULT_PANEL_WIDTH}px</code> — the middle one, and the width the step-0 spike measured
    the repo's longest instrument at with zero horizontal overflow.
  </p>
  <p class="lede">
    ⚠️ These were three buttons on the chart itself. A presentation control on the demo surface is a
    decision every viewer has to make before they can look at the thing, so it moved here and the
    chart just reads the answer.
  </p>
  <ul class="stack">${widthButtons}</ul>

  <h2>Capability profile</h2>
  <p class="lede">
    What <code>/fhir/metadata</code> advertises, and therefore how far the writeback ladder climbs.
    This is <strong>server</strong> state, held in the Durable Object — so flipping it here changes
    what a chart open in another tab is told, and the chart no longer carries a copy of the switch.
  </p>
  <ul class="stack">${buttons}</ul>

  <h2>Demo data</h2>
  <p class="lede">
    Everything written by the panel's writeback ladder, held in a Durable Object.
    Reset discards the writes and <strong>leaves the capability profile alone</strong> — "reset the
    data" and "put the server back to full capability" are different intentions.
  </p>
  <p class="readout">
    <span id="writes-summary">Loading…</span>
    <button type="button" id="reset-writes" class="btn">Reset written data</button>
  </p>

  <p class="callout callout--warn">
    <strong>Demonstration host only.</strong> This server is controlled by the same project it is
    demonstrating, so nothing observed here is evidence of interoperability — that claim is only made
    against a public sandbox. Accepting a write is not evidence either: the mock validates against
    SPiER's own profiles, which is a guardrail against leniency, not a conformance statement.
  </p>`,
    script: `
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
`,
  })
}
