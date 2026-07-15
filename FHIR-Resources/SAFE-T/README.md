# SAFE-T — Suicide Assessment Five-Step Evaluation and Triage

## Overview

SAFE-T is a **structured clinical formulation** — not a scored survey — published by
SAMHSA. It guides a clinician through five steps to reach a documented suicide-risk
**level** with rationale and disposition. Because the risk level is a clinical-judgment
determination that maps onto the common risk tiers, SAFE-T **lands directly on the SPiER
concept layer**: its derived Observation's value binds to the shared suicide-risk-tier
ValueSet, with no per-instrument crosswalk.

**Source:** [SAMHSA SAFE-T pocket card (PEP24-01-036)](https://www.samhsa.gov/resource/dbhis/safe-t-pocket-card-suicide-assessment-five-step-evaluation-triage-safe-t-clinicians).

**SPiER tool ID / stage:** TL-006, `define-risk-picture` (Stage 3 — Define the Risk Picture).

## Pilot status — ⚠️ READ THIS FIRST

This Questionnaire is `status: draft` / `experimental: true`. The risk-factor and
protective-factor checklists use SPiER-local CodeSystems marked `no-standard-binding`.
The one **verified** binding is on the risk-level item, which carries LOINC `93374-7`
("Suicide risk level"); its **value** is a code from the shared
`spier-suicide-risk-tier` CodeSystem (`low` / `moderate` / `high`).

## The five steps

1. **Identify risk factors** — note those that can be modified to reduce risk (checklist).
2. **Identify protective factors** — note those that can be enhanced (checklist). *Even if present, protective factors may not counteract significant acute risk.*
3. **Conduct suicide inquiry** — ideation (frequency, intensity, duration), plan (timing, location, lethality, availability, preparatory acts), behaviors (past/aborted attempts, rehearsals vs. NSSI), and intent (expectation of carrying out; belief in lethality; ambivalence).
4. **Determine risk level & intervention** — clinical judgment after steps 1–3. Develop a safety plan for all individuals at low, moderate, and high risk.
5. **Document** — risk level and rationale, treatment plan, counseling on access to lethal means, and follow-up.

## Risk level → tier / intervention (from the SAMHSA card)

| Risk level | Suicidality | Possible intervention |
|---|---|---|
| **Low** | Thoughts of death; no plan, intent, or behavior | Outpatient referral with a warm handoff; symptom reduction; 988 Lifeline |
| **Moderate** | Suicidal ideation with plan, but no intent or behavior | Admission may be necessary; give emergency/crisis numbers incl. 988 |
| **High** | Ideation with plan, method, and intent to carry out | Emergency psychiatric treatment in a secure setting may be necessary |

The risk level maps 1:1 onto the shared `spier-suicide-risk-tier` codes (`low` / `moderate`
/ `high`) — **no crosswalk needed.** The SPiER SAFE-T result profile binds its value to
`spier-suicide-risk-tier-vs`.

## Override / rationale (SSC-023/024)

SAFE-T's risk level is a clinical-judgment call. The Questionnaire captures a
`clinical-judgment-override` flag and an `override-rationale` free-text item so a clinician
can document when their judgment overrides what the risk/protective factors and suicide
inquiry would otherwise suggest — supporting the SSC override/rationale questions. The
mapper folds the rationale and override reason into the result Observation's `note`.

## Derived Observation

The observation mapper (`web/src/lib/observationMappers/safet.ts`) emits a single derived
Observation:

| Observation code | System | Value | From item |
|---|---|---|---|
| `93374-7` "Suicide risk level" | LOINC | `spier-suicide-risk-tier` code (low/moderate/high) | `risk-level` |

Only the risk-level item declares `observationExtract`; the risk/protective-factor
checklists and the inquiry free-text are recorded in the QuestionnaireResponse for context.
The extract code MUST stay in sync with `web/scripts/check-observation-extract.mjs`
(`EXPECTED`).

## FHIR Assets

| Asset | Path | Description |
|---|---|---|
| Questionnaire | `safet-questionnaire.json` | FHIR R4 Questionnaire; 5 steps, `observationExtract` on the risk-level, value bound to the shared tier |
| FSH source | `../../ig/input/fsh/safet.fsh` | ActivityDefinition, factor CodeSystems/ValueSets, SPiERSAFETRiskLevel profile, example instances |
| Licensing memo | `licensing/MEMO.md` | Public-resource (SAMHSA) licensing audit |

## Clinical Pathway Integration

SAFE-T is a **Define the Risk Picture** stage tool — it documents the current risk status
and the clinical reasoning that guides next steps:

```
Identify Possible Risk → Clarify Risk → Define the Risk Picture (SAFE-T / CAMS worksheet) → Document Safety Actions → …
```

## Copyright

The SAFE-T pocket card is a public resource of SAMHSA (developed with Screening for Mental
Health, Inc. and Douglas Jacobs, MD). Distributed free; no permission or fee is required
for use. See `licensing/MEMO.md`.
