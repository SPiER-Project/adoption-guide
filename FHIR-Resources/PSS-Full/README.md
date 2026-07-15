# PSS Full — Patient Safety Screener / Suicide Risk Screener (Full) (TL-014)

## Overview

A **combined acute-care** instrument: the public ED-SAFE **PSS-3** universal screen (three
items) paired with a **site-defined risk-stratification** step, for EDs/inpatient settings
that want a single screen-and-stratify tool. Used at the **Clarify Risk** stage.

- **Universal screen:** the three public PSS-3 items (depression, active ideation, lifetime
  attempt + recency) — free ED-SAFE tool distributed by SAMHSA/SPRC.
- **Stratification:** a **site-defined** risk level (low / moderate / high) determined per
  the local protocol and clinician judgment. SPiER does **not** embed a proprietary
  secondary instrument.

## Output — lands on the concept layer

The derived risk level binds **directly** to the shared `spier-suicide-risk-tier` (like
SAFE-T), so a partner system consumes the tier with **no per-instrument crosswalk**:

| Observation | Code | Value |
|---|---|---|
| `SPiERPSSFullRiskLevel` | LOINC 93374-7 | shared suicide-risk tier (low/moderate/high) |

Only the risk-level item declares `observationExtract`; the three screening items are
recorded in the QuestionnaireResponse for context. See
`web/src/lib/observationMappers/pssFull.ts`.

## FHIR Assets

| Asset | Path |
|---|---|
| Questionnaire | `pss-full-questionnaire.json` |
| FSH source | `../../ig/input/fsh/pss-full.fsh` (`SPiERPSSFullRiskLevel` profile + `AdministerPSSFull` AD + examples) |
| Licensing memo | `licensing/MEMO.md` |

## Licensing

The PSS-3 screening items are the free ED-SAFE public tool (SAMHSA/SPRC; no permission
required). The stratification step is site-defined. Used under the license/permission held
by the SPiER project (maintainer-confirmed 2026-07-15). See `licensing/MEMO.md`.
