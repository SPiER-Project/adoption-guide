# BSSA — Brief Suicide Safety Assessment (NIMH)

## Overview

The Brief Suicide Safety Assessment (BSSA) is the clinician assessment guide from
the National Institute of Mental Health (NIMH) **ASQ Toolkit**. It is used **after**
a patient screens positive for suicide risk (e.g. a positive ASQ), to gather enough
information to determine a clinical disposition.

The BSSA is **a guide, not a scored survey.** There is no total score and no
validated cut-points. The clinician conducts a structured interview and then selects
one of four dispositions. This SPiER FHIR encoding therefore treats the **disposition**
as the primary machine-actionable output (mirroring the ASQ screening-result pattern),
with a handful of clinically-decisive interview findings captured as discrete
Observations.

**Source:** [NIMH ASQ Toolkit](https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials) — Adult Outpatient BSSA worksheet (item wording followed here). ED, inpatient, and youth worksheets differ only in disposition detail.

**Validated populations:** Youth (age 8+) and adults (setting-specific worksheets exist).

**Settings:** Outpatient / Primary Care, Emergency Department, Inpatient Medical/Surgical.

**SPiER tool ID / stage:** TL-005, `clarify-risk` (Stage 2 — Clarify Risk).

## Pilot status — ⚠️ READ THIS FIRST

This Questionnaire is `status: draft` / `experimental: true`. The BSSA has **no
published panel or per-item LOINC codes.** The root panel code and the discrete
assessment items bind to SPiER-local CodeSystems, each marked with the
`coding-verification-status` extension set to `no-standard-binding`. The single
**verified** binding is on the disposition item, which carries the generic LOINC
`93374-7` ("Suicide risk level") — the same code the ASQ screening result and the
harmonized concept layer use.

## Assessment structure (worksheet)

1. **Praise patient** for discussing their thoughts (scripted opener; `display` item).
2. **Assess the patient:**
   - **Frequency of suicidal thoughts** — past-few-weeks ideation (Yes/No), how often, when last, and **"Are you having thoughts of killing yourself right now?"** (the acuity signal).
   - **Suicide plan / intent to die** — plan (Yes/No), plan description / method & access, and a 0–10 intent self-rating.
   - **Past behavior** — ever tried to hurt yourself (Yes/No), ever tried to kill yourself (Yes/No), and method/date/intent detail. *Past suicidal behavior is the strongest risk factor for future attempts.*
   - **Symptoms** — multi-select checklist (depression, anxiety, impulsivity, hopelessness, anhedonia, isolation, irritability, substance/alcohol use, sleep disturbance, appetite change, other).
   - **Social support & stressors** — support network, family conflict, employment stress, domestic violence, suicide contagion, and reasons for living.
3. **Make a safety plan** with the patient (coping strategies, means restriction) and ask **"Do you think you need help to keep yourself safe?"**
4. **Determine disposition** (see below).
5. **Provide resources** to all patients (988 Suicide & Crisis Lifeline; Crisis Text Line "HOME" to 741741).

## Disposition → next steps

| Disposition (`bssa-disposition`) | Criteria | Next steps |
|---|---|---|
| **Emergency psychiatric evaluation** | Imminent risk (current suicidal thoughts) | Send to ED for extensive mental health evaluation; do not leave alone. |
| **Further evaluation of risk is necessary** | Elevated but not imminent | Review the safety plan; send home with a mental health referral, preferably within 72 hours. |
| **Non-urgent mental health follow-up** | May benefit from follow-up | Review the safety plan; send home with a mental health referral. |
| **No further intervention necessary at this time** | No ongoing concern | For all positive screens, follow up at next appointment. |

The disposition is the value of the derived **BSSA disposition Observation**
(`spier-bssa-disposition-result`, LOINC `93374-7`). A crosswalk
(`ig/input/fsh/crosswalk-bssa.fsh`) maps each disposition onto the common SPiER
suicide-risk tier so partner systems can consume the result without understanding the
BSSA. **The crosswalk is a clinical-equivalence claim and is pending SME sign-off.**

### Conditional-item semantics — "asked vs. not asked"

`ideation-frequency`, `ideation-last-time`, and `attempt-details` are `enableWhen`-gated.
When the gate is not met, the item should be **absent** from the QuestionnaireResponse
rather than present with an empty value. The observation mapper only materializes an
Observation when an answer is actually present.

## Derived Observations

The observation mapper (`web/src/lib/observationMappers/bssa.ts`) is the reference
implementation of the SDC `observationExtract` contract declared on the Questionnaire.
It emits:

| Observation code | System | From item |
|---|---|---|
| `93374-7` "Suicide risk level" | LOINC | `disposition` (value = disposition tier) |
| `current-ideation` | `bssa-item` | `current-ideation` (acuity, Yes/No) |
| `suicide-plan` | `bssa-item` | `has-plan` (Yes/No) |
| `intent-scale` | `bssa-item` | `intent-scale` (0–10 integer) |
| `past-suicide-attempt` | `bssa-item` | `ever-attempt` (Yes/No) |
| `needs-help-to-be-safe` | `bssa-item` | `needs-help-to-be-safe` (Yes/No) |

These codes MUST stay in sync across the Questionnaire item `code`s, the mapper, and
`web/scripts/check-observation-extract.mjs` (`EXPECTED`). The symptom checklist and the
social-support items are captured in the QuestionnaireResponse but are **not** extracted
as discrete Observations.

## FHIR Assets

| Asset | Path | Description |
|---|---|---|
| Questionnaire | `bssa-questionnaire.json` | FHIR R4 Questionnaire; SNOMED-bound Yes/No answers, `enableWhen` conditionals, `observationExtract` on the six discrete outputs |
| FSH source | `../../ig/input/fsh/bssa.fsh` | ActivityDefinition, CodeSystems/ValueSets, disposition Observation profile, example instances |
| Crosswalk | `../../ig/input/fsh/crosswalk-bssa.fsh` | ConceptMap: BSSA disposition → SPiER suicide-risk tier (pending SME sign-off) |
| Licensing memo | `licensing/MEMO.md` | Public-domain licensing audit |

## Clinical Pathway Integration

The BSSA is a **Clarify Risk** stage tool in the SPiER pathway:

```
Identify Possible Risk (ASQ) → Clarify Risk (C-SSRS / BSSA / CAMS SSF-5) → Define the Risk Picture → …
```

A positive ASQ screen routes to a Clarify-Risk instrument; the BSSA is the
disposition-oriented option for medical/ambulatory/acute settings. Its disposition
drives the downstream safety actions (safety plan, referral, or emergency evaluation).

## Copyright

The BSSA is part of the ASQ Toolkit, a **public domain** resource developed by NIMH.
No permission is required for use, reproduction, or translation. See `licensing/MEMO.md`.
