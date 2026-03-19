# PHQ-9 — Patient Health Questionnaire-9

## Overview

The PHQ-9 is a 9-item depression screening instrument scored 0-27. It is the most widely used depression screening tool in primary care and is the primary gateway for suicide risk identification in many EHR workflows through **Item 9**.

**Developers:** Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues

**Copyright:** Developed with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.

## Questions

All 9 items ask: "Over the last 2 weeks, how often have you been bothered by..."

| # | Item | LOINC |
|---|------|-------|
| 1 | Little interest or pleasure in doing things | 44250-9 |
| 2 | Feeling down, depressed, or hopeless | 44255-8 |
| 3 | Trouble falling or staying asleep, or sleeping too much | 44259-0 |
| 4 | Feeling tired or having little energy | 44254-1 |
| 5 | Poor appetite or overeating | 44251-7 |
| 6 | Feeling bad about yourself | 44258-2 |
| 7 | Trouble concentrating on things | 44252-5 |
| 8 | Moving or speaking slowly / being fidgety or restless | 44253-3 |
| **9** | **Thoughts that you would be better off dead or of hurting yourself** | **44260-8** |

**Response options** (each item): Not at all (0), Several days (1), More than half the days (2), Nearly every day (3)

**Total score** (LOINC 44261-6): 0-27

**Functional difficulty question** (LOINC 69722-7): Not difficult at all / Somewhat / Very / Extremely difficult

## Scoring & Severity

| Score | Severity | Recommended Action |
|-------|----------|--------------------|
| 0-4 | Minimal | None |
| 5-9 | Mild | Watchful waiting; repeat at follow-up |
| 10-14 | Moderate | Treatment plan; counseling or pharmacotherapy |
| 15-19 | Moderately Severe | Active treatment with pharmacotherapy and/or psychotherapy |
| 20-27 | Severe | Immediate initiation of pharmacotherapy; if severe impairment or poor response, refer to mental health specialist |

## Item 9 — Suicide Risk Gateway

A positive response on Item 9 (score ≥ 1) indicates thoughts of death or self-harm and should trigger further suicide risk assessment using tools like the ASQ, C-SSRS, or SAFE-T.

## FHIR Implementation

- **LOINC panel:** 44249-1
- **Scoring:** Uses `ordinalValue` extension on each answerOption to encode point values (0-3)
- **Calculated total:** Uses SDC `calculatedExpression` extension with FHIRPath
- **All answer options** use standard LOINC answer codes (LA6568-5 through LA6571-9)

## FHIR Assets

| Asset | Path |
|-------|------|
| Questionnaire | `fhir/questionnaires/questionnaire.json` |
