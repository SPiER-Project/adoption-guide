# ASQ — Ask Suicide-Screening Questions

## Overview

The ASQ is a brief, validated suicide risk screening tool developed by the National Institute of Mental Health (NIMH). It consists of 4 screening questions plus an acuity question, and can be administered in approximately 20 seconds.

**Source:** [NIMH ASQ Toolkit](https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials)

**Validated populations:** Youth (age 8+) and adults

**Settings:** Emergency Department, Inpatient Medical/Surgical, Outpatient/Primary Care, Telehealth

## Pilot status — ⚠️ READ THIS FIRST

This Questionnaire is `status: draft` / `experimental: true`. It has been updated for pilot readiness (coded items, SNOMED Yes/No answer bindings, local CodeSystem resources, `useContext`) but several bindings have **not yet been verified** and MUST be reconciled before the resource is promoted to `active`. The full open-items checklist lives in the SPiER app under **Pathway → ASQ → Pilot Plan**.

### Code verification status

Every coding in the Questionnaire that has not been verified against an authoritative source carries the SPiER extension:

```json
"extension": [
  { "url": "http://spier.org/StructureDefinition/coding-verification-status",
    "valueCode": "unverified" }
]
```

This is a machine-readable marker. When every coding reads `verified`, the Questionnaire can flip to `status: active`.

### Known LOINC code conflict to reconcile

The candidate LOINC codes on q1, q3, q4, q5 in this Questionnaire (`93246-7`, `93247-5`, `93248-3`, `93249-1`) were drawn from a prior discussion and appear to overlap with **C-SSRS** LOINC codes (see `web/src/data/catalog/dataElements.ts` — these same codes are assigned there to C-SSRS levels 1–5). Separately, the SPiER data dictionary and observation mapper use a **different** ASQ LOINC series (`93267-4`, `93266-6`, `93265-8`, `93264-1`, `93263-3`) for the same five questions.

These two code sets cannot both be right. Verification against the LOINC 93373-9 panel definition is the first task in the pilot plan. Until that reconciliation happens, treat **every** LOINC coding on this Questionnaire as unverified.

### Q2 — potentially no standard binding

Q2 ("have you felt that you or your family would be better off if you were dead") is marked with verification status `no-standard-binding` and has no `code` entry. If the LOINC review confirms no binding exists, a LOINC submission may be warranted as a pilot deliverable.

## Screening Questions

1. "In the past few weeks, have you wished you were dead?" (Yes/No — SNOMED-coded)
2. "In the past few weeks, have you felt that you or your family would be better off if you were dead?" (Yes/No — SNOMED-coded)
3. "In the past week, have you been having thoughts about killing yourself?" (Yes/No — SNOMED-coded)
4. "Have you ever tried to kill yourself?" (Yes/No — SNOMED-coded)
   - If yes: "When was the most recent attempt?" (Within last 12 months / Over 1 year ago)

**Acuity question** (asked only if Yes to any of Q1-Q4):

5. "Are you having thoughts of killing yourself right now?" (Yes/No — SNOMED-coded)
   - If yes: "Describe briefly" (free text)

Yes/No answers bind to SNOMED CT qualifier values `373066001` (Yes) and `373067005` (No). This means Yes/No answers survive as coded values through QuestionnaireResponse and into downstream Observations, without depending on a transformation layer to add a binding.

The Questionnaire currently uses inline `answerOption` with these SNOMED codings. A matching `ValueSet` resource (`fhir/valuesets/yes-no.json`) is published alongside for systems that can resolve `answerValueSet` against a terminology server; the inline option is there because not every renderer ships with value-set resolution.

## Risk Stratification

| Result | Criteria | Next Steps |
|--------|----------|------------|
| **Negative Screen** | No to all Q1-Q4 | No intervention required. Clinical judgment can override. |
| **Non-Acute Positive** | Yes to any Q1-Q4, No to Q5 | Brief suicide safety assessment needed. Full mental health eval if indicated. |
| **Acute Positive** | Yes to any Q1-Q4, Yes to Q5 | STAT/urgent safety evaluation. Patient cannot leave until evaluated. Keep in sight. Remove dangerous objects. |

### Conditional-item semantics — "asked vs. not asked"

Q5 and q4-recent-attempt are `enableWhen`-gated. When the gate condition is not met, the conditional item should be **absent** from the QuestionnaireResponse rather than present with a negative or empty value. Receiving systems must treat absence as "not asked" — a missing Q5 in a screening means Q1–Q4 were all No (the acuity branch was never triggered), **not** that the clinician forgot to ask.

Downstream Observation transformation must preserve this semantics: absent items should not become null Observations. Only materialize an Observation when the QuestionnaireResponse actually contains an answer.

### Refusal Handling
- **Youth:** Refusal = non-acute positive screen
- **Adults:** Refusal is NOT a positive screen unless other safety concerns exist

Refusal is currently captured via the `patient-refused` boolean plus a `patient-age-group` choice. Whether `patient-age-group` should be derived from `Patient.birthDate` rather than asked is an open policy item — see pilot plan, Priority 3.

## FHIR Assets

| Asset | Path | Description |
|-------|------|-------------|
| Questionnaire | `fhir/questionnaires/questionnaire.json` | FHIR R4 Questionnaire with enableWhen conditional logic, LOINC panel + item codes (unverified), SNOMED-bound Yes/No answers |
| ValueSet | `fhir/valuesets/yes-no.json` | SNOMED-bound Yes/No answer value set |
| CodeSystem | `fhir/codesystems/asq-attempt-recency.json` | Local codes for recency of prior attempt |
| CodeSystem | `fhir/codesystems/asq-screening-result.json` | Local codes for three-tier result stratification |
| CodeSystem | `fhir/codesystems/asq-age-group.json` | Local codes for refusal-interpretation age group |

Local code system URLs use the `http://spier.org/CodeSystem/...` namespace. Where a LOINC or SNOMED binding is preferred and available, the open-items list calls that out — the local codes are scaffolding for the pilot, not a final binding.

## Clinical Pathway Integration

The ASQ is a **Flag Risk** stage tool in the SPiER pathway:

```
Flag Risk (ASQ) → Clarify Risk (C-SSRS/BSSA) → Set Risk Status → Document Safety Actions → Coordinate Handoffs → Track Follow-Up
```

A positive ASQ screen (acute or non-acute) should trigger a more comprehensive Clarify Risk instrument (C-SSRS Full, BSSA, or CAMS SSF-5) or direct safety planning depending on acuity.

## USCDI+ BH alignment

This Questionnaire is intended to align with the ONC/SAMHSA Behavioral Health IT (BHIT) Initiative and its downstream standards work:

- **USCDI+ Behavioral Health** dataset — ASQ result and individual-item observations should be consumable by any EHR that advertises USCDI+ BH support.
- **HL7 FHIR Behavioral Health Profiles Implementation Guide** (in development by the BHIT community) — where profiles exist, the Questionnaire and its downstream Observations should conform.
- **LOINC panel 93373-9** — the correct root `Questionnaire.code` per NIMH/LOINC coordination.

Practical implication for pilot: this artifact is not a local SPiER invention — it is a FHIR representation of a federally-coordinated screening standard, and its coded bindings are the substrate that lets its outputs be received, filtered, and acted on across EHRs.

## Copyright

The ASQ is a **public domain** instrument. No permission is required for use, reproduction, or translation.
