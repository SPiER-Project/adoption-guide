# Adoption Guide — copy, layout and UX audit

**Date:** 2026-09-20 · **Branch audited:** `main` at `5262c1b` · **Status:** PR 1 (§1.1 dead links and their gate, §1.2 stale statements), PR 2 (§4.1 the Overview rewrite) and PR 3 (§4.2 the Care Pathway split, §1.3 the artifact's documentation strings) applied; §4.3–§4.6 and the §5 gates remain recommendations

**Status 2026-09-20 (PR 3):** the Care Pathway is split to §4.2.
`/guide/pathway` is the explainer — a named reader, the five things a pathway
does in five paragraphs, the C-SSRS simulator as the centrepiece, and the tier
branch as ONE table, obligation × tier, lit by the simulator's result — 2,445
rendered words down to 1,203, of which the page's own prose is about 460, the
simulator's questions 180 and the artifact's table 580; 9.0 screens down to
about 3.5. `/guide/pathway/protocol` is a new subsection (declared with its
full sub-path, so both gates see it) holding the spine with the table in place,
the pending-definition strip, the FHIRPath gates and canonical URLs in a
closed, inspect-gated drawer, and provenance with the JSON; it is the one page
that says "rendered from the published PlanDefinition" (§5 rule 5 — three pages
said it). The table replaces the three columns on the clinician's
`/patient/pathway` as well — Brad's call, 2026-09-20: one artifact, one
rendering — and the drawer returns null there, so the panel now shows the
protocol in words and not one FHIRPath expression. In the artifact, the three
§1.3 `documentation.display` strings (and a fourth of the same class, the
ICD-10 note's pointer at a repo doc) now state the clinical claim and nothing
about this repo, and the three obligations every tier repeats carry identical
documentation, which is what lets the table draw them as the diagram's spanning
row — a core test pins that. Deliberately not done: the eight-stage strip §4.2
sketched; the explainer stays in the protocol's own five steps, and the stage
vocabulary stays Why SPiER's. PRs 4–6 remain.

**Status 2026-09-20 (PR 2):** the Overview is rewritten to §4.1 — 1,716 words
down to 252 above the closing step cards (346 with them), one call to action,
the three chart picks, the interoperability caveat stated once and quietly, and
three reader doors in place of the four surface cards. The essays are not
deleted: Capture → Translate → Act at length, the two vocabularies, the four
surfaces and the portability case are now `/guide/why-spier`, a new **Reference**
group in the sidebar and the pager (Brad's call, 2026-09-20 — the alternative
was dropping them and linking the IG). Two new assertions on the content module
(the 400-word cap, and every door href having a branch), and
`check:surface-links` learned the content modules' inline link markup after a
planted dead route passed green. PRs 3-6 remain.

**Status 2026-09-20 (PR 1):** every link in §1.1 resolves or hops to the
clinical origin; the shared views read their routes from `SurfaceLinksContext`
(each app supplies its own), `check:surface-links` walks both apps and was
proved red three ways, and the five statements in §1.2 are corrected. The
Provider App's 120-word Notice (last row of §1.2) is PR 5's, not PR 1's.

The prompt: *"It's verbose and not always easy to follow. It doesn't craft an
easy to follow story. The pages are bulky and doing too much. The Care Pathway
page should explain what a good care pathway looks like and demonstrate ours,
potentially as a sub-nested page. The tools pages could be links that expand
into the details and the interactive form. The buttons like Launch ASQ
Screening are broken."*

This audit walked every guide route in the browser at desktop and phone width,
read every page's source and the copy it draws from, and measured each page.
It confirms every point in the prompt, finds the launch buttons are one instance
of a larger broken class, and proposes a reading order and a PR sequence.

**The short version.** Three things are wrong, in increasing order of effort to
fix. First, every in-app link from the guide into the clinical app is dead since
the apps split on 2026-09-19 — 33 launch buttons, 34 readiness rows, and a dozen
prose links all silently bounce to the Overview, and no gate looks at the
guide's outbound links. Second, the copy addresses four readers at once,
repeats itself, and explains how the site was built rather than what to do;
five statements on the live pages are stale or contradict each other. Third,
every page is a reference dump with a lede on top: the Overview is 1,700 words
before a reader reaches a link to anything, the Care Pathway is 2,400 words of
rendered artifact, Tools is eleven screens of accordion, the Data Dictionary is
seventeen. The fix is a story with one question per page, the interactive
pieces in the foreground, and the reference material one click down.

---

## 1. Defects (not taste)

### 1.1 Every link from the guide into the clinical app is dead

**What happens.** On `/guide/tools`, expand *Administer ASQ Suicide Screen* and
press **Launch ASQ Screening**. The hash changes to `#/overview` and the front
door renders. No error, no 404.

**Why.** The button renders `<Button to="/patient/assessments/asq">`
(`apps/guide/src/components/ToolDetail.tsx`). Since the apps split, the guide's
route table (`apps/guide/src/App.tsx`) declares no `/patient/*`, `/population/*`
or `/settings` route, so the path falls to the `*` catch-all, which is
`<Navigate to="/" replace />`. The comment on the button still calls it "the
CLINICIAN's path"; the clinician's app is a different bundle on a different
Worker now.

**The class, not the instance** (grep of `to=`, `to:` and `href=` for those
three prefixes across the guide and the shared views it renders):

| Where | Dead target | Count |
|---|---|---|
| Tools → every expanded tool's primary button | `/patient/assessments/*`, `/patient/workflow/*` | 33 |
| Adoption Readiness → the resource link per row (`apps/guide/src/pages/AdoptionReadiness.tsx`) | the same launch paths | 34 |
| Care Pathway → provenance paragraph, "Published Care Pathway" | `/patient/pathway` | 1 |
| Provider App → "Tool Configuration", "open the demo chart" | `/settings`, `/patient/record` | 2 |
| Population Dashboard → "measure dashboard", "enabled", "open the demo caseload" | `/population/measures`, `/settings`, `/population/caseload` | 3 |
| `/guide/tools/:slug/try` → the eyebrow's up-link "Patient Chart" | `/patient/record` | every try page |
| Shared views after a submit → "View in chart" (`packages/tool-views/src/components/QuestionnaireView.tsx`, `WorkflowForm.tsx`) | `/patient/record#activity` | every filler and recorder |
| Recorders' cross-links (`RiskEpisodeView.tsx` "Open the risk registry", `SafetyTaskView.tsx`, `OutreachAttemptView.tsx`, `DischargePacketView.tsx`, `FollowUpAppointmentView.tsx`) | `/population`, `/patient/workflow/*` | 5 |
| Redirects registered on the guide: `/guide/measures`, `/guide/tool-configuration`, `/chart`, `/chart/dashboard`, `/chart/screenings`, `/chart/careplan`, `/chart/encounters` | `/population/measures`, `/settings`, `/patient/*` | 7 |

**Why no gate saw it.** `scripts/check-surface-links.mjs` is the gate written
for exactly this failure ("it does not 404, it silently returns the reader to
the page they were on"), but it walks only `apps/clinical/src/App.tsx`. Nothing
walks the guide. `check:catalog` validates every `<Navigate>` target against
**the union** of both apps' tables (`scripts/lib/route-table.mjs`
`readSurfaceRoutes`), so a guide redirect into a clinical-only path resolves.
`docs/internals/surfaces-and-routing.md` records the hole in one sentence —
*"a path that resolves but now lands on the explainer rather than the app —
that class needs a grep"* — and the grep was only ever pointed at one surface.

**Fix.** Three parts, all in one PR (§6, PR 1):

1. *The catalogue's launch buttons.* On the guide, "launch" cannot mean the
   clinician's route. CLAUDE.md's own rule is *the guide explains and hosts;
   the mock EHR holds and launches*. So the primary button becomes the guide's
   own route, `/guide/tools/:slug/try` (rename the label from "Try it with the
   FHIR view" to "Try the form"), and the clinician's launch becomes an
   outbound link to the Demo EHR — the same destination the sidebar's *Try it*
   zone already offers. The catalog's `launchActions` paths stay what they are;
   they are still what CDS cards and SMART intents resolve to on the clinical
   surface.
2. *The shared views.* "View in chart" and the recorders' cross-links are
   correct on the clinical surface and wrong on the guide. They already have a
   fourth axis to read: `useInspect()` is true only under `/guide`. Under
   inspect, "View in chart" should not render (or should point at the guide's
   own try route for the linked recorder). Same for the try page's eyebrow,
   which reads "← Patient Chart / Assessment" on a guide page.
3. *The gate.* Add the guide as a second walk in `check-surface-links.mjs`
   (RULE 1 and RULE 2 over `apps/guide/src/App.tsx` against the guide's own
   route set). Plant one of the dead links above, watch it fail, remove it. The
   seven dead redirects either point at the clinical Worker's origin via
   `DEPLOY_ORIGINS` or are deleted; a redirect that lands on the front door is
   worse than a 404.

Also dead since the split: `apps/guide/src/components/AppShell.tsx` renders
`PatientBanner` when the path starts with `/patient` or `/chart`, which no
guide route ever does.

### 1.2 Stale or contradictory statements on the live pages

| Page | Says | Reality |
|---|---|---|
| CDS Service, *Authentication* vs *Honesty notes* (`apps/guide/src/pages/CdsServiceGuide.tsx`) | Authentication: enforcement is in **require** mode since 2026-09-20. Honesty notes, four paragraphs later: validation "runs in **warn** mode — tokens are verified and logged, not yet enforced." | The two sections contradict each other on the same page. Require is correct (CLAUDE.md). |
| Overview, *Adoption Guide* lens card (`apps/guide/src/content/overview.ts`) | "…and a Tool Configuration that decides what the provider app may recommend." | Tool Configuration left the guide for `/settings` on 2026-09-15. |
| Overview, *How that maps* | "the vocabulary used by the the provider app" | Doubled word. |
| Try page eyebrow (`packages/tool-views/src/components/QuestionnaireView.tsx`) | "Patient Chart / Assessment", up-link to the chart | Rendered on the guide, where there is no chart. |
| Pathway load error (`packages/app-shell/src/components/PathwayView.tsx`) | "Run npm run copy-fhir in web/" | The web directory was deleted at the tooling hoist (#553). |
| Provider App | "Inside a host chart, every catalogued tool is offered regardless of the Tool Configuration preset" — a 120-word Notice on a mechanism the page has not introduced | True, but it is an implementer's caveat sitting at the same weight as the instruction. See §3. |

### 1.3 Repo jargon in reader-facing copy

The mock-EHR UX pass (PRs #461–#463) fixed this once: *pages explained how they
were built, not what to do*. The guide never got that pass.

- **In the artifact itself.** Three `documentation[=].display` strings in
  `ig/input/fsh/suicide-safer-care-pathway.fsh` render on the Care Pathway page
  and say: *"which is what npm run check:reassessment exists to prevent"*, *"see
  the header of suicide-related-conditions.fsh"*, and *"transcribed in
  docs/reference/suicide-safer-care-pathway-spec.md"*. These are also in the
  published IG. A reader of a FHIR PlanDefinition should never meet an npm
  script.
- **In page copy.** The Care Pathway simulator lede names `mapCSSRSScreener`.
  The CDS Service page names `observationMappers`, `derivePathwayStatus`,
  `buildCdsCards`, a package directory and `npm run check:core-boundary`. The
  Provider App page dates its own rename ("It was called the Patient App until
  2026-09-17"). The Population Dashboard page cites "a repo gate".
- **Rendered raw.** The Care Pathway prints FHIRPath applicability expressions
  (`%episode.extension('http://…').value.coding.where(…).code = 'low'`) and
  bare canonical URLs inline, three times each, in the tier columns.

---

## 2. Measurements

Desktop is a 940px-tall viewport; "screens" is page height divided by viewport.
Word counts are the rendered main element.

| Route | Words | Screens (desktop) | Screens (phone) | Notes |
|---|---|---|---|---|
| `/overview` | 1,716 | 5.7 | — | Capture→Translate→Act stated three times; four-surfaces prose then four-surfaces cards |
| `/guide/pathway` | 2,445 | 9.0 | — | 15 code elements; three tier columns repeating "Share crisis resources" and "Reassess on cadence" |
| `/guide/tools` | 2,047 collapsed | 11.3 | 17.2 | 40 accordion cards; each expands to ~1,600px more; progress bar overflows horizontally with no affordance on phone |
| `/guide/data-dictionary` | 1,980 | 17.1 | — | 8 tables |
| `/guide/tools/readiness` | 627 | 3.6 | — | 8 tables; 34 dead links |
| `/guide/provider-app` | 981 | 2.9 | — | 4 Notices, 2 of them warnings |
| `/guide/dashboard` | 462 | 1.6 | — | The one page near the right length |
| `/guide/cds-service` | 730 | 2.9 | — | 28 code elements |
| `/guide/adoption-rubric` | 368 | 2.8 | — | — |
| `/guide/tools/asq/try` | 173 | 1.4 | — | The best page on the site: one form, one notice |

The phrase "not evidence of interoperability" (or its paraphrase) appears on
four pages. "Rendered from the published PlanDefinition" appears on three.

---

## 3. Why it does not read as a story

**No reader is named.** The site serves a health-system decision-maker, a
clinical informaticist, an EHR implementer and an HL7 reviewer, and every page
addresses all four in the same paragraph. The Overview's lede does it in one
sentence: mission, artifacts, "EHR vendors and health-system admins", and "the
code to execute on it". A decision-maker stops at "FHIR-native reference
implementation"; an implementer skims to the bottom for a link.

**The Overview says everything three times.** Step cards (Capture, Translate,
Act), then three numbered sections restating each card at length, then *How
that maps to what you see in this app* restating that the steps are not the
navigation. Then *Four surfaces* in five paragraphs, then *Where to go next* in
four cards saying the same four things. A reader gets their first actionable
link 1,400 words in.

**Nouns, not questions.** The sidebar reads *The standard / Care Pathway /
Tools / Data Dictionary*. A first-time reader does not know what "the standard"
is or why a pathway and a dictionary sit under it. The 2026-09-17 regroup
([`archive/guide-navigation-regroup.md`](archive/guide-navigation-regroup.md))
fixed the *kind* problem — those three really are the same kind of thing — but
the labels describe the artifacts, not the reader's task.

**Every page is a reference dump with a lede on top.** The Care Pathway
renders the PlanDefinition verbatim: every documentation note, every FHIRPath
gate, every canonical URL, and three tier columns that repeat two of their three
obligations. What a reader wants first — *what does a good suicide-safer care
pathway do?* — is nowhere; the page assumes it and goes straight to the
artifact. The simulator, which is the best thing on the page, is a box above
the wall rather than the centre of it.

**Tools is a catalogue pretending to be a journey.** 40 cards, one line each,
in an accordion. Expanding one adds five sections and 1,600px; expanding another
collapses the first. The form — the thing a reader would actually try — is a
secondary button at the *bottom* of the expanded detail, after the FHIR
examples. On a phone the page is 17 screens with nothing expanded.

**The hedges are equal-weighted with the instruction.** *Not evidence of
interoperability* ×4, *Pending clinical definition*, *Honesty notes*, *This is
the clinician's app, not the patient's*, *You will not see any FHIR in it*. All
true and all worth keeping. The mock-EHR pass settled the pattern: **task
first, caveats demoted into closed drawers, never deleted**. The guide states
each caveat inline, in a coloured box, at every place it could apply.

---

## 4. The proposed shape

One question per page, the interactive thing in the foreground, the artifact
one click down. Reading order:

### 4.1 Start (`/overview`, ~300 words)

Three sentences on what SPiER is. Then the one thing to do: **open the Demo
EHR, pick Marcus Chen, press Launch SPiER** — the same ten-minute path
`docs/mock-ehr-demo-script.md` already scripts, with the three chart picks as a
row. Then three doors by reader:

- *I decide whether to adopt* → the Care Pathway explainer, then Adoption Readiness.
- *I implement* → Tools, the Data Dictionary, the CDS service.
- *I am reviewing the specification* → the published IG.

Capture → Translate → Act survives as the three step cards and nothing more;
the three numbered essays and *How that maps* move to a "Why SPiER" page under
Reference, or to the IG's how-to-read page, which is already their canonical
home. The interoperability caveat appears once, in a drawer under the demo path.

### 4.2 Care Pathway (`/guide/pathway`, ~400 words + simulator)

What a good suicide-safer care pathway does, in five short paragraphs: screen
everyone with an instrument that carries a suicidality item; gate on a positive;
clarify with a validated assessment; tier the response and apply that tier's
obligations; keep asking at every contact and step down only by rule. The eight
stages as one horizontal diagram (the Overview already has this component).
Then the **simulator as the centrepiece**, with the tier branch rendered as
**one table — obligation × tier** — under it, lighting up the column the answers
produce. Three columns that repeat two of three rows become one table where the
repetition is visible as a row spanning all tiers, which is what the source
diagram draws.

Then one sub-page, **The published protocol** (`/guide/pathway/protocol`,
declared as a `subsections` entry so the gates see it): the spine exactly as it
renders today, provenance, pending clinical definition, the JSON. The
implementer's page, reached by one link from the explainer: *"Everything above
is rendered from a published FHIR PlanDefinition. Read it in full →"*.

The three jargon strings in the artifact's documentation are rewritten in the
FSH (§1.3); the FHIRPath gates and canonical URLs render inside a code drawer on
the protocol page rather than inline.

### 4.3 Tools (`/guide/tools`, a list; `/guide/tools/:slug`, a page per tool)

The list: eight stage headings, one line per tool (name, purpose, status
pill), 40 links. No accordion. Roughly two screens.

The tool page: the **form first** — the same element the try route renders
today, inspection on — with the detail beside or below it in a drawer set:
*What it records* (the implementation table), *Data elements*, *FHIR examples*,
*Licensing*. One CTA: *Open in the Demo EHR* (outbound). This retires the
accordion, retires the separate try route (or makes it the tool page's own
URL), and puts the interactive form where the reader lands rather than behind
"Show details" and a secondary button.

Adoption Readiness stays as the scored view of the same list.

### 4.4 See it running (`/guide/provider-app`, `/guide/dashboard`, `/guide/cds-service`)

Keep three pages, cut each to one screen. Pattern per page: what it is (two
sentences), what you see (four bullets), how to see it (the button), one drawer
*How it decides* for the mechanism, one drawer *What this does and does not
prove* for the caveat. The Provider App page today is 981 words with four
Notices; the Population Dashboard page at 462 words is the model.

The CDS page loses its function names, keeps its four curl blocks, and the
Honesty notes section is corrected and folded into the caveat drawer.

### 4.5 Reference

Data Dictionary, Adoption Readiness and the Adoption Rubric under one heading.
Unchanged in content for now; the Data Dictionary's seventeen screens want a
per-stage filter or a jump list at the top, which it already has the anchors
for.

### 4.6 Sidebar

Two options, and a recommendation.

- *Keep the three groups, rename them to the reader's question:* **Understand**
  (Care Pathway, Tools), **See it running** (Provider App, Population Dashboard,
  CDS Service), **Reference** (Data Dictionary, Adoption Readiness, Adoption
  Rubric). Adoption Readiness returns to the sidebar as a row under Reference.
- *Collapse to a single ordered list* of seven rows with no headings.

Recommendation: the first. The 2026-09-17 regroup got the *grouping* right and
this changes only the labels and one row. The pager already walks the list in
order, so the reading order in §4.1–4.5 is what a reader who presses *Next*
gets.

---

## 5. Copy rules to adopt, so this does not regress

1. **One reader per page, named in the first sentence.** "If you are deciding
   whether to adopt…", "If you are wiring this into an EHR…".
2. **Task first, caveats in a drawer.** The mock-EHR rule, applied here. A
   caveat is stated once per site and linked from everywhere else.
3. **No repo vocabulary in reader copy.** No script name, gate name, function
   name, package path, file name, PR number or rename date. The wire format
   goes in a JSON viewer or a code drawer. This applies to
   `documentation.display` in the FSH too, because it is published.
4. **Length caps.** Overview ≤ 400 words. A guide section ≤ 600 words before
   the first interactive element or table. A tool page's prose ≤ 150 words
   above the form.
5. **One statement of provenance.** "Rendered from the published PlanDefinition"
   is said once, on the protocol page, not as a preface on three.

Rule 3 can be a gate: a scan of the guide's reader strings and the FSH's
documentation displays for `npm run`, `check:`, `.fsh`, `.ts`, `docs/`,
`packages/`, `scripts/`. Rule 4 can be a test over the rendered pages. Both are
cheap and both would have failed today.

---

## 6. Sequenced work

Each is one PR against `main`, none stacked.

| # | Scope | Size | Needs a decision? |
|---|---|---|---|
| 1 | **Fix the broken class and gate it** (§1.1): primary tool button → try route, launch → outbound Demo EHR; shared views' "View in chart" and cross-links hidden or redirected under inspect; try-page eyebrow; guide walk in `check-surface-links.mjs`; dead redirects; dead `PatientBanner` branch. Plus the five copy defects in §1.2. | S–M | No. Mechanical, and every change is a defect today. |
| 2 | **Overview rewrite** (§4.1). Applied — see the status note at the top. Larger than the S estimated here: the essays moved to a new guide section rather than being dropped, which added a route, a sidebar group and a pager step. | S | Answered: three doors replace the lens cards, and the essays move to `/guide/why-spier` under Reference. |
| 3 | **Care Pathway split** (§4.2): explainer + `/guide/pathway/protocol` subsection; tier table; FSH documentation rewrite; code drawer for gates and URLs. Applied — see the status note at the top. | M | Answered: the tier table replaces the three columns on the clinical surface too (one artifact, one rendering), and the section stays `wide` with the explainer's prose capped at the reading measure rather than the width model changing. |
| 4 | **Tools as pages** (§4.3): list + `/guide/tools/:slug` with the form inline; retire the accordion; fold the try route in. Touches `check:tool-view-routes` and `check:guide-boundary` expectations. | M–L | Yes: whether the tool page IS the try route or wraps it. |
| 5 | **See it running** (§4.4): trim three pages, drawers for mechanism and caveat, CDS corrections. | S | No. |
| 6 | **Sidebar labels + Reference group** (§4.6), and the two gates in §5. | S | Yes: the labels. |

PR 1 should land first regardless of anything else in this document. Everything
after it is a design decision the user owns; the recommendation is PRs 2 → 3 →
4 → 5 → 6, because that is the order a new reader meets the pages.

---

## Appendix: what was checked

- Every guide route rendered in the built-in browser at 800×940 and 375×812,
  with page height, word count, heading and table counts and outbound-link
  counts read from the DOM.
- The launch-button bounce reproduced by click (Tools → ASQ → Launch ASQ
  Screening → `#/overview`).
- Source of every page under `apps/guide/src/`, the shared `PathwayView`, the
  shared filler and recorder views, the catalog's `tool-ui-metadata.ts`, the
  pathway FSH, `check-surface-links.mjs` and `route-table.mjs`.
- Open GitHub issues: none cover the guide's copy or UX; #526 (the rubric as
  its own surface) is adjacent to §4.5.
- The two archived navigation plans, to avoid re-proposing what they settled.
