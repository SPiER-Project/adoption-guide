# Concept-Layer Harmonization Guide

How SPiER turns many *different* suicide-risk instruments into one *shared, actionable* representation that any partner system can consume — even when the partner doesn't run the same tool. This is the conformance rationale behind the `concept-harmonization` Claude skill; read this for the "why," use the skill for the "do."

## 1. The problem this solves

Partners in a care network do not all use the same instruments. An ED screens with the **ASQ**; an outpatient clinic uses the **Columbia (C-SSRS)**; primary care uses **PHQ-9 Item 9**. Each instrument has its own codes — and some (ASQ item-level) have **no published LOINC codes at all**. A receiving system shouldn't have to understand every instrument to act on the result.

The fix is a **two-layer model**:

| Layer | What it holds | Vocabulary | Fidelity |
|---|---|---|---|
| **Capture** (instrument) | Every question and answer | Instrument LOINC, SNOMED Yes/No, local item codes | High |
| **Concept** (harmonized) | "Positive screen, this severity tier, this date" | One common risk-tier ValueSet + generic LOINC + interpretation flag | Lower, but universally consumable |

The concept layer is **derived from** the capture layer and linked back to it — it never replaces it. High fidelity is preserved for audit and re-scoring; the lower-fidelity summary is what crosses organizational boundaries.

## 2. The precedent: HL7 Gravity Project

Gravity (an HL7 FHIR Accelerator) solved exactly this for **Social Determinants of Health**: it reviewed ~135 screening instruments and harmonized them to a common set of SNOMED CT findings, ICD-10 Z-codes, and interpretation flags, so "food insecurity present" is one coded concept no matter which of 15 screeners produced it. SPiER is doing the same move for suicide risk.

Key Gravity decisions worth copying:

- **LOINC for capture, common concepts on top.** Gravity keeps instrument questions LOINC-coded and *adds* the concept layer via profile bindings and derived resources — it does not discard the instrument codes.
- **StructureMap over ConceptMap for inference.** Because a concept can derive from "a Q-A pair *or pairs*," Gravity uses FHIR **StructureMap** (FHIR Mapping Language) to generate Observations/Conditions from a QuestionnaireResponse, and recommends the **instrument steward ship the StructureMap** so every implementer derives the concept identically.
- **Required binding on `category`, preferred on codes.** Harmonization is enforced at the domain/interpretation level; instrument-level codes stay flexible.
- **`interpretation = POS/NEG`** (v3 ObservationInterpretation) as the universal actionable flag.
- **VSAC grouping value sets** — a parent grouping set aggregates per-instrument source value sets, published to NLM's Value Set Authority Center for national discoverability.
- **Unconfirmed by design.** A concept derived from an instrument "should be verified by a care team member" — it flags a need, it does not confirm a diagnosis.

References:
- [SDOH Clinical Care IG — Gravity Background](https://www.hl7.org/fhir/us/sdoh-clinicalcare/gravity_background.html)
- [Assessment Instrument Support](https://hl7.org/fhir/us/sdoh-clinicalcare/assessment_instrument_support.html)
- [Gravity AHC/HRSN Documentation Resource (PDF)](https://confluence.hl7.org/download/attachments/193661411/Gravity_AHC_HRSN_Documentation_Resource_V1.1.pdf)

## 3. The mechanics: HL7 SDC extraction

The transformation from a completed instrument to derived resources is standardized by HL7 **Structured Data Capture (SDC)**, which SPiER already depends on (`sushi-config.yaml` → SDC 3.0.0). Relevant mechanisms:

- **Observation-based extraction** — `sdc-questionnaire-observationExtract` (boolean) marks items that become *literal* Observations. SPiER uses this today; `web/scripts/check-observation-extract.mjs` guards it against drift.
- **StructureMap-based extraction** — `sdc-questionnaire-targetStructureMap` references a StructureMap for *computed/inferred* resources. This is the home for the harmonized concept.

The line that matters: **literal extractions** (one item → one Observation) use `observationExtract`; **derived concepts** (a tier inferred from several items) use a StructureMap and must **not** be declared with `observationExtract`. SPiER already follows this — the ASQ composite disposition and C-SSRS risk level are computed and deliberately excluded from the extract contract.

Reference: [SDC — Form Data Extraction](https://hl7.org/fhir/uv/sdc/extraction.html)

## 4. Applying it to SPiER

SPiER is partway there. The ASQ mapper (`web/src/lib/observationMappers/asq.ts`) already emits a result Observation on the **generic** LOINC `93374-7` "Suicide risk level" with a v3 `interpretation` flag — that is the correct universal anchor. What's missing:

1. **One common risk-tier vocabulary.** Today the ASQ uses `asq-screening-result` (`negative` / `non-acute-positive` / `acute-positive`) and the alert layer uses `none` / `moderate` / `acute` — two instrument-local sets for one concept. Define a single canonical set (e.g. `no-risk | low | moderate | high | imminent`) and map every instrument into it.
2. **Portable FHIR maps.** The mapping logic lives only in TypeScript. Each instrument needs a StructureMap (or ConceptMap) so the derivation is interoperable and balloteable — the TS stays the runtime, the FHIR map is the shareable contract.
3. **Required `category` binding** to a suicide-risk domain ValueSet, so a partner can query "suicide-risk screens" across instruments.
4. **`derivedFrom` provenance** on every concept Observation, back to the QuestionnaireResponse / source Observations.
5. **Fidelity honesty** — coarse instruments map to the widest defensible tier, recorded with an honest equivalence (`narrower` or `relatedto`, not `wider`) in the per-instrument ConceptMap; never fabricated precision.
6. **VSAC publication** of the tier ValueSet + a grouping ValueSet.

## 5. The HL7 contribution path

The harmonization assets are also SPiER's most contributable standards artifact. The pragmatic sequence:

1. **Build it in-IG now** (CodeSystem + ValueSet + ConceptMap/StructureMap + derived-Observation profile) using the existing FSH tooling — this is directly in scope for the IG.
2. **Prove it in the Big Sky Care Connect pilot** — real cross-EHR, cross-instrument consumption is the evidence base HL7 values.
3. **Contribute** — either fold the crosswalks into an existing Work Group (Behavioral Health / Patient Care) or, if there's appetite, seed a suicide-risk harmonization effort. There is no mature balloted equivalent today — that gap is SPiER's opportunity, but full IG ownership is a stage-2 ambition contingent on pilot traction, not a day-one commitment.

## 6. Conformance checklist (summary)

Use the `concept-harmonization` skill for the full version. In brief, a harmonization asset is conformant when:

- [ ] Exactly one common risk-tier CodeSystem/ValueSet exists; every instrument maps into it.
- [ ] The concept value rides on a generic LOINC (`93374-7`), not an instrument code.
- [ ] The response→concept mapping exists as a FHIR StructureMap (multi-item) or ConceptMap (simple lookup), agreeing with the TS mapper.
- [ ] The derived Observation carries `code`, `value` (tier), `interpretation`, `category` (required binding), `derivedFrom`, `status`, `subject`, `effective`.
- [ ] Coarse instruments use an honest equivalence (`narrower`/`relatedto`); no fabricated precision.
- [ ] Every crosswalk row is cited to validated scoring and cleared by a clinical SME.
- [ ] Derived concepts are excluded from the `observationExtract` contract and its anti-drift `EXPECTED`.
- [ ] Tier + grouping ValueSets are planned for VSAC publication.
- [ ] `check:crosswalk` passes — every ConceptMap target is a real tier, every disposition is mapped and present in its CodeSystem + runtime mapper, and every tier code in a draft StructureMap is valid.

**Two crosswalk shapes, by instrument output:** instruments with a **coded disposition** (ASQ, C-SSRS) use a **ConceptMap** (code→code); instruments emitting a **score/ordinal** (PHQ-9 Item 9, SBQ-R total) use a **StructureMap with numeric thresholds** aligned to the runtime mapper's bands. A ConceptMap can't express score→tier, so the shape follows the instrument. `check:crosswalk` keeps both honest.

---
*Created: 2026-06-05*
