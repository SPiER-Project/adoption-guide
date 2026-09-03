# Suicide Safer Care Pathway — PlanDefinition + guide restructure plan

Turn the *Suicide Safer Care Pathway* diagram (PHQ-9 universal screen → C-SSRS
with Triage Points → four risk tiers → tier-specific obligations) into a
published FHIR PlanDefinition, restructure the Adoption Guide so pathways and
the tool catalog are separate surfaces, and render the pathway from the
artifact — in the guide, and in the SMART app launched inside the mock EHR.

Requirements source: the one-page pathway diagram (NCT Consulting original,
**now SPiER-owned** — no attribution required; decision recorded 2026-09-01).
Phase 1a transcribes it to `docs/reference/suicide-safer-care-pathway-spec.md`
so this plan has a stable, linkable source the way
[`suicide-care-dashboard-spec.md`](../reference/suicide-care-dashboard-spec.md)
does for the dashboard deck.

Primary surfaces affected:
[`ig/input/fsh/`](../../ig/input/fsh/) (new pathway PlanDefinition),
[`packages/core/src/lib/observationMappers/cssrsScreener.ts`](../../packages/core/src/lib/observationMappers/cssrsScreener.ts)
(tier-ladder alignment),
[`web/src/data/guideSections.ts`](../../web/src/data/guideSections.ts) and
[`web/src/pages/PatientJourney.tsx`](../../web/src/pages/PatientJourney.tsx)
(guide restructure), a new pathway renderer in `packages/core`, and
[`packages/core/src/lib/cdsHooks/cards.ts`](../../packages/core/src/lib/cdsHooks/cards.ts)
(clinician-guidance cards).

---

## Decisions already made (conversation record, 2026-09-01)

These were settled with Brad before this plan was written; do not re-litigate
them here, and do not silently reverse them in implementation.

1. **v1 demonstrates exactly one pathway: PHQ-9 → C-SSRS.** The ASQ pathway
   (and every other entry instrument) comes later, and when it does, a step
   where the instruments genuinely measure different things gets a
   **conditional additional-evaluation step**, never a pretended equivalence —
   the ASQ crosswalk's `relatedto` equivalences are the recorded honest gap.
2. **FHIR-first, Pattern A.** The IG is canonical; the app **bundles** the
   generated artifacts at build time (the `reassessment.ts` pattern) and is
   launched in the mock EHR as a SMART app. The mock EHR does **not** serve
   definitional artifacts and `smartDataSource` does not fetch them — the app
   brings its clinical knowledge; the EHR supplies patient context and data.
   ("Pattern B" — EHR-hosted knowledge artifacts — is a possible later demo,
   deliberately out of scope.)
3. **Tools as published.** Until SPiER publishes its own frameworks, tier
   derivation follows the *published* C-SSRS Screener with Triage Points, not
   the diagram and not a SPiER invention. The LOINC/framework publication work
   is a named future deliverable, not part of this plan.
4. **Transportability via the concept layer.** Pathway actions are coded by
   what they accomplish; the tier gate conditions on the harmonized concept
   (LOINC 93374-7 + `SPiERSuicideRiskTier`), so a site that licenses a
   different instrument satisfies the same step. PHQ-9/C-SSRS appear as the
   *demonstrated realization* via `definitionCanonical`, not as the step's
   definition.
5. **SPiER never writes diagnosis codes.** The diagram's problem-list row
   becomes clinician **guidance** (page copy + CDS card the clinician acts on),
   consistent with `suicide-related-conditions.fsh`'s standing rule that no
   Condition is ever derived from a screen.
6. **Historical risk is (probably) an orthogonal flag, not a tier** — pending
   clinical-team confirmation. Same conclusion as
   [`suicide-care-dashboard.md`](suicide-care-dashboard.md) Gap 3, reached
   independently; the two plans share this open question and its answer lands
   in the concept layer once.
7. **Pathway pages now; the interactive builder is a far-out goal.** The one
   v1 interaction is the "set a C-SSRS result" simulator (Phase 3).
8. **Nav restructure approved:** the current stage-organized tool catalog
   becomes a **Tools** page; **Pathway** becomes the rendered-from-FHIR
   pathway surface.
9. **Second lens (non-suicide care paths) is a design property, not a v1
   feature.** Segments like crisis resources stay standalone and composable so
   a future pathway can include them; v1 does not showcase this.
10. **Scenario pages (ER flow etc.) are a later phase**, likely EHR-side
    (suggested paths / links into a patient chart), not guide-side — the guide
    holds no patient data (`check:guide-boundary`).

Related prior work this plan must stay consistent with:

- [`suicide-care-dashboard.md`](suicide-care-dashboard.md) (epic
  [#277](https://github.com/SPiER-Project/adoption-guide/issues/277)) — the
  dashboard deck states the **same clinical framework** (7/14/30-day cadence,
  the Historical tier, the consultant step-down gate). Its Gap 2 is since
  closed (`SPiERReassessmentSchedule` exists); its Gaps 3 and 4 are the same
  open clinical questions listed at the bottom of this plan.
- Issue [#128](https://github.com/SPiER-Project/adoption-guide/issues/128)
  (export a configured pathway as a FHIR Bundle) — the Phase 2 artifact is a
  prerequisite-shaped step toward it, not a competitor.
- [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) — Phase 4
  renders inside the surface that plan built.

---

## Phase 1 — Verify and align the foundation

No new features. Everything later phases assert traces back to something
verified here.

### 1a. Transcribe the diagram

New `docs/reference/suicide-safer-care-pathway-spec.md`: the diagram's care
events, the four tier definitions (with their exact C-SSRS question/timeframe
rules), the six per-tier obligation rows, the high-risk extras (every-contact
question, STAT protocol, no-show outreach), milestone-event list, step-down
criteria, and the three KPIs. Index it in `docs/README.md`. Docs are ungated prose — the transcription is the one
place the diagram's claims live, so keep it verbatim-faithful and put
editorial judgment in this plan instead.

### 1b. Verify the published C-SSRS triage rules

The repo's screener mapper and the diagram **disagree**, and only one can
match the published instrument:

| Endorsed | Mapper today ([cssrsScreener.ts:66](../../packages/core/src/lib/observationMappers/cssrsScreener.ts)) | Diagram |
|---|---|---|
| Q3 (method, no intent) | moderate | moderate |
| **Q4 (some intent)** | **moderate** | **HIGH** |
| Q5 (plan + intent) | high | high |
| **Q6 behavior, lifetime-only** | **high** | **Historical (not high)** |
| Q6 behavior, past 3 months | high | high |

Pull the published screener (the diagram footnotes the CMS-hosted version:
`cms.gov/files/document/cssrs-screen-version-instrument.pdf`; cross-check the
Columbia Lighthouse Project's triage coloring) and record which ladder is
correct in the spec doc. Expectation: the diagram matches the published triage
guidance (Q4/Q5/recent-Q6 → high) and the mapper is the drifted one. The
mapper already *captures* `q6-recent` (the Questionnaire has the nested item)
— it just doesn't use it for tier assignment.

**Confirmation channel: clinical team.** This is a behavior change to shipped
risk stratification; the verification record goes in the spec doc.

**Superseded 2026-09-01 (see open question 1):** this section originally
required the clinical sign-off to land *in* the PR that changes the mapper.
Brad's decision that day made the review **retrospective rather than
blocking** — the tools are not in production, and the published instrument is
the authority (decision 3). Phase 1c shipped on the verification record alone;
the retrospective review is still owed.

### 1c. Align the mappers (after 1b confirms)

- Fix the ladder in every C-SSRS mapper variant that stratifies
  (`cssrsScreener.ts`, `cssrsPediatric.ts`, `cssrsSinceLastContact.ts` — their
  headers say they share the three-tier stratification; check the full
  lifetime/recent variant too).
- Update the mapper tests — they build responses via `__fixtures__/nativeQr.ts`
  (post-#327 discipline), so the change is to expected tiers, not fixture
  shape.
- Update [`crosswalk-cssrs.fsh`](../../ig/input/fsh/crosswalk-cssrs.fsh):
  the `moderate` element's comment says "items 3–4" and would become "item 3";
  the `high` comment's item list changes too. The mapping *targets* likely
  don't move (native low/moderate/high → SPiER tiers stays 1:1); the comments
  and the `PENDING SME sign-off` notes are what change.
- **Ripple check, done deliberately:** derived tiers for scenario patients
  with C-SSRS responses (`p011-cssrs-full`, `p007-cssrs-pediatric`) may
  change, which moves registry rows, reassessment due dates, and possibly
  `measures.narration.test.ts` (a new measure miss must land in
  `EXPLAINED_MISSES` *with a reason* or be fixed in the fixture — never
  allowlisted to make the build green). Run the full `verify` plus
  `services/cds-hooks` and `services/mock-ehr` verifies before calling this
  done; the Workers import the catalog and scenario data and can break with
  `web/` green.

### 1d. Verify the problem-list codes (guidance-only codes, but still verified)

- **Already verified — reuse the record, don't re-verify.** The dashboard
  deck cites the same codes, and
  [`suicide-care-dashboard-spec.md`](../reference/suicide-care-dashboard-spec.md)
  (slide-13 section) already holds the verification table: `R45.851` is
  valid; **`Z91.82` is the wrong code** (*personal history of military
  deployment* — the #220 failure mode in ICD-10), with `Z91.51` (personal
  history of suicidal behavior) / `Z91.52` (nonsuicidal self-harm) the
  intended billable pair, and bare `Z91.5` non-billable. The diagram carries
  the identical `Z91.82` error, which confirms both documents share one
  upstream source. The pathway spec doc (1a) cites that record rather than
  restating it, and **no SPiER artifact, page, or card ever shows `Z91.82`**.
- SNOMED problem-list concepts are **already verified** in
  [`suicide-related-conditions.fsh`](../../ig/input/fsh/suicide-related-conditions.fsh)
  (verification record in its header). Guidance surfaces SNOMED as primary
  (that's what US problem lists store) with the ICD-10-CM crosswalk noted for
  billing.
- ⚠️ **No gate covers ICD-10.** The nightly checks LOINC/SNOMED/thl7 only.
  Every ICD-10 literal this plan introduces (page copy, CDS card text) must
  cite the 1d verification record in a comment, because nothing will re-check
  it mechanically.

**Phase 1 exit:** spec doc committed and indexed; mapper ladder matches the
published instrument, with the *verification* recorded and the clinical review
booked as retrospective (see 1b's superseding note and open question 1); code
verification findings written down. Two PRs: (1a+1b+1d docs/verification, then
1c code change).

---

## Phase 2 — Author the pathway as FHIR

### The artifact

New `ig/input/fsh/suicide-safer-care-pathway.fsh`:
`Instance: SPiERSuicideSaferCarePathway`, `InstanceOf: PlanDefinition`,
`type = #clinical-protocol` (the reassessment schedule is
`#workflow-definition`; this one is a protocol), canonical
`http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway`.

Action structure — **stage-coded groups as the spine, tier branch inside**:

1. **Screen** (stage `identify-possible-risk`): concept-coded action
   ("universal depression screening including a suicidality item"),
   `definitionCanonical` →
   `ActivityDefinition/AdministerPHQ9` as the demonstrated realization.
   `action.documentation` states the transportability rule: any instrument
   feeding the concept layer satisfies this step.
2. **Positive-screen gate**: `condition[applicability]` FHIRPath on the PHQ-9
   Q9 item answer (Q9 ≥ 1, per the diagram's note that 0 = negative), written
   in the same textual-FHIRPath style as `SPiERReassessmentSchedule`'s
   conditions. Also document the diagram's other two entry events (suicidal
   thoughts identified at any point; initial contact) as trigger
   documentation.
3. **Assess** (stage `clarify-risk`): `definitionCanonical` →
   `ActivityDefinition/AdministerCSSRSScreener` (the Triage Points variant —
   name the variant explicitly). A negative C-SSRS exits the pathway
   (documented, matching the diagram's "does not enter" box).
4. **Tier branch** (stage `define-risk-picture` → downstream): one action
   group per tier — `low`, `moderate`, `high` — each with the same
   applicability-condition shape the reassessment schedule uses (tier read
   from the episode's `currentRiskTier` extension / latest 93374-7 concept
   Observation). Each tier group contains:
   - `ActivityDefinition/ShareCrisisResources` (all tiers) — kept a
     standalone, composable segment on purpose (decision 9).
   - `ActivityDefinition/AdministerStanleyBrown` (moderate + high), with the
     diagram's review-at-each-contact note as documentation.
   - **Reassessment cadence: `definitionCanonical` →
     `PlanDefinition/SPiERReassessmentSchedule`.** The pathway *references*
     the schedule; it never restates an interval. `check:reassessment`
     currently ties three statements of the cadence together — this plan must
     not create a fourth (see the new gate below, which enforces exactly
     that).
5. **Clinician-guidance actions** (no `definition` — documentation-only, the
   FHIR shape for "the clinician does this, SPiER prompts"): problem-list
   coding per tier (SNOMED primary + verified ICD-10-CM crosswalk from 1d),
   contact frequency (the diagram states it separately from reassessment with
   identical values; keep it a documentation row until the clinical team says
   it's a distinct rule).
6. **High-tier extras** as documentation actions: the every-contact question,
   STAT safety evaluation contents, and the missed-appointment outreach
   protocol.
7. **Deliberately absent from the artifact:** step-down criteria, milestone
   events, and the historical flag. All three are pending clinical decisions
   (below), and the workbook's status-claim discipline applies: **the
   published artifact must not encode what isn't settled.** The page (Phase 3)
   renders these as a clearly labeled "pending clinical definition" strip from
   page copy, not from the artifact.
8. `relatedArtifact` → the existing Stage-8 Measures that correspond to the
   diagram's three KPIs (the Q9-positive→C-SSRS rate is already modeled
   there; map the other two or note the gap in the spec doc).

Notes: the Emotional Fire Safety Plan is a NowMattersNow artifact, not a SPiER
tool — pending the clinical-team answer, represent it as a
`relatedArtifact`/documentation URL inside the crisis-resources segment rather
than inventing an ActivityDefinition for an instrument SPiER doesn't carry.
PlanDefinitions don't take the `instrument-licensing-status` extension
(`check:catalog` gates ADs); no new ADs are expected in this phase.

### IG narrative

New `ig/input/pagecontent/care-pathway.md` (what the pathway is, how the tier
branch reads the concept layer, the transportability rule), menu entry under
**Guidance** in `ig/sushi-config.yaml`, **and the matching bullet in
`how-to-read.md`** — `node scripts/check-ig-menu.mjs` gates both directions
and runs before the compile in `ig.yml`.

### New drift gate: `check:pathway`

`web/scripts/check-pathway.mjs`, in `verify` (add to `package.json` **and** to
CLAUDE.md's gate list — the list, not a count). Rules:

- (a) every tier code in the pathway's actions resolves to the generated
  `spier-suicide-risk-tier` CodeSystem;
- (b) every `definitionCanonical` resolves to an artifact in
  `packages/fhir-artifacts/generated/` (the `check:catalog` B/C lesson, one
  layer up);
- (c) **no `timingDuration` on any tier-branch action** — the cadence has
  exactly one home (`SPiERReassessmentSchedule`) and this rule is what makes
  "reference, don't restate" mechanical;
- (d) every stage code on the pathway's action groups is in the canonical
  stage list (same source `check:stages` reads);
- (e) the script **fails when it reads nothing** — a missing generated file or
  zero parsed actions is an error, never a skip (#232/#261 family).

Per the standing rule: **plant a defect for each rule and watch it fail**
before reporting the gate green.

### Gates this phase touches

`npx fsh-sushi .` + `check-sushi-output.mjs` (new Instances; PlanDefinition
doesn't touch the sliced `.category`, so no new advisory warnings expected —
if one appears, read the JSON before touching `ALLOWED`), `validate-fhir.mjs`,
and the **IG Publisher** — dispatch `gh workflow run ig-publish.yml` rather
than waiting for merge, since the publisher is the only gate that statically
analyzes the new FHIRPath conditions (the #92 lesson: a green local parse is
necessary, not sufficient). Keep the condition expressions in the exact shape
the reassessment schedule already publishes cleanly.

---

## Phase 3 — Guide restructure + the pathway page

### Navigation

[`guideSections.ts`](../../web/src/data/guideSections.ts) Learn group becomes:

| path | label | content |
|---|---|---|
| `pathway` | Care Pathway | **new** — rendered from the PlanDefinition |
| `tools` | Tools | the current `PatientJourney.tsx` stage-organized catalog, moved |
| `data-dictionary` | Data Dictionary | unchanged |

`/guide/pathway` is deliberately **repurposed** (it's the semantically right
URL for the new page) and `/guide/tools` is new. That makes the migration step
a named risk, not a rename:

- **`check:catalog` validates tool launch paths against `App.tsx` routes both
  ways**, and `services/cds-hooks` imports the catalog — grep
  `guide/pathway` across `web/src`, `services/`, `packages/`, and `docs/`
  before and after; every tool-detail deep link and launch action that meant
  "the catalog" must move to `/guide/tools`.
- Keep the old anchor behavior working: `PatientJourney`'s `useScrollToHash`
  tool anchors now live under `/guide/tools`; follow the `/guide/measures`
  precedent (redirect kept because it was a published launch path) if any
  published path pointed at a tool anchor under `/guide/pathway`.
- Run `services/cds-hooks` and `services/mock-ehr` verifies — both can break
  on this with `web/` green.

### The renderer (React-free core)

New `packages/core/src/lib/pathway.ts`: loads
`PlanDefinition-SPiERSuicideSaferCarePathway.json` via the same
`import.meta.glob` pattern as [`reassessment.ts`](../../packages/core/src/lib/reassessment.ts),
parses it into a typed render model (stage groups → actions → tier branches →
conditions/definitions/documentation), throws rather than skips on action
shapes it can't read. Tests beside it in `packages/core` (the #442/#446
layout). `check:core-boundary` applies — no React, no DOM.

### The page

New `web/src/pages/CarePathway.tsx` + `web/src/css/CarePathway.css`:

- **A guide sub-page, not a lens**: it inherits `AdoptionGuide`'s header and
  must **not** render `PageHeader` (`check:template` gates the reverse
  direction), must not pad its own root, tokens only.
- Layout: **stage spine, tier branch at define-risk-picture** — the whole
  pathway visible at once across all tiers, per Brad's requirement. The
  diagram's tier×obligation matrix appears as the branch's expanded view, not
  as the page's layout.
- **The simulator ("set a C-SSRS result")**: q1–q6 (+ q6-recent) toggles that
  build a *native-shaped* QuestionnaireResponse and run it through **the
  actual `mapCSSRSScreener` mapper** to derive the tier, then light up the
  path that tier takes. Reusing the mapper means the demo can never drift
  from the shipped derivation (the #327 lesson applied as a design choice) —
  and it's the literal Capture → Translate → Act demo. Synthetic input only:
  the page imports mappers from `packages/core`, never fixtures —
  `check:guide-boundary` walks transitively.
- **Provenance strip**: canonical URL, `version`, and the raw artifact via the
  existing `FhirJsonViewer` — the "this screen is a rendering of the published
  artifact" claim, inspectable.
- **"Pending clinical definition" strip** (page copy, not artifact): step-down
  criteria, milestone events, historical flag — each naming its open question.

Copy sweep: Overview/front-door text that describes the Learn group; the
IG's `how-to-read` guide-facing prose if it mentions the app's Pathway tab.
New CSS custom properties (if any) must resolve (`check:tokens`).

---

## Phase 4 — The pathway in the SMART app (embedded in the mock EHR)

Small by design — Pattern A means the artifact is already in the bundle:

- Expose the pathway view in the embedded/SMART-launched surface (the
  embedded-panel plan's shell), reachable from the panel's navigation. Same
  renderer, same provenance strip; in embedded mode the provenance line is
  the demo's thesis: *the app carried this published artifact into the EHR*.
- **No mock EHR changes.** No definitional seeding, no `smartDataSource`
  reads. (Recorded so a future session doesn't "helpfully" add Pattern B.)
- Patient-contextual rendering ("where is *this patient* on the pathway") is
  **deferred to the scenario-pages phase** — the v1 embedded view renders the
  definition, exactly like the guide page.
- Verify `services/mock-ehr` (its chart page hosts the panel) and the SMART
  launch flow end-to-end against the deployed mock EHR.

---

## Phase 5 — Clinician guidance via CDS Hooks

Extend [`cards.ts`](../../packages/core/src/lib/cdsHooks/cards.ts) with
tier-driven guidance cards surfaced in the mock EHR through the existing
`services/cds-hooks` Worker:

- **Problem-list guidance card**: for a patient whose latest concept
  Observation is a positive tier, suggest the clinician add the
  suicide-related finding to the problem list — SNOMED coding from the
  verified ValueSet, ICD-10-CM crosswalk in the card text citing the 1d
  verification record. The card *suggests*; it never writes a Condition
  (decision 5). Cite the pathway canonical in the card's `source`.
- Audit existing cards first — a reassessment-due or safety-plan card may
  already cover part of the diagram's high-tier rows; extend rather than
  duplicate.
- **Nightly-floor check**: card text adds SNOMED literals in TypeScript.
  Confirm the `check:codings` `SCAN` entries cover the file's path
  (`packages/core` moved in #389 — verify the scan followed); if this adds a
  substantial new coding source inside an already-scanned tree, give it its
  own overlapping `SCAN` entry with floors (#261 rule). ICD-10 literals are
  invisible to every gate — comment them with the verification pointer.
- `services/cds-hooks` `npm run verify` gates this; it imports the catalog
  and scenarios, so run it even for "web-only" changes in this phase.

---

## Gate checklist (all phases)

| Gate | Why it's in play |
|---|---|
| `web/` `npm run verify` (all of it) | every phase |
| **new** `check:pathway` | Phase 2+ — plant defects before trusting it |
| `check:catalog` | Phase 3 route moves (launch paths validated both ways) |
| `check:template` | Phase 3 — new guide sub-page must not grow a header/inset |
| `check:guide-boundary` | Phase 3 — pathway page + simulator import no patient data, transitively |
| `check:core-boundary` | Phase 3 — `pathway.ts` stays React/DOM-free |
| `check:tokens` / stylelint | Phase 3 CSS |
| `check:reassessment` | must stay **untouched** — the pathway references, never restates |
| `check:readers` | Phase 1c mapper edits (readers unchanged, but the gate re-parses them) |
| `check:scenarios` / `check:dates` | Phase 1c ripple |
| `measures.narration.test.ts` | Phase 1c — tier changes can create measure misses; explain or fix, never quietly allowlist |
| `services/cds-hooks` verify | Phases 1c, 3, 5 |
| `services/mock-ehr` verify | Phases 1c, 3, 4 |
| SUSHI + `check-sushi-output.mjs` | Phase 2 |
| `validate-fhir.mjs` | Phase 2 |
| `check-ig-menu.mjs` | Phase 2 IG page + menu |
| IG Publisher (`gh workflow run ig-publish.yml`) | Phase 2 — the only static check on the new FHIRPath |
| nightly `check:codings` floors | Phase 5 SNOMED literals; ICD-10 has **no** gate — verification record is the control |

Suggested PR slicing (branch-per-PR, reset to `origin/main` after each
squash-merge): **PR 1** spec doc + verifications (1a/1b/1d) · **PR 2** mapper
alignment (1c) · **PR 3** PlanDefinition + IG page + `check:pathway` (2) ·
**PR 4** guide restructure + pathway page (3) · **PR 5** embedded view (4) ·
**PR 6** CDS cards (5). PRs 1–2 and 3 can be prepared in parallel, but PR 2
merges first — the simulator reuses the mapper, so the page should never ship
on the drifted ladder.

---

## Open questions for the clinical team

Owner: Brad to route (Kelly's team). Each blocks the item named; nothing else.

1. **C-SSRS triage ladder** — ✅ **SETTLED 2026-09-01. Does not block Phase
   1c.** Both questions (Q4 → high rather than moderate; Q6 behavior
   tier-gated by 3-month recency) were answered *yes* by the published
   instrument itself — two sources in agreement, recorded in
   [`suicide-safer-care-pathway-spec.md`](../reference/suicide-safer-care-pathway-spec.md)
   §*Published-instrument verification (Phase 1b)*. Brad's decision that day:
   **proceed on the published-instrument basis now; clinical review is
   retrospective, not blocking**, because these tools are not in production
   and the published instrument is the authority (decision 3). Phase 1c
   shipped on that basis; **retrospective clinical review of the shipped
   ladder is still owed** and is not recorded anywhere as done. Note what is
   *not* covered by this: the diagram's separate **Historical** tier is
   deliberately unimplemented — that is open question 2 below, and the
   published instrument scores lifetime-only Q6 as `moderate`.
2. **Historical risk** — orthogonal history flag rather than a fifth ordinal
   tier? (Shared with dashboard plan Gap 3 / spec question 5; believed to be a
   novel SPiER classification. Answer lands in the concept layer once, cited
   from both plans.) *(Blocks nothing in v1 — the artifact omits it; the page
   shows it as pending.)*
3. **Step-down criteria** — is the rule "another screener on record" plus the
   diagram's 30/90-day No-streak + consultant agreement? (Dashboard Gap 4 —
   how hard is the gate?) *(Blocks nothing in v1; the structure — conditions
   on the reassessment schedule — accommodates whatever comes back.)*
4. **`imminent` tier boundary** — retained (recommended), with the C-SSRS
   high/imminent boundary and the ASQ acute-positive → imminent mapping both
   still `PENDING SME sign-off` in the crosswalks. Does publishing the
   pathway force those sign-offs? *(Blocks marking the crosswalk comments
   settled; not the artifact.)*
5. **Emotional Fire Safety Plan** — keep as an external NowMattersNow
   patient-education link inside the crisis-resources segment, substitute, or
   drop? *(Blocks the final wording of the tier groups' safety-planning
   documentation.)*
6. **Problem-list ICD-10** — the Z91.82 → Z91.51 correction is already
   verified (dashboard spec, slide-13 table); this item is *awareness*, not a
   question: whoever maintains the source diagram should fix it upstream so
   the error stops re-arriving in new documents. *(Blocks nothing — SPiER
   surfaces only the corrected codes.)*

## Out of scope (recorded so they aren't rediscovered as gaps)

ASQ and other entry-instrument pathways (with the conditional-evaluation
step); scenario pages (ER flow) and patient-contextual pathway rendering;
the pathway builder; Pattern B (EHR-hosted definitional artifacts); other
care-path types (the second lens); step-down/milestone/historical encoding in
the artifact; SPiER framework/LOINC publication.

## Documentation changes this drives

- **New:** `docs/reference/suicide-safer-care-pathway-spec.md` (Phase 1a) and
  this plan — both indexed in `docs/README.md`.
- **Amended:** [`suicide-care-dashboard.md`](suicide-care-dashboard.md) gets a
  one-line cross-reference (its Gaps 3/4 are now co-owned by this plan);
  CLAUDE.md's gate list gains `check:pathway` when the gate lands (Phase 2,
  same PR).
- **Owed once decided:** the historical-axis decision next to
  `best-practices/concept-harmonization.md` (already owed by the dashboard
  plan; this plan adds a second citation, not a second copy).
