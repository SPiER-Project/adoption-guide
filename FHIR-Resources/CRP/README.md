# CRP — Crisis Response Plan

## Provenance

A brief, collaboratively authored suicide-prevention intervention: a
personalized, patient-held plan — classically a handwritten card — that the
patient uses to navigate a suicidal crisis. Like the Stanley-Brown Safety Plan,
SPiER encodes it as a **CarePlan** with one activity per section, not as a
scored Observation, because the artifact *is* the plan.

| | |
|---|---|
| **Authors** | Craig J. Bryan and M. David Rudd — see *Brief Cognitive-Behavioral Therapy for Suicide Prevention* |
| **Licensing** | A published clinical technique. Per maintainer confirmation on 2026-07-15, SPiER holds the license or permission needed to encode and distribute it; attribute the CRP to Bryan & Rudd. The status is on the `AuthorCrisisResponsePlan` ActivityDefinition; the evidence is in [`licensing/MEMO.md`](licensing/MEMO.md). |

## What's in this folder

| File | What it is |
|---|---|
| `crp-questionnaire.json` | The FHIR R4 Questionnaire — an intro plus the five repeating free-text sections |
| `licensing/MEMO.md` | The licensing audit |

Everything else is in [`ig/input/fsh/crp.fsh`](../../ig/input/fsh/crp.fsh): the
`SPiERCrisisResponsePlan` CarePlan profile, which declares all five sections as
**named slices** on `activity.detail.code` — so the section codes are readable
off the profile rather than restated here — plus the
`AuthorCrisisResponsePlan` ActivityDefinition with its stage membership and
licensing, and the example CarePlan. The runtime mapper is
`packages/core/src/lib/carePlanMappers/crp.ts`.

Section identity comes from the SPiER-local
`http://thespierproject.org/fhir/CodeSystem/safety-plan-section` CodeSystem,
**shared with the Stanley-Brown Safety Plan** — the CRP's five sections are a
subset of Stanley-Brown's seven, which is what makes the two templates
interchangeable to a consumer. There is no CRP-specific LOINC panel, and LOINC
publishes nothing at safety-plan-section granularity for either template;
[`ig/input/fsh/safety-plan-section.fsh`](../../ig/input/fsh/safety-plan-section.fsh)
records the search performed against LOINC 2.82.

> ### ⚠️ Retracted: the former "Reused LOINC (Stanley-Brown panel)" column
>
> Until 2026-08-05 this file gave LOINC codes `76689-1`, `76690-9`, `81344-4`,
> `76692-5` and `76693-3` for the five sections, described as reused from a
> verified Stanley-Brown panel. **No such panel exists.** Four of those codes
> are not in LOINC at all, and `81344-4` — used here for "Reasons for living" —
> means *"Healthcare agent authority to inspect and disclose mental and physical
> health information Narrative - Reported"*.
>
> They reached this file by being copied from
> `FHIR-Resources/Stanley-Brown/README.md`'s audit table, which asserted a
> verification that never took place. See
> [#220](https://github.com/SPiER-Project/adoption-guide/issues/220). Do not
> reintroduce a section-level LOINC column in either template's README without
> a live terminology check.

⚠️ **DEMO ONLY** — the app generates the CarePlan client-side; no patient data
is persisted.
