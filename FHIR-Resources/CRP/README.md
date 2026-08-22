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

| Section | Section code (`safety-plan-section`) |
|---|---|
| 1. Warning signs | `warning-signs` |
| 2. Coping strategies (self-management) | `internal-coping` |
| 3. Reasons for living | `reason-for-living` |
| 4. Social support | `crisis-support` |
| 5. Professional & crisis support (988, Crisis Text Line, ED) | `professional-support` |

Section identity comes from the **SPiER-local** CodeSystem
`http://thespierproject.org/fhir/CodeSystem/safety-plan-section`, shared with the Stanley-Brown Safety
Plan — the CRP's five sections are a subset of Stanley-Brown's seven. Each activity also
names the section in `detail.code.text`, and at document level the CarePlan carries LOINC
`87626-8` "Suicide prevention note" in `CarePlan.category`.

There is no CRP-specific LOINC panel, and LOINC publishes nothing at safety-plan-section
granularity for either template — see
[`ig/input/fsh/safety-plan-section.fsh`](../../ig/input/fsh/safety-plan-section.fsh) for the
search performed against LOINC 2.82.

> ### ⚠️ Retracted: the former "Reused LOINC (Stanley-Brown panel)" column
>
> Until 2026-08-05 this table gave LOINC codes `76689-1`, `76690-9`, `81344-4`,
> `76692-5` and `76693-3` for these five sections, described as reused from a
> verified Stanley-Brown panel. **No such panel exists.** Four of those codes are
> not in LOINC at all, and `81344-4` — used here for "Reasons for living" — means
> "Healthcare agent authority to inspect and disclose mental and physical health
> information Narrative - Reported".
>
> The codes reached this file by being copied from
> `FHIR-Resources/Stanley-Brown/README.md`'s audit table, which asserted a
> verification that never took place. See issue #220.

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
