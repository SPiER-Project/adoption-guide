# CRP — Crisis Response Plan (TL-015)

## Overview

The Crisis Response Plan (CRP) is a brief, collaboratively-authored suicide-prevention
intervention (Bryan & Rudd) — a personalized, patient-held plan (often a handwritten card)
the patient uses to navigate a suicidal crisis. Like the Stanley-Brown Safety Plan, SPiER
encodes the CRP as a **CarePlan** (one activity per section), not a scored Observation.

**Authors:** Craig J. Bryan & M. David Rudd (see *Brief Cognitive-Behavioral Therapy for
Suicide Prevention*).

**SPiER tool ID / stage:** TL-015, `document-safety-actions` (Stage 4 — Document Safety
Actions). An alternative/complement to the Stanley-Brown Safety Plan (TL-007).

## Five CRP sections → CarePlan activities

| Section | Reused LOINC (Stanley-Brown panel) |
|---|---|
| 1. Warning signs | 76689-1 |
| 2. Coping strategies (self-management) | 76690-9 |
| 3. Reasons for living | 81344-4 |
| 4. Social support | 76692-5 |
| 5. Professional & crisis support (988, Crisis Text Line, ED) | 76693-3 |

There is no validated CRP-specific LOINC panel; codes are reused from the Stanley-Brown
safety-plan panel where the concepts overlap, and each activity also names the section in
`detail.code.text`.

## FHIR Assets

| Asset | Path | Description |
|---|---|---|
| Questionnaire | `crp-questionnaire.json` | 5 repeating free-text sections + intro |
| FSH source | `../../ig/input/fsh/crp.fsh` | `SPiERCrisisResponsePlan` CarePlan profile, `AuthorCrisisResponsePlan` ActivityDefinition, example CarePlan |
| CarePlan mapper | `../../web/src/lib/carePlanMappers/crp.ts` | QR → 5-activity CarePlan |
| Licensing memo | `licensing/MEMO.md` | Bryan & Rudd; used under the license held by the SPiER project |

## Licensing

The CRP is a published clinical technique (Bryan & Rudd). Per maintainer confirmation
(2026-07-15), SPiER holds the necessary license/permission to encode and distribute it;
SPiER attributes the CRP to Bryan & Rudd. See `licensing/MEMO.md`.

## Clinical Pathway Integration

```
… → Clarify Risk → Define the Risk Picture → Document Safety Actions (Stanley-Brown OR Crisis Response Plan) → Coordinate Handoffs → …
```

⚠️ **DEMO ONLY** — the app generates the CarePlan client-side; no patient data is persisted.
