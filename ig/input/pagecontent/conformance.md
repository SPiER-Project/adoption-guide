# Conformance

> **Status: draft** (FMM 0–1). Must-Support flags, the role CapabilityStatements
> and every rule below are the intended conformance contract, not yet balloted.
> Advancing maturity needs independently developed implementations; per-tool
> readiness is tracked in the companion app's
> [Adoption Readiness matrix](https://spier-project.github.io/adoption-guide/#/guide/adoption-readiness).

## Actor roles

SPiER defines conformance per **system role**, the approach of the HL7
[Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/). Each role has a
`CapabilityStatement` declaring the resources and interactions it supports:

- [Screening-Source EHR](CapabilityStatement-screening-source-ehr.html) —
  captures an instrument as a `QuestionnaireResponse` and produces the derived
  instrument Observation(s) and the harmonized suicide-risk concept Observation.
- [HIE Intermediary](CapabilityStatement-hie-intermediary.html) — stores and
  forwards those resources across organizations without losing fidelity or
  provenance.
- [Risk Consumer](CapabilityStatement-risk-consumer.html) — reads the
  harmonized concept (and, optionally, the underlying capture data) to surface
  actionable suicide-risk information at the point of care.
- [Quality Reporter](CapabilityStatement-quality-reporter.html) — evaluates the
  Stage-8 Measures over a population; its access pattern is population-wide
  rather than per patient.

## What "Must-Support" means

Following [US Core](https://hl7.org/fhir/us/core/conformance-expectations.html),
Must-Support is defined **operationally, by role**:

- A **producer** (screening-source EHR) *SHALL be capable of populating* every
  Must-Support element.
- A **consumer** (risk client) *SHALL be capable of processing* instances
  containing those elements *without erroring or failing*.
- **Missing data:** when an element's absence reason is unknown, a producer
  SHALL omit the element, and a consumer SHALL interpret a missing element as
  *data not present*, not as an error.

Must-Support says *what must be supported*; it does **not** constrain maximum
cardinality, so a source system is never forced to strip data out.

## The concept layer is screening-level

The harmonized suicide-risk tier (generic LOINC `93374-7`) is a **derived,
unconfirmed** signal: a screen result warranting follow-up, not a confirmed
clinical finding. Consumers SHOULD treat it as a triage/routing signal and
preserve the `derivedFrom` link to the originating `QuestionnaireResponse`.
See [Reading the artifacts](how-to-read.html#two-layer-model).

### Tier derivation on the Questionnaire {#tier-derivation}

Every instrument's `risk-level` item carries a
[Tier Derivation](StructureDefinition-tier-derivation.html) extension valued
`computed` (the tier is derived from the other answers — the C-SSRS forms) or
`clinician-assigned` (the tier is the clinician's judgment — SAFE-T, PSS-Full).
A `computed` item SHALL be `readOnly` and SHALL NOT be `required`: no filler
produces its value, so a QuestionnaireResponse that omits it is conformant. A
`clinician-assigned` item SHALL be `required`, and a consumer reads the tier
from the response. [Reading the artifacts](how-to-read.html#tier-derivation)
shows the two cases side by side.

### `Observation.interpretation` differs by layer

The concept-layer Observation carries `POS` / `NEG` (positive or negative for
follow-up); the instrument-layer Observations carry `A`, `H`, `L` (a native
result read against the instrument's own thresholds). Both come from the
standard observation-interpretation value set and the profiles do not choose
between them. A consumer SHOULD NOT assume one interpretation vocabulary across
the two layers, and SHOULD read the `derivedFrom` chain to know which layer an
Observation belongs to.

## The problem list

**A screen never becomes a `Condition`.** A positive ASQ, C-SSRS, PHQ-9 item 9
or SBQ-R produces a
[SPiER Suicide Risk Concept](StructureDefinition-spier-suicide-risk-concept.html)
Observation and nothing else. Systems implementing this guide SHALL NOT derive
a problem-list `Condition` from a screening or assessment result; a problem-list
entry is a clinician's assertion, and a screen is a signal that one may be
warranted.

**A clinician-asserted suicide-related problem is coded** with
[SPiER Suicide-Related Condition](StructureDefinition-spier-suicide-related-condition.html),
which requires `verificationStatus` and binds `code` extensibly to
[SPiER Suicide-Related Problem](ValueSet-spier-suicide-related-problem-vs.html):
nine SNOMED CT concepts, each verified against the publishing authority,
spanning risk status, ideation → plan → intent → behavior → attempt, history of
attempt, and self-harm. Depression (`35489007`) is deliberately **not** a member:
a PHQ-9 score is a severity screen, and a system SHALL NOT assert a depressive
disorder from one.

**A CAMS driver stays narrative.**
[SPiER CAMS Suicide Driver](StructureDefinition-spier-cams-suicide-driver.html)
requires `code.text` and leaves `code.coding` optional with an `example`
binding, because no terminology carries concepts at a driver's granularity.

## Categories and codes every profile carries

- **The domain category is required.** Every SPiER resource with a native
  `category` element carries
  `http://thespierproject.org/fhir/CodeSystem/spier-concept-domain#suicide-risk`
  as a `1..1` slice, *in addition to* its standard clinical category (`survey`,
  `procedure`, `problem-list-item`, …). Slicing is open, so a resource may carry
  further categories. [Quick Starts](quick-starts.html) has the queries this
  enables, including why `Appointment` uses `service-category`.
- **`87626-8` in `CarePlan.category` is not a document claim.** The two
  narrative safety plans —
  [Stanley-Brown](StructureDefinition-spier-stanley-brown-safety-plan.html) and
  [Crisis Response Plan](StructureDefinition-spier-crisis-response-plan.html) —
  carry LOINC `87626-8` "Suicide prevention note" in `category` for
  discoverability. It is a document-type concept placed in an `example`-bound
  element; a consumer SHALL NOT read it as a claim that the CarePlan is a
  document. The two CAMS plans do not carry it.
- **Safety-plan section codes are SPiER-local**
  ([safety-plan-section](CodeSystem-safety-plan-section.html)), because LOINC
  publishes nothing at section granularity, and they are kept separate from the
  [CAMS care-plan sections](CodeSystem-cams-careplan-section.html), which the
  CAMS framework orders and scopes differently. No ConceptMap between the two is
  published.
- **Licensing status is a code, and it may say `unknown`.** Every
  ActivityDefinition carries a `copyright` notice and a coded
  [instrument-licensing-status](StructureDefinition-instrument-licensing-status.html).
  `unknown` is a positive statement that SPiER's audit has not established the
  answer, not a synonym for unrestricted. No status has been checked against
  what the rights holder publishes *today*; an adopter SHALL verify licensing
  against the rights holder's current terms before deploying an instrument.
- **A code-less ActivityDefinition is a catalogue entry, not a modelled
  instrument.** A few pathway steps are published with structural metadata only
  — no LOINC or SNOMED codes, no Questionnaire binding, no derived-Observation
  profile — because inventing those would assert things nothing verified. Each
  is still referenced by exactly one stage PlanDefinition action.

## Harmonization status

Every crosswalk is a published, machine-readable artifact; **none has clinical
sign-off yet**. Those are two different facts, and only the first is complete.

| Instrument | Tier-mapping artifact | Kind | Status |
|---|---|---|---|
| ASQ | [ConceptMap: ASQ Disposition → Risk Tier](ConceptMap-ASQDispositionToRiskTier.html) · [StructureMap: ASQ Result → Concept](StructureMap-ASQResultToSuicideRiskConcept.html) | Coded disposition | Published — pending clinical sign-off |
| PSS-3 | [ConceptMap: PSS-3 Result → Risk Tier](ConceptMap-PSS3ResultToRiskTier.html) | Coded disposition | Published — pending clinical sign-off |
| C-SSRS | [ConceptMap: C-SSRS Risk Level → Risk Tier](ConceptMap-CSSRSRiskLevelToRiskTier.html) · [StructureMap: C-SSRS Risk Level → Concept](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html) | Coded disposition | Published — pending clinical sign-off |
| BSSA | [ConceptMap: BSSA Disposition → Risk Tier](ConceptMap-BSSADispositionToRiskTier.html) | Coded disposition | Published — pending clinical sign-off |
| CAMS (SSF overall risk) | [ConceptMap: CAMS SSF Overall Risk → Risk Tier](ConceptMap-CAMSOverallRiskToRiskTier.html) | Coded disposition | Published — pending clinical sign-off; clinician-overridable |
| PHQ-9 (Item 9) | [StructureMap: PHQ-9 Item 9 → Concept](StructureMap-PHQ9Item9ToSuicideRiskConcept.html) | Ordinal threshold | Published — pending clinical sign-off |
| SBQ-R (total score) | [StructureMap: SBQ-R Total Score → Concept](StructureMap-SBQRTotalScoreToSuicideRiskConcept.html) | Numeric cutoff | Published — pending clinical sign-off |

A coded disposition maps code to code, hence a ConceptMap; an ordinal or
numeric result is keyed on the value, hence a StructureMap; the ASQ and C-SSRS
carry both because deriving the Observation also shapes the resource
(`derivedFrom`, categories, interpretation) around the `translate()` call. All
are `status = draft`, `experimental = true`.

CAMS is a collaborative therapeutic process, not a predictive screener, and no
published stratification of the SSF Overall Risk rating exists: its map is
clinician-overridable decision support, every row carries a `wider`
equivalence, and **no rating maps to `imminent`**.

**Declared transformation.**
[Stanley-Brown QuestionnaireResponse → CarePlan](StructureMap-StanleyBrownQRToCarePlan.html)
states how a completed safety-plan questionnaire becomes a safety-plan
`CarePlan`; the Document Safety Actions stage names it in
`PlanDefinition.action.transform`.

**Egress: harmonized tier → LOINC.**
[SPiER Risk Tier → LOINC LL465-6](ConceptMap-SPiERRiskTierToLOINC.html) maps
the tier onto the normative LOINC answer list for `93374-7`, so a consumer
expecting the LOINC-coded value can read a SPiER concept without the local
vocabulary. Two steps are lossy: `imminent` collapses onto LOINC `High`, so a
consumer reading only the LOINC value SHOULD read the SPiER tier alongside it
where the distinction matters; and `no-risk` is omitted, having no LOINC
equivalent.

Until sign-off by suicide-prevention subject-matter experts, every tier
assignment above is **illustrative reference logic**. Adopters SHALL validate
tier assignments against their own clinical protocols before using the
harmonized tier to drive care decisions.
