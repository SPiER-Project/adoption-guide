# C-SSRS — Columbia-Suicide Severity Rating Scale

## Overview

The C-SSRS is the gold-standard suicide risk assessment tool, developed at Columbia University. It provides a hierarchical assessment of suicidal ideation severity (5 levels) and suicidal behavior, with standardized risk stratification.

**Authors:** Posner, K.; Brent, D.; Lucas, C.; Gould, M.; Stanley, B.; Brown, G.; Fisher, P.; Zelazny, J.; Burke, A.; Oquendo, M.; Mann, J.

**Copyright:** © 2008 The Research Foundation for Mental Hygiene, Inc. Training required for administration. Contact: posnerk@nyspi.columbia.edu

## Versions Implemented

### C-SSRS Screener (Recent)
- **6 items** with three-tier risk stratification
- LOINC panel: **93373-9**
- Quick assessment for universal screening contexts

### C-SSRS Full (Lifetime/Recent)
- **5 ideation levels** (dual timeframe: Lifetime + Past Month)
- **5 intensity ratings** (frequency, duration, controllability, deterrents, reasons)
- **Full behavior section** (actual attempts, interrupted, aborted, preparatory acts, lethality)
- LOINC panel: **93245-9**

## Suicidal Ideation Hierarchy (5 Levels)

| Level | Description | Risk Tier |
|-------|-------------|-----------|
| 1 | Wish to be Dead | Low |
| 2 | Non-Specific Active Suicidal Thoughts | Low |
| 3 | Active Ideation with Any Methods (Not Plan), No Intent | Moderate |
| 4 | Active Ideation with Some Intent, No Specific Plan | Moderate |
| 5 | Active Ideation with Specific Plan and Intent | High |

## Screener Risk Stratification

| Risk Level | Criteria |
|------------|----------|
| **Low** | Q1 or Q2 = Yes (wish to be dead or non-specific thoughts) |
| **Moderate** | Q3 or Q4 = Yes (method or some intent) |
| **High** | Q5 = Yes (specific plan with intent) or Q6 = Yes (suicidal behavior) |

## FHIR Assets

| Asset | Path | LOINC Panel |
|-------|------|-------------|
| Screener | `fhir/questionnaires/screener.json` | 93373-9 |
| Full Lifetime/Recent | `fhir/questionnaires/full-lifetime-recent.json` | 93245-9 |

## Key LOINC Codes

| Code | Description |
|------|-------------|
| 93246-7 | Wish to be dead |
| 93247-5 | Non-specific active suicidal thoughts |
| 93248-3 | Active ideation with methods, no intent |
| 93249-1 | Active ideation with some intent |
| 93250-9 | Active ideation with specific plan and intent |
| 93267-3 | Suicidal behavior (done/started/prepared to end life) |
| 93269-9 | Was this within past 3 months |
| 93271-5 | Actual lethality/medical damage |
| 93374-7 | Suicide risk level |

## Clinical Pathway Integration

The C-SSRS sits in the **Assessment** phase:

```
PHQ-9 Item 9+ or ASQ+ (Screening) → C-SSRS (Assessment) → Risk Stratification → Safety Planning
```

The screener is appropriate for initial triage. The full version provides comprehensive assessment for treatment planning.
