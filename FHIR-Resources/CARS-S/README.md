# CARS-S — Cultural Assessment of Risk for Suicide (TL-028)

> **Placeholder — licensing audit only.** This directory contains **no** FHIR
> Questionnaire, FSH, or mapper. Per the Wave 3 "audit-first" step of the
> [SSC stage-tiles rollout](../../docs/plans/ssc-stage-tiles-rollout.md), the
> CARS was audited **before** any authoring, and the outcome is **NO-GO pending
> written permission** — see [`licensing/MEMO.md`](licensing/MEMO.md).

## Why no artifacts

The Cultural Assessment of Risk for Suicide (CARS; Chu et al., 2013, *Psychological
Assessment* 25(2):424–434) is a **copyrighted** research measure. Unlike the
public-domain instruments (ASQ, PHQ-9, PSS-3, SAFE-T) or the free-with-registration
C-SSRS, the CARS requires the authors'/publisher's permission (or a purchased
license) to reproduce its 39 items. SPiER does not reproduce copyrighted item
content without a permission grant on file.

## Current state

- `AdministerCARSS` (TL-028) remains a **placeholder** ActivityDefinition in
  `ig/input/fsh/pathway-tool-placeholders.fsh`. The tool is still catalogued in the
  adoption guide as an optional, culturally-informed Clarify-Risk assessment.
- No item wording is reproduced anywhere in the repo.

## To unblock authoring

1. Obtain written permission (or a license) from Dr. Joyce Chu / APA Permissions.
2. File it here as `licensing/permission-letter.pdf` and update `licensing/MEMO.md`.
3. Then run the full `assessment-to-ig` flow (Questionnaire JSON + FSH + mapper +
   catalog wiring), carrying the required attribution.
