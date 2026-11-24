Every instrument SPiER publishes, one section each. A row is one form: the
Questionnaire to load, the activity that administers it, the profile its
result is written to, how that result reaches the shared risk tier, and a
worked response.

- **What each instrument is:** the
  [clinical primer](how-to-read.html#clinical-primer) has one line on each.
- **Into the tier** links the map that carries a result into the shared risk
  tier. "Directly" means the result is valued on the tier itself; a dash means
  the form's result is not a risk result, or has no crosswalk. No crosswalk
  has clinical sign-off yet; see
  [Harmonization status](harmonization-and-limitations.html#harmonization-status).
- **How to query for a result:** [Quick Starts](quick-starts.html).
- **Licensing status** is SPiER's reading and has not been checked against the
  developer's current terms. Read [Licensing](index.html#licensing) before
  deploying any instrument; the full notice is on each activity's page.

<!-- BEGIN generated instrument directory: do not edit by hand -->

### ASQ {#asq}

Licensing status: Public domain / free use.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [ASQ — Ask Suicide-Screening Questions](Questionnaire-ASQ-Screening-Tool.html) | [Administer ASQ Suicide Screen](ActivityDefinition-AdministerASQ.html) | [SPiER ASQ Screening Result Observation](StructureDefinition-spier-asq-result.html) | [ConceptMap](ConceptMap-ASQDispositionToRiskTier.html) · [StructureMap](StructureMap-ASQResultToSuicideRiskConcept.html) | [response](QuestionnaireResponse-ExampleASQResponseNonAcute.html) |

### BSSA {#bssa}

Licensing status: Public domain / free use.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [BSSA — Brief Suicide Safety Assessment (NIMH)](Questionnaire-BSSA.html) | [Administer NIMH Brief Suicide Safety Assessment (BSSA)](ActivityDefinition-AdministerBSSA.html) | [SPiER BSSA Disposition Result Observation](StructureDefinition-spier-bssa-disposition-result.html) | [ConceptMap](ConceptMap-BSSADispositionToRiskTier.html) | [response](QuestionnaireResponse-ExampleBSSAResponse.html) |

### C-SSRS {#c-ssrs}

Licensing status: Registration or permission required.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [Columbia-Suicide Severity Rating Scale — Full (Lifetime/Recent)](Questionnaire-C-SSRS-Full-Lifetime-Recent.html) | [Administer C-SSRS Full (Lifetime/Recent)](ActivityDefinition-AdministerCSSRSFull.html) | [SPiER C-SSRS Risk Level Observation](StructureDefinition-spier-cssrs-risk-level.html) | [ConceptMap](ConceptMap-CSSRSRiskLevelToRiskTier.html) · [StructureMap](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html) | [response](QuestionnaireResponse-ExampleCSSRSFullResponse.html) |
| [Columbia-Suicide Severity Rating Scale — Pediatric / Adolescent Screener](Questionnaire-C-SSRS-Pediatric.html) | [Administer C-SSRS Pediatric / Adolescent Version](ActivityDefinition-AdministerCSSRSPediatric.html) | [SPiER C-SSRS Risk Level Observation](StructureDefinition-spier-cssrs-risk-level.html) | [ConceptMap](ConceptMap-CSSRSRiskLevelToRiskTier.html) · [StructureMap](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html) | [response](QuestionnaireResponse-ExampleCSSRSPediatricResponse.html) |
| [Columbia-Suicide Severity Rating Scale — Screener (Recent)](Questionnaire-C-SSRS-Screener.html) | [Administer C-SSRS Screener](ActivityDefinition-AdministerCSSRSScreener.html) | [SPiER C-SSRS Risk Level Observation](StructureDefinition-spier-cssrs-risk-level.html) | [ConceptMap](ConceptMap-CSSRSRiskLevelToRiskTier.html) · [StructureMap](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html) | [response](QuestionnaireResponse-ExampleCSSRSScreenerResponse.html) |
| [Columbia-Suicide Severity Rating Scale — Since Last Visit / Since Last Contact](Questionnaire-C-SSRS-Since-Last-Contact.html) | [Administer C-SSRS Since Last Visit / Since Last Contact](ActivityDefinition-AdministerCSSRSSinceLastContact.html) | [SPiER C-SSRS Risk Level Observation](StructureDefinition-spier-cssrs-risk-level.html) | [ConceptMap](ConceptMap-CSSRSRiskLevelToRiskTier.html) · [StructureMap](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html) | [response](QuestionnaireResponse-ExampleCSSRSSinceLastContactResponse.html) |

### CAMS {#cams}

Licensing status: Commercial license required.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [CAMS SSF-5: Outcome / Disposition (Final Session)](Questionnaire-CAMS-SSF5-OutcomeDisposition.html) | [Administer CAMS SSF-5 Outcome/Disposition (Final Session)](ActivityDefinition-AdministerCAMSOutcomeDisposition.html) | [SPiER CAMS Outcome Disposition Observation](StructureDefinition-spier-cams-outcome-disposition.html)<br/>[SPiER CAMS SSF Vital Observation](StructureDefinition-spier-cams-ssf-vital.html) | CAMS SSF Vital: [ConceptMap](ConceptMap-CAMSOverallRiskToRiskTier.html) | [response](QuestionnaireResponse-ExampleCAMSOutcomeDispositionResponse.html) |
| [CAMS Stabilization Plan](Questionnaire-CAMS-Stabilization-Plan.html) | [Author CAMS Stabilization Plan](ActivityDefinition-AdministerCAMSStabilizationPlan.html) | [SPiER CAMS Stabilization Plan CarePlan](StructureDefinition-spier-cams-stabilization-plan.html) | — | [response](QuestionnaireResponse-ExampleCAMSStabilizationPlanResponse.html) |
| [CAMS Suicide Status Form (SSF-5) - Section A (Patient)](Questionnaire-CAMS-SSF5-SectionA.html) | [Administer CAMS Interim Session (SSF Re-Rating)](ActivityDefinition-AdministerCAMSInterimSession.html)<br/>[Administer CAMS SSF-5 Section A (Patient Vitals)](ActivityDefinition-AdministerCAMSSectionA.html) | [SPiER CAMS SSF Vital Observation](StructureDefinition-spier-cams-ssf-vital.html) | [ConceptMap](ConceptMap-CAMSOverallRiskToRiskTier.html) | [response](QuestionnaireResponse-ExampleCAMSSectionAResponse.html) |
| [CAMS Suicide Status Form (SSF-5) - Section B (Clinician Risk Assessment)](Questionnaire-CAMS-SSF5-SectionB.html) | [Administer CAMS SSF-5 Section B (Clinician Drivers)](ActivityDefinition-AdministerCAMSSectionB.html) | [SPiER CAMS Suicide Driver Condition](StructureDefinition-spier-cams-suicide-driver.html) | — | [response](QuestionnaireResponse-ExampleCAMSSectionBResponse.html) |
| [CAMS Therapeutic Worksheet: Understanding Your Suicidality](Questionnaire-CAMS-Therapeutic-Worksheet.html) | [Author CAMS Therapeutic Worksheet](ActivityDefinition-AdministerCAMSTherapeuticWorksheet.html) | [SPiER CAMS Therapeutic Worksheet CarePlan](StructureDefinition-spier-cams-therapeutic-worksheet.html) | — | [response](QuestionnaireResponse-ExampleCAMSTherapeuticWorksheetResponse.html) |

### CRP {#crp}

Licensing status: Registration or permission required.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [Crisis Response Plan (CRP)](Questionnaire-CrisisResponsePlan.html) | [Author Crisis Response Plan / Crisis Planning](ActivityDefinition-AuthorCrisisResponsePlan.html) | [SPiER Crisis Response Plan CarePlan](StructureDefinition-spier-crisis-response-plan.html) | — | [response](QuestionnaireResponse-ExampleCrisisResponsePlanResponse.html) |

### PHQ-9 {#phq-9}

Licensing status: Public domain / free use.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [Patient Health Questionnaire-9 (PHQ-9)](Questionnaire-PHQ-9.html) | [Administer PHQ-9](ActivityDefinition-AdministerPHQ9.html) | [SPiER PHQ-9 Item 9 Observation](StructureDefinition-spier-phq9-item9.html)<br/>[SPiER PHQ-9 Total Score Observation](StructureDefinition-spier-phq9-total-score.html) | PHQ-9 Item 9: [StructureMap](StructureMap-PHQ9Item9ToSuicideRiskConcept.html) | [response](QuestionnaireResponse-ExamplePHQ9Response.html) |

### PSS-3 {#pss-3}

Licensing status: Unknown — pending licensing audit.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [PSS-3 — Patient Safety Screener 3](Questionnaire-PSS-3.html) | [Administer Patient Safety Screener-3 (PSS-3)](ActivityDefinition-AdministerPSS3.html) | [SPiER PSS-3 Screening Result Observation](StructureDefinition-spier-pss3-result.html) | [ConceptMap](ConceptMap-PSS3ResultToRiskTier.html) | [response](QuestionnaireResponse-ExamplePSS3ResponsePositive.html) |

### PSS-Full {#pss-full}

Licensing status: Unknown — pending licensing audit.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [Patient Safety Screener / Suicide Risk Screener (Full)](Questionnaire-PSS-Full.html) | [Administer Patient Safety Screener / Suicide Risk Screener (Full)](ActivityDefinition-AdministerPSSFull.html) | [SPiER PSS Full Risk Level Observation](StructureDefinition-spier-pss-full-risk-level.html) | directly | [response](QuestionnaireResponse-ExamplePSSFullResponse.html) |

### SAFE-T {#safe-t}

Licensing status: Public domain / free use.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [SAFE-T — Suicide Assessment Five-Step Evaluation and Triage](Questionnaire-SAFE-T.html) | [Administer SAFE-T](ActivityDefinition-AdministerSAFET.html) | [SPiER SAFE-T Risk Level Observation](StructureDefinition-spier-safet-risk-level.html) | directly | [response](QuestionnaireResponse-ExampleSAFETResponse.html) |

### SBQ-R {#sbq-r}

Licensing status: Unknown — pending licensing audit.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [Suicide Behaviors Questionnaire-Revised (SBQ-R)](Questionnaire-SBQ-R.html) | [Administer SBQ-R](ActivityDefinition-AdministerSBQR.html) | [SPiER SBQ-R Total Score Observation](StructureDefinition-spier-sbqr-total-score.html) | [StructureMap](StructureMap-SBQRTotalScoreToSuicideRiskConcept.html) | [response](QuestionnaireResponse-ExampleSBQRResponse.html) |

### Stanley-Brown {#stanley-brown}

Licensing status: Registration or permission required.

| Form | Activity | Result profile | Into the tier | Worked example |
|---|---|---|---|---|
| [Stanley-Brown Safety Plan](Questionnaire-StanleyBrownSafetyPlan.html) | [Author Stanley-Brown Safety Plan](ActivityDefinition-AdministerStanleyBrown.html) | [SPiER Stanley-Brown Safety Plan CarePlan](StructureDefinition-spier-stanley-brown-safety-plan.html) | — | [response](QuestionnaireResponse-ExampleStanleyBrownSafetyPlanResponse.html) |

<!-- END generated instrument directory -->
