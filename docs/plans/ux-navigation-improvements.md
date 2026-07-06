# Plan: UX / navigation improvements

Findings from a hands-on navigation audit (desktop + mobile preview walkthrough,
plus a code inventory of every page's nav affordances). The app has no dead ends
and good empty/loading states — the "clunky" feeling traces to a small number of
structural issues, chiefly **two navigation systems that disagree**.

## Current state

### 1. The Adoption Guide has two competing navs, and they don't match

Every `/guide/*` page renders **both**:

- a sticky in-page tab bar (`.ig-tabs` in `AdoptionGuide.tsx`) with **8** tabs:
  Overview, Pathway, Tool Configuration, Data Dictionary, CDS Service,
  Adoption Readiness, Adoption Rubric, Roadmap;
- sidebar children (`Sidebar.tsx` `LENSES`) with **6** entries — **Overview and
  CDS Service are missing**, so the guide's own landing page and the CDS
  service page highlight nothing in the sidebar and are invisible to anyone
  navigating from it.

The tab bar is ~1191px wide; it clips (with `overflow-x: auto` but **no visible
scroll affordance**) inside the ~976px content column even on a 1600px window —
"Adoption Rubric" and "Roadmap" are simply not visible. Horizontal scrolling is
required by that layout, but eight top-level tabs is past what the pattern can
carry: the layout is the problem, not the scrollbar.

The two lists are hand-maintained in two files, which is why they drifted.

### 2. Patient context is easy to lose and hard to change

- Sidebar "Patient View" links to `/patient/chart?new=1` (`Sidebar.tsx:73`),
  which **silently discards the active patient**. Clicking the nav item that
  describes where you already are blanks your chart. (Browser Back recovers it —
  the id is URL-driven — but it's a trap.) The Home page's "Patient" link goes
  to plain `/patient/chart` and *preserves* the patient: same label, opposite
  behavior.
- With a patient loaded, `PatientBanner` has **zero interactive elements** — no
  way to switch patient (must know to return to Population View) and no way to
  intentionally clear to the blank "try the forms" state.
- The empty-chart copy says "Use the assessment forms **in the sidebar**" —
  stale; the sidebar no longer lists forms. Forms launch from the CDS
  recommendation cards below the message.

### 3. "Screenings" is a ghost destination

`QuestionnaireView` / `StanleyBrownView` breadcrumb to "← Screenings" →
`/patient/assessments`, which is nothing but a redirect to `/patient/chart`.
The post-submit CTA "View in Screenings" does the same. Three names
(Screenings / assessments / Patient chart) for one place; meanwhile
`WorkflowActionView` already says "← Patient chart". The renderer's **Cancel**
button does nothing visible (no navigation, no confirm).

### 4. Anchor deep-links only work on the Patient Chart

`PatientChart.tsx` has careful scroll-restoration (`scrollToAnchor` +
`useLayoutEffect` on `location.hash`). `PatientJourney` stage anchors rely on
native browser behavior: navigating to `/guide/pathway#stage-…` from another
page loads unscrolled (verified: target section 5000px+ below the viewport).
Also, the sidebar's Patient View anchor children hardcode `/patient/chart#…`,
dropping the `/:patientId` segment from a shareable URL.

### 5. Small persistent irritants

- `PopulationView.tsx:61-62`: "1 weeks ago" / "1 months ago".
- CTA styles vary for equivalent actions (arrow links, dark buttons, plain
  links) across Home cards, CDS cards, population "View chart →", post-submit
  links.
- Mobile: chart "Recommendations" heading and its long gray subtitle wrap
  awkwardly at 375px; the banner drops the **risk pill** on mobile — the single
  most important datum on this chart.
- React Router v6 future-flag warnings spam the console on every navigation.

## Goal

One navigation system per lens, no horizontal-scrolling nav, patient context
that is never lost silently, one name per destination, and anchors that work
from anywhere. Sliced into three PRs, each independently shippable.

## Design

### Phase 1 — Unify guide navigation (kills the tab bar)

**Decision: the sidebar becomes the single navigation for `/guide/*`; the
in-page tab bar is removed.** Rationale: the app already pays for a persistent
240px sidebar on every screen; vertical space scales with section count where
horizontal never will; the guide is docs-like content and a vertical section
rail is the standard docs pattern; and it resolves the drift problem and the
scroll problem in one move.

1. **Single source of truth.** New `web/src/data/guideSections.ts` exporting an
   ordered manifest: `{ path, label }` for all 8 sections (reading order:
   Overview, Pathway, Tool Configuration, Data Dictionary, CDS Service,
   Adoption Readiness, Adoption Rubric, Roadmap). `Sidebar.tsx` derives the
   guide children from it; `App.tsx` route declarations map over it; the pager
   (below) derives from it. The two-lists-drift bug becomes unrepresentable.
2. **Remove `.ig-tabs`** from `AdoptionGuide.tsx` (and its CSS). Keep the
   wrapper slim: the parent can shrink to just the `<Outlet/>` — each section
   already has its own `<h1>`-equivalent (`.page-title`, currently hidden by
   `.implementation-guide .page-title { display: none }`; un-hide it).
3. **Prev/next pager** at the bottom of every guide section (component driven
   by the manifest): "← Data Dictionary  |  Adoption Readiness →". Gives the
   guide sequential flow (currently absent) and gives **mobile** — where the
   sidebar is a hidden drawer — a visible way to move between sections without
   opening the hamburger.
4. Sidebar polish that this unlocks: the guide children list is now 8 items;
   keep it flat, auto-expanded only while inside `/guide` (existing behavior).

*Alternative considered and rejected:* grouped/overflow tabs ("More ▾", priority
tabs, two-row wrap). Still two nav systems to reconcile, still cramped at
common widths, more code than deleting the bar.

### Phase 2 — Patient context affordances

1. **Sidebar link stops clearing the patient**: `/patient/chart?new=1` →
   `/patient/chart` (matches Home). The `?new=1` handling in PatientContext
   stays (used by the explicit action below).
2. **Banner becomes the patient-context control.** With a patient loaded,
   `PatientBanner` gains: a **Switch patient** control (menu/select of the
   population registry; activation goes through the existing PatientContext
   publish-on-activation effect, so FHIRcast broadcast comes for free per the
   two-way-sync design) and a **Close patient ✕** (navigates to
   `/patient/chart?new=1` — the deliberate route to the blank state).
3. **Rewrite the empty-chart copy**: point at the launch buttons in the
   recommendation card below and the "Choose from population →" banner CTA;
   delete the stale "forms in the sidebar" sentence.
4. **One name for the chart.** Breadcrumbs in `QuestionnaireView` /
   `StanleyBrownView` → "← Patient chart" linking `/patient/chart`; post-submit
   CTA → "View in chart" linking `/patient/chart#activity` (matching
   `WorkflowActionView`). `/patient/assessments` stays as a redirect for old
   URLs only.
5. **Cancel behaves like Cancel**: wire the renderer's cancel to navigate back
   to `/patient/chart` if formbox exposes an `onCancel`; otherwise hide the
   button.
6. **Sidebar anchor children preserve the patient**: build hrefs from the
   active patient (`#/patient/chart/${id}#activity` when set), so mid-session
   URLs stay shareable.

### Phase 3 — Deep links, consistency, polish

1. **`useScrollToHash()` hook** extracted from PatientChart's implementation
   (scroll-restoration disable + hash-change effect); adopt in `PatientJourney`
   so `/guide/pathway#stage-…` deep-links scroll. PatientChart refactors onto
   the same hook.
2. **Relative-time helper** moved to `web/src/lib/` with correct singulars
   ("1 week ago", "1 month ago").
3. **CTA pass**: define exactly two link-out styles (primary action button;
   arrow-suffixed text link), apply across Home cards, CDS cards, population
   table, post-submit actions.
4. **Mobile fixes**: stack the chart section header/subtitle at narrow widths;
   keep the risk pill visible in the mobile banner (it currently truncates
   away).
5. **Housekeeping**: enable `v7_startTransition` and `v7_relativeSplatPath`
   future flags on `HashRouter`.

## PR slicing

| PR | Content | Risk |
|----|---------|------|
| 0 | This plan doc | — |
| 1 | Phase 1 — guide nav unification (manifest, tab-bar removal, pager) | Medium: layout change on 8 pages |
| 2 | Phase 2 — patient context (banner controls, `?new=1`, terminology, cancel) | Medium: touches PatientContext consumers |
| 3 | Phase 3 — deep links + polish | Low |

## Verification

Per PR: `npm run verify` in `web/`, then a preview walkthrough:

- PR 1: every guide section reachable from the sidebar with correct active
  state; no horizontal overflow at 375/768/1280; pager cycles all 8 in order;
  old `/guide/*` URLs unaffected.
- PR 2: population → chart → sidebar "Patient View" keeps the patient; switch
  patient from the banner broadcasts (second tab follows); close patient lands
  on blank state with accurate copy; submit an assessment → "View in chart"
  lands on `#activity` scrolled.
- PR 3: cold deep-link to `/guide/pathway#stage-coordinate-handoffs` scrolls;
  "1 week ago" renders; console clean of RR warnings.

## Out of scope

- Redesigning Population View (it tested well).
- Any FHIR artifact / IG changes.
- The published-IG static site's own navigation.
