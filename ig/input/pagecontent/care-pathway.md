The **Suicide Safer Care Pathway** is SPiER's clinical protocol published as a
FHIR artifact:
[PlanDefinition/SPiERSuicideSaferCarePathway](PlanDefinition-SPiERSuicideSaferCarePathway.html).
It is the *Act* layer of the
[Capture → Translate → Act model](how-to-read.html#capture-translate-act) — a
course of care a machine can read, a CDS engine can evaluate, and a quality
measure can be scored against.

## What it encodes

Four steps, in order:

1. **Screen** (*Identify Possible Risk*) — administer a universal screen that
   carries a suicidality item, as part of ongoing depression screening.
2. **Gate, then assess** (*Clarify Risk*) — on a positive screen, administer a
   suicide-risk assessment that yields a harmonized risk tier. A negative
   assessment exits the pathway: none of the obligations below apply.
3. **Branch by tier** (*Define the Risk Picture*) — one action group per risk
   tier carrying that tier's obligations: crisis resources at every tier, a
   collaborative safety plan from moderate upward, reassessment on the
   published per-tier cadence, and the high-risk-only protocol (the direct
   question at every contact, the STAT safety evaluation, the
   missed-appointment outreach protocol).
4. **Clinician guidance** — steps the pathway *prompts* and a clinician
   performs: the problem-list entry, and the tier's frequency of patient
   contact.

## The branch reads the tier, not the tool

Each tier group is gated on an applicability condition over the episode's
`episode-current-risk-tier` extension, which caches the most recent
[SPiER Suicide Risk Concept](StructureDefinition-spier-suicide-risk-concept.html)
Observation — LOINC `93374-7` valued from
[SPiERSuicideRiskTier](CodeSystem-spier-suicide-risk-tier.html). It is the same
expression shape, over the same extension and code system, that
[PlanDefinition/SPiERReassessmentSchedule](PlanDefinition-SPiERReassessmentSchedule.html)
uses for its cadences, so an engine that evaluates one evaluates the other.

The consequence is the point: **the obligations attach to the tier.** Two
patients who reach `moderate` by different instruments are owed the same
things, and a site can change instruments without rewriting the protocol.

**Transportability.** Every clinical step is coded by *what it accomplishes*.
The instruments named on the steps by `definitionCanonical` —
[AdministerPHQ9](ActivityDefinition-AdministerPHQ9.html) and
[AdministerCSSRSScreener](ActivityDefinition-AdministerCSSRSScreener.html) —
are the **demonstrated realization**, the pair SPiER ships end to end, not the
requirement: any instrument with a published crosswalk into
`SPiERSuicideRiskTier` satisfies the same step, and each step says so in its
own `action.documentation`. Two details are load-bearing: the assessment
variant is the **C-SSRS Screener with Triage Points**, the one form that
publishes the item-to-risk-level assignment the tiers depend on; and the gate is
on a **positive screen**, of which PHQ-9 item 9 `≥ 1` is the demonstrated
realization.

**The cadence has exactly one home.** Each tier group reaches its reassessment
interval by `definitionCanonical` to
[SPiERReassessmentSchedule](PlanDefinition-SPiERReassessmentSchedule.html);
the pathway references the cadence and never restates it. There is no
`timingDuration` and no numeric interval anywhere in the pathway artifact.

## What is deliberately not encoded

A published protocol must not encode what is not settled. Each of these is
stated by the source diagram and absent from the artifact, blocked on an open
clinical question:

| Not encoded | Why |
|---|---|
| **Step-down criteria** | the de-escalation rule combines four conditions and has an asymmetry nobody has confirmed is intentional; publishing it would tell a site to lower risk on an unreviewed rule |
| **Milestone events** | the diagram's list is explicitly open-ended, so a code system would read as complete when it is not |
| **A "historical" tier** | `SPiERSuicideRiskTier` has no `historical` code: the C-SSRS itself scores that response pattern **Moderate**, and whether it belongs as a history flag rather than a tier is open |
| **Frequency of patient contact** | whether it is one rule with the reassessment cadence or two is open, so the obligation is published as prose and no interval |

The tier branch therefore covers **low, moderate and high**. `imminent` is
active escalation rather than a routine protocol, and `no-risk` is not on the
pathway at all.

## SPiER never writes a diagnosis code

The problem-list step carries no `definition[x]` — the FHIR shape for "the
clinician does this and SPiER prompts". A problem-list entry is a clinician's
assertion; a screen is a signal that one may be warranted
([Conformance](conformance.html) states the SHALL NOT). What the step *does*
carry is the verified coding: SNOMED CT as primary, which is what US problem
lists store, with the billable ICD-10-CM crosswalk named in the documentation
text for sites that need it.

## Measurement, and the KPI gaps

The source diagram states three KPIs. The pathway names the Stage-8 Measures
that answer them as `relatedArtifact`, and **no Measure was invented to make
the list look complete**:

| KPI | Measure | Coverage |
|---|---|---|
| Positive screen → clarifying assessment | [SPiERScreenToAssessment](Measure-SPiERScreenToAssessment.html) | **Full.** Generalized to the pathway-stage tags, so substituting an instrument does not break it. |
| Positive assessment → problem-list entry / risk flag | [SPiERRiskStatusDocumented](Measure-SPiERRiskStatusDocumented.html) | **Partial.** The risk-status half is measured; the problem-list half cannot be, because SPiER never writes a `Condition` from a screen and so has no numerator. |
| Safety plan / resources provided, per tier | [SPiERSafetyPlanBeforeDischarge](Measure-SPiERSafetyPlanBeforeDischarge.html) | **Partial.** Anchored on a care transition, not stratified by tier, and not counting crisis-resource sharing — the two gaps. |

## Related artifacts

- [SPiERReassessmentSchedule](PlanDefinition-SPiERReassessmentSchedule.html) —
  the per-tier reassessment cadence this pathway references.
- The eight stage PlanDefinitions (the [pathway group](artifacts.html#6) on the
  Artifacts page) — each a `workflow-definition` cataloguing what a stage *can*
  contain. This pathway is a `clinical-protocol`: one course of care drawn from
  that catalogue, which is what the stage codes on its action groups tie back to.
- [Measures](measurement.html) — how the Measures above are scored.
