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

/**
 * Panel widths the demo can switch between, in CSS pixels.
 *
 * Not arbitrary: 470 is the width the step-0 spike measured the longest
 * instrument in the repo at (panel plan §9.1 — zero horizontal overflow), 700
 * is the width that buys one-line option labels and ~14% less scrolling, and
 * 380 is below both, kept so the demo can show the floor rather than claim it.
 * The spike's conclusion was that the choice is a presentation preference, so
 * this exposes it as one.
 */
const PANEL_WIDTHS = [380, 470, 700] as const
const DEFAULT_PANEL_WIDTH = 470

const LIST_CSS = `
  table { border-collapse: collapse; width: 100%; font-size: .95rem; }
  th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid ${RULE}; }
  th { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: ${INK}; }
  tbody tr:hover { background: ${TINT_WARM}; }
  td a { font-weight: 600; text-decoration: none; }
  td.mono { font-variant-numeric: tabular-nums; color: ${INK}; }
`

/** The patient list — the way into a chart, and nothing more. */
export function patientListPage(patients: DemoPatient[]): string {
  const rows = patients.map(p => `
      <tr>
        <td><a href="/chart/${esc(p.id)}">${esc(p.name)}</a></td>
        <td class="mono">${esc(p.mrn)}</td>
        <td class="mono">${esc(p.birthDate)}</td>
        <td>${esc(p.gender)}</td>
        <td class="mono">${esc(p.id)}</td>
      </tr>`).join('')

  return page({
    title: 'Patients — SPiER mock EHR',
    css: LIST_CSS,
    body: `
  ${crumbs([{ label: 'SPiER mock EHR', href: '/' }, { label: 'Patients' }])}
  <h1>Patients</h1>
  <p class="lede">
    ${patients.length} synthetic patients, read from the app's own population scenarios.
    Open a chart to launch the SPiER panel inside it.
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
  .chart-layout { display: flex; align-items: stretch; min-height: 100vh; }
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

  .panel-dock { flex: 0 0 auto; display: flex; flex-direction: column; border-left: 1px solid ${RULE}; background: ${TINT}; }
  .panel-dock__bar { display: flex; align-items: center; gap: .5rem; padding: .4rem .6rem; border-bottom: 1px solid ${RULE};
                     font-size: .8rem; color: ${INK}; }
  .panel-dock__title { font-weight: 700; color: ${RASPBERRY}; letter-spacing: .02em; }
  .panel-dock__widths { margin-left: auto; display: flex; gap: .25rem; }
  .panel-dock__widths button { padding: .1rem .4rem; font-size: .75rem; }
  .panel-dock__widths button[aria-pressed="true"] { background: ${RASPBERRY}; border-color: ${RASPBERRY}; color: #fff; }
  .panel-dock__empty { padding: 1.5rem 1rem; color: ${INK}; font-size: .9rem; }
  .panel-dock iframe { flex: 1 1 auto; width: 100%; border: 0; background: #fff; }
  .panel-dock__sent { padding: .4rem .6rem; border-top: 1px solid ${RULE}; font-size: .75rem; color: ${INK};
                      overflow-wrap: anywhere; }
  .panel-dock[hidden] { display: none; }

  .profiles { list-style: none; padding: 0; margin: 0; display: grid; gap: .4rem; }
  .profiles button { width: 100%; text-align: left; display: grid; gap: .15rem; padding: .5rem .75rem; }
  .profiles button span { font-size: .8rem; color: ${INK}; }
  .profiles button[aria-pressed="true"] { border-color: ${RASPBERRY}; box-shadow: inset 3px 0 0 ${RASPBERRY}; background: ${TINT_WARM}; }
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
    profiles,
    activeProfile,
  }: {
    cdsEndpoint: string
    panelOrigin: string
    /** Every capability profile, with its one-line description. */
    profiles: Array<{ profile: string; description: string }>
    activeProfile: string
  },
): string {
  const widthButtons = PANEL_WIDTHS.map(w => `
        <button type="button" data-width="${w}" aria-pressed="${w === DEFAULT_PANEL_WIDTH}">${w}px</button>`).join('')

  return page({
    title: `${patient.name} — SPiER mock EHR`,
    css: CHART_CSS,
    bodyClass: 'chart',
    body: `
  <div class="chart-layout">
    <div class="chart-main">
      ${crumbs([
    { label: 'SPiER mock EHR', href: '/' },
    { label: 'Patients', href: '/chart' },
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

      <h2>Clinical decision support</h2>
      <p class="lede">
        <code>patient-view</code> fired against
        <a href="${esc(cdsEndpoint)}">${esc(cdsEndpoint)}</a>.
        A card link of <code>type: "smart"</code> launches the panel into this chart, scoped to the
        instrument the card names.
      </p>
      <p id="cds-status" class="cds-status">Calling the CDS service…</p>
      <ul id="cds-cards" class="cards"></ul>

      <h2>What this server will accept</h2>
      <p class="lede">
        The capability-degradation demo. Flip the profile, relaunch, submit the same instrument: the
        panel's writeback ladder reads <code>/metadata</code> and climbs only as far as this says it
        can, then reports what it could not write instead of hiding it.
      </p>
      <ul class="profiles">${profiles.map(p => `
        <li>
          <button type="button" data-profile="${esc(p.profile)}" aria-pressed="${p.profile === activeProfile}">
            <strong>${esc(p.profile)}</strong>
            <span>${esc(p.description)}</span>
          </button>
        </li>`).join('')}</ul>
      <p class="server-note">
        <span id="writes-summary">Loading written data…</span>
        <button type="button" id="reset-writes">Reset written data</button>
      </p>

      <h2>Activity</h2>
      <p class="lede">
        The vendor-configured entry point: it knows the patient and nothing else, so the panel opens
        on the pathway rather than in a tool.
      </p>
      <button type="button" id="open-panel" class="primary">Open SPiER Suicide-Safer Pathway</button>

      ${DISCLAIMER}
    </div>

    <aside class="panel-dock" id="dock" hidden aria-label="SPiER panel">
      <div class="panel-dock__bar">
        <span class="panel-dock__title">SPiER</span>
        <span id="dock-context"></span>
        <span class="panel-dock__widths">${widthButtons}
          <button type="button" id="close-panel" title="Close the panel">&times;</button>
        </span>
      </div>
      <iframe id="panel" title="SPiER Suicide-Safer Pathway" src="about:blank"></iframe>
      <p class="panel-dock__sent" id="dock-sent"></p>
    </aside>
  </div>`,
    script: chartScript({ patientId: patient.id, cdsEndpoint, panelOrigin }),
  })
}

/**
 * The chart page's behaviour. Plain ES2020 in a string — this Worker has no
 * Static Assets binding and no client bundle, which is also why it is small.
 */
function chartScript({
  patientId,
  cdsEndpoint,
  panelOrigin,
}: { patientId: string; cdsEndpoint: string; panelOrigin: string }): string {
  return `
  var PATIENT = ${JSON.stringify(patientId)};
  var CDS_ENDPOINT = ${JSON.stringify(cdsEndpoint)};
  var PANEL_ORIGIN = ${JSON.stringify(panelOrigin)};

  var dock = document.getElementById('dock');
  var frame = document.getElementById('panel');
  var dockContext = document.getElementById('dock-context');
  var dockSent = document.getElementById('dock-sent');

  function setWidth(px) {
    dock.style.flexBasis = px + 'px';
    dock.style.width = px + 'px';
    document.querySelectorAll('[data-width]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.width) === px));
    });
  }
  setWidth(${DEFAULT_PANEL_WIDTH});
  document.querySelectorAll('[data-width]').forEach(function (b) {
    b.addEventListener('click', function () { setWidth(Number(b.dataset.width)); });
  });

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
      }),
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (body) {
      frame.src = body.launchUrl;
      dockContext.textContent = label || 'pathway';
      dockSent.innerHTML = 'Launch context sent: <code>patient=' + PATIENT + '</code>'
        + (intent ? ' <code>intent=' + intent + '</code>' : '')
        + ' <code>need_patient_banner=false</code>';
    }).catch(function (err) {
      dockContext.textContent = '';
      dockSent.textContent = 'Could not mint a launch: ' + err.message;
    });
  }

  document.getElementById('open-panel').addEventListener('click', function () { launch(null, 'pathway'); });

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

  document.getElementById('reset-writes').addEventListener('click', function () {
    fetch('/_admin/reset', { method: 'POST' }).then(function (res) {
      if (!res.ok) { alert('Could not reset: HTTP ' + res.status); return; }
      refreshWrites();
    });
  });

  document.querySelectorAll('[data-profile]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      fetch('/_admin/capabilities', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: btn.dataset.profile }),
      }).then(function (res) {
        if (!res.ok) { alert('Could not switch profile: HTTP ' + res.status); return; }
        document.querySelectorAll('[data-profile]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
      });
    });
  });

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
