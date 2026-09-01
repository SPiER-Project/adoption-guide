The **Suicide Safer Care Pathway** is SPiER's clinical protocol published as a
FHIR artifact: [PlanDefinition/SPiERSuicideSaferCarePathway](PlanDefinition-SPiERSuicideSaferCarePathway.html).
It is the *Act* layer of the [Capture → Translate → Act model](how-to-read.html#capture-translate-act)
— a course of care that a machine can read, a CDS engine can evaluate, and a
quality measure can be scored against, rather than a diagram a clinician has to
remember.

## What it encodes

Four steps, in order:

1. **Screen** (*Identify Possible Risk*) — administer a universal screen that
   carries a suicidality item, as part of ongoing depression screening.
2. **Gate, then assess** (*Clarify Risk*) — on a positive screen, administer a
   suicide-risk assessment that yields a harmonized risk tier. A negative
   assessment exits the pathway: the patient does not enter suicide-safer care
   and none of the obligations below apply.
3. **Branch by tier** (*Define the Risk Picture*) — one action group per risk
   tier, each carrying that tier's obligations: crisis resources at every tier,
   a collaborative safety plan from moderate upward, reassessment on the
   published per-tier cadence, and the high-risk-only protocol (the direct
   question at every contact, the STAT safety evaluation, the missed-appointment
   outreach protocol).
4. **Clinician guidance** — steps the pathway *prompts* and a clinician
   performs: the problem-list entry, and the tier's frequency of patient
   contact.

## How the tier branch reads the concept layer

The branch never reads an instrument's native result. Each tier group is gated
on an applicability condition over the episode's `episode-current-risk-tier`
extension, which caches the most recent
[SPiER Suicide Risk Concept](StructureDefinition-spier-suicide-risk-concept.html)
Observation — LOINC `93374-7` valued from
[SPiERSuicideRiskTier](CodeSystem-spier-suicide-risk-tier.html). That is the same
expression shape, over the same extension and the same code system, that
[PlanDefinition/SPiERReassessmentSchedule](PlanDefinition-SPiERReassessmentSchedule.html)
uses for its cadences, so an engine that can evaluate one can evaluate the other.

The consequence is the point: **the obligations attach to the tier, not to the
tool.** Two patients who reach `moderate` by different instruments are owed the
same things, and a site can change instruments without rewriting the protocol.

### The transportability rule

Every clinical step is coded by *what it accomplishes*. The instruments named on
those steps by `definitionCanonical` —
[AdministerPHQ9](ActivityDefinition-AdministerPHQ9.html) and
[AdministerCSSRSScreener](ActivityDefinition-AdministerCSSRSScreener.html) — are
the **demonstrated realization**: the pair SPiER ships end to end, so the
pathway can be shown working rather than only described. They are not the
requirement. Any instrument with a published crosswalk into
`SPiERSuicideRiskTier` satisfies the same step, and each step says so in its own
`action.documentation` so a partner reading the artifact does not have to find
this page.

Two details of the assessment step are load-bearing:

- The variant is the **C-SSRS Screener with Triage Points**. The C-SSRS ships in
  several forms, and only that one publishes the item-to-risk-level assignment
  the tiers depend on.
- The positive-screen gate is on a **positive screen**, not on the PHQ-9. The
  PHQ-9 item-9 condition (`≥ 1`, since a score of 0 is a negative screen) is the
  demonstrated realization of the gate.

## The cadence has exactly one home

Each tier group reaches its reassessment interval by `definitionCanonical` to
[SPiERReassessmentSchedule](PlanDefinition-SPiERReassessmentSchedule.html). The
pathway **references** the cadence and never restates it. There is no
`timingDuration` and no numeric interval anywhere in the pathway artifact.

This is not tidiness. The per-tier interval is already stated three times — in
that PlanDefinition, in the app that derives due dates from it, and in the
measure CQL that scores against it — and a drift gate exists to hold those three
in agreement. A fourth statement, in a document nothing compares against, is
exactly the failure that gate was built to prevent, so a second gate
(`check:pathway`) fails the build if one appears here.

## What is deliberately not encoded

A published protocol must not encode what is not settled. Three things the
source diagram states are therefore **absent from the artifact**, each blocked
on an open clinical question:

| Not encoded | Why |
|---|---|
| **Step-down criteria** | The reduction rules combine a "No"-answer streak, a milestone-event window, a minimum time in tier and psychiatric-consultant agreement — and the streak length is asymmetric (30 days at low and moderate, 90 at high) in a way nobody has confirmed is intentional. Publishing it would tell a site to de-escalate risk on an unreviewed rule. |
| **Milestone events** | The diagram's list is explicitly open-ended ("include, but are not limited to"), so there is no closed vocabulary to publish. A partial code system would read as a complete one. |
| **A "historical" tier** | `SPiERSuicideRiskTier` has no `historical` code. Verification against the published C-SSRS found that the response pattern the diagram calls Historical — behavior endorsed lifetime-only — is scored **Moderate** by the instrument itself; the fourth tier is structure layered on top of the instrument. Whether it belongs as an orthogonal history flag rather than an ordinal tier is open. |

The tier branch therefore covers **low, moderate and high only**. `imminent` and
`no-risk` are out for the reasons the reassessment schedule already records: a
patient at imminent risk is in active escalation rather than on a routine
protocol, and a no-risk patient is not on the pathway at all.

One further omission is stated on the artifact itself. The diagram gives
**frequency of patient contact** as a row separate from reassessment cadence,
with values that coincide at the higher tiers and diverge at the lower ones.
Whether that is one rule or two is an open question, so the pathway publishes
the obligation as prose and no interval.

## SPiER never writes a diagnosis code

The problem-list step carries no `definition[x]`. That is the FHIR shape for
"the clinician does this and SPiER prompts", and it is deliberate: a problem-list
entry is a clinician's assertion, and a screen is a signal that one may be
warranted. The same rule is stated from the terminology side in
[the suicide-related problem value set](ValueSet-spier-suicide-related-problem-vs.html) —
SPiER derives no `Condition` from a screen, and no mapper in the app does either.

What the step *does* carry is the verified coding: SNOMED CT as primary (which
is what US problem lists store), with the billable ICD-10-CM crosswalk named in
the documentation text for sites that need it.

## Measurement, and the KPI gaps

The source diagram states three KPIs. The pathway names the Stage-8 Measures
that answer them as `relatedArtifact`, and it names them honestly — **no Measure
was invented to make the list look complete**:

| KPI | Measure | Coverage |
|---|---|---|
| Positive screen → clarifying assessment | [SPiERScreenToAssessment](Measure-SPiERScreenToAssessment.html) | **Full.** The diagram states it as PHQ-9 Q9 → C-SSRS; the Measure generalizes it to the pathway-stage tags, so substituting an instrument does not break the measurement. |
| Positive assessment → problem-list entry / risk flag | [SPiERRiskStatusDocumented](Measure-SPiERRiskStatusDocumented.html) | **Partial.** The risk-status half is measured. The **problem-list half is not measured at all**, and cannot be: SPiER never writes a `Condition` from a screen, so it has no numerator it can compute. Closing this would mean measuring a clinician action SPiER only prompts. |
| Safety plan / resources provided, per tier | [SPiERSafetyPlanBeforeDischarge](Measure-SPiERSafetyPlanBeforeDischarge.html) | **Partial.** The Measure is anchored on a care transition and is **not stratified by risk tier**, and it does not count crisis-resource sharing — which this pathway obliges at every tier. A tier-stratified group and a crisis-resources numerator are the two gaps. |

## Related artifacts

- [SPiERReassessmentSchedule](PlanDefinition-SPiERReassessmentSchedule.html) —
  the per-tier reassessment cadence this pathway references.
- The eight stage PlanDefinitions (see [Artifacts](artifacts.html)) — each a
  `workflow-definition` cataloguing what a stage *can* contain. This pathway is
  a `clinical-protocol`: one course of care drawn from that catalogue, which is
  what the stage codes on its action groups tie back to.
- [Measurement (Stage 8)](measurement.html) — how the Measures above are scored.
