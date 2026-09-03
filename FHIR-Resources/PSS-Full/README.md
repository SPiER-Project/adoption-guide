# PSS Full — Patient Safety Screener / Suicide Risk Screener (Full)

## Provenance

A **combined acute-care** instrument for EDs and inpatient settings that want a
single screen-and-stratify tool, rather than a screen plus a separate
stratifier. It has two halves with different origins, and the distinction is the
whole point of the tool:

- **The universal screen** is the three public ED-SAFE **PSS-3** items
  (depression, active ideation, lifetime attempt with recency) — the free tool
  distributed by SAMHSA and the Suicide Prevention Resource Center.
- **The stratification** is a **site-defined** risk level determined by local
  protocol and clinician judgment. SPiER deliberately does **not** embed a
  proprietary secondary instrument here, which is also why no third-party item
  content is carried and the licensing status is public-domain.

| | |
|---|---|
| **Source** | ED-SAFE study / SAMHSA / SPRC for the screening items; the stratification step is the adopting site's own |
| **Settings** | Emergency department, inpatient — the Clarify Risk stage |
| **Licensing** | Public domain, with the reasoning above recorded on the `AdministerPSSFull` ActivityDefinition. The evidence, including maintainer confirmation on 2026-07-15, is in [`licensing/MEMO.md`](licensing/MEMO.md). |

## What's in this folder

| File | What it is |
|---|---|
| `pss-full-questionnaire.json` | The FHIR R4 Questionnaire — the three screening items plus the site-stratified risk-level item |
| `licensing/MEMO.md` | The licensing audit |

Everything else is in [`ig/input/fsh/pss-full.fsh`](../../ig/input/fsh/pss-full.fsh):
the `SPiERPSSFullRiskLevel` profile, the `AdministerPSSFull`
ActivityDefinition with its stage membership and licensing, and the examples.

## Why this tool needs no crosswalk

Its derived risk level binds **directly** to the shared
`spier-suicide-risk-tier` ValueSet — the same design as SAFE-T — so the
Observation's value is already a common tier and a partner system consumes it
with no per-instrument ConceptMap in between. Only the risk-level item declares
`observationExtract`; the three screening items are recorded in the
QuestionnaireResponse for context.
