# Conformance

> **Status: draft.** SPiER is a draft IG (FMM 0–1). Must-Support flags and the role CapabilityStatements described below are now defined, but remain draft/experimental — treat them as the intended conformance contract, not yet balloted.

## Actor roles

Rather than a single monolithic specification, SPiER defines conformance per **system role** (the approach used by the HL7 [Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/)). The roles map directly onto SPiER's audiences and its cross-EHR portability pilot:

- **Screening-source EHR** — captures an instrument as a `QuestionnaireResponse` and produces the derived instrument Observation(s) and the harmonized suicide-risk concept Observation.
- **HIE intermediary** — stores and forwards those resources across organizations without losing fidelity or provenance.
- **Risk consumer / client** — reads the harmonized concept (and, optionally, the underlying capture data) to surface actionable suicide-risk information at the point of care.

Each role has a `CapabilityStatement` declaring the resources and interactions it supports:

- [Screening-Source EHR](CapabilityStatement-screening-source-ehr.html) — produces the screening data.
- [HIE Intermediary](CapabilityStatement-hie-intermediary.html) — stores and forwards it.
- [Risk Consumer](CapabilityStatement-risk-consumer.html) — reads the harmonized concept.

## What "Must-Support" means

Following [US Core](https://hl7.org/fhir/us/core/conformance-expectations.html), Must-Support is defined **operationally, by role**:

- A **producer** (screening-source EHR) *SHALL be capable of populating* every Must-Support element.
- A **consumer** (risk client) *SHALL be capable of processing* instances containing those elements *without erroring or failing*.
- **Missing-data semantics:** when an element's absence reason is unknown, a producer SHALL omit the element, and a consumer SHALL interpret a missing element as *data not present* (not as an error).

Must-Support identifies *what must be supported* — it does **not** constrain maximum cardinality, so source systems are never forced to strip data out.

## The concept layer is screening-level

The harmonized suicide-risk tier (generic LOINC `93374-7`) is a **derived, unconfirmed** signal: it indicates a screen result warranting follow-up, not a confirmed clinical finding. Consumers SHOULD treat it as a triage/routing signal and preserve the `derivedFrom` link to the originating `QuestionnaireResponse`. See [How to Read This Guide](how-to-read.html#two-layer-model).

## Harmonization status

Every crosswalk below is now an artifact in this guide, and **none have clinical sign-off yet**. Two things are being tracked separately here, and the distinction matters: whether the artifact is *published and machine-readable*, and whether its tier assignments are *clinically ratified*. The first column pair is now complete; the second is not.

| Instrument | Tier-mapping artifact | Kind | Status |
|---|---|---|---|
| ASQ | [ConceptMap: ASQ Disposition → Risk Tier](ConceptMap-ASQDispositionToRiskTier.html) · [StructureMap: ASQ Result → Concept](StructureMap-ASQResultToSuicideRiskConcept.html) | Coded disposition | Published — pending clinical sign-off |
| PSS-3 | [ConceptMap: PSS-3 Result → Risk Tier](ConceptMap-PSS3ResultToRiskTier.html) | Coded disposition | Published — pending clinical sign-off |
| C-SSRS | [ConceptMap: C-SSRS Risk Level → Risk Tier](ConceptMap-CSSRSRiskLevelToRiskTier.html) · [StructureMap: C-SSRS Risk Level → Concept](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html) | Coded disposition | Published — pending clinical sign-off |
| BSSA | [ConceptMap: BSSA Disposition → Risk Tier](ConceptMap-BSSADispositionToRiskTier.html) | Coded disposition | Published — pending clinical sign-off |
| CAMS (SSF overall risk) | [ConceptMap: CAMS SSF Overall Risk → Risk Tier](ConceptMap-CAMSOverallRiskToRiskTier.html) | Coded disposition | Published — pending clinical sign-off; clinician-overridable decision support (see below) |
| PHQ-9 (Item 9) | [StructureMap: PHQ-9 Item 9 → Concept](StructureMap-PHQ9Item9ToSuicideRiskConcept.html) | Ordinal threshold | Published — pending clinical sign-off |
| SBQ-R (total score) | [StructureMap: SBQ-R Total Score → Concept](StructureMap-SBQRTotalScoreToSuicideRiskConcept.html) | Numeric cutoff | Published — pending clinical sign-off |

**Why some crosswalks are ConceptMaps and others are StructureMaps.** A ConceptMap maps code to code. Instruments that publish a coded disposition (ASQ, PSS-3, C-SSRS, BSSA, CAMS) therefore use one. The PHQ-9's suicide-relevant signal is Item 9, an ordinal integer 0–3, and the SBQ-R produces a numeric total against validated cutoffs; neither is a code-to-code mapping, so both are expressed as StructureMaps keyed on the value. The ASQ and C-SSRS carry a StructureMap *as well as* a ConceptMap because deriving the harmonized Observation involves resource shaping — provenance via `derivedFrom`, category codings, interpretation — around the ConceptMap `translate()` call.

Every ConceptMap and StructureMap above is published with `status = draft` and `experimental = true`.

The CAMS map differs in kind from the others and adopters should treat it accordingly. CAMS is a **collaborative therapeutic process, not a predictive screener**, and no published psychometric stratification of the SSF Overall Risk rating exists. Its tier assignment is therefore explicitly clinician-overridable decision support: every row carries a `wider` equivalence, and **no rating maps to `imminent`** — escalation to the imminent tier is a separate clinical triage decision that a patient self-rating cannot make.

### Declared transformations

One further StructureMap has a different job. [Stanley-Brown QuestionnaireResponse → CarePlan](StructureMap-StanleyBrownQRToCarePlan.html) describes how a completed safety-plan questionnaire becomes a safety-plan `CarePlan`, and the Document Safety Actions stage names it in `PlanDefinition.action.transform` on its `administer-stanley-brown` action. An implementer can therefore see not only that a safety plan yields a `CarePlan`, but how each of the seven Stanley-Brown steps lands in it.

### Egress: harmonized tier → LOINC

One further ConceptMap handles egress rather than ingress. [SPiER Risk Tier → LOINC LL465-6](ConceptMap-SPiERRiskTierToLOINC.html) maps the instrument-agnostic tier onto the normative LOINC answer list for `93374-7`, so a consumer expecting the LOINC-coded value — for example the HL7 US Behavioral Health Profiles IG — can interpret a SPiER harmonized concept without understanding the SPiER-local vocabulary.

Two lossy steps in that map are called out deliberately, and both are pending the same clinical sign-off:

- **`imminent` collapses onto LOINC `High`.** LL465-6 provides no distinct "imminent" answer. A consumer reading only the LOINC value therefore cannot distinguish imminent from high risk, and SHOULD read the SPiER-local tier alongside it where the distinction matters clinically.
- **`no-risk` is omitted**, having no LOINC equivalent.

Until sign-off by suicide-prevention subject-matter experts, the tier assignments in these artifacts are **illustrative reference logic**, not clinical guidance. Adopters SHALL validate tier assignments against their own clinical protocols before using the harmonized tier to drive care decisions.

## Maturity

SPiER is FMM 0–1. Advancing maturity requires evidence from **independently developed implementations** (FMM 2 expects interoperability across 3+ such systems); the current HIE portability pilot and planned HL7 Connectathon participation are the path there. Maturity is tracked per artifact, not coupled mechanically to ballot status.

Per-instrument maturity is tracked in the companion reference application. The [**Adoption Readiness matrix**](https://spier-project.github.io/adoption-guide/#/implementation-guide/adoption-readiness) scores every catalogued instrument on its build status, recommendation tier, and target integration depth (electronic capture / discrete write-back / workflow triggering), and links each to its pilot plan, live demo, and tracking epic.
