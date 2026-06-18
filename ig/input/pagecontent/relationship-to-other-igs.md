# Relationship to Other Implementation Guides

SPiER is **narrow and deep**: it specifies the suicide-safer-care pathway end to end — Capture (validated instruments as Questionnaires), Translate (an instrument-agnostic suicide-risk concept), and Act (executable PlanDefinitions/ActivityDefinitions). It is designed to sit *on top of* the broader US-realm baselines rather than restate them, and to interoperate with — not compete with — the national behavioral-health data layer now taking shape.

## Shared foundation

SPiER builds on the same anchors as the rest of the US behavioral-health ecosystem, so adopters reuse infrastructure they already have:

- **[US Core 6.1.0](https://hl7.org/fhir/us/core/)** — Patient demographics and the standard Observation shape.
- **[SDC 3.0.0](https://hl7.org/fhir/uv/sdc/)** — `Questionnaire` authoring plus the `observationExtract` / `calculatedExpression` mechanics SPiER uses to derive Observations from a completed `QuestionnaireResponse`.
- **[Gravity / SDOH Clinical Care](https://hl7.org/fhir/us/sdoh-clinicalcare/)** — the per-role conformance pattern (see [Conformance](conformance.html)) and the derived-concept modeling that the SPiER suicide-risk concept layer follows.

## HL7 US Behavioral Health Profiles (USCDI+ Behavioral Health)

The [HL7 US Behavioral Health Profiles IG](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/) expresses the USCDI+ Behavioral Health data elements as FHIR. It is **broad and shallow** by design: it covers the whole behavioral-health domain (clinical notes, program/grant metadata, and a wide catalog of health-status assessments) on the same US Core + SDC + SDOH foundation SPiER uses.

The two guides are **complementary**:

| Concern | US Behavioral Health Profiles | SPiER |
|---|---|---|
| PHQ-9, C-SSRS, and other instruments | included as **examples** (unconstrained) | **profiled** Observations with Must-Support, plus capture Questionnaires |
| Cross-instrument suicide-risk concept | not addressed | harmonized risk tier (LOINC `93374-7`) + per-instrument ConceptMaps |
| Workflow / "Act" | not addressed | PlanDefinition / ActivityDefinition per pathway stage |
| Conformance | data-element layer (draft) | per-role CapabilityStatements |

In short, SPiER **profiles the suicide-prevention instruments that US Behavioral Health Profiles only exemplifies**, and adds the translation and workflow layers that a suicide-safer-care pathway requires. A system can conform to both: emit USCDI+ BH data elements *and* the SPiER pathway artifacts from the same capture event.

### Terminology alignment

Where the two guides describe the same datum, SPiER deliberately uses the same codes so a system implementing both does not see two codings for one concept:

- **PHQ-9** — SPiER's total-score (`44261-6`), item-9 (`44260-8`), and LOINC answer codes match the codes used in the US Behavioral Health Profiles PHQ-9 example.
- **C-SSRS** — the derived risk-level Observation carries LOINC `93374-7 "Suicide risk level"`. LOINC publishes a normative answer list ([`LL465-6`](https://loinc.org/93374-7): Low / Moderate / High) for this code; SPiER's value uses a finer-grained tier set and provides a ConceptMap to the LOINC answer list so HL7-aligned consumers can interpret the value.

## A note on dependencies

SPiER does **not** declare a FHIR-package dependency on the US Behavioral Health Profiles IG. That guide is an early CI build (v0.1.0, pre-ballot) whose artifacts change frequently; binding SPiER's conformance to unstable artifacts would be premature. SPiER instead aligns at the **terminology and modeling** level and will revisit a formal dependency if and when that guide reaches a stable ballot release.
