# Clinical app — copy, layout and UX audit

**Date:** 2026-09-21 · **Branch audited:** `main` at `c246f11` · **Surfaces:** the
two SMART apps in `apps/clinical/` (the chart, the fillers and recorders, the
caseload, the measures), the shared chrome in `packages/app-shell/`, the shared
views in `packages/tool-views/`, and the mock EHR that launches them
(`services/mock-ehr/`).

**Status:** PRs 1, 2 and 3 have shipped; PRs 4–7 have not started. §7 records
the decisions Brad made on 2026-09-21; the briefs to run PRs 4–7 each in a
fresh session are in [`clinical-app-redesign-briefs.md`](clinical-app-redesign-briefs.md).

**Status 2026-09-21 (PR 3):** the chart stops answering "what do I do" three
times — §1.4, §1.5, §4.5 and rules 3 and 4. A new evaluator in
`packages/core/src/lib/pathwayEvaluation.ts` walks
`PlanDefinition/SPiERSuicideSaferCarePathway` against the patient's record and
returns one primary obligation, the also-due list, and one sentence naming the
trigger; `buildCdsCards` is rewritten over it and decides nothing itself. A
step is retired by an artifact of the right kind recorded after its trigger, so
Sarah Patel's chart no longer says *Start C-SSRS Screener* on a step that holds
one, and `PATHWAY_STAGE_DEFAULTS` produces no cards at all — it still says what
a stage OFFERS and no longer what anything RECOMMENDS. Exactly one card carries
`spier-primary`. Measured in the panel at 375×812, Sarah goes from 3 cards /
318 words / 2,358px to 1 card / 164 words / 1,217px, with the one button at
437px instead of ~520px: above the fold for the first time.

Two readings the table in §4.5 did not spell out, both recorded in the
evaluator: the published pathway states the tier's obligations but does **not**
rank them (no `action.priority`, no `selectionBehavior`), so the ranking that
puts the safety plan above crisis resources comes from §4.5 and decision §7.2
and is declared in TypeScript; and the tier is read through the published
crosswalk ConceptMaps as well as a `SPiERSuicideRiskTier` value, because SPiER's
own C-SSRS administrations record their result in the instrument's native
vocabulary and a rule that read only the harmonized value could not tell
moderate from high for the one assessment the pathway names.

Two things the evaluator surfaced rather than fixed. **No demo scenario records
crisis resources at all**, so every patient with a tier now leads with *Share
patient-facing crisis resources* — a true reading of the fixtures and a gap in
them. And **Maria Alvarez is not "finished"** — that chart holds no crisis
resources and its reassessment is seven weeks overdue — so the demo host's
narration for it was corrected in the same change.

A third was surfaced and then fixed in the same PR. **The CAMS SSF-5 recorded
its overall-risk rating as a bare integer on LOINC 93374-7**, so
`ConceptMap/CAMSOverallRiskToRiskTier` — published, and translating codes — had
nothing to translate, and patient-006's chart could state no risk tier at all.
`cams.fsh` had anticipated exactly this and said on the CodeSystem that "a
producer maps valueInteger n to the like-numbered code before translating";
nothing was that producer. The mapper now is, so that chart reads *Complete a
collaborative safety plan — CAMS SSF-5 on Aug 6: moderate risk*. The six SSF
vitals still carry integers, because `SPiERCAMSSSFVital` requires them. The
crosswalk gate's `NO_MAPPER_REASON` entry for this source is deleted rather than
reworded, so the map is now really checked.

Fixing that exposed a second thing the demo had been saying wrongly, corrected
here too: patient-006's story line read *"High risk after a CAMS session"*, and
that number is the risk ALERT, which the mapper drives from the highest of the
six SSF vitals (psychological pain and hopelessness are both 4/5). The
patient's own OVERALL risk rating — the one item the published crosswalk reads,
and therefore the one the pathway branches on — is 3/5, which is moderate. Both
numbers are on the chart and they are not the same measurement. The host's
story, the curated next-step line in `patients.json` (which also claimed a
"risk status" that chart has never carried) and two prose references now say
which one they mean.

**The two numbers reached two different SPiER surfaces, and the caseload now
reads the tier.** Its RISK column was `highestRiskLevel(riskAlerts)` — the most
severe thing any instrument said — so it printed *High* for this patient while
that patient's own chart read *moderate risk*. `deriveRegistryRow` now
evaluates the pathway once per row and takes the harmonized tier from it, which
is what the protocol conditions on; the row's next-reassessment date is
computed off the same tier, so the two surfaces agree on the cadence as well.
An alert is still the fallback where a record has reached no tier at all — a
positive PHQ-9 with no assessment yet reaches none, and printing *None* for
that patient would read as "screened, no risk".

⚠️ **That change found a worse thing than the one it was made for.**
patient-013 and patient-014 are the ED exception branches — an acute positive
ASQ, then a transfer and an elopement. Their scenarios carry an **empty
`riskAlerts` array**, which is a cached derivation rather than anything in the
record, and `highestRiskLevel([])` is `none`. So the worklist rendered **None**
for two patients whose charts record an acute positive screen, and
`RISK_LEVEL_ORDER` sorted them to the **bottom** of a list whose own caption
says "highest risk first". Reading the tier off the Observation fixes it,
because a chart that has one cannot be missing it. Four demo rows change in
total: patient-001 and patient-006 from high to moderate, patient-013 and
patient-014 from none to acute.

⚠️ **The related half is still open: `none` and `unknown` are one word on this
page.** `RiskLevel` already carries both, and `riskLabel.ts` says why — "a
chart that has never been screened must not read as cleared" — but the registry
row's type does not, so a never-screened patient and a screened-negative one
both render *None*. Closing it means touching the census bar, the risk filter
and the summary tiles, which is PR 7's screen and its audit section.

⚠️ **That closes the narrow half of the gap and not the recorded worry about
it.** `docs/best-practices/concept-harmonization.md` had flagged in advance that
letting CAMS reach the shared tier puts one *patient self-rating* beside five
clinician-determined routes. On the wire nothing is conflated — SPiER emits the
CAMS-native vocabulary and never a harmonized-tier value — but in the
application it now is: the evaluator translates the self-rating and then obliges
a safety plan and a reassessment cadence from it exactly as it would from a
clinician's C-SSRS. That doc records what changed; whether the two provenances
should drive the same obligations is a clinical decision, not a mapper one.

**Deliberately not done in PR 3.** No page layout: the landing screen, "Why
this?" and the narrow-panel identity strip are PR 4's, and the also-due
obligations therefore still render as cards on the rail rather than as text
under the primary. Because the rail groups cards by `spier-stage-id`, the
primary is first in the card list but not always first on screen — a patient
whose primary sits at a later stage than the problem-list prompt sees the
prompt above it. That is the landing screen's job, not the builder's, and it is
why Maria's chart is longer than before (391 words at 470px against 296): three
obligations are genuinely outstanding where the old chart said little.
`high-missed-appointment-outreach` is a published high-risk obligation this
evaluator never emits, because it is gated on a missed appointment rather than
on the tier.

**Status 2026-09-21 (PR 2):** the demo host stops drifting from `main` and
stops contradicting itself — §1.1, §1.3, §1.13, §1.14 and §4.11.
`.github/workflows/deploy.yml` grows a `mock-ehr` job beside `clinical` and
`cds`, so all four Workers ship on merge, and `scripts/check-deploy-jobs.mjs`
fails the moment a `services/*/wrangler.jsonc` has no job that deploys it (five
rules, all planted red). The audit was right that the Worker was hand-deployed
and understated it by one turn: #558 had given all four services the same
`test -n "$CI"` guard the day before, so the README's own hand-deploy
instruction had already stopped working — the documented recovery was broken
too. The host now attaches `prefetch.questionnaireResponses` to its signed CDS
call, as a searchset Bundle of the patient's completed responses from **both**
the fixtures and the Durable Object, so the service's live path reads the chart
instead of the bundled scenario; what it *recommends* from that is untouched
and is PR 3's. Written data still lives on the server (§7 item 5) and a Cron
Trigger at 09:00 UTC calls the same `reset()` the Settings button calls — the
front door's drawer and `/settings` both say so. A chart whose story the writes
contradict now says so in one line under its launch card, outside the drawer,
from a new `?patient=` filter on the write log. Both of the front door's
top-level launches send `embed=0`, which is what a tab that was ever embedded
needs to leave panel chrome.

**Deliberately not done in PR 2.** Nothing about what the service recommends,
and nothing under `apps/` or `packages/` — §1.4, §4.1 and §4.5 are PR 3's, and
with an empty prefetch the service still takes its fallback and surfaces the
patient's curated `recommendedNextStep`, which is the half of §7 item 1
("otherwise, screening") that PR 3 answers. Two stale claims in
[`mock-ehr-demo-script.md`](../mock-ehr-demo-script.md) were corrected while
that file was open — it still said the front door's caseload frame is *not* a
SMART launch, which stopped being true at #401.

The prompt (Brad, 2026-09-21): *"on the mock EHR, the only change I want to make
sure we make is that when launching the smart app on mobile, the side bar
covers (part of) the chart, so that the user doesn't have to scroll down to see
their actions. for the smart app, we need to be cognizant of space constraints
and an overwhelmed provider. they need to be able to clearly understand what
they should do, and if they need to explore why, that can be discoverable,
potentially as a page to navigate to in the app. there is a lot of product/tech
debt in this as it's been broken out from the adoption guide. we want to keep
the spirit the same, but nothing is off limits."*

This audit launched the deployed apps from the deployed mock EHR at phone width
(375×812), at the panel's default dock width (470×900) and at desktop width,
read every clinical page's source and the copy it draws from, and measured each
screen. It confirms the phone complaint and finds the reason, finds that the
live demo host is stale and its recommendations section is broken, and finds
that the chart answers "what do I do" with three competing answers — one of
them already done.

**The short version.** Four things are wrong, in increasing order of effort.
First, the deployed mock EHR is not the one on `main`: it predates 2026-09-20,
its "Recommendations from SPiER" section fails on every chart, and it is the
only one of the four Workers CI does not deploy. Second, on a phone the panel
opens below the fold, seven pixels past the bottom of the viewport, so pressing
the one button on the page changes nothing on screen. Third, the demo charts
contradict their own stories: writes persist across every visitor, so "Nothing
on file" Marcus Chen is at step 3 with fourteen records. Fourth — the product
problem — the chart is a rail of eight stages that a clinician has to read to
find out what to do, and when they do, it recommends three things at once, two
of which disagree and one of which is already recorded. The fix is a landing
screen that says one thing, a *why* one tap away, and the rail and the record
demoted to pages a clinician opens on purpose.

---

## 1. Defects (not taste)

### 1.1 The deployed mock EHR is stale, and its recommendations are broken

**What happens.** Open any chart on the live host. *Recommendations from
SPiER* reads **"The CDS service at https://spier-clinical.bbthorson.workers.dev
could not be reached (Failed to fetch)."** No cards render, so the second of the
two launch entry points the panel plan names — a CDS Hooks card whose link is
`type: "smart"` — is dead on the demo, and steps 3 and 5 of the demo script
(`docs/mock-ehr-demo-script.md`) cannot be performed as written.

**Why.** The served chart page carries an inline `<script>` and no
`spier-page-config` block, so it is a build from before #564 (2026-09-20), which
moved the page scripts into built client modules. It is also from before #556,
which moved the CDS service onto its own Worker — the page still posts to the
service browser-direct at an origin that no longer answers. `main` fixed both
on 2026-09-20; the host never picked either up because **the mock EHR is the
one Worker `.github/workflows/deploy.yml` does not deploy**. Its README says so
(*"This Worker is NOT deployed by CI … After merging anything under
`services/mock-ehr/`: `npm install && npm run deploy`"*) and eleven commits have
touched that directory since 2026-09-15. The README's own prediction is exactly
what a visitor sees: *"the symptom is a demo that behaves like the previous
commit — which reads as a code bug rather than a deploy that never happened."*

**Fix.** A `mock-ehr` job in `deploy.yml` beside `clinical` and `cds`, on the
same token. Until then, one `npm run deploy` from `services/mock-ehr/`.

### 1.2 On a phone the panel opens below the fold

**What happens.** At 375×812 on the deployed host, pressing **Launch SPiER** on
Sarah Patel's chart grows the document from 886px to 1,536px and puts the dock's
top edge at **874px — in an 867px viewport**. Nothing visible changes. The
clinician has to guess that scrolling down is the next step.

**Why.** `CHART_CSS` in `services/mock-ehr/src/chartPage.ts` handles narrow
screens with `@media (max-width: 60rem)` by making the dock `position: static`
and wrapping it under the chart column — a fix for the crushed-column defect it
records, which put the panel in flow below everything else on the page.

**Fix — PR 1, on this branch.** Below 60rem the dock takes over the screen:
`position: fixed`, the whole viewport, above the app bar, with a labelled
**← Back to chart** at the left of the guest bar as the way out (Brad,
2026-09-21: a full-screen takeover, *"as long as it's clear how to navigate
back to the patient chart"*). The launch card's "Opens in a panel beside the
chart" now reads "on this chart", which is true at every width. §4.10 has the
design.

### 1.3 The demo charts contradict their own stories

**What happens.** The front door and the demo script say Marcus Chen has
*"No suicide-risk screening on file"* and Sarah Patel is *"one step in … the
assessment the pathway calls for has not happened."* Launched today, Marcus is
at **Step 3 of 8** with six records at step 1 and eight at step 2, *Moderate
Risk — ideation with method*; Sarah has a **C-SSRS Screener recorded
2026-09-03** under a stage marked Complete. Their fixtures hold none of this
(`packages/demo-population/src/scenarios/patient-002.json` has no
QuestionnaireResponse at all; `patient-003.json` has one PHQ-9).

**Why.** Every write the panel makes lands in the mock EHR's Durable Object and
stays there for every later visitor. The host's launch card, story column and
"Start here" picks are static prose about the fixtures. The demo script knows
this — *"If someone ran the demo before you, open Settings → Reset written
data"* — but a visitor arriving from the Adoption Guide has not read the script,
and the first person to run the demo dirties it for everyone after.

**Fix.** Decided (§7, item 5): writes stay in the demo EHR's store and a
scheduled job clears them nightly. The chart page also says when a chart has
been written to since its story was true, so a presenter meeting Marcus at
step 3 mid-day knows why.

### 1.4 A recommendation survives the thing it recommended

**What happens.** Sarah's step 2, *Clarify Risk*, is **Complete** and holds a
C-SSRS Screener with four Observations. The same node carries a card,
**Recommended — Start C-SSRS Screener**, with a live button, and the page header
counts it among *3 recommended actions*. A clinician is told to do the thing
the node says was done.

**Why.** `buildCdsCards` (`packages/core/src/lib/cdsHooks/cards.ts`) emits one
card per live risk alert whose suggested action is not already a link on the
active stage's card. The PHQ-9 item-9 alert suggests the C-SSRS Screener; the
active stage is now step 3, so the dedupe never sees it; and nothing asks
whether the suggested tool has since been recorded. The rail labels the result
*Guidance* rather than *Do now* — which is the label logic noticing the
contradiction and softening it instead of resolving it.

**Fix.** In core: an alert whose suggested tool has an artifact at its target
stage dated after the alert's source is **satisfied** and emits no card. The
CDS service uses the same builder, so the host's cards get the same rule. Test:
Sarah with a later C-SSRS produces no C-SSRS card.

### 1.5 Three answers to "what do I do", and two of them disagree

**What happens.** Sarah's chart, in the panel, offers in order: *Start C-SSRS
Screener* (§1.4), *Next step: Define the Risk Picture — Launch SAFE-T*, and
*Start Safety Plan* (*Moderate Risk … Safety planning recommended*). The header
says *3 recommended actions*. Marcus has the same two live ones. Which is first
is decided by rail order, not by urgency or by the protocol.

**Why.** Two sources, one page. The stage card leads with the stage's lead tool
— and at *Define the Risk Picture* that lead is a **product default**
(`PATHWAY_STAGE_DEFAULTS` in `packages/core/src/lib/pathwaySelection.ts`),
because the published pathway names nothing there. The safety-plan card comes
from the C-SSRS alert — and *that* is what the **published pathway's tier
branch** obliges at moderate risk. So the card the protocol actually mandates is
the second card, on a stage marked Upcoming, and the product default sits above
it on the stage marked You are here.

**Fix.** A recommendation policy in core (§4.5): one **primary** action, then
the rest, with the published pathway's obligation outranking a product default.
The clinical question inside that — whether formulation (SAFE-T) precedes the
safety plan at moderate risk — is §7 question 2.

### 1.6 Four labels for one state, still

Step 4 on Sarah's and Marcus's charts reads **DO NOW · UPCOMING** on the row and
**RECOMMENDED** inside it, with a bell icon. The 2026-09-01 pass reduced this
on the active node; the upcoming-with-a-card node kept all three. One state
word per row.

### 1.7 No patient name in the panel on a phone

**What happens.** The host sends `need_patient_banner: false`, so the panel
draws no identity strip (correct per SMART: the host banner is beside it). On a
phone the layout stacks, the host banner is 800px above the panel, and once the
panel is a sheet (§1.2) it is covered. The clinician fills in a suicide-risk
screener with no name on screen.

**Fix.** `PanelShell` draws the dense strip whenever its own width is under the
phone breakpoint, regardless of `need_patient_banner` — the parameter says the
host *has* a banner, not that it is *visible*. §7 question 3 asks whether to
take that liberty with the spec's parameter; the recommendation is yes, because
the alternative is a safety defect in the one setting where the app is most
likely to be used one-handed.

### 1.8 A recorder tells a launched clinician no patient is selected

**What happens.** Under a live launch for Sarah, every workflow recorder
(caring contact, referral, handoff …) opens with a blue notice: **"No patient
selected — this will be recorded in the scratch chart. Pick a patient from the
caseload to attach it to a specific record."**

**Why.** `WorkflowForm` shows the hint when `activePatientId === null`, and that
id is URL-derived; a SMART launch lands on `/patient/record` with no id. The
write itself is correct — `SmartDataSource` resolves the patient from the
launch context and rewrites the subject — so the notice is false, not the data.
The same null reaches `buildCaringContact` and friends, which stamp
`Patient/demo-patient` on the *draft* the guide's drawer shows.

**Fix.** The hint keys on *"no patient in context"*, which under SMART is the
launch patient. Two-line fix in `WorkflowForm.tsx`; a test that a recorder under
a SMART session shows no scratch-chart notice.

### 1.9 The clinician's chart names resource types, codes and issue numbers

`check:fhir-render` gates JSON and `<pre>`; `check:jargon` reads only the
guide's strings. Neither sees a string. What a clinician reads on the clinical
surface today:

| Where | Text |
|---|---|
| Every *Recorded here* row | `QuestionnaireResponse · Sep 3, 2026, 11:18 AM`, `Observation · Sep 3, 2026`, `CarePlan · active`, plus 📝 📊 📋 emoji |
| Every stage node, open | The CodeSystem definition, written to a vendor: *"The EHR supports documenting the current risk status and the clinical reasoning that guides next steps."* |
| The problem-list card | *"Current suicide-risk tier: High risk (harmonized concept, LOINC 93374-7, recorded 2026-08-02)"*, then *"No tool is enabled for this step."* |
| *Saved to the EHR* | `Tier 0 · DocumentReference`, *"Created as QuestionnaireResponse / …"*, *"The universal floor: a readable rendering plus the raw QuestionnaireResponse as recoverable FHIR JSON."* |
| Episode record | *"No route in FHIR R4. These types have no `.encounter` element and no indirect path"* |
| Scenario walkthrough | *"Narrative steps, not FHIR resources … (tracked in issue #52)"*, *"profile gap"*, *"proposed step"* — demo narration on the clinical build |
| Published Care Pathway (in the panel) | Leads with a canonical URL in monospace, `0.1.0`, `draft · experimental`, `clinical-protocol`, then *"SPiER does not fetch this protocol from the EHR it is connected to. It bundles the compiled Implementation Guide at build time"* |
| Measures | GitHub issue links (`#NNN`) as the explanation of an empty denominator; *"nothing on this page is stored, which is the point of Stage 8"* |
| Alerts (caseload) | *"Measure SPiERCaringContactAdherence · caring-contact"* as provenance; *"4 deck rules are not being watched"*; *"No coded risk level in the episode"* |
| Caseload footnote | *"broadcasts a FHIRcast patient-open event: a chart open in another tab follows along, the way context-synced apps do in production"* |
| Tool page (stage page) | *"Belongs to the Define the Risk Picture stage of the SPiER pathway"* — the FSH `purpose`, addressed to an implementer |
| Panel footnote | *"The published protocol · Tools this deployment offers"* |

Each is right for the Adoption Guide and wrong for the person holding the panel.
The clean-clinical-surface pass (2026-09-17) removed the JSON and left the
words; `docs/internals/tool-views.md` §4 made the same finding about recorder
ledes and fixed those. This is the same rule over the rest of the surface.

### 1.10 Settings, the protocol and the measures are on the panel's navigation

Three pages reachable from the panel's own links, measured at 375px inside a
live launch:

| Page | Words | Height | Controls |
|---|---|---|---|
| `/settings` (Tool Configuration) | 1,520 | 8,605px | 34 checkboxes, 4 preset cards |
| `/patient/pathway` (Published Care Pathway) | 1,884 | 7,674px | — |
| `/population/measures` (from the stage 8 card) | 931 | — | 8 tables, all *no denominator* under a patient-bound token |

The settings page opens by saying, in bold, that it **does not apply inside a
host chart**. The measures page, reached from *Open measure dashboard* on a
patient's chart, computes over *"the 0-patient cohort in context"*. Both are
true statements a clinician should never have been sent to read.

### 1.11 The caseload buries the worklist

The caseload is the care manager's screen and its job is the table. Measured in
a worklist launch: the first patient row is at **936px in a 768px viewport** on
desktop and **1,290px on a phone** (document 3,116px), under a seven-tile
summary and a 21-alert panel. `PopulationSummary.tsx`'s own header says *"If
this grows, shrink it."* It grew. On a phone the table is 923px wide inside a
375px viewport and scrolls sideways inside its wrapper, with six columns.

### 1.12 The framed caseload makes ~400 requests to draw six tiles

The front door's framed summary reads fourteen patients × fourteen resource
searches, each with a CORS preflight — about 400 requests, serially per patient,
before the tiles settle. It is the first thing on the demo's first page. A
`$everything`-style read, a cohort summary endpoint on the mock, or a smaller
per-tile query set would each be an order of magnitude fewer.

### 1.13 A tab that was ever embedded stays in panel chrome

`PresentationProvider` persists `embed=1` in sessionStorage so the flag survives
the OAuth redirect. A later top-level launch in the same tab that carries no
`embed` parameter inherits panel chrome; the worklist launch this audit minted
landed on `/population/summary` instead of the caseload for that reason. The
host should send `embed=0` on every top-level launch it mints (`client/home.ts`
sends none). Minor, and only reachable by reusing a tab.

### 1.14 The host's cards are computed from the fixture, not from the chart

**What happens.** The host page's *Recommendations from SPiER* and the panel's
own cards can disagree about the same patient the moment anything is written.
After Marcus Chen's PHQ-9 lands, the panel (reading the live server) moves to
the assessment; the host's card (once §1.1 is fixed) still says *screen*.

**Why.** The mock EHR invokes the CDS service with context only and **no
prefetch**, so the service takes its documented fallback and evaluates the
bundled fixture for that patient id — not the chart. Brad's rule for the card
(2026-09-21): *"if the chart data passed to the CDS service suggests a step,
the CDS Hook card should suggest that step, otherwise … screening."* Today no
chart data is passed.

**Fix.** The host's signed, server-to-server call attaches the prefetch the
service's discovery document already asks for — the patient's completed
QuestionnaireResponses, from the fixture plus the Durable Object — and the
service's live path does the rest. Host, panel and endpoint then read the same
record and, with §4.5, apply the same rule to it.

---

## 2. Copy: who the words are for

The guide audit found four readers on one page. The clinical app has the same
four, and only one of them is in the room:

- **The clinician** — the user. Needs the patient's name, the one thing to do,
  and a way to ask why.
- **The implementer** — reads the guide. Owns the wire format, the tiers, the
  canonical URLs, the FHIRPath. Every one of those still appears on the clinical
  surface (§1.9).
- **The demo presenter** — needs the scenario walkthrough, the write log, the
  FHIRcast notices. Two of the three are on the clinician's chart.
- **The EHR vendor** — the audience of the stage CodeSystem's definitions
  (*"The EHR supports…"*), which the chart uses as stage descriptions.

The rule the guide audit settled (§5 rule 2: *task first, caveats in a closed
drawer, never deleted*) applies here with one sharpening: on the clinical
surface the caveat's drawer is a **different page**, not a `<details>` under
the button. A closed drawer still costs a line of the panel's 900px, and the
panel's budget is the whole reason it exists.

---

## 3. Length and density (measured)

Chrome above the first actionable element, and what a reader meets on arrival.

| Screen | Width | First card / control | Words on arrival | Height |
|---|---|---|---|---|
| Chart, panel (Sarah) | 375 | first card 369px; first button ~520px | 318 | 2,358px |
| Chart, panel (Sarah) | 470 | first card 287px; first button 442px | — | 1,991px |
| Chart, panel (Maria, complete) | 470 | — | 296 | 1,897px |
| Chart, standalone | 1024 | header 51 + banner 44 + page header 72 → first node 298px, first card 497px | — | — |
| PHQ-9 filler, panel | 375 | first control 303px | — | 1,827px |
| Caring-contact recorder, panel | 375 | first field ~260px, under a false notice (§1.8) | — | — |
| Caseload, worklist launch | 1024 | first row 936px | 966 | 2,548px |
| Caseload, worklist launch | 375 | first row 1,290px | — | 3,116px |
| Settings, panel | 375 | — | 1,520 | 8,605px |
| Published protocol, panel | 375 | — | 1,884 | 7,674px |

The panel chart is not long — 318 words, three open nodes — and that is the
point: it is already near the budget, and it still does not say what to do.
The problem is the shape, not the count. The 2026-09-01 panel pass got the
chrome down (header 61px, strip 0px when the host draws one); what is left is
that the *content* is a rail to be read rather than an instruction to be
followed.

---

## 4. The target design

### 4.1 The landing screen answers one question

The chart, in both chromes, opens on **what to do for this patient now**, in
this order and nothing above it:

1. **Who.** Name · age · MRN · current risk pill, one line, always (§1.7).
2. **Do this now.** One card. Its title is the act (*Start the safety plan*),
   its one sentence is the trigger in the clinician's words (*C-SSRS
   Screener on Sep 3: moderate risk — ideation with a method*), its one button
   launches the tool. A line under it names the *next* thing, as text.
3. **Why this?** One link to the recommendation's page (§4.2).
4. **Where this patient is · What's on file.** Two links, with a fact each
   (*Step 3 of 8* · *14 records*). These are the pages the rail and the record
   sections become (§4.3, §4.4).

That is the whole screen. In a 470×900 panel it fits without scrolling; on a
phone the button is above the fold. A patient with nothing outstanding reads
*Nothing is due* with the same two links. A patient with no data reads the
screen the empty state already writes, shorter.

### 4.2 "Why this?" is a page, and it is the discoverable half

One page per recommendation, reached from the landing card and from nowhere
else. It holds, in order: what on the record triggered it (the artifact, its
date, its result — linked into *What's on file*); the rule that turned the
trigger into this action, in the protocol's words (*at moderate risk the pathway
asks for a safety plan and crisis resources, then reassessment within 7 days*);
the alternatives — the stage page's *use a different instrument* list moves
here; and, last, one link to *The protocol*, which is `/patient/pathway`
rewritten in plain words with its canonical URL and version behind inspection
(§1.9). A clinician who wants the reasoning has it in one tap; one who does not
never sees it.

### 4.3 The rail becomes "Where this patient is"

The eight-stage rail is a good answer to a question the landing screen no
longer asks. It moves to its own page, keeps its markers and its collapsed rows,
and drops: the stage CodeSystem definitions (replaced by one clinician sentence
per stage, held in core beside the stage ids — a *display for the person doing
it*, the same split `documentation` displays got in the FSH on 2026-09-20), the
*Tools that satisfy this stage* chips (they are the stage page's), and every
card (they are the landing screen's, and a stage that carries a recommendation
says *1 due* on its row). Each row links to its stage page, which stays as it
is.

### 4.4 The record becomes "What's on file"

*Episode record*, *Patient Documents* and *Other activity* become one page with
one list: what was recorded, when, by which instrument, grouped by episode
where the references allow. The resource type leaves the row (§1.9); the
*Episode record*'s FHIR R4 explanations and the *Patient Documents* filter
chips go with it. **The scenario walkthrough leaves the clinical build**: it is
demo narration keyed to a fixture, and it renders under a live launch against a
server that does not have it. It belongs on the guide's Provider App page or on
the mock EHR's chart page, where the presenter is.

### 4.5 One recommendation, from the published pathway only

Decided 2026-09-21: *"for now, just want to support the care pathway laid out
on the guide's Care Pathway page"* — the published
`PlanDefinition/SPiERSuicideSaferCarePathway`, and nothing beside it. So the
card is not "the active stage's lead tool" any more; it is **the first step of
the published pathway this record has not satisfied**, and the product
defaults that filled the pathway's silent stages (`PATHWAY_STAGE_DEFAULTS` in
`packages/core/src/lib/pathwaySelection.ts` — SAFE-T, the handoff, the
episode, the dashboard) stop producing cards. They stay as what the stage
pages *offer*; they no longer *recommend*.

The pathway, read as an evaluator over the record:

| Record says | Primary action | Also due |
|---|---|---|
| No screen with a suicidality item | **Screen** — PHQ-9 | — |
| Positive screen (item 9 ≥ 1, or a crosswalked positive), no assessment after it | **Assess** — C-SSRS Screener | — |
| Assessment negative | *Nothing is due.* The patient does not enter the pathway. | re-screen at the next depression screen |
| Tier **low** | **Share crisis resources**, if not since the assessment | reassess on the low cadence |
| Tier **moderate** | **Complete a safety plan** (Stanley-Brown), if none since the assessment | share crisis resources · reassess on the moderate cadence |
| Tier **high** | **Complete a safety plan**, if none since the assessment | share crisis resources · lethal-means counseling · the direct question at every contact · reassess on the high cadence |
| Every obligation met, reassessment due | **Reassess** — C-SSRS Screener | — |
| Every obligation met, nothing due | *Nothing is due until* the next reassessment date | — |

The rules that fall out of it:

- **One primary.** The first unsatisfied row, top to bottom, is the card. The
  rest of the row is *also due*, as text. The card carries `spier-primary`
  in its extension so every renderer agrees which one it is.
- **Satisfied means recorded after the trigger.** A C-SSRS recorded after the
  PHQ-9 satisfies *Assess* (§1.4); a safety plan recorded after the assessment
  satisfies *Complete a safety plan*. Nothing is ever re-recommended because
  its alert is still on file.
- **The title is the act.** *Complete a safety plan*, not *Next step: Document
  Safety Actions*. The detail is the trigger in the clinician's words — *C-SSRS
  Screener on Sep 3: moderate risk* — not a CodeSystem definition.
- **Guidance is not an action.** The problem-list prompt lives on *Why this?*
  and *Where this patient is*, never as the card.
- **Same builder, three consumers.** The chart, the embedded panel and the CDS
  service already share `buildCdsCards`; with §1.14 they share the record too.

Custom pathways are a later decision (Brad, same day); the evaluator reads the
one published artifact and is written so a second artifact is a parameter, not
a rewrite.

### 4.6 Fillers and recorders: keep the frame, fix the beats

The form frame is right. Four changes: the scratch-chart notice keys on the
launch patient (§1.8); the post-submit result becomes the confirmation beat the
panel plan asked for — the risk summary, **one** next-step button, and *Back
to the chart*, with the rail visibly advanced on return; *About this
instrument* keeps its closed drawer and its recorded judgement; and the
recorders' *on this chart* lists keep their plain labels. Combobox-per-item
remains the renderer's decision and is out of scope here, but on a phone a
nine-item Likert as nine dropdowns is the slowest possible form, and it is
worth a note to `@formbox/renderer`.

### 4.7 Two chromes, one landing screen

`PanelShell` and `LaunchShell` stay two answers to *is someone else drawing the
frame?* and both render §4.1. `LaunchShell` keeps its four sidebar destinations
and its status footer; its patient banner and the landing screen's *Who* line
are the same strip once, not twice (the banner wins where it is drawn).
`PanelShell` gains the narrow-width strip rule (§1.7) and loses the footnote
links — *The protocol* is reached through *Why this?*, and *Tools this
deployment offers* is §4.9.

### 4.8 The caseload leads with the worklist

For the care manager: the table first, the summary collapsed to its one
breached tile by default on a phone and expanded on desktop, the alerts as a
count that opens a page. The three caseload views stay. The lede stops
explaining what recommendations are. Decided 2026-09-21: these two screens are
in this pass, and they get their own audit section first, by this document's
method, before PR 7 redesigns them. The dashboard's own plan
(`docs/plans/suicide-care-dashboard.md`) and its reader are the starting
points.

### 4.9 Settings is an operator's page

Tool Configuration is a fact about a deployment. It stays at `/settings` in the
standalone app and leaves the panel's navigation; in panel chrome the page
itself stays reachable by URL and says, in one line, that the host offers every
tool. The 1,520 words become the preset picker, the checklist, and one sentence
about what the setting does.

### 4.10 The mock EHR on a phone — PR 1

Below 60rem the dock is a full-screen takeover: fixed, the whole viewport,
above the app bar. The guest bar stays at the top of it, and its close button
— the same `#close-panel` the desktop dock has always closed with — renders as
**← Back to chart** at the left, where a phone puts its back control. Decided
2026-09-21: *"a full screen take over, as long as it's clear how to navigate
back to the patient chart."* No JavaScript changes: the launch already un-hides
the dock, and a fixed takeover needs no scrolling to.

Deliberately not done here: a half-height or resizable state. A panel the
clinician can shrink is a preference; a panel that is on screen when it opens
is the defect.

### 4.11 Demo host hygiene

The mock EHR deploys from CI like its three siblings (§1.1). Written data stays
on the server — the demo's point is a write landing on a FHIR server, with the
host's own write log corroborating it — and is cleared nightly by a scheduled
job, with the manual *Reset written data* on the host's Settings page kept for
a presenter who cannot wait (decided 2026-09-21). The chart page says when a
chart has been written to since its story was true (*"3 records were added to
this chart by an earlier demo — Reset on Settings"*), so a presenter meeting
Marcus at step 3 knows why.

---

## 5. Rules to gate

Every rule below is a defect from §1 restated as something a test can fail on.

1. **A clinician page has a word budget on arrival.** The guide's
   `apps/guide/src/pages/pageLength.test.tsx` mechanism — words a reader meets,
   a closed drawer costing its summary — applied to the clinical pages with the
   panel as the measured chrome. The landing screen's budget is small.
2. **No wire vocabulary in clinician copy.** `check:jargon` grows a second scan
   over `apps/clinical/src` and `packages/tool-views/src` with a clinical rule
   set: no FHIR resource type as a word (`QuestionnaireResponse`,
   `DocumentReference`, `Observation` used as a label), no LOINC or SNOMED
   code, no canonical URL, no issue number, no tier or rung. The FSH `purpose`
   and CodeSystem `definition` strings the app renders are read where they
   are rendered.
3. **One primary action, from the pathway.** A render test over the landing
   screen for the demo fixtures: exactly one primary card, and it is the first
   unsatisfied row of §4.5's table for that patient — screening when nothing is
   on file.
4. **A satisfied alert emits no card.** Core test: a PHQ-9 alert plus a later
   C-SSRS at *Clarify Risk* produces no C-SSRS card.
5. **The patient is named on a narrow panel.** `PanelShell` under the phone
   breakpoint draws the strip with `need_patient_banner: false`.
6. **No scratch-chart notice under a launch.** A recorder rendered inside a
   SMART session shows no *No patient selected*.
7. **The mock EHR is deployed by CI.** `deploy.yml` has a `mock-ehr` job, and
   `check-deploy-origins.mjs` or a sibling asserts the four Workers are all
   present in it.
8. **The dock is on screen when it opens.** A jsdom test cannot see layout;
   `chartPage.test.ts` asserts the narrow-screen rule is `fixed` and anchored
   to the bottom, which is the property the 2026-09-21 measurement found
   missing.

---

## 6. PR sequence

Each PR is mergeable on its own and leaves every gate green.

| PR | Scope | Closes |
|---|---|---|
| **1** (this branch) | Mock EHR: the dock is a bottom sheet under 60rem; launch copy; this audit | §1.2, rule 8 |
| **2** | Demo host hygiene: `mock-ehr` job in `deploy.yml`; prefetch on the host's CDS call; `embed=0` on top-level launches; the "written since" line on the chart page; nightly reset of written data | §1.1, §1.3, §1.13, §1.14, rule 7 |
| **3** | The pathway evaluator in core (§4.5): one primary from the published pathway, satisfied steps retire, act-titled cards, product defaults stop recommending; the CDS service inherits | §1.4, §1.5, rules 3–4 |
| **4** | The landing screen and *Why this?*: §4.1, §4.2, the narrow-panel strip, the two chromes converging on it | §1.6, §1.7, rule 5 |
| **5** | *Where this patient is* and *What's on file*: the rail and record sections become pages; the walkthrough leaves the clinical build; the protocol page in plain words; clinical word budgets and the clinical jargon scan | §1.9, §1.10, rules 1–2 |
| **6** | Fillers and recorders: the scratch-chart notice, the confirmation beat, one next action | §1.8, rule 6 |
| **7** | The caseload and measures: an audit section first, by this method, then the worklist leads, settings leaves the panel's navigation, the framed summary's request count | §1.10, §1.11, §1.12 |

PR 3 before PR 4 on purpose: the landing screen renders the policy's primary
card, and building the screen first would mean building it twice. PRs 2 and 3
are independent of each other; PR 6 and PR 7 need only PR 3.

Each PR has a paste-ready brief for a fresh session in
[`clinical-app-redesign-briefs.md`](clinical-app-redesign-briefs.md).

---

## 7. Decisions (Brad, 2026-09-21)

1. **The card suggests the step the chart data suggests; with nothing on file,
   screening.** One recommendation, derived from the record — §4.1's landing
   screen and §4.5's evaluator. This also means the CDS service must be handed
   the chart data (§1.14).
2. **The published pathway, and only it, for now.** Custom pathways later.
   §4.5 reads the one artifact; the product defaults stop recommending. The
   clinical ordering question (formulation before the safety plan at moderate
   risk) is answered by the artifact: the pathway names no formulation step,
   so the safety plan is primary.
3. **Show the patient, synced with the host's context, on a narrow panel** even
   when `need_patient_banner` is false — §1.7, §4.7.
4. **The caseload and measures are in this pass, and get audited first.** The
   care manager's two screens (`/population/caseload`, `/population/measures`)
   are PR 7: an audit section by this document's method, then the redesign.
   Nothing changes about where patient data lives — it is FHIR in the demo EHR
   and stays so.
5. **Written demo data stays on the server, resets nightly, and can be reset
   by hand.** Brad first said browser localStorage; the point that the demo
   shows a write landing on a FHIR server, corroborated by the host's write
   log, stood, so writes stay in the demo EHR's store. A scheduled job clears
   them each night and the *Reset written data* control on the host's Settings
   page stays for a presenter who needs a clean chart now.
6. **A full-screen takeover, with a clear way back.** Shipped in PR 1 (§4.10).
