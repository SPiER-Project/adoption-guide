# Relationship to Other Implementation Guides

SPiER is **narrow and deep**: it specifies the suicide-safer-care pathway end to end — Capture (validated instruments as Questionnaires), Translate (an instrument-agnostic suicide-risk concept), and Act (executable PlanDefinitions/ActivityDefinitions). It is designed to sit *on top of* the broader US-realm baselines rather than restate them, and to interoperate with — not compete with — the national behavioral-health data layer now taking shape.

## Shared foundation

SPiER builds on the same anchors as the rest of the US behavioral-health ecosystem, so adopters reuse infrastructure they already have:

- **[US Core 6.1.0](https://hl7.org/fhir/us/core/)** — Patient demographics and the standard Observation shape. SPiER's survey-derived instrument Observations carry a named `survey` category slice, which is the element [US Core Observation Screening Assessment](https://hl7.org/fhir/us/core/STU6.1/StructureDefinition-us-core-observation-screening-assessment.html) requires (`category:survey` 1..1); that profile also derives from base `Observation`, so the two shapes agree.
- **[SDC 3.0.0](https://hl7.org/fhir/uv/sdc/)** — `Questionnaire` authoring plus the `observationExtract` / `calculatedExpression` mechanics SPiER uses to derive Observations from a completed `QuestionnaireResponse`.
- **[Gravity / SDOH Clinical Care](https://hl7.org/fhir/us/sdoh-clinicalcare/)** — the per-role conformance pattern (see [Conformance](conformance.html)) and the derived-concept modeling that the SPiER suicide-risk concept layer follows.

## HL7 US Behavioral Health Profiles (USCDI+ Behavioral Health)

The [HL7 US Behavioral Health Profiles IG](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/) expresses the USCDI+ Behavioral Health data elements as FHIR. It is **broad and shallow** by design: it covers the whole behavioral-health domain (clinical notes, program/grant metadata, and a wide catalog of health-status assessments) on the same US Core + SDC + SDOH foundation SPiER uses.

Note that guide mixes US Core versions: its three profiles derive from **US Core 7.0.0**, while its examples still pin `us-core-questionnaireresponse|6.1.0`. Read the version off the artifact rather than the guide.

The two guides are **complementary**:

| Concern | US Behavioral Health Profiles | SPiER |
|---|---|---|
| PHQ-9, C-SSRS, and other instruments | included as **examples** (unconstrained) | **profiled** Observations with Must-Support, plus capture Questionnaires |
| Cross-instrument suicide-risk concept | crosswalk **names** `us-core-observation-screening-assessment` for its "Suicide Risk Assessment" element, but ships no such Observation | harmonized risk tier (LOINC `93374-7`) + per-instrument ConceptMaps, in a profile that satisfies the named US Core one |
| Workflow / "Act" | not addressed | PlanDefinition / ActivityDefinition per pathway stage |
| Conformance | data-element layer (draft) | per-role CapabilityStatements |

The "Suicide Risk Assessment" row is the sharpest illustration. That guide's worked story has an ED nurse administer a C-SSRS and the psychiatrist read a low risk off it — and then nothing consumes the result: no derived concept, no safety plan, no follow-up, no measure. The slot is declared and unfilled, which is precisely the Translate/Act layer SPiER supplies.

In short, SPiER **profiles the suicide-prevention instruments that US Behavioral Health Profiles only exemplifies**, and adds the translation and workflow layers that a suicide-safer-care pathway requires. A system can conform to both: emit USCDI+ BH data elements *and* the SPiER pathway artifacts from the same capture event.

### Terminology alignment

Where the two guides describe the same datum, SPiER deliberately uses the same codes so a system implementing both does not see two codings for one concept:

- **PHQ-9** — SPiER's total-score (`44261-6`), item-9 (`44260-8`), and LOINC answer codes match the codes used in the US Behavioral Health Profiles PHQ-9 example.
- **C-SSRS** — the match is item-for-item. SPiER's C-SSRS Screener Questionnaire carries **all eight** LOINC codes that guide's C-SSRS example uses, in the same order and with the same meaning: `93246-7`, `93247-5`, `93248-3`, `93249-1`, `93250-9`, `93267-3`, `93269-9`, and `93374-7` "Suicide risk level".
- **Risk level** — `93374-7` has a normative answer list ([`LL465-6`](https://loinc.org/93374-7): Low / Moderate / High), and that guide's example uses `LA9194-7` "Low" from it. SPiER's value uses a finer-grained tier set and provides a [ConceptMap](ConceptMap-SPiERRiskTierToLOINC.html) onto that answer list, so an HL7-aligned consumer can interpret the value natively.

The alignment is exercised, not just asserted: that guide's published PHQ-9 and C-SSRS QuestionnaireResponses are checked into SPiER as test fixtures, and SPiER's [code-based dispatch fallback](https://github.com/SPiER-Project/adoption-guide) reads both — recovering the same PHQ-9 total (12) and the same C-SSRS risk level the guide's own examples state. Worth knowing if you are producing that shape: those examples carry their LOINC code **only in `linkId`** (as `/44250-9`), because R4 `QuestionnaireResponse.item` has no `code` element, and the C-SSRS one points `questionnaire` at a PDF rather than a `Questionnaire` canonical.

## A note on dependencies

SPiER does **not** declare a FHIR-package dependency on the US Behavioral Health Profiles IG. That guide is an early CI build (v0.1.0, pre-ballot) whose artifacts change frequently; binding SPiER's conformance to unstable artifacts would be premature. SPiER instead aligns at the **terminology and modeling** level and will revisit a formal dependency if and when that guide reaches a stable ballot release.

That is a judgement about stability, and the build supports it. As inspected on 2026-08-12: the two US Core versions noted above coexist in one build; the change log documents a "0.2.0" while the package is `0.1.0`; six data elements that change log says were **removed** are still live rows in the crosswalk table (so the crosswalk is not a safe element list); the `ImplementationGuide` declares `hl7.org/fhir/us/bhp/…` while every artifact uses `fhir.org/guides/astp/bhp/…`; and the narrative disagrees with its own examples about the patient's coverage. None of this is unusual for a pre-ballot CI build — it is simply why the dependency waits. Full detail, with the pilot timeline that makes the alignment worth maintaining anyway, is in `docs/research/2026-08-us-behavioral-health-profiles-ig.md`.
