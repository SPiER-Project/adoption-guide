# ASQ — Ask Suicide-Screening Questions

## Overview

The ASQ is a brief, validated suicide risk screening tool developed by the National Institute of Mental Health (NIMH). It consists of 4 screening questions plus an acuity question, and can be administered in approximately 20 seconds.

**Source:** [NIMH ASQ Toolkit](https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials)

**Validated populations:** Youth (age 8+) and adults

**Settings:** Emergency Department, Inpatient Medical/Surgical, Outpatient/Primary Care, Telehealth

## Screening Questions

1. "In the past few weeks, have you wished you were dead?" (Yes/No)
2. "In the past few weeks, have you felt that you or your family would be better off if you were dead?" (Yes/No)
3. "In the past week, have you been having thoughts about killing yourself?" (Yes/No)
4. "Have you ever tried to kill yourself?" (Yes/No)
   - If yes: "When was the most recent attempt?" (Within last 12 months / Over 1 year ago)

**Acuity question** (asked only if Yes to any of Q1-Q4):

5. "Are you having thoughts of killing yourself right now?" (Yes/No)
   - If yes: "Describe briefly" (free text)

## Risk Stratification

| Result | Criteria | Next Steps |
|--------|----------|------------|
| **Negative Screen** | No to all Q1-Q4 | No intervention required. Clinical judgment can override. |
| **Non-Acute Positive** | Yes to any Q1-Q4, No to Q5 | Brief suicide safety assessment needed. Full mental health eval if indicated. |
| **Acute Positive** | Yes to any Q1-Q4, Yes to Q5 | STAT/urgent safety evaluation. Patient cannot leave until evaluated. Keep in sight. Remove dangerous objects. |

### Refusal Handling
- **Youth:** Refusal = non-acute positive screen
- **Adults:** Refusal is NOT a positive screen unless other safety concerns exist

## FHIR Assets

| Asset | Path | Description |
|-------|------|-------------|
| Questionnaire | `fhir/questionnaires/questionnaire.json` | FHIR R4 Questionnaire with enableWhen conditional logic |

## Clinical Pathway Integration

The ASQ fits into the SPiER clinical workflow as a **screening** tool:

```
ASQ (Screening) → C-SSRS/SAFE-T (Assessment) → Risk Stratification → Safety Planning → Follow-up
```

A positive ASQ screen should trigger a more comprehensive assessment (e.g., C-SSRS) or direct safety planning depending on acuity level.

## Copyright

The ASQ is a **public domain** instrument. No permission is required for use, reproduction, or translation.
