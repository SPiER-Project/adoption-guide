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
 * binding and no build step beyond the Vite bundle. Host chrome — a patient
 * list, a patient page, a launch button — is step 5, not this.
 */
import { CAPABILITY_PROFILES, PROFILE_DESCRIPTIONS, type CapabilityProfile } from './capability'

const PLUM = '#341528'
const RASPBERRY = '#cc3366'

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

  <h2>Launch the panel</h2>
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

  <h2>Capability profile</h2>
  <p>What <code>/fhir/metadata</code> advertises, and therefore how far the writeback ladder climbs.</p>
  <ul>${buttons}</ul>

  <p class="warn">
    <strong>Demonstration host only.</strong> This server is controlled by the same project it is
    demonstrating, so nothing observed here is evidence of interoperability — that claim is only made
    against a public sandbox. The profile is held in memory: it is per-isolate and resets on a cold
    start, so flip it immediately before launching the panel.
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
