# Quick Starts

Concrete RESTful patterns for reading SPiER data, one block per instrument — in the style of [US Core Quick Starts](https://hl7.org/fhir/us/core/). These are **illustrative search patterns** against a FHIR R4 server that holds SPiER-conformant data; SPiER does not yet define its own server API or required SearchParameters.

In every example, replace `[base]` with the server's FHIR base URL and `[id]` with the patient's logical id.

## The common thread: the harmonized risk concept

Every instrument produces a harmonized **suicide-risk concept** Observation on the generic LOINC code, tagged with the suicide-risk domain category. To read the instrument-agnostic risk tier for a patient regardless of which tool was used:

```
GET [base]/Observation?code=http://loinc.org|93374-7&category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
```

`Observation.derivedFrom` on each result links back to the source `QuestionnaireResponse` and any instrument-specific Observations.

## ASQ (Ask Suicide-Screening Questions)

- Questionnaire: `http://spier.org/Questionnaire/ASQ-Screening-Tool` (v1.1.0-pilot)
- Derived profile: `SPiERASQResult` (disposition on LOINC `93374-7`)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/ASQ-Screening-Tool&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## C-SSRS (Columbia-Suicide Severity Rating Scale)

- Questionnaires: `http://spier.org/Questionnaire/C-SSRS-Screener` (v1.0.0), `http://spier.org/Questionnaire/C-SSRS-Full-Lifetime-Recent` (v1.0.0)
- Derived profile: `SPiERCSSRSRiskLevel` (risk level on LOINC `93374-7`)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/C-SSRS-Screener&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## PHQ-9 (Patient Health Questionnaire-9)

- Questionnaire: `http://spier.org/Questionnaire/PHQ-9` (v1.0.0)
- Derived profiles: `SPiERPHQ9TotalScore` (LOINC `44261-6`), `SPiERPHQ9Item9` (LOINC `44260-8`, the suicide-relevant item)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/PHQ-9&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|44260-8&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|44261-6&subject=Patient/[id]
```

## SBQ-R (Suicide Behaviors Questionnaire-Revised)

- Questionnaire: `http://spier.org/Questionnaire/SBQ-R` (v1.0.0)
- Derived profile: `SPiERSBQRTotalScore` (total on SNOMED `225337009`; cutoffs ≥7 / ≥8)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/SBQ-R&subject=Patient/[id]
GET [base]/Observation?code=http://snomed.info/sct|225337009&subject=Patient/[id]
```

> Tip: to retrieve a patient's suicide-risk picture across *all* instruments in one query, use the harmonized-concept search at the top of this page — that's the payoff of the [two-layer model](how-to-read.html#two-layer-model).
