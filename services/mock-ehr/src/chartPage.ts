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
import { DISCLAIMER, crumbs, esc, page } from './hostChrome'
import { ageOn, chartRecordFor, formatDate, type ChartSection } from './chartRecord'
import type { DemoPatient } from './fixtures'
import { TRY_IT_ORDER, storyOf } from './demoStories'
import { MRN_SYSTEM } from '@spier/core/lib/fhircast'
import type { ChartClientConfig } from './client/types'

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

/*
 * The front door's own rules. Everything structural — the table, the cards, the
 * guest frame — is a host component now (`hostChrome.ts`); what is left here is
 * the ONE measurement specific to this page.
 *
 * ⚠️ **Measured, not guessed, and it has two answers because the app has a
 * breakpoint.** The widget's two zones sit side by side above 1100px of FRAME
 * width and stack below it, so the frame needs the taller of the pair or their
 * sum: measured at 387px side-by-side and 717px stacked. A single height would
 * either scroll the desktop case or leave 330px of dead space in it.
 *
 * ⚠️ **This is a CONTAINER query, and that is the fix for a trap this rule fell
 * into twice.** It was a media query at 1148px — 1100 plus the 48px of body
 * padding that made the frame narrower than the window — with a comment noting
 * that getting the offset wrong by 48px would reintroduce the scrollbar in a
 * 48px-wide band of window sizes nobody would ever find. Then the page grew a
 * `max-width`, and the offset was wrong by far more than 48px: the frame could
 * no longer exceed 1040px at ANY window width, so the side-by-side branch became
 * unreachable and every viewer got the stacked layout in a 25rem frame.
 *
 * The measurement was always about the frame, so the query asks the frame.
 * Nothing between here and the viewport can invalidate it again — which is the
 * property the hand-computed offset never had.
 */
/*
 * ⚠️ **This block used to hold the front door's one measurement and now holds
 * its one behaviour.** The measurement was the embedded caseload frame's height,
 * container-queried at 1100px of FRAME width because the widget's two zones sat
 * side by side above that and stacked below it. #401 replaced that frame with a
 * real launch, so there is no guest frame on this page to measure — the whole
 * rule is deleted rather than kept "in case", since a stale height on a
 * non-existent element is the kind of thing that outlives everyone who
 * understood it.
 *
 * What replaces it is the launch itself: the button POSTs for a user-scoped
 * launch context and follows the URL the server hands back, exactly as the
 * chart's own launch button does. Inline because this page has no bundler and
 * one listener does not earn a module.
 */
/*
 * The front door's own rules: the framed activity, and the launch buttons beside
 * it.
 *
 * ── The frame is a VIEWPORT, not a fitted box ──────────────────────────────
 *
 * ⚠️ **Do not try to make this frame the height of its content again.** Two
 * separate attempts are on the record and both failed, in different ways:
 *
 *   1. A media query at 1148px — 1100 plus the body padding that made the frame
 *      narrower than the window. The page later grew a `max-width`, the offset
 *      became wrong by far more than 48px, and the side-by-side branch was
 *      unreachable at every window width. Nobody could see it.
 *   2. A container query on `.guest` (still declared in hostChrome.ts, still the
 *      right instinct) with two measured heights, 387px side by side and 717px
 *      stacked. #401 deleted the frame and the numbers went stale with it.
 *
 * The chart's dock settled this from the other side and its comment has the
 * measurement: a 2073px chart column gave a 1961px iframe in a 1000px window,
 * and the panel's own `position: fixed` chrome — the code drawer, the FHIRcast
 * notice — was pinned a thousand pixels below the fold. **An embedded activity
 * gets a viewport, so the frame has to be one.** A frame sized to its content
 * has no viewport, and the guest's fixed chrome has nothing to pin to.
 *
 * So: a fixed height, the guest scrolls inside it, and no number here depends on
 * anything inside the panel. `clamp` keeps it honest on a laptop and on a
 * projector — the floor is roughly the summary's two zones stacked, the ceiling
 * stops it eating a tall display, and 62vh is what leaves the patient table
 * visibly below the fold-line rather than pushed off it.
 */
const HOME_CSS = `
  .worklist-launches { display: flex; flex-wrap: wrap; gap: var(--s3); }
  .activity iframe { height: clamp(420px, 62vh, 760px); }
`

/*
 * The front door's behaviour — the framed caseload launch and the two worklist
 * launches — is `src/client/home.ts`, built and served by the Worker (see
 * clientAssets.ts). It was an inline script here until 2026-09-20; the rules it
 * follows (mint the launch at runtime, never bake a URL into the markup;
 * `embed: true`; no topic) are documented at the top of that module.
 */

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
 * `#/population/summary` (`PopulationSummaryEmbed` in the app), and the host's
 * own table — which owns the links into `/chart/{id}` — is the only list on the
 * page.
 *
 * ── Why the page reads: caseload → start here → patients → about ────────────
 *
 * ⚠️ **This order has now been set three ways, and the thing being ordered
 * changed underneath it. Read the whole history before moving it a fourth
 * time.**
 *
 * 1. **Caseload first, until 2026-09** — where an EHR hangs a hosted activity,
 *    so that is where it was put. A first-time viewer then met, in order: a
 *    sentence saying "this is not SPiER", a dense iframe full of registry
 *    vocabulary, a long warning box saying the frame proves nothing, and only
 *    then the instruction to open a chart. The one thing on the page the page
 *    itself disclaims was the first thing on it. Reviewed as a user
 *    (2026-09-01): *"there's a lot of technical information about how the thing
 *    is built, but it doesn't make it easy to understand what the heck I'm
 *    supposed to do."*
 * 2. **Caseload demoted below the patient table**, so the page led with which
 *    charts to open and why.
 * 3. **Caseload back on top (2026-09-15, by request)** — and this is not a
 *    revert, because what sits here is no longer what was demoted. #401 deleted
 *    the iframe: the section is now a heading, two sentences and two buttons,
 *    and the warning box that used to follow it lives in the `.hood` drawer.
 *    The defect step 2 was written against was *density before instruction*, and
 *    the density is gone.
 * 4. **The frame comes back, and stays on top (2026-09-17, by request).**
 *    Reported directly: the caseload button *"takes you back to the adoption
 *    guide, but in reality, this is an iframed app that is running against the
 *    EHRs data."* That was accurate — the button did
 *    `window.location.href = launchUrl`, navigating the whole page away to
 *    another origin, which reads as the demo giving up rather than as an
 *    activity running inside a host.
 *
 * ⚠️ **Step 3 left a rule saying a regained frame must go BELOW the table, and
 * this is not a violation of it — read what the rule was about.** Its stated
 * reason is "step 1's defect returns with it", and step 1's defect is named in
 * the three bullets below: *density before instruction*. What sat on top in
 * step 1 was a dense iframe of registry vocabulary followed by a long warning
 * box, with the instruction underneath all of it. What sits on top now is the
 * instruction (the `<h1>` lede, which still says open a chart and press Launch
 * SPiER), then one sentence, then the frame; the warning box is still in
 * `.hood`. The defect the rule protects against is the ordering of INSTRUCTION
 * against DENSITY, not the ordering of a frame against a table. If a later pass
 * wants to move it again, that is the question to ask.
 *
 * **What must stay true whatever the order is**, because these are the rules
 * the four passes were actually about, not the sequence itself:
 *
 * - The instruction comes before the disclaimer. "Open a chart" is in the first
 *   paragraph, above everything including the caseload.
 * - The caveats are not softened — the panel plan §1 requires the page to SAY
 *   what it does not prove — they are one click away in `.hood` rather than
 *   inline. Never inline them again to "balance" a section that moved up.
 * - A frame on top must be preceded by the instruction and followed by the
 *   patient table. That is the shape step 1 got wrong and step 4 gets right.
 *
 * ⚠️ **The frame's claim changed with #401 and again here, so read the label.**
 * It is no longer the labelled fake: it carries a real `iss` and `launch`, over
 * a user-scoped authorization, reading this server's FHIR API. What it still
 * does not prove is interoperability — this host is written and run by the same
 * project as the app it launches — and that paragraph stays unsoftened in the
 * `.hood` drawer where §1 guardrail 3 put it.
 */
export function homePage(patients: DemoPatient[], { scriptUrl }: { scriptUrl: string }): string {
  const byId = new Map(patients.map(p => [p.id, p]))
  const picks = TRY_IT_ORDER.map(id => {
    const patient = byId.get(id)
    const { tryIt } = storyOf(id)
    if (!patient || !tryIt) throw new Error(`[mock-ehr] TRY_IT_ORDER names ${id}, which has no chart or no tryIt`)
    return `
      <li class="try__card">
        <h3 class="try__name">${esc(patient.name)}</h3>
        <p class="try__why">${esc(tryIt.why)}</p>
        <p class="try__watch"><strong>What to notice:</strong> ${esc(tryIt.watch)}</p>
        <a class="btn btn--primary" href="/chart/${esc(patient.id)}">Open chart &rarr;</a>
      </li>`
  }).join('')

  const rows = patients.map(p => `
      <tr>
        <td><a href="/chart/${esc(p.id)}">${esc(p.name)}</a></td>
        <td class="story">${esc(storyOf(p.id).story)}</td>
        <td class="mono">${esc(p.mrn)}</td>
        <td class="mono">${esc(p.birthDate)}</td>
        <td>${esc(p.gender)}</td>
      </tr>`).join('')

  return page({
    title: 'SPiER mock EHR',
    css: HOME_CSS,
    scriptSrc: scriptUrl,
    nav: 'chart',
    // ⚠️ Still `wide`, but no longer for the reason it was. It was wide so the
    // embedded caseload frame could reach the 1100px at which SPiER's widget
    // laid its two zones side by side; that frame is gone (#401). What keeps it
    // wide is the fourteen-row patient table, which is this page's real content
    // and has five columns.
    variant: 'wide',
    body: `
  <h1>Patients</h1>
  <p class="lede">
    A stand-in for a vendor EHR, so SPiER can be launched inside one. <strong>Open a chart</strong>
    and press <strong>Launch SPiER</strong>: SPiER opens in a panel beside the chart, shows where that
    patient is on the suicide-safer care pathway, and writes anything you record back to this chart.
    The slate chrome is the host; the panel is SPiER. This host is not SPiER.
  </p>

  <h2>Caseload</h2>
  <p class="lede">
    A worklist activity, running here rather than somewhere else: SPiER reads <strong>this
    server's</strong> fourteen patients over FHIR and reports who is owed an action. Unlike a chart
    launch it carries no patient &mdash; the token is user-scoped, so the app may read across the
    panel and may not write to anyone.
  </p>
  <section class="activity guest" aria-label="SPiER caseload activity">
    <div class="guest__bar">
      <span class="guest__title">SPiER</span>
      <span>Caseload summary &middot; user-scoped launch</span>
      <span class="guest__note" id="activity-status">Authorizing&hellip;</span>
    </div>
    <iframe id="activity" title="SPiER caseload summary" src="about:blank"></iframe>
  </section>
  <p class="lede">
    Everything inside that border is drawn by SPiER; everything around it is this host. It is a real
    SMART launch, minted the way the chart's panel is &mdash; not a picture of one.
  </p>
  <p class="worklist-launches">
    <button type="button" class="btn primary" data-launch-worklist>Open the full caseload &rarr;</button>
    <button type="button" class="btn" data-launch-worklist data-intent="open-measures">
      Launch measures &rarr;
    </button>
  </p>
  <p class="lede">
    Both open top-level, in this tab, the way an EHR opens an activity that wants the whole window.
    The measures button sends a SMART <code>intent</code> naming the tool &mdash; the same mechanism
    a CDS card uses to open a specific instrument in a chart, applied to a launch that has no chart.
  </p>

  <h2>Start here</h2>
  <p class="lede">
    Three charts that show the pathway at different points. Any of the ${patients.length} works; these
    three are where the demo has something to do.
  </p>
  <ul class="try">${picks}</ul>

  <h2>Patient list</h2>
  <p class="lede">
    ${patients.length} synthetic patients. Each line says what that chart is a story about.
  </p>
  <table class="table">
    <thead><tr><th>Name</th><th>Story</th><th>MRN</th><th>Born</th><th>Sex</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>


  <details class="hood">
    <summary>About this demo, and what it does and does not prove</summary>
    <div class="hood__body">
      <h3>What this is</h3>
      <p class="lede">
        A mock EHR: a FHIR server holding SPiER's own fourteen synthetic patients, with a patient
        list, a chart per patient, and a SMART on FHIR authorization server — enough for SPiER to be
        launched into a chart the way a vendor EHR would launch it. Operator controls (the server's
        capability profile, a top-level launch, the write reset) are on
        <a href="/settings">Settings</a>.
      </p>
      <h3>What you record stays here, until tomorrow morning</h3>
      <p class="lede">
        Anything the panel writes lands on this server and stays there for the next visitor &mdash;
        that is the demo, not a leak: the point is a write reaching a FHIR server, with this host's
        own log corroborating what the panel says it saved. So a chart may be further along than the
        story beside it says, and a chart says so when it is. <strong>Written data is cleared
        automatically every night</strong>, and <a href="/settings">Settings</a> has
        <strong>Reset written data</strong> for a clean chart now.
      </p>
      <h3>What the framed caseload is, and what it still does not prove</h3>
      <p class="lede">
        ⚠️ <strong>The frame at the top of this page is not the frame that used to be there.</strong>
        Until #401 the caseload sat in an iframe carrying no <code>iss</code> and no
        <code>launch</code>, rendering SPiER's own bundled demo registry rather than this server's
        data &mdash; the <em>shape</em> of a hosted activity and nothing more. What is framed now is
        a real SMART launch, minted the same way the chart's panel is: a user-scoped authorization
        (no patient in context, <code>user/*.read</code>), a roster read against this server's FHIR
        API, and per-patient reads on the same token. The app holds no patient data of its own.
      </p>
      <p class="lede">
        It shows the caseload <em>summary</em> rather than the sortable worklist, and that is a
        judgement about this page rather than a limit of the launch. A patient list framed above
        this page's own patient table is two lists on one screen, and the rows in the frame
        navigate inside the frame &mdash; so the more useful-looking list would be the one that
        opens no chart. The summary is the part a host cannot compute for itself.
        <strong>Open the full caseload</strong> gives you the worklist, top-level, where its rows
        are the only navigation there is.
      </p>
      <p class="lede">
        What that still does not prove is interoperability. <strong>This host is written and run by
        the same project as the app it launches</strong>, so a handshake succeeding here says the app
        behaves correctly as a guest &mdash; not that it works against a server nobody here
        controls. That claim needs a third-party sandbox, and the guardrail is unchanged.
      </p>
      <p>
        Two things are deliberately narrower than they look. The token is enforced on exactly one
        axis &mdash; may it read a patient other than its own &mdash; and not on resource types, so
        do not read this as evidence that SMART scopes work in general. And a worklist token is
        refused at write: a write is attributed to the launch's patient, and this one has none.
      </p>
      ${DISCLAIMER}
    </div>
  </details>`,
  })
}

/*
 * The chart's own rules: a patient banner, a launch card and a docked panel.
 * Everything else it renders — cards, buttons, callouts, the guest bar — is a
 * host component, which is why this block is now a third of its former size.
 */
const CHART_CSS = `
  /* The chart owns the whole viewport, so it takes the inset from \`.page\` and
     applies it to its own column instead — the dock has to reach the edge. */
  .chart-layout { display: flex; align-items: flex-start; min-height: calc(100vh - var(--bar-h)); }
  .chart-main { flex: 1 1 auto; min-width: 0; padding: var(--s5); }

  /* ── Patient header ───────────────────────────────────────────────────────
     The host identifying its own patient, and the thing that licenses the launch
     to send \`need_patient_banner:false\`. A left rule in the host's action colour,
     not the guest's: this row is drawn by the EHR and has to look it.

     ⚠️ **It was four fields on one line, and that was the chart's whole clinical
     content.** Reviewed as a chart rather than as a demo (2026-09-22): a name, an
     MRN, a birth date and a sex, then a launch button — no EHR serves that page,
     and a viewer asked to believe the panel beside it is running inside one is
     looking at the evidence against. The chips are the fix, and they are drawn
     from this patient's own Flags, EpisodeOfCare and Tasks (chartRecord.ts);
     nothing here is decorative and nothing is invented. */
  .chart-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--s3) var(--s5);
    padding: var(--s4);
    border: 1px solid var(--line);
    border-left: 3px solid var(--action);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  .chart-header__id { display: flex; align-items: center; gap: var(--s3); min-width: 0; }

  /* ⚠️ Initials, never a photograph. A synthetic patient with a stock face is
     the one thing on this page that would be pretending, on a page whose entire
     subject is which pixels are telling the truth about what. */
  .chart-header__avatar {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--radius-pill);
    background: var(--action-soft);
    color: var(--action);
    font-weight: 700;
  }

  .chart-header__name { margin: 0; font-size: var(--text-lg); font-weight: 700; }
  .chart-header__age { margin-left: var(--s2); font-size: var(--text-sm); font-weight: 600; color: var(--ink-soft); }

  .chart-header__meta {
    margin: 0;
    color: var(--ink-soft);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  /* At the far end of the row, which is where a vendor header hangs its alerts —
     and, once the row wraps, on their own line rather than crushed beside the
     name. */
  .chart-header__chips { display: flex; flex-wrap: wrap; gap: var(--s2); margin-left: auto; }

  /* ── Result tiles ─────────────────────────────────────────────────────────
     Where a general chart puts vital signs, this one puts the assessment
     results — chartRecord.ts has the reasoning, and it is not a substitute for a
     row we could not fill: these are the Observations SPiER writes back, so the
     EHR showing them as its own chart data is the write-back claim standing
     where a clinician's eye already goes.

     ⚠️ **auto-FILL, not auto-fit**, and the difference is the whole rule. A
     patient may have one result or six; auto-fit collapses the empty tracks and
     stretches the lone tile across the chart, which is how patient-014's single
     result rendered as a banner. auto-fill keeps the tracks, so one tile is the
     width of one tile. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--s3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* ⚠️ **Subgrid, because the four rows have to line up ACROSS the tiles.** A
     label is one line on most results and two on "Brief suicide safety
     assessment — determination", and with each tile laying itself out the values
     beside it sat at three different heights — a row of tiles that reads as
     three unrelated boxes rather than one row. Subgrid puts every tile's label,
     value, date and note on the same four tracks.

     Four rows and not three: the note is optional, and a tile without one has to
     leave the track empty rather than pull its neighbours' notes up. Where
     subgrid is unsupported the tiles simply lay out independently, which is the
     arrangement this replaced — a degradation, not a break. */
  .tile {
    display: grid;
    grid-row: span 4;
    grid-template-rows: subgrid;
    align-content: start;
    padding: var(--s3);
    border: 1px solid var(--line);
    border-top: 3px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  /* The accent is the Observation's own \`interpretation\` code and nothing else —
     never the value's wording. See TONE_FOR_INTERPRETATION. */
  .tile--critical { border-top-color: var(--critical); }
  .tile--warning { border-top-color: var(--warning); }
  .tile--notice { border-top-color: var(--notice); }
  .tile--info { border-top-color: var(--action); }

  .tile__value { margin: var(--s1) 0 0; font-size: var(--text-lg); font-weight: 700; line-height: 1.25; }
  .tile__meta { margin: var(--s1) 0 0; font-size: var(--text-xs); color: var(--ink-faint); font-variant-numeric: tabular-nums; }

  /* Clamped rather than dropped or truncated with an ellipsis in the string: one
     fixture's note is a paragraph and another's is the entire reason the result
     is absent, so neither "omit it" nor "cut it at N characters" is right. Three
     lines on screen, the whole sentence in the title attribute. */
  .tile__note {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    margin: var(--s2) 0 0;
    font-size: var(--text-xs);
    color: var(--ink-soft);
  }

  /* ── The SPiER module ─────────────────────────────────────────────────────
     ONE area for everything SPiER, and the shape of what it replaced is the
     argument for it. The chart used to carry a launch card, then
     a "Recommendations from SPiER" heading with a lede and a status line, then one
     bordered card per recommendation with a button of its own — three kinds of
     container and up to five buttons, all of them saying "open SPiER", spread
     down the page. Reported directly (2026-09-22): the callouts should be
     "contained to a single area, and the specific recommendations … appear as
     nested launch options".

     So the bar owns the generic launch — the vendor-configured activity button,
     which knows the patient and nothing else — and the rows inside are the
     specific ones, each opening the panel already scoped to the tool the card
     names. Two entry points (the plan's §2), one area.

     ⚠️ **Still directly under the patient header, and still the first thing to
     do.** The launch button was the LAST element on this page once, under an
     <h2>Activity</h2> nobody scrolled to — the old front door's undiscoverable
     entry point, one page along. Consolidating must not put it back below
     anything.

     ⚠️ **Steel, not raspberry, even though its contents come from SPiER.** This
     is the EHR reporting what a decision-support service told it — the host's own
     rendering of a CDS Hooks response, not pixels SPiER drew. \`--guest-brand\` is
     for the bar above the panel's iframe and nowhere else; see the note at the
     top of hostChrome.ts for what happened the last time the guest's colour
     appeared on a host control. */
  .spier {
    margin-top: var(--s4);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .spier__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s2) var(--s4);
    padding: var(--s3) var(--s4);
    border-bottom: 1px solid var(--line);
    background: var(--action-soft);
  }

  /* ⚠️ The border is reset, not inherited. \`h2\` carries a rule underneath it in
     COMPONENTS — the host's section divider — and inside this flex bar it drew a
     short underline the width of the words, which reads as a rendering fault
     rather than as a divider. The module's own bottom border is the divider here. */
  .spier__title { margin: 0; padding: 0; border: 0; font-size: var(--text-base); font-weight: 700; }
  /* Pushed to the end of the bar so the button's position is the same whatever
     the status line says — including when it says nothing yet. */
  .spier__bar .btn { margin-left: auto; }
  .spier__body { padding: var(--s3) var(--s4) var(--s4); }
  .spier__lede { margin: 0; font-size: var(--text-sm); }
  /* The protocol note, one size down: true, and not the reason to press the button. */
  .spier__meta { margin: var(--s3) 0 0; font-size: var(--text-xs); color: var(--ink-faint); }

  /* ⚠️ Under the lede and NOT in the drawer, because it contradicts the lede.
     The story beside the button is static prose about the fixture ("no
     screening on file"); writes from an earlier visitor live in this server and
     are shown to the next one. A presenter who meets Marcus Chen three steps
     further along than the script says has to be able to see why without
     opening anything. Warning-toned rather than faint: it is a correction. */
  .spier__written {
    margin: var(--s2) 0 0;
    font-size: var(--text-sm);
    padding-left: var(--s2);
    border-left: 3px solid var(--warning);
    color: var(--ink-soft);
  }

  /* ── One recommendation ───────────────────────────────────────────────────
     A ROW, not a card. The recommendations were bordered cards in a stack, which
     gave each one the same visual weight as the module around it and made a
     chart with three of them read as three competing offers. Inside one module
     they are rows, the first is the one the service marked primary, and the rest
     are behind a disclosure. */
  .recs { display: grid; gap: var(--s2); margin: var(--s3) 0 0; padding: 0; list-style: none; }

  .rec {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--s2) var(--s3);
    padding: var(--s2) var(--s3);
    border: 1px solid var(--line);
    border-left: 3px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
  }

  /* The card's own indicator, which is the service's statement of urgency. */
  .rec--critical { border-left-color: var(--critical); background: var(--critical-soft); }
  .rec--warning { border-left-color: var(--warning); background: var(--warning-soft); }
  .rec--info { border-left-color: var(--action); }

  .rec__text { flex: 1 1 18rem; min-width: 0; }
  .rec__title { margin: 0; font-size: var(--text-sm); font-weight: 700; }
  .rec__why { margin: var(--s1) 0 0; font-size: var(--text-xs); color: var(--ink-soft); }
  .rec__actions { display: flex; flex-wrap: wrap; gap: var(--s2); margin-left: auto; }

  /* ── What else is due ─────────────────────────────────────────────────────
     ⚠️ Closed, and holding the NON-primary recommendations only. The service
     marks exactly one card primary when anything is due; everything else is real
     and is not the next thing. A chart that shouts five times has told a
     clinician nothing about which to do first — and the drawer's summary carries
     the count, so nothing is hidden, only ranked. */
  .recs-more { margin: var(--s3) 0 0; font-size: var(--text-sm); }
  /* ⚠️ \`list-style: none\` AND the -webkit pseudo-element. The webkit rule alone
     leaves the modern \`::marker\` in place, and the drawer rendered with TWO
     arrows — the browser's and ours. \`.hood\` in hostChrome.ts carries both for
     the same reason; this one was copied without the first line. */
  .recs-more > summary { cursor: pointer; color: var(--action); font-weight: 600; list-style: none; }
  .recs-more > summary::-webkit-details-marker { display: none; }
  .recs-more > summary::before { content: "\\25B8"; display: inline-block; width: 1.1em; color: var(--ink-faint); }
  .recs-more[open] > summary::before { content: "\\25BE"; }
  .recs-more[hidden] { display: none; }

  /* The service's own answer when nothing is outstanding, and the place a failed
     call reports itself. Never silent: a chart that shows no recommendations and
     no reason is indistinguishable from one whose service is down. */
  .recs-status { margin: var(--s3) 0 0; font-size: var(--text-sm); color: var(--ink-soft); }

  /* ── The chart body ───────────────────────────────────────────────────────
     Two columns, wide then narrow: what happened and what was ordered on the
     left, the plan and the handover on the right — the arrangement a chart has
     had since before it was software.

     ⚠️ **A CONTAINER query, not a media query, and this file has the scars to
     explain why.** The dock is up to 700px of the window and appears when the
     panel is launched, so the space this grid has is not a function of the
     viewport at all: a media query at, say, 70rem would put two columns in a
     620px column the moment the panel opened. Two earlier rules in this file
     were hand-computed against the viewport and both went wrong — one silently,
     for every viewer, for months. The measurement is about THIS element, so the
     query asks this element.

     60rem: two 28rem columns plus the gap. Below it the narrow column's sections
     follow the wide one's, which is the same reading order a phone gets. */
  .chart-body { container: chart-body / inline-size; margin-top: var(--s6); }

  .chart-body__cols { display: grid; gap: var(--s5); }

  @container chart-body (min-width: 60rem) {
    .chart-body__cols { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); align-items: start; }

    /* ⚠️ **One column when only one column has anything in it.** patient-014 has
       encounters and tasks but no plan, no appointment and no document, and the
       two-track grid left its whole right-hand side empty — 40% of a chart
       reading as a column that failed to load rather than as a record that has
       nothing there. The page renders no empty column element and says so here. */
    .chart-body__cols--single { grid-template-columns: minmax(0, 1fr); }
  }

  .chart-body__col { display: grid; gap: var(--s5); align-content: start; }

  /* ── One section ──────────────────────────────────────────────────────────
     A bordered panel with its heading in a tinted bar — the "Active Problems" /
     "Recent Labs" furniture every chart has, and the thing that makes a page of
     lists read as a record rather than as a report. */
  .sect {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  /* ⚠️ Resets the section rule \`h3\` does not have but \`h2\` does; these headings
     are h3 because the page's one h1 is the patient's name and the module above
     owns the h2. Keeping them h2 would have made the chart's structure claim
     that a care plan is a peer of the patient. */
  .sect__title {
    margin: 0;
    padding: var(--s2) var(--s3);
    border-bottom: 1px solid var(--line);
    background: var(--surface-header);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .sect__list { margin: 0; padding: 0; list-style: none; }

  .entry {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--s1) var(--s3);
    padding: var(--s2) var(--s3);
    border-bottom: 1px solid var(--line);
  }

  .entry:last-child { border-bottom: 0; }

  .entry__text { flex: 1 1 14rem; min-width: 0; }
  .entry__title { margin: 0; font-size: var(--text-sm); font-weight: 600; }
  .entry__detail { margin: var(--s1) 0 0; font-size: var(--text-xs); color: var(--ink-soft); }
  .entry__when {
    flex: 0 0 auto;
    font-size: var(--text-xs);
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
  }

  /* The status pill. ⚠️ Only an OPEN state is coloured — see statusTone. A
     timeline where every line is tinted carries the same information as one
     where none is, and these records are mostly finished work. */
  .entry__status {
    flex: 0 0 auto;
    padding: 0 var(--s2);
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    background: var(--surface-sunken);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--ink-soft);
  }

  .entry__status--warning { border-color: var(--warning); background: var(--warning-soft); color: var(--warning); }
  .entry__status--critical { border-color: var(--critical); background: var(--critical-soft); color: var(--critical); }

  /* ── The dock ─────────────────────────────────────────────────────────────
     ⚠️ **Sticky and exactly one viewport tall — not stretched to the column
     beside it.** With align-items: stretch (the flex default) the dock grows to
     the height of the chart content, so the iframe becomes as tall as the host
     page. The panel's own chrome is position: fixed — the code drawer and the
     FHIRcast notice — which pins it to the bottom of the IFRAME's viewport, and
     that is then a thousand pixels below the fold. Measured here: a 2073px chart
     column gave a 1961px iframe in a 1000px window, and the FHIRcast banner
     rendered correctly and invisibly.

     This is panel plan §9.1 finding 3 ("the code drawer is not merely cramped at
     panel width — it is stranded") arriving from the other side: step 3 fixed it
     inside the panel, and step 4's additions to THIS page reintroduced it from
     the host. An embedded activity gets a viewport, so the frame has to be one.

     Both the offset and the height come from --bar-h, the app bar's own token:
     the bar is sticky, so a dock pinned to 0 would slide underneath it, and a
     dock a full 100vh tall would overflow by exactly the bar's height. */
  .panel-dock {
    flex: 0 0 auto;
    /* Set by the page script from the operator's stored preference, and
       defaulted here so the dock is never zero-width if that script has not run
       yet. The three permitted widths are whitelisted in the script. */
    width: var(--panel-width, 470px);
    align-self: flex-start;
    position: sticky;
    top: var(--bar-h);
    height: calc(100vh - var(--bar-h));
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--line);
    border-radius: 0;
    background: var(--surface-header);
  }

  .panel-dock .guest__bar { border-radius: 0; }
  .panel-dock__close { margin-left: auto; padding: 0 var(--s2); line-height: 1.4; }
  .panel-dock__empty { padding: var(--s5) var(--s4); color: var(--ink-soft); font-size: var(--text-sm); }
  .panel-dock iframe { flex: 1 1 auto; width: 100%; border: 0; background: var(--surface); }

  /* Where the panel's error goes when a launch cannot be minted. The launch
     CONTEXT readout used to sit here too, as a permanent footer under the frame:
     73px of "patient=… need_patient_banner=false hub.topic=…" on screen for the
     whole session, 9% of the dock, saying nothing a clinician acts on. It is in
     the "Under the hood" drawer now with the rest of the evidence (#dock-sent);
     only a failure still needs to be seen without opening anything. */
  .panel-dock__error { overflow-wrap: anywhere; color: var(--critical); }
  .panel-dock__error[hidden] { display: none; }

  .panel-dock[hidden] { display: none; }

  /* The way back out of a full-screen panel. Desktop shows the glyph the dock
     has always had; below 60rem the dock covers the whole chart, so the same
     button reads "Back to chart" and sits where a phone puts its back control,
     at the left of the bar. One button, two renderings, so the close handler
     and the id it is bound to stay one thing. */
  .panel-dock__back { display: none; }

  /*
   * ── Below the dock's own width, the dock takes over the screen ────────────
   *
   * ⚠️ **Without a rule here the chart column is crushed rather than narrowed.**
   * The layout is one flex row and the dock is flex: 0 0 auto at up to 700px, so
   * on a 375px screen the dock kept its full width and .chart-main — which is
   * flex: 1 1 auto with min-width: 0, and therefore shrinkable to nothing — was
   * left about 90px, wrapping its prose to one word per line. It looked like a
   * rendering bug and was simply the row doing what a row does.
   *
   * ⚠️ **The first fix stacked the dock UNDER the chart, and that put the panel
   * below the fold.** Measured on the deployed host at 375×812 (2026-09-21):
   * pressing Launch SPiER grew the document from 886px to 1536px and the dock's
   * top edge landed at 874px — seven pixels past the bottom of an 867px viewport.
   * Nothing on screen changed. A clinician who presses the one button the page
   * offers has to know to scroll down to find out that it worked, which is the
   * front door's undiscoverable-entry-point defect (§6.3) one screen later.
   *
   * So below 60rem the dock is a full-screen takeover: fixed to the viewport,
   * the whole of it, the way a phone EHR opens an activity (Brad, 2026-09-21:
   * "a full screen take over, as long as it's clear how to navigate back to the
   * patient chart"). The guest bar stays at the top of it and its close button
   * becomes a labelled "Back to chart" at the left, which is the one thing a
   * takeover owes. dvh rather than vh: on a phone vh is the largest viewport,
   * and a takeover that tall hides its own bottom edge behind the browser's
   * toolbar. Nothing here is in flow any more, so the wrap on .chart-layout is
   * only a guard against the crushed-column case above.
   *
   * 60rem is above the widest dock option (700px) plus a readable column, so the
   * side-by-side layout only survives where both halves fit.
   */
  @media (max-width: 60rem) {
    .chart-layout { flex-wrap: wrap; }

    .panel-dock {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100dvh;
      /* Above the sticky app bar (10): the takeover is the thing the clinician
         just asked for, and the bar has nothing on it they need while it is up. */
      z-index: 20;
      border: 0;
      border-radius: 0;
    }

    .panel-dock__close { order: -1; margin-left: 0; margin-right: var(--s2); }
    .panel-dock__back { display: inline; }
    .panel-dock__close-x { display: none; }
  }
`

/**
 * The avatar's two letters.
 *
 * ⚠️ First and LAST token, not the first two: "Maria Isabel Alvarez" is MA in
 * every chart anyone has ever used, and the naive `split(' ').slice(0, 2)` makes
 * it MI. A single-token name gets one letter rather than a padded one.
 */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]![0]!
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : ''
  return (first + last).toUpperCase()
}

/** "34Y · female" — the pill beside the name. Age is derived; see `ageOn`. */
function ageAndSex(patient: DemoPatient): string {
  const age = ageOn(patient.birthDate)
  return age === null ? patient.gender : `${age}Y · ${patient.gender}`
}

/**
 * One chart section: a titled panel of lines.
 *
 * ⚠️ The status word is printed as the resource spells it — `in-progress`,
 * `entered-in-error`. That is EHR vocabulary and it belongs on this surface:
 * `check:jargon` covers the guide and the clinical app precisely because those
 * are the surfaces where it does not. A host that translated FHIR statuses into
 * friendlier words would be hiding the thing the demo is showing.
 */
function chartSection(section: ChartSection): string {
  const entries = section.entries.map(entry => `
            <li class="entry">
              <div class="entry__text">
                <p class="entry__title">${esc(entry.title)}</p>
                ${entry.detail ? `<p class="entry__detail">${esc(entry.detail)}</p>` : ''}
              </div>
              <span class="entry__when">${esc(entry.when)}</span>
              ${entry.status ? `<span class="entry__status entry__status--${esc(entry.tone)}">${esc(entry.status)}</span>` : ''}
            </li>`).join('')
  return `
        <section class="sect" aria-labelledby="sect-${esc(section.id)}">
          <h3 class="sect__title" id="sect-${esc(section.id)}">${esc(section.title)}</h3>
          <ul class="sect__list">${entries}</ul>
        </section>`
}

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
    scriptUrl,
  }: {
    cdsEndpoint: string
    panelOrigin: string
    /** Everyone except this patient, for the FHIRcast announce affordance. */
    otherPatients: DemoPatient[]
    /** The built chart module, from `clientScriptUrl('chart')`. */
    scriptUrl: string
  },
): string {
  // The host's one-line annotation of this chart (demoStories.ts), so the launch
  // card says what THIS chart is a story about rather than describing the protocol.
  const { story } = storyOf(patient.id)
  // Everything clinical on this page, derived from the resources this server
  // serves for this patient. See chartRecord.ts: nothing here may come from
  // anywhere else.
  const record = chartRecordFor(patient.id)
  const chips = record.chips.map(chip => `
          <span class="chip chip--${esc(chip.tone)}"${chip.detail ? ` title="${esc(chip.detail)}"` : ''}>${esc(chip.label)}</span>`).join('')
  // ⚠️ The EMPTY columns are dropped here rather than rendered blank. See the
  // note on `.chart-body__cols--single`: a two-track grid with nothing in its
  // second track reads as a column that failed to load.
  const columns = [record.main, record.side].filter(sections => sections.length > 0)
  const tiles = record.results.map(result => `
        <li class="tile tile--${esc(result.tone)}">
          <p class="label">${esc(result.label)}</p>
          <p class="tile__value">${esc(result.value)}</p>
          <p class="tile__meta">${esc(result.when)}${result.trend ? ` &middot; ${esc(result.trend)}` : ''}</p>
          ${result.note ? `<p class="tile__note" title="${esc(result.note)}">${esc(result.note)}</p>` : ''}
        </li>`).join('')
  return page({
    title: `${patient.name} — SPiER mock EHR`,
    css: CHART_CSS,
    nav: 'chart',
    // The dock has to reach the window edge, so this page owns its own inset.
    variant: 'flush',
    body: `
  <div class="chart-layout">
    <div class="chart-main">
      ${crumbs([
    { label: 'Patients', href: '/' },
    { label: patient.name },
  ])}

      <!-- The host's own patient header. This is what licenses the launch to
           send need_patient_banner:false — see the note in the dock below. The
           chips come from this patient's own resources; chartRecord.ts says why
           nothing on this page may come from anywhere else. -->
      <header class="chart-header">
        <div class="chart-header__id">
          <span class="chart-header__avatar" aria-hidden="true">${esc(initialsOf(patient.name))}</span>
          <div>
            <h1 class="chart-header__name">${esc(patient.name)}<span class="chart-header__age">${esc(ageAndSex(patient))}</span></h1>
            <p class="chart-header__meta">MRN ${esc(patient.mrn)} &middot; Born ${esc(formatDate(patient.birthDate))}</p>
          </div>
        </div>
        ${chips.length > 0 ? `<div class="chart-header__chips">${chips}</div>` : ''}
      </header>

      <!-- The vendor-configured activity, and the one thing to do on this page.
           It knows the patient and nothing else, so the panel opens on the
           pathway rather than in a tool. The CDS cards below are the OTHER entry
           point (§2), and they name an instrument — but this one has to be
           obvious without reading anything, which is why it is here and not
           under an <h2>Activity</h2> at the foot of the page. -->
      <section class="spier" aria-labelledby="spier-title">
        <div class="spier__bar">
          <h2 class="spier__title" id="spier-title">SPiER Suicide-Safer Pathway</h2>
          <button type="button" id="open-panel" class="btn btn--primary btn--lg">Launch SPiER &rarr;</button>
        </div>
        <div class="spier__body">
          <p class="spier__lede">
            Open SPiER for ${esc(patient.name)}. It shows where ${esc(patient.name)} is on the
            suicide-safer care pathway and what to do next, and anything you record in it is written
            back to this chart. <span id="launch-story">${esc(story)}</span>
          </p>
          <!-- Filled by the client module from /_admin/writes?patient=, and
               hidden while the count is zero. Server-rendered empty rather than
               omitted: the page is one template for fourteen charts and the
               count is not known at render time. -->
          <p class="spier__written" id="written-since" hidden></p>

          <!-- The specific recommendations, nested under the generic launch. The
               primary one is a row here; everything else the tier owes is inside
               the disclosure below, which the client module unhides and counts.
               Both are filled from the CDS Hooks response — see src/client/chart.ts. -->
          <ul id="cds-cards" class="recs"></ul>
          <details class="recs-more" id="cds-more" hidden>
            <summary id="cds-more-summary">Also due</summary>
            <ul id="cds-cards-more" class="recs"></ul>
          </details>
          <p id="cds-status" class="recs-status">Asking SPiER for recommendations&hellip;</p>

          <p class="spier__meta">
            Opens in a panel on this chart over a SMART on FHIR launch: SPiER authorizes against
            this EHR, reads this chart, and writes to it. A recommendation's own button opens the
            panel already on that tool.
          </p>
        </div>
      </section>

      <!-- What this server holds, in the place a chart holds it. Rendered only
           when there is something to render: a patient with no results on file
           gets the sentence rather than an empty grid, because "nothing has been
           recorded" is this chart's actual finding for several of the fourteen
           and is the reason their story is worth opening. -->
      <h2>Recent results</h2>
      ${record.results.length > 0
    ? `<ul class="tiles">${tiles}</ul>`
    : `<p class="lede">No assessment results are on file for ${esc(patient.name)}.</p>`}

      <!-- The record itself, in the two columns a chart uses. Every section is
           dropped when it is empty (chartRecord.ts) — nine of the fourteen have
           no orders and eleven have no documents, and a page of headings over
           empty states is a chart pretending the record is fuller than it is.
           An empty COLUMN goes the same way, and so does the whole block: a
           patient with nothing on file gets nothing here rather than a grid of
           blank panels. -->
      ${columns.length > 0
    ? `<div class="chart-body">
        <div class="chart-body__cols${columns.length === 1 ? ' chart-body__cols--single' : ''}">
          ${columns.map(sections => `<div class="chart-body__col">${sections.map(chartSection).join('')}</div>`).join('')}
        </div>
      </div>`
    : ''}

      <!-- ⚠️ Everything below is EVIDENCE, and it used to sit inline at the
           same weight as the launch button — the endpoint that was called, the
           hub topic, the write log, the announce control. Reviewed as a user:
           the page read as a description of how it was built rather than as a
           thing to use. Nothing here is deleted; it is one click away. The
           write log in particular has to stay on this page: it is the SERVER's
           account of what the panel wrote, and the panel's own scorecard is
           SPiER reporting on itself. Two statements make it checkable. -->
      <details class="hood" id="hood">
        <summary>Under the hood: what was called, what was written, shared context</summary>
        <div class="hood__body">
          <h3>Decision support</h3>
          <p class="lede">
            The cards above came from a CDS Hooks <code>patient-view</code> call to
            <a href="${esc(cdsEndpoint)}">${esc(cdsEndpoint)}</a>. A card link of
            <code>type: "smart"</code> is what lets a card launch the panel into this chart, scoped to
            the instrument the card names.
          </p>
          <p class="lede">
            The host made that call <strong>server to server</strong>, carrying a short-lived JWT it
            signed with its own key &mdash; the browser never holds one. The service verifies it
            against the key set this host publishes at
            <a href="/.well-known/jwks.json"><code>/.well-known/jwks.json</code></a>, which is what
            CDS&nbsp;Hooks means by trusting a CDS Client. An unsigned call is refused.
          </p>

          <h3>Launch context</h3>
          <p class="readout" id="dock-sent">Nothing launched yet — press <strong>Launch SPiER</strong> and the
            SMART launch context the host minted is shown here.</p>

          <h3>Written to this chart</h3>
          <p class="readout">
            <span id="writes-summary">Loading written data…</span>
            <a href="/settings">Capability profile, reset and other controls &rarr;</a>
          </p>

          <h3>Shared context (FHIRcast)</h3>
          <p class="lede">
            This chart is a FHIRcast subscriber on the EHR's own hub, and it tells the panel which
            session it is in via <code>hub.url</code> and <code>hub.topic</code> on the token response.
            Opening a chart announces <code>patient-open</code>; the panel is subscribed to the same
            topic and reacts to it <strong>across the origin boundary</strong>.
          </p>
          <p class="readout">
            <span id="cast-status">Subscribing to the hub…</span>
          </p>

          <!-- ⚠️ Why a button and not just "open another chart": navigating this page
               is a full page load, which destroys the iframe — so the panel would be
               gone before it could react. This announces a context change WITHOUT
               navigating, which is the only way to watch the panel receive one. A
               demo affordance, and it says so. -->
          <form id="cast-form" class="form">
            <label class="field"><span>Announce a context change to another patient</span>
              <select name="patient">${otherPatients.map(p => `
                <option value="${esc(p.id)}">${esc(p.name)} &middot; ${esc(p.id)}</option>`).join('')}
              </select>
            </label>
            <div><button type="submit" class="btn">Announce patient-open</button></div>
          </form>
          <p class="readout">
            Stands in for the clinician opening a different chart. The panel is scoped to
            ${esc(patient.name)} by its access token, so it <em>cannot</em> follow — watch it say so
            rather than fail.
          </p>
          <ul id="cast-log" class="stack"></ul>

          ${DISCLAIMER}
        </div>
      </details>
    </div>

    <aside class="panel-dock guest" id="dock" hidden aria-label="SPiER panel">
      <div class="guest__bar">
        <span class="guest__title">SPiER</span>
        <span id="dock-context"></span>
        <button type="button" id="close-panel" class="btn panel-dock__close" aria-label="Close SPiER and return to the chart">
          <span class="panel-dock__back" aria-hidden="true">&larr; Back to chart</span>
          <span class="panel-dock__close-x" aria-hidden="true">&times;</span>
        </button>
      </div>
      <p class="panel-dock__empty panel-dock__error" id="dock-error" hidden></p>
      <iframe id="panel" title="SPiER Suicide-Safer Pathway" src="about:blank"></iframe>
    </aside>
  </div>`,
    config: chartClientConfig({ patient, cdsEndpoint, panelOrigin }),
    scriptSrc: scriptUrl,
  })
}

/**
 * The chart module's inputs. The behaviour itself is `src/client/chart.ts` —
 * 408 lines of ES5 in a template literal here until 2026-09-20, with these
 * values interpolated as `var PATIENT = ${…}`. They travel as data now, in a
 * `<script type="application/json">` block the module reads on load; the
 * shape is `ChartClientConfig`, shared type-only with the browser project.
 */
function chartClientConfig({
  patient,
  cdsEndpoint,
  panelOrigin,
}: { patient: DemoPatient; cdsEndpoint: string; panelOrigin: string }): ChartClientConfig {
  // Split for the FHIRcast context Patient, which carries a HumanName. Same
  // "first token is the given name" rule `buildContextPatient` uses in the app —
  // crude, and correct for every synthetic name in this repo.
  const [given, ...familyParts] = patient.name.split(' ')
  return {
    patient: { id: patient.id, mrn: patient.mrn, given: given ?? '', family: familyParts.join(' ') },
    // Imported rather than restated: the MRN namespace has four sites that must
    // agree and check:patients gates them (see fixtures.ts).
    mrnSystem: MRN_SYSTEM,
    // ⚠️ Displayed, not fetched. The browser calls this host's own /_admin/cds,
    // which mints a signed JWT and invokes the service server-to-server (see
    // routes/cds.ts). It stays because it is what the page SHOWS the reader,
    // and because chartPage.test.ts asserts the three origins stay distinct
    // through it.
    cdsEndpoint,
    panelOrigin,
    panelWidths: PANEL_WIDTHS,
    defaultPanelWidth: DEFAULT_PANEL_WIDTH,
    panelWidthKey: PANEL_WIDTH_KEY,
  }
}
