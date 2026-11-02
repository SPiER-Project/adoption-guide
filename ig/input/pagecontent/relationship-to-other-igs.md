SPiER is **narrow and deep**: it specifies the suicide-safer-care pathway end
to end — Capture, Translate, Act — and sits *on top of* the US-realm baselines
rather than restating them.

### Shared foundation

- **[US Core 9.0.0](https://hl7.org/fhir/us/core/)** — the parent of every
  SPiER profile whose resource type US Core profiles, so an instance that
  conforms to SPiER also conforms to US Core:

  | SPiER profiles | US Core parent |
  |---|---|
  | The 12 instrument and concept Observations | [Observation Screening Assessment](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-observation-screening-assessment.html) |
  | Means Safety Action | [Simple Observation](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-simple-observation.html) |
  | Suicide-Related Condition, CAMS Suicide Driver | [Condition Problems and Health Concerns](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-condition-problems-health-concerns.html) |
  | The four safety-plan and CAMS CarePlans | [CarePlan](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-careplan.html) |
  | Lethal Means Counseling | [Procedure](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-procedure.html) |
  | [Encounter](StructureDefinition-spier-encounter.html) | [Encounter](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-encounter.html) |
  | [Discharge Safety Packet](StructureDefinition-spier-discharge-safety-packet.html) | [DocumentReference](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-documentreference.html) |
  | [Safety Referral](StructureDefinition-spier-safety-referral.html) | [ServiceRequest](https://hl7.org/fhir/us/core/STU9/StructureDefinition-us-core-servicerequest.html) |

  US Core requires a code on the last three, and SPiER fixes them:
  `Encounter.type` follows the encounter's class (SNOMED CT `4525004`
  Emergency department patient visit, `32485007` Hospital admission, otherwise
  `308335008` Patient encounter procedure); the packet's type is LOINC
  `87626-8` Suicide Prevention Note; and a referral is coded SNOMED CT
  `390866009` Referral to mental health team, or `183524004` Referral to
  psychiatry service for a transfer to inpatient psychiatric care, with the
  service named in `code.text`.

  The remaining profiles — the Communications, Consent, Flag, Task, Appointment
  and EpisodeOfCare — constrain types US Core does not profile, and build on
  the base resources.
- **[SDC 4.0.0](https://hl7.org/fhir/uv/sdc/)** — `Questionnaire` authoring
  plus the `observationExtract` / `calculatedExpression` mechanics SPiER uses
  to derive Observations from a completed `QuestionnaireResponse`.
- **[Gravity / SDOH Clinical Care](https://hl7.org/fhir/us/sdoh-clinicalcare/)**
  — the per-role conformance pattern ([Conformance](conformance.html)) and the
  domain category on every resource. SPiER departs from Gravity in one place:
  Gravity gives each derived result its own code, while SPiER's instrument
  results and harmonized tier share one (see
  [Known limitations](conformance.html#known-limitations)).

### Other standards SPiER uses

- **[CDS Hooks](https://cds-hooks.hl7.org/)** — SPiER's reference decision
  support service answers the `patient-view` hook with cards for the patient's
  next pathway step and any active risk alerts, derived from their completed
  assessments. The service is one implementation of the Act layer, not part of
  the conformance contract.
- **[SMART App Launch](https://hl7.org/fhir/smart-app-launch/)** — the
  reference apps launch from an EHR with SMART, read the patient's record, and
  write results back. SPiER defines no scopes or launch context of its own.
- **[Bulk Data Access](https://hl7.org/fhir/uv/bulkdata/)** — the
  [Quality Reporter](CapabilityStatement-quality-reporter.html) exports the
  SPiER resource types with a group-level `$export`.
- **[CRMI](https://hl7.org/fhir/uv/crmi/) and CQF Common** — dependencies of
  the measures. When the guide is published, the measure CQL is compiled and
  each Measure's data requirements are worked out from it, which uses both.
  SPiER does not hand-author any CRMI artifact.
- **[Clinical Practice Guidelines (CPG)](https://hl7.org/fhir/uv/cpg/)** — the
  pathway is written as base R4 PlanDefinitions and ActivityDefinitions in the
  shape CPG describes (a protocol that applies setting pathways, steps that
  reference activity definitions), but no SPiER artifact claims a CPG profile
  yet, and SPiER does not depend on the CPG package.
- **Quality measure IGs ([QI-Core](https://hl7.org/fhir/us/qicore/),
  [DEQM](https://hl7.org/fhir/us/davinci-deqm/), CQF Measures)** — not used.
  The measures read SPiER's own profiles rather than QI-Core, and are
  patient-based base R4 Measures, which needs nothing from CQF Measures; see
  [Measures](measurement.html).

### US Behavioral Health Profiles (USCDI+ Behavioral Health)

The [US Behavioral Health Profiles IG](https://fhir.org/guides/astp/bhp/),
published by ASTP/ONC with SAMHSA funding and HL7 EHR Work Group input,
expresses the USCDI+ Behavioral Health data elements as FHIR. It is **broad
and shallow** by design, covering the whole behavioral-health domain on the
same US Core + SDC + SDOH foundation. The two guides are complementary, and a
system can conform to both from the same capture event:

| Concern | US Behavioral Health Profiles | SPiER |
|---|---|---|
| PHQ-9, C-SSRS and other instruments | included as **examples** (unconstrained) | **profiled** Observations with Must-Support, plus the capture Questionnaires |
| Cross-instrument suicide-risk concept | names `us-core-observation-screening-assessment` for its "Suicide Risk Assessment" element, but ships no such Observation | the harmonized risk tier (LOINC `93374-7`) plus per-instrument ConceptMaps, in a profile that satisfies the named US Core one |
| Workflow / "Act" | not addressed | PlanDefinition / ActivityDefinition per pathway stage |
| Conformance | data-element layer (draft) | per-role CapabilityStatements |

**Terminology alignment.** Where the two guides describe the same datum, SPiER
uses the same codes so a system implementing both never sees two codings for
one concept:

- **PHQ-9** — total score `44261-6`, item 9 `44260-8` and the LOINC answer
  codes match that guide's PHQ-9 example.
- **C-SSRS** — item for item: SPiER's Screener carries all eight LOINC codes
  that guide's example uses (`93246-7`, `93247-5`, `93248-3`, `93249-1`,
  `93250-9`, `93267-3`, `93269-9`, `93374-7`), in the same order with the same
  meaning.
- **Risk level** — `93374-7` has a normative answer list
  ([`LL465-6`](https://loinc.org/93374-7)); SPiER's finer-grained tier maps
  onto it through the [egress ConceptMap](ConceptMap-SPiERRiskTierToLOINC.html).

SPiER does **not** declare a package dependency on that guide: it is an
early release (0.1.0, with 0.2.0 in preparation in October 2026) whose
artifacts, package name and canonical URL are still moving, and whose own
consistency was still settling when inspected in August and October 2026, so
SPiER aligns at the terminology and modeling level and will revisit a formal
dependency when it stabilizes. The inspection notes are in
[this research note](https://github.com/SPiER-Project/adoption-guide/blob/main/docs/research/2026-08-us-behavioral-health-profiles-ig.md).
