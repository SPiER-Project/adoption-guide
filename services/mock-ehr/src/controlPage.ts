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
import type { DemoPatient } from './fixtures'
import type { SettingsClientConfig } from './client/types'

/**
 * Why each width is on the list. The numbers come from the step-0 spike (panel
 * plan §9.1); this is the one-liner a presenter needs to choose between them.
 */
const WIDTH_NOTES: Record<number, string> = {
  380: 'the floor — narrower than anything was measured at, kept so the demo can show it rather than claim it',
  470: 'the default — the repo’s longest instrument with zero horizontal overflow',
  700: 'one-line option labels and ~14% less scrolling, at the cost of chart width',
}

/**
 * The SMART `intent` values the app answers — `open-<launch slug>`, derived in
 * the app by `launchPathForIntent` from the tool catalog.
 *
 * ⚠️ Hand-written here rather than imported, for the reason `CDS_SERVICE_PATH`
 * in app.ts is: importing `@spier/core/lib/smartIntent` pulls the whole tool
 * catalog — every ActivityDefinition and PlanDefinition — into this Worker's
 * bundle for a `<datalist>`. `controlPage.test.ts` asserts this list equals
 * `knownIntents()` at test time instead, so a tool added to the catalog fails a
 * test here until the list is updated, and a stale entry fails rather than
 * minting a launch the app answers by landing on the chart with no error.
 */
export const KNOWN_INTENTS: readonly string[] = [
  'open-asq',
  'open-bssa',
  'open-cams-outcome-disposition?tool=TL-020',
  'open-cams-section-a?tool=TL-020',
  'open-cams-section-b',
  'open-cams-stabilization-plan',
  'open-cams-therapeutic-worksheet',
  'open-caring-contact',
  'open-crisis-resources',
  'open-crisis-response-plan',
  'open-cssrs-full',
  'open-cssrs-pediatric',
  'open-cssrs-screener',
  'open-cssrs-since-last-contact',
  'open-discharge-packet',
  'open-follow-up-appointment',
  'open-lethal-means',
  'open-measures',
  'open-outreach',
  'open-phq-9',
  'open-pss-3',
  'open-pss-full',
  'open-referral',
  'open-risk-episode',
  'open-safe-t',
  'open-safety-tasks',
  'open-sbq-r',
  'open-sharing-consent',
  'open-stanley-and-brown',
  'open-transition',
]

export function controlPage(
  active: CapabilityProfile,
  fhirBase: string,
  resourceCount: number,
  patients: DemoPatient[],
  authRequired: boolean,
  { scriptUrl }: { scriptUrl: string },
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
      <select name="patient">${patients.map(p => `<option value="${esc(p.id)}">${esc(p.name)} &middot; ${esc(p.id)}</option>`).join('')}</select>
    </label>
    <label class="field"><span>intent <small>(optional — which tool the panel opens on; leave blank for the pathway)</small></span>
      <input name="intent" type="text" list="known-intents" placeholder="open-cssrs-full">
      <datalist id="known-intents">${KNOWN_INTENTS.map(i => `<option value="${esc(i)}"></option>`).join('')}</datalist>
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
  <p class="lede">
    <strong>Written data is cleared automatically every night</strong>, so a chart that an earlier
    visitor worked through is back to its own story by the next morning. This button is the same
    clearance, on demand — for a presenter who cannot wait, or who has just finished a run and wants
    the next one to start where the script says it does.
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
    // The bench's behaviour is `src/client/settings.ts`, built and served by the
    // Worker (clientAssets.ts). It reads these three values from the page's
    // config block rather than having them interpolated into code.
    config: {
      panelWidths: PANEL_WIDTHS,
      defaultPanelWidth: DEFAULT_PANEL_WIDTH,
      panelWidthKey: PANEL_WIDTH_KEY,
    } satisfies SettingsClientConfig,
    scriptSrc: scriptUrl,
  })
}
