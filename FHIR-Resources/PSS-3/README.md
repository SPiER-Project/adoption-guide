# PSS-3 — Patient Safety Screener 3

## Overview

The Patient Safety Screener 3 (PSS-3) is a brief, validated **universal** suicide-risk
screen for emergency departments and inpatient medical settings (patients ages 12+).
It was developed through the NIMH-funded **ED-SAFE** study (Boudreaux et al.). Three
questions cover depression, active suicidal ideation in the past two weeks, and lifetime
suicide attempt, with a recency follow-up when an attempt is reported.

**Source:** ED-SAFE study; printable tool distributed by the [Suicide Prevention Resource Center (SPRC)](https://sprc.org/) and [SAMHSA](https://www.samhsa.gov/resource/dbhis/patient-safety-screener-pss-3-brief-tool-detect-suicide-risk-acute-care-settings).

**Validated populations:** Ages 12+, universal (screen regardless of presenting complaint).

**Settings:** Emergency Department, inpatient medical.

**SPiER tool ID / stage:** TL-011, `identify-possible-risk` (Stage 1 — Identify Possible Risk).

## Pilot status — ⚠️ READ THIS FIRST

This Questionnaire is `status: draft` / `experimental: true`. The PSS-3 has **no
published panel or per-item LOINC codes.** The root panel code and the three screening
items bind to SPiER-local CodeSystems marked `no-standard-binding`. The one **verified**
binding is on the computed result, which carries the generic LOINC `93374-7` ("Suicide
risk level") — the same code the ASQ result and the harmonized concept layer use.

## Screening questions (verbatim)

1. **In the past two weeks, have you felt down, depressed, or hopeless?** (depression)
2. **In the past two weeks, have you had thoughts of killing yourself?** (active ideation)
3. **In your lifetime, have you ever attempted to kill yourself?** (lifetime attempt)
   - **3a. If yes, when did this happen?** — Within past 24 hours (including today) / Within last month (but not today) / Between 1 and 6 months ago / More than 6 months ago.

Answer options for items 1–3: **Yes / No / Patient unable to complete / Patient refused.**
A patient presenting with a current suicide attempt is an automatic **Yes** on Items 2 and 3.

Yes/No answers bind to SNOMED CT `373066001` (Yes) / `373067005` (No); the two
non-response options bind to the SPiER-local `pss3-answer` CodeSystem.

## Positive-screen definition (scoring)

The PSS-3 yields a binary **suicide-risk** result (item 1 is a depression lead-in and is
not counted toward the suicide-risk result):

- **Positive** if item 2 (active ideation) = **Yes**, **or** item 3a (recency) is *within
  past 24 hours*, *within last month*, or *between 1 and 6 months ago* (i.e. an attempt
  within the last ~6 months).
- **Negative** otherwise (including an attempt reported as *more than 6 months ago* with
  no current ideation).

Per the tool's tip sheet, a positive screen should trigger a **secondary risk-stratification
assessment** (Clarify Risk) — in SPiER, the PSS-3 positive result fires the `on-pss3-positive`
trigger on the Clarify Risk PlanDefinition.

### Conditional-item semantics — "asked vs. not asked"

`q3a-recency` is `enableWhen`-gated on a Yes to the lifetime-attempt item. When not
triggered it should be **absent** from the QuestionnaireResponse; the mapper only reads a
recency answer when one is present.

## Derived Observations

The observation mapper (`web/src/lib/observationMappers/pss3.ts`) is the reference
implementation of the SDC `observationExtract` contract declared on the Questionnaire.
It emits:

| Observation code | System | From item |
|---|---|---|
| `93374-7` "Suicide risk level" | LOINC | computed result (value = positive / negative) |
| `depression-2wk` | `pss3-item` | q1 (Yes/No) |
| `active-ideation-2wk` | `pss3-item` | q2 (Yes/No) |
| `lifetime-attempt` | `pss3-item` | q3 (Yes/No) |

The result Observation is **computed** (from items 2 and 3a) and therefore is NOT declared
with `observationExtract` — only the three literal item captures are. The per-item codes
MUST stay in sync across the Questionnaire item `code`s, the mapper, and
`web/scripts/check-observation-extract.mjs` (`EXPECTED`).

## Risk-tier crosswalk

`ig/input/fsh/crosswalk-pss3.fsh` maps the PSS-3 result onto the common SPiER suicide-risk
tier (positive → moderate, negative → no-risk). A positive PSS-3 is a screen-level signal
that does not resolve finer severity (the tool itself calls for a secondary stratifier), so
the positive mapping is `relatedto` and **pending SME sign-off.**

## FHIR Assets

| Asset | Path | Description |
|---|---|---|
| Questionnaire | `pss3-questionnaire.json` | FHIR R4 Questionnaire; SNOMED-bound Yes/No answers, `enableWhen` recency, `observationExtract` on q1–q3 |
| FSH source | `../../ig/input/fsh/pss3.fsh` | ActivityDefinition, CodeSystems/ValueSets, SPiERPSS3Result profile, example instances |
| Crosswalk | `../../ig/input/fsh/crosswalk-pss3.fsh` | ConceptMap: PSS-3 result → SPiER suicide-risk tier (pending SME sign-off) |
| Licensing memo | `licensing/MEMO.md` | Public-domain / free-use licensing audit |

## Clinical Pathway Integration

The PSS-3 is an **Identify Possible Risk** stage screen. A positive PSS-3 advances the
patient to **Clarify Risk** (C-SSRS / BSSA / CAMS SSF-5):

```
Identify Possible Risk (ASQ / PHQ-9 / PSS-3) → Clarify Risk → Define the Risk Picture → …
```

## Copyright

The PSS-3 was developed through the ED-SAFE study (NIMH-funded) and is distributed as a
free public resource by SAMHSA and SPRC. No permission or fee is required for use. See
`licensing/MEMO.md`.
