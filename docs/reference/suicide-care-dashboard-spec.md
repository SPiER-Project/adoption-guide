# Suicide Care Dashboard — source spec

> **Status in this repo:** This document transcribes *Suicide Care Dashboard*, a
> 13-slide deck authored by the SPiER project lead and received 2026-08-11. It is
> a **requirements source, not an implementation record** — nothing below is
> encoded in this repo yet. The implementation analysis, gap list, and phasing
> live in [`docs/plans/suicide-care-dashboard.md`](../plans/suicide-care-dashboard.md).
>
> Same role as [`ssc-stage-tiles-question-set.md`](ssc-stage-tiles-question-set.md):
> a leader-authored spec kept verbatim enough to be citable, so that later
> implementation decisions can be traced back to what was actually asked for.

Source: `Suicide Care Dashboard.pptx` (13 slides). Twelve dashboard panels plus a
closing "capture these structured fields" ask.

---

## The framing decision the deck makes

**This is a Collaborative Care Model (CoCM) registry.** The deck never says so,
but three panels and four filters are scoped by a specific role triad:

- Primary Care Provider
- Behavioral Health Care Manager
- Psychiatric Consultant

That is the AIMS Center / IMPACT structure, in which a psychiatric consultant
reviews a caseload without necessarily seeing patients, and — per slide 6 —
**must approve before a patient's risk level is reduced**.

This matters more than any single metric, because SPiER is currently
role-agnostic: there is no `CareTeam` or `PractitionerRole` anywhere in
`ig/input/fsh/` or the population scenarios. Panels 6, 7 and 11 cannot be built
without adopting a role model. See the plan doc, gap 1.

A second framing note: the deck's entry trigger is **PHQ-9 Item 9 positive, or
suicidal thoughts/behaviors otherwise identified** (slide 3). That aligns with
SPiER's existing `identify-possible-risk` stage and its Item 9 PlanDefinition
trigger (LOINC 44260-8).

---

## Panel 1 — Executive Summary

A metric / current / goal table.

| Metric | Goal stated |
|---|---|
| Patients on Suicide Care Pathway | Trending |
| High Risk | <5% |
| Moderate Risk | Monitor |
| Low Risk | Monitor |
| Historical Risk | Monitor |
| New Positive PHQ-9 Question 9 Today | Daily |
| C-SSRS Due Today | 100% |
| Safety Plans Needing Update | 0 |
| Psychiatric Consultations Overdue | 0 |

Note that "High Risk <5%" is a **proportion of the pathway census**, not a count
— the only tier row with a numeric target.

## Panel 2 — Risk Distribution

Per-tier sub-metrics. The deck states these tiers "correspond directly to the
pathway criteria based on C-SSRS responses and clinical judgment."

| Tier | Sub-metrics |
|---|---|
| High Risk | Number of patients · New this week · Average days in tier · Overdue contacts |
| Moderate Risk | Current census · Due for reassessment · Safety plans current % |
| Low Risk | Active patients · Eligible for discharge |
| Historical Risk | Lifetime history only · Annual review completion % |

**Four tiers, and they are not SPiER's five.** See the plan doc, gap 3.

## Panel 3 — Screening Performance

| Instrument | Metrics |
|---|---|
| PHQ-9 | Patients screened · Percent screened · Positive Question 9 · Average PHQ-9 score |
| C-SSRS | Completed within required timeframe · Missing · Overdue · Average completion time after positive PHQ-9 |

Two metric *shapes* here that SPiER has none of: a **screening rate** (needs an
eligible-population denominator) and an **average latency** (a continuous
variable, where all seven current SPiER measures are patient-based proportions).

## Panel 4 — Care Pathway Compliance

Seven gauge indicators, described as "the pathway's required interventions
following risk identification":

1. Safety Plan Completed
2. Emotional Fire Safety Plan Given
3. Stanley Brown Safety Plan Completed
4. Emergency Contact Consent
5. Crisis Resources Provided
6. 988 Information Given
7. NowMattersNow Provided

⚠️ **Items 1 and 3 are listed separately**, so "Safety Plan" is something
distinct from the Stanley-Brown plan in this model. ⚠️ **Item 2, "Emotional Fire
Safety Plan," does not map to any instrument identifiable from the deck.** Both
are open questions below.

## Panel 5 — Reassessment Tracker

A patient list — Patient · Risk · Last C-SSRS · Next Due · Status — over an
interval rule the deck says is "automatically calculated according to pathway
intervals":

| Tier | Reassessment interval |
|---|---|
| High Risk | Every 7 days |
| Moderate Risk | Every 14 days |
| Low Risk | Every 30 days |
| Historical | As indicated |

**This table is the highest-value single artifact in the deck.** It is the input
to panel 5, to "C-SSRS Due Today" on panel 1, to "Risk Reassessment On Time" on
panel 9, and to two of the panel-8 alerts. Nothing in SPiER encodes it today.

## Panel 6 — Psychiatric Consultant Dashboard

- Patients awaiting review
- Review frequency: High every 7 days · Moderate every 14 days · Low monthly
- Consults overdue
- Average time to recommendation
- Patients approved for risk reduction

Described as aligning with "the pathway's required psychiatric consultation
cadence and **consultant approval before reducing risk level**."

Note the review cadence is *close to but not identical with* the panel-5
reassessment intervals — Low is "monthly" here and "every 30 days" there. Worth
confirming whether these are one schedule or two.

## Panel 7 — Care Manager Work Queue

Today's patients needing: New C-SSRS · Safety Plan Review · Firearm Safety
Discussion · Psychiatric Consultation · PCP Follow-up · Outreach Call · Wellness
Check · Emergency Contact Follow-up.

Pivoted **by work type**, where SPiER's registry row is pivoted by patient.

## Panel 8 — Alerts Panel

| Severity | Rules |
|---|---|
| Red | High Risk patient not contacted in 7 days · Safety Plan missing · Positive PHQ-9 without C-SSRS · Psychiatric consultation overdue · Missing emergency contact |
| Yellow | Reassessment due in 48 hours · Safety Plan due for review · PCP review overdue |

## Panel 9 — Quality Measures (Performance Scorecard)

| Measure | Goal |
|---|---|
| PHQ-9 Screening Rate | >95% |
| Positive PHQ-9 with Same-Day C-SSRS | >95% |
| Safety Plan Completion | 100% |
| Crisis Resource Documentation | 100% |
| Psychiatric Consultation Completed | >95% |
| Follow-up Contact Timeliness | >95% |
| Risk Reassessment On Time | >90% |
| Risk Reduction Criteria Met | Track |

Eight rows against SPiER's seven Measures; four map, four do not. Note **"Same-Day"**
— a calendar-day boundary, where `SPiERScreenToAssessment` uses a rolling 24
hours. Note also that these goals are stated numerically, and SPiER encodes no
targets on any `Measure`.

## Panel 10 — Outcome Measures

Monthly trends: Suicide attempts · Emergency department visits · Psychiatric
hospitalizations · 988 referrals · Crisis interventions · Patients discharged
from pathway · Average days in each risk tier.

**Every SPiER measure today is a process measure.** This panel is a new family.
ED visits are countable from the `class = EMER` Encounters added by
[#285](https://github.com/SPiER-Project/adoption-guide/pull/285); what it still
needs is a way to mark a *psychiatric* admission (no seeded Encounter carries
`type` or `reasonCode`) and a time-series report shape. See the plan's gap 5.

## Panel 11 — Population Health View

Filters: Clinic · Primary Care Provider · Behavioral Health Care Manager ·
Psychiatric Consultant · Age · Diagnosis · Insurance · Risk Tier · Location.

SPiER's Population view has two of these nine (stage — which is not on this list
at all — and risk tier).

## Panel 12 — Individual Patient Snapshot

**Header:** Current Risk Tier · Current PHQ-9 · Current C-SSRS · Last Contact ·
Next Contact Due · Safety Plan Status · Emergency Contact Status · Psychiatric
Consultation Date.

**Timeline:** Positive PHQ-9 · C-SSRS · Safety Plan · Psychiatric Review ·
Follow-up Contacts · Risk Tier Changes · Discharge from Pathway.

The closest existing fit in the repo — `PatientChart.tsx` plus
`PatientPathway.tsx` already render a stage-grouped activity timeline.

## Panel 13 — Suggested EHR Data Elements

"To automate this dashboard, capture the following structured fields":

1. PHQ-9 total score
2. PHQ-9 Question 9 response
3. C-SSRS responses (Q1–Q6)
4. Current suicide risk tier
5. Risk identification date
6. Last and next C-SSRS dates
7. Safety Plan completion and review dates
8. Emotional Fire Safety Plan provided
9. Stanley and Brown Safety Plan completed
10. Crisis resources provided (988 / Now Matters Now)
11. Emergency contact consent
12. Psychiatric consultant review date
13. Behavioral health care manager contact date
14. Primary care follow-up date
15. Risk reduction eligibility
16. Pathway entry and exit dates
17. Suicide-related diagnosis codes

This is the slide that speaks most directly to the adoption guide's audience —
it is a conformance shopping list for EHR vendors, which is exactly what
`DataDictionary.tsx` publishes.

---

## ⚠️ Terminology verification — one code on slide 13 is wrong

Slide 13 cites suicide-related diagnosis codes as "e.g. R45.851, Z91.82/Z91.5".
Checked against ICD-10-CM on 2026-08-11:

| Code | Actual ICD-10-CM meaning | Verdict |
|---|---|---|
| `R45.851` | Suicidal ideations | ✅ Correct |
| `Z91.5` | Personal history of self-harm | ⚠️ Valid subcategory but **non-billable** — ICD-10-CM requires the highest available specificity, i.e. `Z91.51` or `Z91.52` |
| `Z91.82` | **Personal history of military deployment** | ❌ **Wrong code.** Not suicide-related. Almost certainly intended `Z91.51` (personal history of suicidal behavior) |

The likely intended pair is **`Z91.51`** (personal history of suicidal behavior)
and **`Z91.52`** (personal history of nonsuicidal self-harm), which are the two
billable children created when `Z91.5` was subdivided.

**Do not propagate `Z91.82` into any SPiER artifact, page, or vendor-facing
document.** This is the same failure mode as issue
[#220](https://github.com/SPiER-Project/adoption-guide/issues/220): a code that
resolves cleanly against the publishing authority while meaning something else
entirely, so no validator can catch it. There, `81344-4` was read as "reason for
living" when it actually means healthcare-agent disclosure authority. Here, a
vendor following slide 13 literally would capture military-deployment history as
a suicide-risk field.

Note separately that **SPiER codes problem-list Conditions in SNOMED CT, not
ICD-10-CM**, and `ig/input/fsh/suicide-related-conditions.fsh` carries the
written rationale for that choice plus a tx.fhir.org verification record. The
deck's ICD-10 ask is not a reason to switch; it is a reason to publish a
crosswalk, because sites register in SNOMED and bill in ICD-10.

Sources:
[R45.851](https://www.icd10data.com/ICD10CM/Codes/R00-R99/R40-R46/R45-/R45.851) ·
[Z91.5](https://www.icd10data.com/ICD10CM/Codes/Z00-Z99/Z77-Z99/Z91-/Z91.5) ·
[Z91.51](https://www.icd10data.com/ICD10CM/Codes/Z00-Z99/Z77-Z99/Z91-/Z91.51) ·
[Z91.52](https://www.icd10data.com/ICD10CM/Codes/Z00-Z99/Z77-Z99/Z91-/Z91.52) ·
[Z91.82](https://www.icd10data.com/ICD10CM/Codes/Z00-Z99/Z77-Z99/Z91-/Z91.82)

---

## Open questions for the author

Answers to the first three change implementation sequencing; the rest are
clarifications that can wait.

1. **Panel 4 lists "Safety Plan Completed" and "Stanley Brown Safety Plan
   Completed" as separate gauges.** What is the first one, if not Stanley-Brown?
   Is it a site-local safety-plan document, or the Crisis Response Plan
   (which SPiER models as `SPiERCrisisResponsePlan`)?
2. **What is the "Emotional Fire Safety Plan" (panel 4, data element 8)?** Not
   identifiable from the deck. A local handout, a named published instrument, or
   a transcription slip?
3. **How hard is the consultant approval gate on risk reduction (panel 6)?** A
   soft expectation the dashboard reports on, or a hard constraint that should
   block a step-down from being recorded at all? This decides whether SPiER
   models it as a reportable `Task` or as a genuine state-transition guard.
4. **Are the panel-5 reassessment intervals and the panel-6 consultant review
   cadence one schedule or two?** They differ for Low ("every 30 days" vs
   "monthly").
5. **Is "Historical Risk" a fifth risk tier, or a separate lifetime-history
   axis?** See the plan doc, gap 3 — SPiER's reading is that it is an axis, and
   this changes the concept layer either way.
6. **Where does `imminent` go?** SPiER's tier CodeSystem has an `imminent` level
   above `high`; the deck's four tiers stop at High. Does outpatient CoCM route
   imminent risk out of the registry to the ED, or is it folded into High?
7. **Which panel-9 goals are aspirational vs contractual?** Only matters if we
   encode them as `Measure` targets.
8. **What is the safety-plan review interval?** Panel 5 states reassessment
   intervals per tier, but no interval is stated for safety-plan review — even
   though "Safety Plans Needing Update" (panel 1), "Safety Plan due for review"
   (panel 8) and "review dates" (data element 7) all depend on one. Is it the
   same per-tier cadence as reassessment, a single fixed interval, or
   event-driven (reviewed whenever the tier changes)?
