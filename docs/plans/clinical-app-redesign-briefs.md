# Clinical app redesign — one session brief per PR

**Status:** briefs written 2026-09-21 for the PR sequence in
[`clinical-app-ux-audit-2026-09-21.md`](clinical-app-ux-audit-2026-09-21.md) §6.
PR 1 shipped from the audit's own session; PRs 2–7 are each meant to run in a
**fresh chat**, so a session never needs the audit session's context — only
this file and the repo.

How to use this file: open a new chat, paste **the common preamble** and then
**one brief**, verbatim. Run them in the order the dependency line in each
brief allows. When a PR merges, the next session's first act is to rebase onto
`origin/main`; a stale worktree is the single most common way these go wrong.

Suggested models: PR 2 and PR 6 are mechanical and suit Sonnet; PRs 3, 4, 5
and 7 make design and copy judgements and suit Opus. None of them needs the
model that wrote the audit.

---

## The common preamble — paste first, every time

```
You are working in the SPiER repo (github SPiER-Project/adoption-guide). Its
CLAUDE.md is loaded automatically; read it once before anything else, then read
the docs/internals/ file it names for the area you are changing. Every ⚠️ in
those files is a defect that shipped.

This session is ONE pull request of the clinical-app redesign. The audit that
scoped it is docs/plans/clinical-app-ux-audit-2026-09-21.md — read the sections
the brief names, and §4 (the target design) and §7 (the decisions Brad made on
2026-09-21) in full. The decisions are settled; do not re-open them.

Setup, in a fresh worktree branched from origin/main:
  npm install                       # repo root — the only node_modules for apps/ and packages/
  (cd services/<each one you touch> && npm install)
  npm run copy-fhir                 # generated FHIR tree; tsc -b needs it present

Working rules:
- One branch, one PR. Brad squash-merges. Open the PR with
  `gh pr create --repo SPiER-Project/adoption-guide --body-file <file>`;
  `--body -` silently stores a literal "-". The PR title is a sentence saying
  what is true after the change, like the commits already on main.
- Before you call anything done: `npm run verify` at the repo root when
  apps/ or packages/ changed; `npm run verify` inside EVERY services/* you
  touched (the root does not cover them); the standalone docs gates
  (`node scripts/check-md-links.mjs`, `node scripts/check-md-paths.mjs`,
  `node scripts/check-plan-status.mjs`) when you touched a .md.
- A new gate or test must be proved able to fail: plant the defect it is for,
  watch it go red, remove the plant, say so in the PR.
- Never hand-edit generated output. No IS_DEMO. No route literal inside
  packages/tool-views (routes come from SurfaceLinksContext). No resource
  type, profile, code, canonical URL, tier number or issue number in anything
  a clinician reads; the wire format lives in the Adoption Guide. Design
  tokens only; the nine surface owners own padding, radius, border and
  background. Do not raise a page budget to go green.
- Measure before and after in a real browser at 375×812 and 470×900. The
  audit's numbers are in its §3; yours go in the PR description.
- When the PR is up, add a dated "**Status YYYY-MM-DD (PR n):**" paragraph to
  the top of docs/plans/clinical-app-ux-audit-2026-09-21.md saying what shipped
  and what was deliberately not done, the way
  docs/plans/archive/adoption-guide-ux-audit-2026-09-20.md does. Do NOT write
  the words done, complete, merged or implemented on the file's own
  "**Status:**" line — check:plan-status archives a plan on those words.
- Report at the end: what changed, what you measured, what you left out and
  why. If you find the audit was wrong about something, say so rather than
  working around it.
```

---

## Brief 2 — Demo host hygiene

Depends on: nothing. Can run in parallel with PR 3.

```
PR 2 of the clinical-app redesign: the demo host (services/mock-ehr) stops
drifting from main and stops contradicting itself. Read the audit's §1.1, §1.3,
§1.13, §1.14, §4.11 and §7 items 1, 5. Internals: docs/internals/workers.md.
Also read services/mock-ehr/README.md and docs/mock-ehr-demo-script.md — you
will edit both.

Five changes, each with a test:

1. DEPLOY FROM CI. .github/workflows/deploy.yml has jobs for the clinical and
   cds Workers and none for services/mock-ehr — it is the one Worker deployed
   by hand, and the live host is weeks behind main because of it. Add a
   mock-ehr job shaped like the cds job (same token, its own install, its own
   `npm run deploy` with CI set). Delete the README's "NOT deployed by CI"
   paragraph and the ordering warning under it, and fix docs/internals/workers.md
   to say all four Workers deploy from main. Add a check — extend
   scripts/check-deploy-origins.mjs or a small sibling — that every
   services/*/wrangler.jsonc name appears in deploy.yml, and prove it red.

2. PREFETCH ON THE HOST'S CDS CALL. services/mock-ehr/src/routes/cds.ts
   invokes the CDS service server-to-server with context only, so the service
   (services/cds/src/service.ts) takes its fallback and evaluates the bundled
   fixture rather than the chart. Brad's rule: the card suggests the step the
   chart data suggests, otherwise screening. So the host attaches
   `prefetch.questionnaireResponses` — the key the service's discovery
   document declares — as a searchset Bundle of the patient's completed
   QuestionnaireResponses from BOTH the fixtures (src/fixtures.ts) and the
   Durable Object's writes (src/demoStore.ts `list()`, filtered to the
   patient). The service's live path already handles a prefetched Bundle.
   Test in mock-ehr that the outbound body carries a written QR; the interop
   test in services/cds (it imports the mock EHR) must still pass. Run
   `npm run verify` in BOTH services.

3. NIGHTLY RESET, MANUAL RESET KEPT. Writes stay in the demo EHR's store —
   the point of the demo is a write landing on a FHIR server and the host's
   own write log corroborating it (Brad, 2026-09-21). Add a Cron Trigger to
   services/mock-ehr/wrangler.jsonc (around 09:00 UTC) and a `scheduled`
   handler in src/index.ts that calls DemoStore `reset()` — the same method
   POST /_admin/reset uses, so the manual "Reset written data" button on
   /settings keeps working and the two cannot diverge. Say on the front door's
   drawer and on /settings that written data resets nightly and can be reset
   now. Test the handler with a fake store.

4. "WRITTEN SINCE" ON THE CHART. The launch card's story is static prose about
   the fixture ("No suicide-risk screening on file") while the chart may hold
   an earlier visitor's writes. GET /_admin/writes takes a `?patient=` filter
   (writes are stored per patient), and src/client/chart.ts shows one line
   under the launch lede when the count is non-zero: "N records were added to
   this chart by an earlier demo — Settings → Reset written data." Keep it out
   of the hood; a presenter meeting Marcus Chen at step 3 needs to see it
   without opening anything.

5. EMBED=0 ON TOP-LEVEL LAUNCHES. PresentationProvider persists `embed=1` in
   sessionStorage for the tab, so a later top-level launch in the same tab
   that carries no embed parameter inherits panel chrome. src/client/home.ts's
   two worklist launches send `embed: false` and POST /_admin/launch turns
   that into `embed=0` in the query (before the `#`). Test in
   chartPage.test.ts beside the existing embed=1 cases.

Then update docs/mock-ehr-demo-script.md: its "Before you start" and
"If something looks wrong" sections describe the pre-CI world.

Not in scope: anything under apps/ or packages/core. Do not change what the
CDS service recommends — that is PR 3; you are only making sure it is handed
the chart.
```

---

## Brief 3 — The pathway evaluator in core

Depends on: nothing. Can run in parallel with PR 2. PRs 4, 6 and 7 wait on it.

```
PR 3 of the clinical-app redesign: one recommendation, from the published
pathway only. Read the audit's §1.4, §1.5, §4.5 (the table is the spec) and
§7 items 1 and 2. Internals: docs/internals/tool-views.md §4 for the copy
rule, docs/internals/measures.md for how tiers and cadences are read. Read
ig/input/fsh/suicide-safer-care-pathway.fsh in full — it IS the pathway — and
packages/core/src/lib/pathway.ts, pathwayRealizations.ts, pathwaySelection.ts,
reassessment.ts, riskEpisode.ts, patientPathway.ts and cdsHooks/cards.ts with
its tests.

What exists: buildCdsCards (packages/core/src/lib/cdsHooks/cards.ts) emits a
card for the active pathway STAGE, leading with that stage's lead tool — which
for five of the eight stages is a PRODUCT DEFAULT in PATHWAY_STAGE_DEFAULTS,
not anything the published pathway names — plus one card per live risk alert,
plus a guidance card. Nothing ever asks whether an alert's suggested tool has
since been recorded, so Sarah Patel's chart shows "Start C-SSRS Screener" on a
stage that holds a C-SSRS, and three "recommended actions" of which the one
the pathway actually obliges (a safety plan at moderate risk) is third.

Build, React-free and DOM-free in packages/core (check:core-boundary):

1. A pathway evaluator module. Input: a patient's slice (responses,
   observations, carePlans, communications, procedures, episodes, riskAlerts).
   Output: the primary recommendation, the also-due list, and a one-sentence
   reason in the clinician's words. Walk the audit §4.5 table top to bottom:
   no screen → screen (PHQ-9, the pathway's realization); positive screen with
   no assessment after it → assess (C-SSRS Screener); negative assessment →
   nothing due; tier low → crisis resources then reassess; moderate → safety
   plan (Stanley-Brown), crisis resources, reassess; high → the same plus
   lethal-means counseling and the direct question; every obligation met →
   reassess when the cadence (reassessment.ts) says so, else nothing due.
   "Satisfied" means an artifact of the right kind dated AFTER its trigger.
   Read the realizations through pathwayRealizations.ts and the tier from the
   harmonized Observation (LOINC 93374-7) or the episode's current-tier
   extension — never from an instrument's native result. Write it so the
   PlanDefinition is a parameter: custom pathways are a later decision, not
   this one.

2. buildCdsCards rewritten over it. The first card is the primary and carries
   `spier-primary: true` in its extension; also-due obligations follow; the
   problem-list guidance card stays last and unlinked. Card titles are the
   act ("Complete a safety plan"), details are the trigger in plain words
   ("C-SSRS Screener on Sep 3: moderate risk"), never a CodeSystem definition.
   PATHWAY_STAGE_DEFAULTS stop producing cards; leave the constant, the preset
   and the stage pages that read it alone. Keep the CDS Hooks 2.0 Card shape,
   the smartLaunch link form, spier-stage-id and spier-router-paths — the
   CDS service and the chart both consume them unchanged. Export the
   evaluator's primary label for the caseload's "next step" column
   (caseloadColumns.tsx reads derivedNextStep today).

3. Tests, each against a demo fixture from packages/demo-population: Marcus
   Chen (patient-002) → screen; Sarah Patel (patient-003) → assess; Sarah plus
   a later moderate C-SSRS → safety plan primary, crisis resources and
   reassess also due, and NO C-SSRS card; a negative C-SSRS → nothing due;
   Maria Alvarez (patient-011) → reassess or nothing due per her cadence.
   Plant each defect the audit found (a stale alert card, two primaries, a
   product default recommending) and watch it fail.

Gates: root `npm run verify` (check:pathway, check:outputs,
check:published-profiles and check:reassessment all read this area) and
`npm run verify` in services/cds, which imports the builder. The chart
(apps/clinical/src/components/PatientPathway.tsx) must still render — it
groups cards by spier-stage-id — but do not redesign it here; that is PR 4.

Not in scope: any page layout, the mock EHR, the guide.
```

---

## Brief 4 — The landing screen and "Why this?"

Depends on: PR 3 merged.

```
PR 4 of the clinical-app redesign: the chart opens on one instruction. Read
the audit's §1.6, §1.7, §4.1, §4.2, §4.7 and §7 items 1 and 3. Internals:
docs/internals/surfaces-and-routing.md, css-and-page-template.md and
web-gates.md — the template gate (scripts/check-page-template.mjs), the
catalog gate (scripts/check-catalog-integrity.mjs, which reads landing routes
and every <Navigate> target as TEXT) and check:surface-links will all see
what you do. Read apps/clinical/src/App.tsx, pages/PatientChart.tsx,
components/PatientPathway.tsx, PanelShell.tsx, LaunchShell.tsx,
packages/app-shell/src/components/PatientIdentityStrip.tsx and PatientBanner.tsx.

Build, in apps/clinical, using only the nine surface owners in packages/ui and
packages/tool-views (a page passes className for layout or a domain colour,
never a radius, padding, border or background):

1. THE LANDING SCREEN at /patient/record, in both chromes, in this order and
   nothing above it: (a) who — name, age, MRN, current risk pill, one line;
   (b) the primary card from PR 3's evaluator — the act as the title, the
   trigger as one sentence, one launch button — with the also-due obligations
   as one line of text under it; (c) a "Why this?" link; (d) two links,
   "Where this patient is · Step N of 8" and "What's on file · N records".
   For this PR those two links may point at in-page anchors above the
   existing rail and record sections, which move BELOW the landing content;
   PR 5 makes them pages. A patient with nothing due reads "Nothing is due"
   with the same two links; the empty-chart notice stays for a patient with
   no data. In a 470×900 panel the button must be above the fold; measure it.

2. "WHY THIS?" — one page per recommendation, reached only from the landing
   card. In order: the artifact that triggered it (date, result, linked into
   the record), the pathway rule that turned the trigger into this action in
   the protocol's words, the alternatives (move the stage page's "use a
   different instrument" list here), and one link to the protocol page.
   Declare the route in App.tsx, give it a PageHeader with `up` back to the
   chart, and register whatever check:catalog and check:surface-links need.

3. THE PATIENT IS NAMED ON A NARROW PANEL. PanelShell draws the dense
   PatientIdentityStrip whenever its own width is under the phone breakpoint,
   even when the host sent need_patient_banner:false — the parameter says the
   host HAS a banner, not that it is visible, and on a phone the host banner
   is covered by the takeover. Decided (Brad, 2026-09-21: show synced patient
   state). Test it.

4. THE TWO CHROMES CONVERGE. LaunchShell keeps its four sidebar destinations
   and its status footer; its patient banner and the landing "who" line are
   one strip, not two. PanelShell loses its footnote links ("The published
   protocol · Tools this deployment offers") — the protocol is reached through
   "Why this?", and settings is PR 7's.

Tests: a render test over the demo fixtures asserting exactly one primary card
on the landing screen and that it is PR 3's primary; the strip rule; one
PageHeader per page (ToolPage.test.tsx in apps/guide shows how to count them).
Keep every existing route resolving; `check:catalog` fails a stranded Navigate.

Not in scope: rewriting the rail or record sections' copy (PR 5), the fillers
(PR 6), the caseload (PR 7).
```

---

## Brief 5 — "Where this patient is", "What's on file", and the clinician's words

Depends on: PR 4 merged.

What PR 4 left for this one, beyond the audit's own list: the landing screen's
two links jump to the `activity` and `on-file` anchors rather than navigating,
and this PR turns them into pages. ⚠️ **Deleting the rail's *Tools that satisfy
this stage* chips is the measured part of §4.3, not a tidy-up** — with the
pathway's obligations off the rail, a stage that used to carry a card now falls
into that branch, and Sarah Patel's chart grew from 1,217px to 1,589px at 375px
because of it. The same block holds the *Open this stage →* link, which is the
only route into `/patient/pathway/:stageId`; move it before deleting the block
or `check:catalog` fails on a stranded route.

```
PR 5 of the clinical-app redesign: the rail and the record become pages a
clinician opens on purpose, and nothing on the clinical surface names a
resource type. Read the audit's §1.9 (the table is your worklist), §1.10, §2,
§4.3, §4.4, and §5 rules 1–2. Internals: docs/internals/tool-views.md §4 (the
recorder describes the act — the same rule, applied to the rest of the
surface), web-gates.md on check:jargon and check:fhir-render, and
apps/guide/src/pages/pageLength.test.tsx, which is the model for the budget
test you will write.

Build:

1. TWO PAGES. "Where this patient is" is the eight-stage rail on its own
   route: markers and collapsed rows stay; the stage CodeSystem definitions
   go (they are written to an EHR vendor — "The EHR supports documenting…")
   and are replaced by one clinician sentence per stage held in
   packages/core beside the stage ids, typed against the generated StageId
   union like STAGE_BLURB in cdsHooks/cards.ts; the "Tools that satisfy this
   stage" chips go (they are the stage page's); a stage carrying a
   recommendation says "1 due" on its row. Each row links to its stage page.
   "What's on file" is one list: what was recorded, when, by which
   instrument, grouped by episode where the references allow — replacing
   Episode record, Patient Documents and Other activity. Update the landing
   screen's two links and every "View in chart" anchor.

2. THE WALKTHROUGH LEAVES THE CLINICAL BUILD. EncountersTimeline renders
   fixture narration ("Narrative steps, not FHIR resources … tracked in issue
   #52") under a live launch against a server that has no such thing. Remove
   it from apps/clinical; if the presenter needs it, the mock EHR's chart page
   already carries each chart's story.

3. THE COPY PASS, over every string a clinician reads in apps/clinical and
   packages/tool-views: the "Recorded here" rows (no "QuestionnaireResponse ·",
   no emoji), "Saved to the EHR" (what was saved, in words — not tiers and
   resource types), the episode record's FHIR R4 explanations, the protocol
   page at /patient/pathway (plain words first; the canonical URL, version and
   status behind useInspect()), the stage page's tool purpose text, the panel
   footnote, the caring-contact and other recorder ledes if any slipped.
   Where a string comes from the FSH (a stage definition, a tool purpose),
   give the app a clinician display rather than editing the published artifact.

4. TWO GATES. Extend scripts/check-reader-jargon.mjs with a second scan over
   apps/clinical/src and packages/tool-views/src using a clinical rule set: no
   FHIR resource type used as a word, no LOINC or SNOMED code, no canonical
   URL, no issue number, no tier or rung number. Add a clinical page-budget
   test on the pageLength model, with the panel as the measured chrome and a
   small budget for the landing screen. Prove both red.

Gates: root `npm run verify`. Not in scope: the fillers' submit flow (PR 6),
the caseload and measures (PR 7).
```

---

## Brief 6 — Fillers and recorders: the confirmation beat

Depends on: PR 3 merged. Can run in parallel with PR 4 and PR 5.

```
PR 6 of the clinical-app redesign: the forms keep their frame and fix their
beats. Read the audit's §1.8, §4.6 and §7 item 1. Internals:
docs/internals/tool-views.md in full — the recorder describes the act,
check:fhir-render RULE 3 reads the recorders' JSX text, and the 29 views are
ONE definition rendered by two apps. Read packages/tool-views/src/components/
WorkflowForm.tsx, QuestionnaireView.tsx, InstrumentHeader.tsx and
CarePlanDisplay.tsx, and packages/app-shell/src/hooks/useCorrelatedSave.ts.

Fix:

1. THE SCRATCH-CHART NOTICE. Under a live SMART launch every recorder opens
   with "No patient selected — this will be recorded in the scratch chart",
   because WorkflowForm keys the hint on the URL-derived activePatientId,
   which is null on /patient/record. The write is correct (SmartDataSource
   resolves the launch patient); the notice is false. Key it on "no patient
   in context" — under SMART that is the launch patient. Test a recorder
   inside a SMART session shows no notice.

2. THE CONFIRMATION BEAT. After a submit, QuestionnaireView shows the risk
   summary and then ONE next action — PR 3's evaluator's primary for the
   record as it now stands — and a "Back to chart" that returns to the
   landing screen with the pathway visibly advanced. Today it offers the
   mapper's suggestedAction and "View in chart" side by side; the mapper's
   suggestion stays available to the evaluator but is not a second button.
   The recorders' success notice gets the same one-action shape through
   WorkflowForm. Scroll the beat into view as the notice already does.

3. THE SAFETY PLAN'S "DEMO ONLY" NOTICE in CarePlanDisplay says "no patient
   data has been stored, transmitted, or persisted to any server", which is
   false under a live launch that just wrote a CarePlan. Say what is true in
   each case, or drop it where the writeback scorecard already says it.

4. "About this instrument" keeps its closed drawer and its recorded judgement
   (InstrumentHeader's header comment). Do not adopt Disclosure for it
   without re-reading why it did not.

Gates: root `npm run verify`; check:fhir-render and check:tool-view-routes
read these files. Measure the PHQ-9 at 375 and 470 before and after: first
control's offset and document height.

Not in scope: the renderer's combobox-per-item (a note upstream at most), any
page outside the form views.
```

---

## Brief 7 — The caseload and the measures: audit, then redesign

Depends on: PR 3 merged (the caseload's next-step column). The audit half can
start any time.

```
PR 7 of the clinical-app redesign: the care manager's two screens. Decided
(Brad, 2026-09-21): they are in scope, and they get the same audit the chart
got before anything is redesigned. Read the audit's §1.10, §1.11, §1.12, §4.8,
§4.9 and §3 (the method), then docs/plans/suicide-care-dashboard.md and the
spec it names. Read apps/clinical/src/pages/PopulationView.tsx,
PopulationSummaryEmbed.tsx, MeasureDashboard.tsx, ToolConfiguration.tsx, the
components they compose (PopulationSummary, PopulationAlertsPanel,
CaseloadTable, caseloadColumns), hooks/useRegistrySlices.ts and
useCaseloadSummary.ts, and packages/core/src/lib/registry.ts and measures.ts.

Part 1 — AUDIT FIRST, as a new section appended to
docs/plans/clinical-app-ux-audit-2026-09-21.md. Launch the caseload from the
demo EHR's front door ("Open the full caseload", a user-scoped launch) at
375×812 and desktop, and the measures via "Launch measures". For each screen:
who the reader is, the words they meet on arrival, the pixel offset of the
first row or first table, every string an implementer or presenter wrote
(the audit's §1.9 table has the kinds), and every control that does nothing
for that reader. Known starting points: the first caseload row is at 936px in
a 768px viewport on desktop and 1,290px on a phone; the measures page under a
patient-bound token reports "the 0-patient cohort" and eight tables with no
denominator; the caseload's lede explains what recommendations are; alerts
cite Measure ids as provenance; the framed summary on the front door issues
about 400 requests to draw seven tiles. Write the findings before you fix
anything, and get a nod on them.

Part 2 — REDESIGN, on the findings. The audit's §4.8 sets the direction: the
table first; the summary collapsed to its breached tiles by default on a
phone, open on desktop; the alerts as a count that opens a page; the three
caseload views kept; the lede stops explaining. The measures page says what a
patient-bound session can and cannot show in one line and offers the worklist
launch. Settings (§4.9) leaves the panel's navigation and its 1,520 words
become the preset picker, the checklist and one sentence. Cut the framed
summary's request fan-out — a cohort summary read on the mock EHR, or fewer
searches per patient — measured before and after.

Gates: root `npm run verify`; `npm run verify` in services/mock-ehr if you
touched the front door or added an endpoint. Extend the clinical page budgets
PR 5 added to these pages.

Not in scope: new measures, new registry columns, the role model the
dashboard plan says is missing.
```
