/**
 * chartPage — the host chrome. Panel step 5.
 *
 * ── Why this page exists at all ─────────────────────────────────────────────
 *
 * Everything before step 5 launched the panel **top-level**, from a form on the
 * control page. That left the proposal's foundational claim untested: the panel
 * plan §6 says cross-origin framing is "the first thing that will break", and
 * `frame-ancestors` was configured on the panel host and never exercised,
 * because there was no host chrome to embed it in. A patient list and a patient
 * page with an `<iframe>` in it is the smallest thing that turns that
 * configuration into a demonstrated fact — and if it is wrong, it is wrong here
 * rather than in front of an audience.
 *
 * ── The two entry points are the two the plan names (§2) ────────────────────
 *
 *   1. **An activity button.** Vendor-configured, boring, real. It knows the
 *      patient and nothing else.
 *   2. **A CDS Hooks card whose link is `type: "smart"`.** This is the
 *      interesting one: the card names the instrument, so the panel opens
 *      already scoped to it. It answers *how did the button know which tool to
 *      name* with a standard instead of a hard-coded button.
 *
 * The card's `appContext` carries the intent, and the host puts it in the launch
 * context as SMART `intent` — which is the division of labour the spec
 * describes: the CDS service proposes, the EHR mints the launch.
 *
 * ── What this host deliberately does NOT do ─────────────────────────────────
 *
 * - **No prefetch on the CDS call.** A real EHR would hand the service the
 *   patient's QuestionnaireResponses. This host sends context only, so the
 *   service takes its documented fallback path and serves the bundled
 *   population scenario for that patient id. Same data either way (both read
 *   the scenarios), and it keeps this page from needing a bearer token for its
 *   own FHIR API. Named here because "no prefetch" silently selects a different
 *   code path in the service, and that should be a decision, not a surprise.
 * - **No SMART launch of its own devising.** The iframe's `src` is whatever
 *   `POST /_admin/launch` returns; this page never assembles OAuth parameters.
 * - **No login, no user, no encounter.** `patient-view` needs a patient; a
 *   fabricated practitioner would be theatre.
 */
import { DISCLAIMER, INK, RASPBERRY, RULE, TINT, TINT_WARM, crumbs, esc, page } from './hostChrome'
import type { DemoPatient } from './fixtures'
import { MRN_SYSTEM } from '@spier/core/lib/fhircast'

/**
 * Panel widths the demo can be set to, in CSS pixels.
 *
 * Not arbitrary: 470 is the width the step-0 spike measured the longest
 * instrument in the repo at (panel plan §9.1 — zero horizontal overflow), 700
 * is the width that buys one-line option labels and ~14% less scrolling, and
 * 380 is below both, kept so the demo can show the floor rather than claim it.
 *
 * ⚠️ **These used to be three buttons on the chart, and are now a preference on
 * `/settings`.** The spike's conclusion was that the width is a presentation
 * preference, and a presentation preference on the demo surface is a control
 * every viewer has to decide about before they can look at the thing. Everyone
 * gets the middle one unless an operator changes it; the chart reads the stored
 * value and never offers to change it. `settingsPage` owns the control.
 */
export const PANEL_WIDTHS = [380, 470, 700] as const
export const DEFAULT_PANEL_WIDTH = 470
/** localStorage key the settings page writes and the chart reads. Same origin. */
export const PANEL_WIDTH_KEY = 'spier-mock-ehr:panel-width'

const HOME_CSS = `
  table { border-collapse: collapse; width: 100%; font-size: .95rem; }
  th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid ${RULE}; }
  th { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: ${INK}; }
  tbody tr:hover { background: ${TINT_WARM}; }
  td a { font-weight: 600; text-decoration: none; }
  td.mono { font-variant-numeric: tabular-nums; color: ${INK}; }

  /*
   * The embedded-activity card. This is the one place these pages try to look
   * like something rather than just be legible: a host chrome bar above a frame
   * is what an EHR-hosted activity looks like, and the point of the section is
   * that a reader can tell at a glance which pixels are SPiER's and which are
   * the host's.
   */
  .activity { border: 1px solid ${RULE}; border-radius: 6px; overflow: hidden; background: #fff; }
  .activity__bar { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem;
                   padding: .4rem .7rem; border-bottom: 1px solid ${RULE}; background: ${TINT};
                   font-size: .8rem; color: ${INK}; }
  .activity__title { font-weight: 700; color: ${RASPBERRY}; letter-spacing: .02em; }
  .activity__note { margin-left: auto; }
  /*
   * ⚠️ **Measured, not guessed, and it has two answers because the app has a
   * breakpoint.** The widget's two zones sit side by side above 1100px of FRAME
   * width and stack below it, so the frame needs the taller of the pair or their
   * sum: measured at 387px side-by-side and 717px stacked. A single height would
   * either scroll the desktop case or leave 330px of dead space in it.
   *
   * The host's own breakpoint is 1148px, not 1100px: body padding is 1.5rem a
   * side, so the frame is 48px narrower than the window. Getting that wrong by
   * 48px reintroduces the scrollbar in a 48px-wide band of window sizes, which
   * is exactly the kind of thing nobody would ever find.
   *
   * It still scrolls internally rather than clipping, because the alerts panel
   * is expandable and an unusually bad day must not be cut off.
   */
  .activity iframe { display: block; width: 100%; height: 46rem; border: 0; }
  @media (min-width: 1148px) {
    .activity iframe { height: 25rem; }
  }
`

/**
 * The front door.
 *
 * ⚠️ **This used to be the operator's bench, and that was the defect.** The root
 * URL served a capability switch and a launch form, while the thing worth looking
 * at — a chart with the SPiER panel embedded in it — was two clicks away and
 * undiscoverable. Reported directly: *"it was very difficult for me to understand
 * what to do."* A demo whose entry point does not say what to do is a demo nobody
 * runs correctly. The bench moved to `/settings`; the way in is now first.
 *
 * ── Why the embed is the summary and not the whole lens ─────────────────────
 *
 * It used to frame the app's entire Population view, which put **two patient
 * lists on one page**: the host's demographics table below and SPiER's sortable
 * caseload inside the frame. The frame was duplicating the list beside it, and
 * its row clicks navigated *within the iframe* rather than opening a chart here —
 * so the more useful-looking list was the one that went nowhere.
 *
 * The part a host cannot compute for itself is what sits above a worklist: the
 * summary tiles, the risk census and the alert groups. So the embed is
 * `#/population/summary` (`PopulationSummaryEmbed` in the app), it comes first
 * because that is where an EHR hangs a hosted activity, and the host's own table
 * — which owns the links into `/chart/{id}` — is the only list on the page.
 *
 * ⚠️ Read the label on the frame either way. It is still not a SMART launch: no
 * `iss`, no `launch`, and the app renders its own bundled registry rather than
 * this server's FHIR API. Calling it an embedded SMART view would be the kind of
 * claim §1 guardrail 3 exists to stop. Upgrading it needs a user-scoped launch
 * and a data-source refactor; see `docs/plans/embedded-panel-smart-launch.md`
 * §6.3.
 */
export function homePage(
  patients: DemoPatient[],
  { summaryPanelUrl }: { summaryPanelUrl: string },
): string {
  const rows = patients.map(p => `
      <tr>
        <td><a href="/chart/${esc(p.id)}">${esc(p.name)}</a></td>
        <td class="mono">${esc(p.mrn)}</td>
        <td class="mono">${esc(p.birthDate)}</td>
        <td>${esc(p.gender)}</td>
        <td class="mono">${esc(p.id)}</td>
      </tr>`).join('')

  return page({
    title: 'SPiER mock EHR',
    css: HOME_CSS,
    body: `
  <h1>SPiER mock EHR</h1>
  <p class="lede">
    A stand-in for a vendor chart, so SPiER can be launched into one. <strong>This is not
    SPiER</strong> — SPiER is what appears in the panel on the right of a patient's chart.
    <a href="/settings">Server settings and controls &rarr;</a>
  </p>

  <h2>Caseload summary and alerts</h2>
  <p class="lede">
    SPiER embedded as a hosted activity: the summary, the risk census and the outstanding alerts
    across the caseload — the part of a worklist page an EHR cannot compute for itself.
  </p>
  <div class="activity">
    <div class="activity__bar">
      <span class="activity__title">SPiER</span>
      <span>Embedded activity</span>
      <span class="activity__note">Everything below this bar is drawn by SPiER, not by the host.</span>
    </div>
    <iframe src="${esc(summaryPanelUrl)}" title="SPiER caseload summary and alerts (embedded)"></iframe>
  </div>
  <p class="warn">
    ⚠️ <strong>Embedded, but not a SMART launch — and the difference matters.</strong> This frame
    carries no <code>iss</code> and no <code>launch</code>, and the app renders its own bundled demo
    registry rather than this server's FHIR API. So it shows the <em>shape</em> of a hosted activity
    and proves nothing about data crossing the boundary. Making it real needs a user-scoped SMART
    launch (a caseload is not one patient, and every token this server issues is bound to one) and a
    refactor so the view reads through the data-source seam. Tracked in the panel plan &sect;6.3.
    The framed panel inside a <strong>chart</strong> is the real launch.
  </p>

  <h2>Patients</h2>
  <p class="lede">
    ${patients.length} synthetic patients &mdash; the host's own list, which is why it is plain.
    <strong>Open a chart</strong>: that is where the SPiER panel is launched over a real SMART
    handshake, and where an assessment can be filled in and written back.
  </p>
  <table>
    <thead><tr><th>Name</th><th>MRN</th><th>Born</th><th>Sex</th><th>FHIR id</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${DISCLAIMER}`,
  })
}

const CHART_CSS = `
  body.chart { padding: 0; }
  .chart-layout { display: flex; align-items: flex-start; min-height: 100vh; }
  .chart-main { flex: 1 1 auto; min-width: 0; padding: 1.5rem; }
  .banner { display: flex; flex-wrap: wrap; align-items: baseline; gap: .25rem 1rem; padding: .75rem 1rem;
            border: 1px solid ${RULE}; border-left: 4px solid ${RASPBERRY}; border-radius: 6px; background: ${TINT}; }
  .banner__name { font-size: 1.15rem; font-weight: 700; }
  .banner__meta { color: ${INK}; font-size: .9rem; font-variant-numeric: tabular-nums; }
  .banner__note { flex-basis: 100%; color: ${INK}; font-size: .8rem; }

  .cards { display: grid; gap: .75rem; padding: 0; margin: 0; list-style: none; }
  .card { border: 1px solid ${RULE}; border-radius: 6px; padding: .75rem 1rem; }
  .card--critical { border-left: 4px solid #b3123c; }
  .card--warning { border-left: 4px solid #b8681b; }
  .card--info { border-left: 4px solid ${INK}; }
  .card__summary { font-weight: 600; }
  .card__detail { margin: .35rem 0 0; font-size: .9rem; color: ${INK}; }
  .card__source { margin: .35rem 0 0; font-size: .75rem; color: ${INK}; }
  .card__links { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .6rem; }
  .cds-status { color: ${INK}; font-size: .9rem; }

  button { font: inherit; cursor: pointer; border-radius: 4px; padding: .35rem .7rem;
           border: 1px solid ${RULE}; background: #fff; color: inherit; }
  button.primary { background: ${RASPBERRY}; border-color: ${RASPBERRY}; color: #fff; font-weight: 600; }
  button.smart::before { content: "SMART"; font-size: .65rem; font-weight: 700; letter-spacing: .04em;
                         margin-right: .4rem; padding: .05rem .25rem; border-radius: 2px;
                         background: ${RASPBERRY}; color: #fff; }
  button.smart { border-color: ${RASPBERRY}; }

  /*
   * The launch card. This is the ONE thing a reader is meant to do on this page,
   * and it used to be the last element on it — below the CDS cards, the
   * capability switch and the FHIRcast log, under an <h2>Activity</h2> nobody
   * scrolled to. Same defect as the old front door (§6.3): the demo's entry
   * point was undiscoverable from the page it was on. It now sits directly under
   * the banner, which is also where a vendor hangs an activity button.
   */
  .launch { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.5rem;
            margin-top: 1rem; padding: 1rem 1.25rem; border: 1px solid ${RASPBERRY};
            border-radius: 6px; background: ${TINT_WARM}; }
  .launch__text { flex: 1 1 22rem; min-width: 0; }
  .launch__title { margin: 0; font-size: 1.05rem; }
  .launch__lede { margin: .25rem 0 0; font-size: .9rem; color: ${INK}; }
  .launch__button { font-size: 1rem; padding: .6rem 1.25rem; }

  /*
   * ⚠️ **Sticky and exactly one viewport tall — not stretched to the column
   * beside it.** With align-items: stretch (the flex default) the dock grows to
   * the height of the chart content, so the iframe becomes as tall as the host
   * page. The panel's own chrome is position: fixed — the code drawer and the
   * FHIRcast notice — which pins it to the bottom of the IFRAME's viewport, and
   * that is then a thousand pixels below the fold. Measured here: a 2073px chart
   * column gave a 1961px iframe in a 1000px window, and the FHIRcast banner
   * rendered correctly and invisibly.
   *
   * This is panel plan §9.1 finding 3 ("the code drawer is not merely cramped at
   * panel width — it is stranded") arriving from the other side: step 3 fixed it
   * inside the panel, and step 4's additions to THIS page reintroduced it from
   * the host. An embedded activity gets a viewport, so the frame has to be one.
   */
  .panel-dock { flex: 0 0 auto; align-self: flex-start; position: sticky; top: 0;
                height: 100vh; display: flex; flex-direction: column;
                border-left: 1px solid ${RULE}; background: ${TINT}; }
  .panel-dock__bar { display: flex; align-items: center; gap: .5rem; padding: .4rem .6rem; border-bottom: 1px solid ${RULE};
                     font-size: .8rem; color: ${INK}; }
  .panel-dock__title { font-weight: 700; color: ${RASPBERRY}; letter-spacing: .02em; }
  .panel-dock__close { margin-left: auto; padding: .1rem .4rem; font-size: .75rem; }
  .panel-dock__empty { padding: 1.5rem 1rem; color: ${INK}; font-size: .9rem; }
  .panel-dock iframe { flex: 1 1 auto; width: 100%; border: 0; background: #fff; }
  .panel-dock__sent { padding: .4rem .6rem; border-top: 1px solid ${RULE}; font-size: .75rem; color: ${INK};
                      overflow-wrap: anywhere; }
  .panel-dock[hidden] { display: none; }

  .server-note { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; font-size: .85rem; color: ${INK}; }
`

/**
 * One patient's chart, with the panel docked beside it.
 *
 * `cdsEndpoint` and `panelOrigin` are passed in rather than derived here so this
 * function stays a pure string builder — the same reason `controlPage` takes its
 * state as arguments.
 */
export function patientChartPage(
  patient: DemoPatient,
  {
    cdsEndpoint,
    panelOrigin,
    otherPatients,
  }: {
    cdsEndpoint: string
    panelOrigin: string
    /** Everyone except this patient, for the FHIRcast announce affordance. */
    otherPatients: DemoPatient[]
  },
): string {
  return page({
    title: `${patient.name} — SPiER mock EHR`,
    css: CHART_CSS,
    bodyClass: 'chart',
    body: `
  <div class="chart-layout">
    <div class="chart-main">
      ${crumbs([
    { label: 'SPiER mock EHR', href: '/' },
    { label: 'Patients', href: '/' },
    { label: patient.name },
  ])}

      <!-- The host's own patient banner. This is what licenses the launch to
           send need_patient_banner:false — see the note in the dock below. -->
      <div class="banner">
        <span class="banner__name">${esc(patient.name)}</span>
        <span class="banner__meta">MRN ${esc(patient.mrn)}</span>
        <span class="banner__meta">Born ${esc(patient.birthDate)}</span>
        <span class="banner__meta">${esc(patient.gender)}</span>
        <span class="banner__note">Host banner — drawn by the EHR, not by the panel.</span>
      </div>

      <!-- The vendor-configured activity, and the one thing to do on this page.
           It knows the patient and nothing else, so the panel opens on the
           pathway rather than in a tool. The CDS cards below are the OTHER entry
           point (§2), and they name an instrument — but this one has to be
           obvious without reading anything, which is why it is here and not
           under an <h2>Activity</h2> at the foot of the page. -->
      <div class="launch">
        <div class="launch__text">
          <h2 class="launch__title">SPiER Suicide-Safer Pathway</h2>
          <p class="launch__lede">
            The EHR's SPiER activity for this patient. Opens in a panel beside the chart over a real
            SMART handshake — authorize, read this server's FHIR API, fill in an assessment, write it
            back.
          </p>
        </div>
        <button type="button" id="open-panel" class="primary launch__button">Launch SPiER &rarr;</button>
      </div>

      <h2>Clinical decision support</h2>
      <p class="lede">
        <code>patient-view</code> fired against
        <a href="${esc(cdsEndpoint)}">${esc(cdsEndpoint)}</a>.
        A card link of <code>type: "smart"</code> launches the panel into this chart, scoped to the
        instrument the card names.
      </p>
      <p id="cds-status" class="cds-status">Calling the CDS service…</p>
      <ul id="cds-cards" class="cards"></ul>

      <!-- ⚠️ A READOUT, not a control, and that distinction is why it survived
           the switch's removal. This is the SERVER's account of what the panel
           wrote; the panel's own scorecard is SPiER reporting on itself, and one
           source cannot corroborate anything. Resetting it, and turning the
           server's capability down, are operator actions and live on /settings. -->
      <p class="server-note">
        <span id="writes-summary">Loading written data…</span>
        <a href="/settings">Capability profile, reset and other controls &rarr;</a>
      </p>

      <h2>Shared context (FHIRcast)</h2>
      <p class="lede">
        This chart is a FHIRcast subscriber on the EHR's own hub, and it tells the panel which
        session it is in via <code>hub.url</code> and <code>hub.topic</code> on the token response.
        Opening a chart announces <code>patient-open</code>; the panel is subscribed to the same
        topic and reacts to it <strong>across the origin boundary</strong>.
      </p>
      <p class="server-note">
        <span id="cast-status">Subscribing to the hub…</span>
      </p>

      <!-- ⚠️ Why a button and not just "open another chart": navigating this page
           is a full page load, which destroys the iframe — so the panel would be
           gone before it could react. This announces a context change WITHOUT
           navigating, which is the only way to watch the panel receive one. A
           demo affordance, and it says so. -->
      <form id="cast-form">
        <label>Announce a context change to another patient
          <select name="patient">${otherPatients.map(p => `
            <option value="${esc(p.id)}">${esc(p.name)} &middot; ${esc(p.id)}</option>`).join('')}
          </select>
        </label>
        <button type="submit">Announce patient-open</button>
      </form>
      <p class="server-note">
        Stands in for the clinician opening a different chart. The panel is scoped to
        ${esc(patient.name)} by its access token, so it <em>cannot</em> follow — watch it say so
        rather than fail.
      </p>
      <ul id="cast-log" class="cards"></ul>

      ${DISCLAIMER}
    </div>

    <aside class="panel-dock" id="dock" hidden aria-label="SPiER panel">
      <div class="panel-dock__bar">
        <span class="panel-dock__title">SPiER</span>
        <span id="dock-context"></span>
        <button type="button" id="close-panel" class="panel-dock__close" title="Close the panel">&times;</button>
      </div>
      <iframe id="panel" title="SPiER Suicide-Safer Pathway" src="about:blank"></iframe>
      <p class="panel-dock__sent" id="dock-sent"></p>
    </aside>
  </div>`,
    script: chartScript({ patient, cdsEndpoint, panelOrigin }),
  })
}

/**
 * The chart page's behaviour. Plain ES2020 in a string — this Worker has no
 * Static Assets binding and no client bundle, which is also why it is small.
 */
function chartScript({
  patient,
  cdsEndpoint,
  panelOrigin,
}: { patient: DemoPatient; cdsEndpoint: string; panelOrigin: string }): string {
  // Split for the FHIRcast context Patient, which carries a HumanName. Same
  // "first token is the given name" rule `buildContextPatient` uses in the app —
  // crude, and correct for every synthetic name in this repo.
  const [given, ...familyParts] = patient.name.split(' ')
  return `
  var PATIENT = ${JSON.stringify(patient.id)};
  var MRN = ${JSON.stringify(patient.mrn)};
  var GIVEN = ${JSON.stringify(given ?? '')};
  var FAMILY = ${JSON.stringify(familyParts.join(' '))};
  // Imported rather than restated: the MRN namespace has four sites that must
  // agree and check:patients gates them (see fixtures.ts).
  var MRN_SYSTEM = ${JSON.stringify(MRN_SYSTEM)};
  var CDS_ENDPOINT = ${JSON.stringify(cdsEndpoint)};
  var PANEL_ORIGIN = ${JSON.stringify(panelOrigin)};

  /**
   * The FHIRcast session topic, held in sessionStorage for the TAB.
   *
   * Per-tab rather than per-page: opening patient-012's chart is a full page
   * navigation, and a topic minted per load would put every chart in its own
   * session — so the panel launched from the previous chart would never hear
   * about the new one, which is exactly the event worth demonstrating. Per-tab
   * also keeps two people demonstrating at once on separate sessions.
   */
  var TOPIC = (function () {
    var key = 'spier-mock-ehr:fhircast-topic';
    try {
      var existing = sessionStorage.getItem(key);
      if (existing) return existing;
      var minted = 'host-' + crypto.randomUUID();
      sessionStorage.setItem(key, minted);
      return minted;
    } catch (e) {
      // Storage denied — fall back to a per-load topic. The demo degrades to
      // "the panel does not follow", which is visible, rather than throwing.
      return 'host-' + crypto.randomUUID();
    }
  })();

  var dock = document.getElementById('dock');
  var frame = document.getElementById('panel');
  var dockContext = document.getElementById('dock-context');
  var dockSent = document.getElementById('dock-sent');

  /*
   * The panel width, read from the operator's preference and never offered here.
   *
   * ⚠️ **The whitelist is the point, not the default.** localStorage is
   * attacker-writable in the sense that matters for a demo — anything on this
   * origin can put a string there — and this value goes into an inline style, so
   * an unvalidated read is how a preference becomes an injection. Only the three
   * measured widths are honored; anything else is the middle one.
   */
  var PANEL_WIDTHS = ${JSON.stringify(PANEL_WIDTHS)};
  function storedWidth() {
    try {
      var raw = Number(localStorage.getItem(${JSON.stringify(PANEL_WIDTH_KEY)}));
      return PANEL_WIDTHS.indexOf(raw) === -1 ? ${DEFAULT_PANEL_WIDTH} : raw;
    } catch (e) {
      // Storage denied. The middle width is the answer, which is also the answer
      // for every viewer who has never opened /settings.
      return ${DEFAULT_PANEL_WIDTH};
    }
  }
  (function (px) {
    dock.style.flexBasis = px + 'px';
    dock.style.width = px + 'px';
  })(storedWidth());

  document.getElementById('close-panel').addEventListener('click', function () {
    // about:blank rather than removing the node: a closed panel that keeps its
    // session alive would hide whether the next launch really re-authorizes.
    frame.src = 'about:blank';
    dock.hidden = true;
  });

  /**
   * Mint a launch context and point the iframe at it.
   *
   * needPatientBanner is always false here because this page draws a banner
   * two inches to the left. embed:true is what puts the app in panel chrome.
   */
  function launch(intent, label) {
    dock.hidden = false;
    dockContext.textContent = 'authorizing…';
    dockSent.textContent = '';
    return fetch('/_admin/launch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        patient: PATIENT,
        intent: intent || undefined,
        needPatientBanner: false,
        embed: true,
        // ⚠️ THIS page's topic, not a fresh one. The panel joins the session the
        // host is already in, which is the whole point — a per-launch topic
        // would give each side its own session and nothing would cross, while
        // looking identical to working.
        topic: TOPIC,
      }),
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (body) {
      frame.src = body.launchUrl;
      dockContext.textContent = label || 'pathway';
      dockSent.innerHTML = 'Launch context sent: <code>patient=' + PATIENT + '</code>'
        + (intent ? ' <code>intent=' + intent + '</code>' : '')
        + ' <code>need_patient_banner=false</code>'
        + ' <code>hub.topic=' + TOPIC + '</code>';
    }).catch(function (err) {
      dockContext.textContent = '';
      dockSent.textContent = 'Could not mint a launch: ' + err.message;
    });
  }

  document.getElementById('open-panel').addEventListener('click', function () { launch(null, 'pathway'); });

  // ── FHIRcast: subscribe, then announce this chart ─────────────────────────
  //
  // The subscription is the spec's: POST the hub with hub.channel.type=websocket
  // and connect to the endpoint it hands back. Announcing patient-open on load is
  // what a real EHR does when a chart is opened, and it is what the embedded
  // panel reacts to.
  var castStatus = document.getElementById('cast-status');
  var castForm = document.getElementById('cast-form');
  var castLog = document.getElementById('cast-log');

  function logCast(text, kind) {
    var li = document.createElement('li');
    li.className = 'card card--' + (kind || 'info');
    li.textContent = text;
    castLog.insertBefore(li, castLog.firstChild);
  }

  fetch('/fhircast', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'hub.channel.type': 'websocket',
      'hub.mode': 'subscribe',
      'hub.topic': TOPIC,
      'hub.events': 'patient-open',
    }).toString(),
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function (body) {
    var endpoint = body['hub.channel.endpoint'];
    if (!endpoint) throw new Error('the hub returned no channel endpoint');
    var socket = new WebSocket(endpoint);
    socket.addEventListener('open', function () {
      castStatus.innerHTML = 'Subscribed on <code>' + TOPIC + '</code>. Announcing this chart…';
      announce();
    });
    socket.addEventListener('message', function (e) {
      var parsed;
      try { parsed = JSON.parse(e.data); } catch (err) { return; }
      if (parsed['hub.mode'] === 'subscribe') {
        logCast('Hub confirmed the subscription on topic ' + parsed['hub.topic'], 'info');
        return;
      }
      var evt = parsed.event || {};
      // The ACK the spec asks of a subscriber.
      if (parsed.id) socket.send(JSON.stringify({ id: parsed.id, status: 'ok' }));
      var ctx = (evt.context || [])[0] || {};
      var who = (ctx.resource || {}).id || '(unknown)';
      logCast(evt['hub.event'] + ' → ' + who + '  (received on the hub)', 'info');
    });
    socket.addEventListener('close', function () {
      castStatus.textContent = 'The hub connection closed.';
    });
  }).catch(function (err) {
    castStatus.textContent = 'Could not subscribe to the hub: ' + err.message;
  });

  castForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = new FormData(e.target).get('patient');
    var option = e.target.querySelector('option[value="' + id + '"]');
    var label = option ? option.textContent.split('\u00b7')[0].trim() : String(id);
    var parts = label.split(' ');
    publish(String(id), parts[0], parts.slice(1).join(' '), '');
  });

  /** Publish patient-open for THIS chart's patient. */
  function announce() {
    var event = {
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
      event: {
        'hub.topic': TOPIC,
        'hub.event': 'patient-open',
        context: [{
          key: 'patient',
          resource: {
            resourceType: 'Patient',
            id: PATIENT,
            identifier: [{ system: MRN_SYSTEM, value: MRN }],
            name: [{ given: [GIVEN], family: FAMILY }],
          },
        }],
      },
    };
    postEvent(event, PATIENT);
  }

  /** Publish patient-open for an arbitrary patient, on this page's topic. */
  function publish(id, given, family, mrn) {
    postEvent({
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
      event: {
        'hub.topic': TOPIC,
        'hub.event': 'patient-open',
        context: [{
          key: 'patient',
          resource: {
            resourceType: 'Patient',
            id: id,
            identifier: mrn ? [{ system: MRN_SYSTEM, value: mrn }] : undefined,
            name: [{ given: [given], family: family }],
          },
        }],
      },
    }, id);
  }

  function postEvent(event, who) {
    fetch('/fhircast/' + encodeURIComponent(TOPIC), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    }).then(function (res) { return res.json(); }).then(function (body) {
      castStatus.innerHTML = 'Announced <code>patient-open</code> for ' + who
        + ' on <code>' + TOPIC + '</code> — delivered to ' + body.delivered + ' subscriber(s).';
      logCast('patient-open → ' + who + '  (published by this chart)', 'info');
    }).catch(function (err) {
      castStatus.textContent = 'Could not announce: ' + err.message;
    });
  }

  // ── The server's own account of what was written ─────────────────────────
  // Deliberately independent of the panel's scorecard: the ladder reporting on
  // itself and the server reporting on the same event are two statements, and
  // only two make it checkable.
  function refreshWrites() {
    return fetch('/_admin/writes').then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (body) {
      var out = document.getElementById('writes-summary');
      if (!body) { out.textContent = 'No DEMO_STORE binding — writes cannot be persisted.'; return; }
      if (body.count === 0) { out.textContent = 'Nothing written yet.'; return; }
      out.textContent = body.count + ' resource(s) written: ' + Object.keys(body.byType).sort().map(function (t) {
        return body.byType[t] + ' ' + t;
      }).join(', ');
    }).catch(function () {
      document.getElementById('writes-summary').textContent = 'Could not read the write log.';
    });
  }
  refreshWrites();
  // The panel writes on submit, inside a cross-origin frame we cannot observe,
  // so poll while it is open rather than pretending to know when it finished.
  setInterval(function () { if (!dock.hidden) refreshWrites(); }, 4000);

  // ── CDS Hooks patient-view ────────────────────────────────────────────────
  // No prefetch: see the module header. hookInstance must be unique per call.
  fetch(CDS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hook: 'patient-view',
      hookInstance: crypto.randomUUID(),
      fhirServer: window.location.origin + '/fhir',
      context: { patientId: PATIENT },
    }),
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function (body) {
    renderCards(body.cards || []);
  }).catch(function (err) {
    document.getElementById('cds-status').textContent =
      'The CDS service at ' + PANEL_ORIGIN + ' could not be reached (' + err.message + ').';
  });

  function renderCards(cards) {
    var status = document.getElementById('cds-status');
    var list = document.getElementById('cds-cards');
    if (cards.length === 0) {
      status.textContent = 'The CDS service returned no cards for this patient.';
      return;
    }
    status.textContent = cards.length + (cards.length === 1 ? ' card' : ' cards') + ' returned.';
    cards.forEach(function (card) {
      var li = document.createElement('li');
      li.className = 'card card--' + (card.indicator || 'info');

      var summary = document.createElement('p');
      summary.className = 'card__summary';
      summary.textContent = card.summary || '';
      li.appendChild(summary);

      if (card.detail) {
        var detail = document.createElement('p');
        detail.className = 'card__detail';
        // Rendered as text, not markdown: the spec allows GFM in the detail field and a
        // markdown renderer is not worth shipping to prove a launch works.
        detail.textContent = card.detail;
        li.appendChild(detail);
      }

      var source = document.createElement('p');
      source.className = 'card__source';
      source.textContent = 'Source: ' + ((card.source && card.source.label) || 'unknown');
      li.appendChild(source);

      var links = card.links || [];
      if (links.length > 0) {
        var row = document.createElement('div');
        row.className = 'card__links';
        links.forEach(function (link) {
          if (link.type === 'smart') {
            // The host mints the launch — the card supplies the app's launch
            // URL and its appContext, never OAuth parameters.
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'smart';
            btn.textContent = link.label;
            btn.addEventListener('click', function () { launch(intentOf(link), link.label); });
            row.appendChild(btn);
          } else {
            // type: "absolute" — a plain deep link. Opened in a new tab rather
            // than the panel: it is not a SMART launch and carries no context.
            var a = document.createElement('a');
            a.href = link.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = link.label + ' ↗';
            row.appendChild(a);
          }
        });
        li.appendChild(row);
      }
      list.appendChild(li);
    });
  }

  /** appContext is a JSON string per the CDS Hooks spec; tolerate anything else. */
  function intentOf(link) {
    if (!link.appContext) return null;
    try {
      var parsed = JSON.parse(link.appContext);
      return parsed && typeof parsed.intent === 'string' ? parsed.intent : null;
    } catch (e) {
      return null;
    }
  }
`
}
