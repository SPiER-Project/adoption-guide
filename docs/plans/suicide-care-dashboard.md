# Suicide Care Dashboard — implementation analysis and plan

What the *Suicide Care Dashboard* deck asks for, what SPiER already has, and the
order to close the difference in.

Requirements source:
[`docs/reference/suicide-care-dashboard-spec.md`](../reference/suicide-care-dashboard-spec.md)
— read that first; this doc assumes its panel numbering.

Primary surfaces affected: [`web/src/pages/PopulationView.tsx`](../../web/src/pages/PopulationView.tsx),
[`web/src/lib/registry.ts`](../../web/src/lib/registry.ts),
[`web/src/pages/MeasureDashboard.tsx`](../../web/src/pages/MeasureDashboard.tsx),
[`ig/input/fsh/concept-layer.fsh`](../../ig/input/fsh/concept-layer.fsh),
[`ig/input/fsh/measure-and-share.fsh`](../../ig/input/fsh/measure-and-share.fsh).

---

## The core insight

**The deck is not asking for a new dashboard. It is asking for four more pivots
over the query SPiER already computes, plus one role model it does not have.**

`deriveRegistryRow` already returns per-patient risk tier, stage, open/overdue
task counts, next appointment, no-show and unreached streaks, open referrals, and
a recommended next step. Panels 1, 2, 5, 7 and 8 are all *re-projections of that
same row* — grouped by tier, by due date, by work type, by severity. The
Population view renders exactly one of the available pivots.

So the work splits cleanly, and unevenly: a large amount of the deck is a
presentation problem over data that exists, and a small, identifiable remainder
needs real FHIR modeling. The five items in the next section are that remainder.

The one genuinely structural finding: **three of twelve panels are scoped by care
team role, and SPiER has no role model at all.**

---

## The five modeling gaps

### Gap 1 — No care-team role model *(largest)*

`grep -rl "CareTeam\|PractitionerRole" ig/input/fsh/ web/src/` returns one hit,
and it is a string literal inside a handoff-content list in
`patient-011.json`. There is no `CareTeam`, no `PractitionerRole`, no
`Practitioner`, and `patients.json` carries only `id`, `displayName`, `dob`,
`mrn`, `gender`, `recommendedNextStep`.

Blocked by this: panel 6 (consultant dashboard) and panel 7's role scoping
entirely, plus four of panel 11's nine filters (PCP, BH care manager, psychiatric
consultant, clinic).

Highest-leverage part of the deck after gap 2, because a role model is what turns
one caseload table into three role-scoped worklists — which is most of what the
deck is actually asking for.

### Gap 2 — The reassessment interval is a rule nobody encodes *(best value/effort)*

Panel 5's table (High 7d / Moderate 14d / Low 30d / Historical as indicated) is
described in the deck as "automatically calculated." In SPiER today it is not
calculated at all: `Task` due dates are minted by
[`riskEpisode.ts`](../../web/src/lib/riskEpisode.ts) from a caller-supplied
`dueDate`, and the only caller is a date input in
[`SafetyTaskView.tsx:137`](../../web/src/components/SafetyTaskView.tsx:137) that
defaults to today. The interval lives in a clinician's head.

Encoding it is small — per-tier `timing` on a reassessment `ActivityDefinition`,
or a tier→interval `ConceptMap` — and it unlocks four separate deck panels:

- panel 5's Next Due and Status columns
- "C-SSRS Due Today" on panel 1
- "Risk Reassessment On Time >90%" on panel 9
- the "reassessment due in 48 hours" and "not contacted in 7 days" alerts on panel 8

⚠️ **The deck states a reassessment interval but never states a safety-plan
review interval**, despite "Safety Plans Needing Update" on panel 1, "Safety Plan
due for review" on panel 8, and "review dates" in data element 7. That interval
has to come from somewhere before those three items can compute — added as
question 8 to the spec doc's open list.

### Gap 3 — "Historical Risk" is a fifth tier, and probably shouldn't be a tier

`spier-suicide-risk-tier` is `no-risk` / `low` / `moderate` / `high` /
`imminent`. The deck's four are High / Moderate / Low / Historical. Two
mismatches in opposite directions: SPiER has `imminent` and the deck does not;
the deck has Historical and SPiER does not.

**Recommendation: model Historical as a second axis, not a fifth ordinal level.**
A patient with a past attempt and no current ideation is `no-risk` on the current
axis and positive on a history axis. Collapsing those into one ordinal destroys
exactly the distinction that makes them worth an annual review, and it would make
the tier field non-monotonic — is "Historical" above or below "Low"? C-SSRS
already models this as two axes (lifetime vs since-last-visit), and SPiER's
problem-list ValueSet already carries `23233009` "Previous known suicide attempt"
separately from the current-finding codes.

This is a **concept-layer decision**, so once settled it belongs alongside
[`best-practices/concept-harmonization.md`](../best-practices/concept-harmonization.md),
not only in this plan. It is now also co-owned by
[`suicide-safer-care-pathway.md`](suicide-safer-care-pathway.md) (clinical
question 2 there) — the pathway diagram carries the same Historical tier, and
both plans deliberately proceed without it until the axis decision lands.

### Gap 4 — No approval gate on risk step-down

Panel 6 requires "consultant approval before reducing risk level." A risk tier in
SPiER is just the most recent `SPiERSuicideRiskConcept` Observation, with nothing
guarding the transition; `measures.ts` measure 2 deliberately reads that
Observation rather than the episode's cached tier extension, precisely because
the cache could be hand-set.

Three candidate models, in increasing strictness:

1. A `Task` with a review code that must be `completed` — reportable, not binding
2. `Provenance` on the step-down Observation naming the approving consultant
3. An invariant on the episode extension refusing a downward tier change without (1) or (2)

Which one is right depends on spec question 3 (how hard is the gate). Do not pick
before that answer arrives — this is the one gap where guessing wrong means
building a constraint that either does nothing or blocks real clinical work.
(Co-owned by [`suicide-safer-care-pathway.md`](suicide-safer-care-pathway.md),
clinical question 3 — the pathway diagram states the step-down criteria this
gate would enforce, and its v1 artifact deliberately omits them.)

### Gap 5 — Outcome measures need a visit *classification* SPiER does not carry

> **Revised.** This gap was first written as "outcome measures need resources
> SPiER does not emit," on an inventory taken before
> [#285](https://github.com/SPiER-Project/adoption-guide/pull/285) landed. That
> PR added the `SPiEREncounter` profile and 24 scenario Encounters, so the
> premise was already false when this plan merged. The gap is real but
> **narrower and more actionable** than first described — see below.

All seven current Measures are process measures. Panel 10 wants attempts, ED
visits, psychiatric hospitalizations, 988 referrals, crisis interventions,
discharges, and average days per tier — as **monthly trends**.

`Encounter` now exists, and its shape helps: `SPiEREncounter` deliberately keeps
`class` on the base v3-ActCode binding rather than narrowing it, with the stated
rationale that ED, ambulatory and telephone contacts are all in scope. The 24
seeded instances break down as:

| `class` | Count | Panel-10 relevance |
|---|---|---|
| `AMB` ambulatory | 9 | — |
| `VR` virtual | 9 | — |
| `EMER` emergency | 5 | **ED visits — countable today** |
| `IMP` inpatient | 1 | hospitalizations, but see below |

So **ED-visit counts are derivable now**. What is left:

1. **Nothing distinguishes a *psychiatric* admission from any inpatient stay.**
   None of the 24 Encounters carries `Encounter.type` or `reasonCode` — only
   `status`, `class`, `episodeOfCare`, `subject` and `period` — and
   `SPiEREncounter` requires neither. `class = IMP` counts hospitalizations in
   general; panel 10 asks specifically for psychiatric ones. This is the real
   residual gap, and it is a small one: a `type` or `reasonCode` binding on the
   profile, plus seeding it.
2. **Attempts cannot come from instrument data.**
   `suicide-related-conditions.fsh` carries a written refusal to derive a
   `Condition` from a screen. So an attempt count must come from a
   clinician-asserted Condition (`82313006` / `23233009`) or an Encounter —
   never from a positive screen. This is a constraint to respect, not a gap to
   close.
3. **`MeasureReport` is a period snapshot, not a series.** "Monthly trends"
   needs either N reports or a different report shape.
4. **988 referrals and crisis interventions are not Encounter-shaped anyway** —
   they land closer to the existing crisis-resources and outreach artifacts, and
   were never blocked on this gap.

---

## Panel-by-panel disposition

| Panel | Disposition | Blocked by |
|---|---|---|
| 1 Executive summary | Build — 5 of 9 tiles derivable today | 2 tiles → gap 2; 1 → gap 3; 1 → gap 1/4 |
| 2 Risk distribution | Build — census is `riskCounts`, already computed | sub-metrics → gap 2, gap 3 |
| 3 Screening performance | New measure shapes (rate + latency) | needs eligible-population denominator |
| 4 Pathway compliance | Build — ~5 of 7 gauges map to existing profiles | spec questions 1, 2 |
| 5 Reassessment tracker | Build | gap 2 |
| 6 Consultant dashboard | Defer | gaps 1, 4 |
| 7 Care manager queue | Build the work-type pivot; defer role scoping | gap 1 for full version |
| 8 Alerts panel | Build — re-pivot of `measureGaps.ts` | 2 of 8 rules → gap 2 |
| 9 Quality scorecard | 4 of 8 rows exist; 4 new | gaps 1, 2, 4 |
| 10 Outcome measures | Defer | gap 5 |
| 11 Population filters | Build stage/risk/age; defer the rest | gap 1 for 4 filters |
| 12 Patient snapshot | Mostly exists — `PatientChart` + `PatientPathway` | — |
| 13 EHR data elements | Publish via `DataDictionary.tsx` | ⚠️ fix `Z91.82` first |

On panel 9's four mappable rows: Safety Plan Completion ≈
`SPiERSafetyPlanBeforeDischarge`, Follow-up Timeliness ≈
`SPiERFollowUpTimeliness`, Crisis Resource Documentation ≈ the crisis-resources
artifacts, and Same-Day C-SSRS ≈ `SPiERScreenToAssessment`. **That last one needs
a variant, not a reuse:** the deck says "same-day" (a calendar-day boundary) and
the measure implements a rolling 24 hours. They disagree for a 9pm screen.

Also: SPiER encodes **no numeric targets** on any `Measure`, and panel 9 states a
goal for all eight rows. `Measure.scoring` has no target element in R4; this
wants either an extension or a display-layer table.

---

## Population view redesign

Current state: one table, six columns, two filters (stage, risk). The deck
implies three zones on one page.

### Zone 1 — Summary strip (panels 1–2)

Compact KPI tiles plus a tier census bar. Note that `riskCounts` is **already
computed in `PopulationView.tsx` and currently used only to label filter-menu
options** — the census exists and is thrown away.

### Zone 2 — Alerts (panel 8)

Red/yellow, grouped by patient, each row linking to that chart.

The insight worth building on: [`measureGaps.ts`](../../web/src/lib/measureGaps.ts)
already computes *which measure a patient failed and why*, keyed by `Measure.id`,
and `MeasureDashboard` renders it **per measure**. The deck wants the same
information **per patient**. Same engine, transposed — not a new rules engine.
Six of the eight alert rules fall out of gaps that engine already knows about.

### Zone 3 — Caseload with a view switcher

The deck contains four tables over the same rows: general caseload, reassessment
tracker (panel 5), care-manager queue (panel 7), consultant queue (panel 6).
**Build one table whose view selector swaps columns, default sort, and default
filter** — not four components. `DerivedRegistryRow` stays the single source, and
four near-duplicate tables never get a chance to drift.

| View | Columns | Needs |
|---|---|---|
| Caseload | today's six | — |
| Reassessment | Patient · Tier · Last assessment · Next due · Status | gap 2 |
| Work queue | grouped by work type | richer Task codes |
| Consultant | Patient · Tier · Awaiting review · Days waiting | gaps 1, 4 |

### Filters

Age is derivable from `dob` today. Clinic and the three role filters need gap 1.
Diagnosis and insurance need `Condition` queries and `Coverage`, and I would skip
both until something actually asks — they are the two filters on panel 11 with no
stated metric depending on them.

### ⚠️ One design caution

**The deck's summary is a management artifact; the Population view is a triage
artifact.** Ten KPI tiles stacked above a worklist push actual patients below the
fold, which is the one thing a triage view must not do.

Recommendation: keep zone 1 compact and collapsible on one page rather than
splitting Dashboard / Caseload into two tabs — the deck's own argument is that the
census and the worklist are the same query, and two tabs would deny that.

---

## Phasing

Ordered to front-load everything that needs no new FHIR, and to defer both gaps
that need a decision from the deck's author.

Tracked under epic
[#277](https://github.com/SPiER-Project/adoption-guide/issues/277).

| Phase | Scope | New FHIR? | Issue |
|---|---|---|---|
| 1 | KPI strip · tier census · alerts panel · age filter · view-switcher scaffold | none | [#278](https://github.com/SPiER-Project/adoption-guide/issues/278) |
| 2 | Reassessment interval rule → tracker view, Next Due, on-time measure, 2 alert rules | one small artifact | [#279](https://github.com/SPiER-Project/adoption-guide/issues/279) |
| 3 | Historical-risk axis | concept-layer decision first | not filed |
| 4 | `CareTeam` / `PractitionerRole` → consultant + care-manager views, role filters, approval gate | yes | not filed |
| 5 | Outcome measures · visit classification · time series | yes | not filed |

Phases 3–5 are deliberately unfiled: each needs an answer from the deck's author
before it can be scoped without guessing.

Phase 5 was originally labelled "largest scope." It is no longer clearly the
largest — #285 supplied the `Encounter` layer it was mostly waiting on, leaving a
visit-classification gap plus the time-series shape. **Phase 4 is now the biggest
piece of the deck**, and if phase 5 gets re-estimated before it is filed, start
from the revised gap 5 above rather than from this table's original wording.

Phase 1 is deliberately sized to be shippable without answering any open
question. Phase 2 needs only the interval table, which the deck already states.
Phases 3 and 4 need spec answers 5/6 and 3/4 respectively.

### Gate costs that are easy to forget

- **Phase 4 adds new `resourceType`s** (`CareTeam`, `PractitionerRole`,
  `Coverage`). Each needs its entries in `BASE_REQUIRED` and
  `STATUS_CODES` in `web/scripts/check-scenario-resources.mjs` — those tables are
  hand-maintained because base R4 StructureDefinitions are not vendored here.
- **New measures need CQL** in `ig/input/cql/`, which the IG Publisher *does*
  compile (see the correction in
  [`stage-8-measure-and-share.md`](archive/stage-8-measure-and-share.md)), plus a
  criterion in `measures.ts` or `npm run check:measures` fails.
- **New codings in TypeScript** are only seen by `npm run check:codings`
  (nightly, needs a terminology server). A substantial new coding source inside
  an already-scanned tree wants **its own `SCAN` entry** — a parent floor cannot
  tell two contributors apart.
- **Any new tier code** ripples through `ig/input/fsh/`,
  `web/src/lib/observationMappers/`, and `packages/demo-population/` by hand. Grep
  the whole repo.

---

## Documentation changes this drives

- **New:** `docs/reference/suicide-care-dashboard-spec.md` (the deck, transcribed)
  and this plan. Both indexed in `docs/README.md`.
- **Amended:** [`stage-8-measure-and-share.md`](archive/stage-8-measure-and-share.md) —
  it currently presents seven process measures as the whole of Stage 8. The deck
  splits Stage 8 into a process half (built) and an outcome half (unmodeled),
  which changes what "Stage 8 complete" means. See its *Update — the deck adds an
  outcome half* section.
- **Owed once decided:** the gap-3 axis decision belongs next to
  `best-practices/concept-harmonization.md`; a short `docs/reference/` note on
  CoCM role codes is owed if phase 4 proceeds, so the FSH, the app, and the
  measures share one role vocabulary instead of inventing three.
- **Corrected in passing:** `MANIFEST.md` claimed 5 of 8 stage PlanDefinitions
  were authored with "stages 5, 6, 8 pending" (all eight exist in
  `pathway-stages.fsh`) and still used the pre-July-2026 stage names Flag Risk /
  Set Risk Status / Manage Active Risk. Fixed while adding the entries above,
  because the deck's panels index by stage and a stale stage list would have been
  read straight into this work.

---

## Open questions

Tracked in the spec doc's *Open questions for the author* section — eight of them.
The three that gate phases: what the non-Stanley-Brown "Safety Plan" gauge is
(question 1), how hard the approval gate is (question 3), and whether Historical
is a tier or an axis (question 5).

One question this repo should answer for itself rather than asking: **does the
Population view stay a single page as it absorbs five more panels?** The caution
above says yes, compactly. That is a recommendation, not a settled decision, and
phase 1 is where it gets tested.
