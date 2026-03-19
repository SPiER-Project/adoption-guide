# SBQ-R — Suicide Behaviors Questionnaire-Revised

## Overview

The SBQ-R is a 4-item self-report measure where each item taps a different dimension of suicidality. It provides a broad range of risk information in a very brief administration.

**Authors:** Osman A, Bagge CL, Guitierrez PM, Konick LC, Kooper BA, Barrios FX

**Copyright:** © Osman et al (1999) Revised. Permission for use granted by A. Osman, MD.

**Reference:** Osman et al., The Suicidal Behaviors Questionnaire-Revised (SBQ-R): Validation with clinical and nonclinical samples. Assessment, 2001, (5), 443-454.

## Questions & Scoring

### Item 1: Lifetime suicide ideation and/or suicide attempts (1-4 pts)

| Response | Subgroup | Points |
|----------|----------|--------|
| Never | Non-Suicidal | 1 |
| It was just a brief passing thought | Suicide Risk Ideation | 2 |
| I have had a plan at least once to kill myself but did not try to do it | Suicide Plan | 3 |
| I have had a plan at least once to kill myself and really wanted to die | Suicide Plan | 3 |
| I have attempted to kill myself, but did not want to die | Suicide Attempt | 4 |
| I have attempted to kill myself, and really hoped to die | Suicide Attempt | 4 |

### Item 2: Frequency of suicidal ideation over the past 12 months (1-5 pts)

| Response | Points |
|----------|--------|
| Never | 1 |
| Rarely (1 time) | 2 |
| Sometimes (2 times) | 3 |
| Often (3-4 times) | 4 |
| Very Often (5 or more times) | 5 |

### Item 3: Threat of suicide attempt (1-3 pts)

| Response | Points |
|----------|--------|
| No | 1 |
| Yes, at one time, but did not really want to die | 2 |
| Yes, at one time, and really wanted to die | 2 |
| Yes, more than once, but did not want to do it | 3 |
| Yes, more than once, and really wanted to do it | 3 |

### Item 4: Self-reported likelihood of suicidal behavior in the future (0-6 pts)

| Response | Points |
|----------|--------|
| Never | 0 |
| No chance at all | 1 |
| Rather unlikely | 2 |
| Unlikely | 3 |
| Likely | 4 |
| Rather likely | 5 |
| Very likely | 6 |

## Total Score & Cutoffs

**Score range:** 3-18

| Population | Cutoff | Sensitivity | Specificity | AUC |
|------------|--------|-------------|-------------|-----|
| General Population | ≥ 7 | 93% | 95% | 0.96 |
| Psychiatric Inpatients | ≥ 8 | 80% | 91% | 0.89 |

## FHIR Implementation

- **Scoring:** Uses `ordinalValue` extension on each answerOption to encode point weights
- **Calculated total:** Uses SDC `calculatedExpression` extension with FHIRPath
- **Note:** Items 1 and 3 have responses that map to the same score (e.g., 3a and 3b both score 3 points)

## FHIR Assets

| Asset | Path |
|-------|------|
| Questionnaire | `fhir/questionnaires/questionnaire.json` |
