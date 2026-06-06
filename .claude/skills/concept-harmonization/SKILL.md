---
name: concept-harmonization
description: Enforce SPiER's cross-instrument *concept layer* — the instrument-agnostic, actionable representation that disparate suicide-risk tools (ASQ, C-SSRS, PHQ-9 Item 9, SBQ-R, CAMS) all map into. Use this skill whenever the work is about translating *between* instruments rather than coding a single one: building or reviewing a common suicide-risk-tier CodeSystem/ValueSet, a ConceptMap or StructureMap that derives a shared concept from an instrument response, a "derived" / "interpretation" Observation that sits downstream of an instrument-specific result, or any request for a "translation layer," "crosswalk," "common code set," "harmonization," or "map tool A to tool B." Trigger when a partner can't consume an instrument's native codes (e.g. ASQ has no LOINC item codes but produces data comparable to C-SSRS) and needs a universally consumable summary. This is the cross-instrument counterpart to `assessment-to-ig` (authoring one instrument) and `fhir-questionnaire-quality` (reviewing one Questionnaire) — use those for instrument-scoped work, this one for the layer that spans instruments.
---

# Concept-Layer Harmonization

SPiER already does the **instrument-capture layer** well: every Questionnaire carries LOINC/SNOMED codes, the `sdc-questionnaire-observationExtract` contract pins which items become discrete Observations, and `assessment-to-ig` / `fhir-questionnaire-quality` keep that layer rigorous. This skill governs the **other half** — the layer a receiving system actually acts on without knowing *which* tool produced the data.

The driving problem: partners in a network (Big Sky Care Connect, an HIE, an outpatient EHR) do not all run the same instruments. One site screens with the ASQ, another with the Columbia (C-SSRS), another with PHQ-9 Item 9. Each has its own — sometimes absent — instrument codes. What the network needs to share is not "ASQ question 4 = yes," it's **"this person screened positive for suicide risk, at this severity tier, on this date."** That common, lower-fidelity, instrument-agnostic concept is what this skill builds and protects.

This is the same pattern HL7's **Gravity Project** used to harmonize ~135 SDOH screening instruments to a common set of SNOMED CT findings + interpretation flags, and it rides on **HL7 SDC** extraction mechanics. Treat those two IGs as the normative reference (see `docs/best-practices/concept-harmonization.md` for citations and the deeper rationale).

## The two-layer model (never collapse them)

| Layer | Vocabulary | Fidelity | Who consumes it |
|---|---|---|---|
| **Capture** (instrument) | Instrument LOINC items, SNOMED Yes/No, local item codes (`asq-item`) | High — every question/answer | Authoring system, audit, re-scoring |
| **Concept** (this skill) | One common risk-tier ValueSet, generic LOINC `93374-7` "Suicide risk level", `interpretation` POS/NEG | Lower — the actionable summary | Every downstream/partner system |

The capture layer is preserved, not replaced. The concept layer is **derived from** it and linked back via `derivedFrom`. If you ever find yourself overwriting instrument-specific data with the common concept, stop — you are losing fidelity that the capture layer is supposed to keep.

## When this skill applies

- Defining or reviewing the common `suicide-risk-tier` CodeSystem and ValueSet
- Authoring a ConceptMap or StructureMap that maps an instrument's result to the common tier
- Reviewing a "derived" / "summary" / "interpretation" Observation that represents the harmonized concept
- A partner says they can't consume an instrument's native output and needs a normalized field
- Deciding how a *new* instrument's result tiers crosswalk to the existing common tiers
- Preparing the harmonization assets for VSAC publication or an HL7 contribution

For coding a single instrument's Questionnaire/Observations, use `assessment-to-ig` (authoring) or `fhir-questionnaire-quality` (review) instead. This skill picks up where those leave off.

## Conformance checklist

Work top to bottom; the earlier items are foundational.

### 1. Exactly one common concept vocabulary

There must be a **single** instrument-agnostic risk-tier CodeSystem (e.g. `http://spier.org/CodeSystem/suicide-risk-tier`) and a ValueSet binding to it. Every instrument maps into *this* set — not its own parallel one.

**Watch for the failure SPiER has today:** the ASQ mapper emits `asq-screening-result` codes (`negative` / `non-acute-positive` / `acute-positive`), and the `riskAlert` layer uses *yet another* set (`none` / `moderate` / `acute`). Those are two instrument-local vocabularies for the same concept. Harmonization means defining one tier set (e.g. `no-risk | low | moderate | high | imminent`) and mapping both ASQ dispositions and every other instrument's result *into* it.

- The common tier value should ride on a **generic LOINC code**, not an instrument code. SPiER already uses `93374-7` ("Suicide risk level") on the ASQ result Observation — that is the correct universal anchor; reuse it across instruments rather than minting instrument-specific result codes.
- Where a SNOMED CT clinical finding expresses the concept (e.g. *suicidal ideation*, *at risk for suicide*), prefer it for the `value` or a companion `Condition`, but **verify the SCTID** in the SNOMED browser before committing — never assert an unverified code (same discipline as `assessment-to-ig`).

### 2. The mapping must exist as a portable FHIR resource, not only as code

SPiER's per-instrument logic lives in TypeScript (`web/src/lib/observationMappers/*.ts`). That is fine as the *runtime*, but a TS function is not interoperable — a partner can't consume it. For each instrument, the response→concept mapping must **also** exist as a publishable FHIR artifact:

- **ConceptMap** when it's a simple answer-code → tier lookup (one source code → one tier) — e.g. ASQ disposition (`crosswalk-asq.fsh`) or C-SSRS risk level (`crosswalk-cssrs.fsh`).
- **StructureMap** (FHIR Mapping Language) when the concept is inferred from *multiple* items, or when the instrument emits a **score/ordinal** rather than a coded disposition (PHQ-9 Item 9 = 0–3; SBQ-R total = 3–18). A ConceptMap maps code→code and cannot express score→tier, so these are StructureMap-only (`ig/drafts/*.fml`). Keep the thresholds aligned with the runtime mapper's own bands so the FHIR map and the TS mapper can't diverge.

Gravity's guidance is that the **instrument steward ships the StructureMap** so every implementer derives the same concept. SPiER is the de-facto steward for its instruments — own that. The TS mapper and the FHIR map must agree; the `check:crosswalk` CI guard (`web/scripts/check-concept-crosswalk.mjs`, run after `sushi`) enforces it: every ConceptMap target is a real tier code, every disposition is mapped (completeness) and exists in its source CodeSystem and runtime mapper, and every tier code in a draft StructureMap is valid — the concept-layer analogue of `check-observation-extract.mjs`.

### 3. Required fields on the derived concept Observation

The harmonized Observation is the deliverable. It SHALL carry:

- **`code`** — the generic concept LOINC (`93374-7`), *not* an instrument item code.
- **`value[x]`** — coded to the common risk-tier ValueSet.
- **`interpretation`** — a universal flag. Gravity uses `POS`/`NEG` from v3 `ObservationInterpretation`; SPiER currently uses `A`/`N`. Pick one and apply it everywhere — `POS`/`NEG` is the more semantically precise choice for a screen and is what an SDOH-aligned consumer expects. Flag the current `A`/`N` usage as a harmonization decision to settle.
- **`category`** — bind (required strength) to a suicide-risk domain ValueSet so a consumer can filter "show me suicide-risk screens" regardless of instrument. This is Gravity's `category` pattern.
- **`derivedFrom`** — references the source QuestionnaireResponse and/or the instrument-specific Observations. This is the provenance chain; it is mandatory, not optional.
- **`status`**, **`subject`**, **`effective`** — populated from the source response, never invented.

### 4. Be honest about fidelity — never fabricate precision

A lower-fidelity instrument must not be mapped as if it carried more information than it does. The ASQ can assert "positive / acute vs non-acute"; it cannot produce a C-SSRS sub-severity. When an instrument's result is coarser than the tier set, map it to the **widest defensible tier** and leave finer distinctions unpopulated — do not guess.

- In the ConceptMap, mark the equivalence honestly (`equivalent`, `narrower`, `wider`, `relatedto`, `inexact`). When the instrument's disposition is broader than the single tier you assign it, the target is `narrower` than the source; when the correspondence is only approximate, use `relatedto`/`inexact`. Record the lossiness so consumers don't over-read precision the instrument can't support.
- The derived concept is **screening-level and unconfirmed** (Gravity's explicit nuance: documentation based on an instrument "should be verified by a care team member"). Say so in the artifact — the concept Observation flags a need for follow-up, it does not confirm a diagnosis.

### 5. Crosswalks need cited rationale and clinical sign-off

Every "instrument result X → common tier Y" assertion is a clinical equivalence claim. It must be:

- **Traceable to the instrument's validated scoring** — cite the cut-point / disposition rule from the instrument's own documentation (e.g. ASQ "acute" = any of Q1–Q4 positive *and* Q5 positive). No invented equivalences.
- **Reviewed by a clinical SME** before the mapping is treated as authoritative. This skill produces the structure and the documented rationale; it does not unilaterally decide clinical equivalence (see *What this skill does not do*).
- **Documented** in the instrument README and the ConceptMap/StructureMap `.text` or comments.

### 6. Keep derived concepts out of the observationExtract contract

The `sdc-questionnaire-observationExtract` extension is for **literal** item→Observation extractions, and `check-observation-extract.mjs` enforces that declared codes match the mapper's literal emissions. The harmonized concept is a **computed/derived** Observation — like the ASQ composite disposition and C-SSRS risk level today — and must **not** be declared with `observationExtract`, nor added to the script's `EXPECTED` set. It lives in the mapper (and the StructureMap), consistent with the existing contract's documented design.

### 7. Publish for discoverability

- Define the risk-tier ValueSet and a **grouping ValueSet** (parent → per-instrument source value sets), mirroring Gravity's VSAC hierarchy.
- For national discoverability, plan publication to **VSAC** (NLM) — name it as a follow-up even if not done immediately.
- Bindings: **required** on `category` and on the tier `value`; **preferred/extensible** on instrument-level source codes (Gravity's strength split — harmonize the concept, stay flexible on capture).

## Common failure modes to watch for

- **Parallel result vocabularies:** each instrument invents its own disposition codes (the current ASQ `asq-screening-result` vs `riskAlert` split) instead of mapping into one shared tier set.
- **TS-only mapping:** the response→concept logic exists only in `observationMappers/*.ts`, so it can't be shared, validated, or balloted. No FHIR StructureMap/ConceptMap counterpart.
- **Instrument code on the concept Observation:** the harmonized Observation carries an instrument item code instead of the generic `93374-7`, defeating cross-instrument query.
- **Lost provenance:** the derived concept has no `derivedFrom` back to the QuestionnaireResponse / source Observations.
- **Fabricated precision:** a coarse instrument mapped to a fine tier without a `wider` equivalence flag, implying fidelity it doesn't have.
- **Uncited equivalence:** a crosswalk that isn't traceable to the instrument's validated cut-points, or hasn't had clinical sign-off.
- **Confirmation overreach:** the concept Observation presented as a confirmed finding rather than an unconfirmed, follow-up-warranting screen.
- **Extract-contract pollution:** a derived concept Observation declared via `observationExtract` and tripping (or worse, silently added to) the anti-drift check.

## Output format

When reviewing existing harmonization assets:

1. **What's working** — name the correct decisions (e.g. "reuses generic LOINC 93374-7", "derivedFrom present").
2. **Priority 1** — anything breaking cross-instrument consumability: parallel vocabularies, instrument code on the concept Observation, missing FHIR map.
3. **Priority 2** — fidelity honesty, equivalence flags, category binding, provenance.
4. **Priority 3** — publication/VSAC, grouping value sets, documentation polish.
5. **Open questions / sign-off needed** — clinical equivalence claims requiring SME review; SNOMED SCTIDs to verify; the `A`/`N` vs `POS`/`NEG` decision.

When authoring a new harmonization (instrument → common tier):

1. **Confirm the common tier set** — restate the canonical risk-tier ValueSet; if one doesn't exist yet, propose it first and get it agreed before mapping anything into it.
2. **Document the crosswalk** — instrument result/disposition → tier, each row cited to the instrument's validated scoring and marked `equivalent`/`wider`/`narrower`/`relatedto`. Flag rows needing clinical sign-off.
3. **File plan** — the CodeSystem/ValueSet FSH, the ConceptMap or StructureMap, the derived-Observation profile, and any README/IG-page updates.
4. **Author artifacts** — produce them; verify `cd ig && sushi .` compiles clean.
5. **Reconcile with the runtime** — confirm the FHIR map agrees with the TS mapper; note any drift to fix.
6. **Hand-off** — files created, clinical sign-offs still required, SCTIDs to verify, VSAC publication as a follow-up, and a suggested tracking issue.

## What this skill does *not* do

- **Decide clinical equivalence.** Whether an ASQ "non-acute positive" equals a C-SSRS tier is a clinical judgment. This skill structures, cites, and documents the crosswalk and routes it for SME sign-off; it does not rule on the medicine.
- **Mint or assert unverified codes.** SNOMED SCTIDs and any new LOINC are flagged for verification, never invented (same rule as `assessment-to-ig`).
- **Re-author instrument capture artifacts.** Questionnaires, item codes, and literal extractions belong to the other two skills.
- **Run VSAC submission or the HL7 balloting process.** It prepares publication-ready assets and names the path; it does not execute the standards-body workflow.
