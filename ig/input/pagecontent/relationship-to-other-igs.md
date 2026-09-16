# Relationship to Other Implementation Guides

SPiER is **narrow and deep**: it specifies the suicide-safer-care pathway end
to end — Capture, Translate, Act — and sits *on top of* the US-realm baselines
rather than restating them.

## Shared foundation

- **[US Core 6.1.0](https://hl7.org/fhir/us/core/)** — Patient demographics
  and the standard Observation shape. SPiER's instrument Observations carry a
  named `survey` category slice, which is the element
  [US Core Observation Screening Assessment](https://hl7.org/fhir/us/core/STU6.1/StructureDefinition-us-core-observation-screening-assessment.html)
  requires, so the two shapes agree.
- **[SDC 3.0.0](https://hl7.org/fhir/uv/sdc/)** — `Questionnaire` authoring
  plus the `observationExtract` / `calculatedExpression` mechanics SPiER uses
  to derive Observations from a completed `QuestionnaireResponse`.
- **[Gravity / SDOH Clinical Care](https://hl7.org/fhir/us/sdoh-clinicalcare/)**
  — the per-role conformance pattern ([Conformance](conformance.html)) and the
  derived-concept modeling the suicide-risk concept layer follows.

## HL7 US Behavioral Health Profiles (USCDI+ Behavioral Health)

The [HL7 US Behavioral Health Profiles IG](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/)
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

SPiER does **not** declare a package dependency on that guide: it is a
pre-ballot CI build whose artifacts change frequently and whose own
consistency was still settling when inspected in August 2026, so SPiER aligns
at the terminology and modeling level and will revisit a formal dependency
when it reaches a stable ballot release. The inspection notes are in
[this research note](https://github.com/SPiER-Project/adoption-guide/blob/main/docs/research/2026-08-us-behavioral-health-profiles-ig.md).
