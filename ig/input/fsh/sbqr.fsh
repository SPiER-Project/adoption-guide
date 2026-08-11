// =============================================================
// SBQ-R — Suicide Behaviors Questionnaire-Revised
// =============================================================
// 4-item screener producing a 3–18 total score with two clinical
// cutoffs (≥7 general population, ≥8 psychiatric inpatient).
//
// Existing Questionnaire:
//   http://spier.org/Questionnaire/SBQ-R|1.0.0
// =============================================================


Profile: SPiERSBQRTotalScore
Parent: Observation
Id: spier-sbqr-total-score
Title: "SPiER SBQ-R Total Score Observation"
Description: "Integer total score (3–18) derived from a completed SBQ-R QuestionnaireResponse. General-population clinical cutoff is ≥7 (93% sensitivity, 95% specificity); psychiatric inpatient cutoff is ≥8 (80%/91%)."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory
// TERMINOLOGY NOTE (LOINC recheck, July 2026):
//   As of July 2026 there is still no published LOINC panel, item, or
//   total-score code for the SBQ-R (see
//   docs/research/2026-07-terminology-crosswalk-research.md). The resolution
//   is documentation, not a code switch.
//   SNOMED CT 225337009 is used here for the total-score Observation. Its
//   actual display is "Suicide risk assessment" — a *generic* suicide-risk
//   concept, NOT an SBQ-R-specific code. This is a pragmatic local choice, not
//   an assertion that 225337009 identifies the SBQ-R.
//   Re-check for a dedicated LOINC code at the next major release.
* code = http://snomed.info/sct#225337009
* subject 1..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only integer


Instance: AdministerSBQR
InstanceOf: ActivityDefinition
Title: "Administer SBQ-R"
Description: "Capture a Suicide Behaviors Questionnaire-Revised (SBQ-R) and derive a total-score Observation."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerSBQR"
* name = "AdministerSBQR"
* version = "0.1.0"
* title = "Administer SBQ-R"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Capture a Suicide Behaviors Questionnaire-Revised (SBQ-R) and derive a total-score Observation. Total ≥7 advances the patient to Clarify Risk; ≥8 indicates higher acuity warranting a full safety assessment."
* purpose = "Screen for lifetime and recent suicide-related ideation, plans, and behavior. Validated in both general-population and psychiatric-inpatient settings."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "SBQ-R questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/SBQ-R|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #unknown
* copyright = "Licensing status UNKNOWN, pending the issue #64 audit. The SPiER SBQ-R Questionnaire records the notice “© Osman et al (1999) Revised. Permission for use granted by A. Osman, MD.” That establishes the instrument is copyrighted and that a permission exists, but it does not state what an adopting system must do to deploy it, to whom the permission was granted, or whether it transfers — and no licensing-audit memo is on file. Do NOT read this as free reuse: confirm terms with the author before deployment. Reference: Osman A, Bagge CL, Gutierrez PM, Konick LC, Kopper BA, Barrios FX. The Suicidal Behaviors Questionnaire-Revised (SBQ-R): Validation with clinical and nonclinical samples. Assessment. 2001;8(4):443-454."


Instance: ExampleSBQRTotalScore9
InstanceOf: SPiERSBQRTotalScore
Title: "Example — SBQ-R Total Score 9 (Above Inpatient Cutoff)"
Description: "Sample SBQ-R total-score Observation indicating a score above both the general-population and psychiatric-inpatient cutoffs."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:45:00Z"
* valueInteger = 9
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#H "High"
* interpretation[=].text = "Above inpatient cutoff (≥8). Score 9/18."
* note[+].text = "SBQ-R total score: 9/18. General population cutoff: ≥7. Psychiatric inpatient cutoff: ≥8."


Instance: ExampleSBQRResponse
InstanceOf: QuestionnaireResponse
Title: "Example — SBQ-R QuestionnaireResponse (above inpatient cutoff)"
Description: "Source SBQ-R QuestionnaireResponse yielding a total of 9 (above the ≥8 inpatient cutoff). The derived SPiERSBQRTotalScore and the harmonized concept Observation reference this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/SBQ-R"
* subject = Reference(Patient/example)
* authored = "2026-03-19T10:45:00Z"
// q1–q4 are all `required` on the Questionnaire. The answers below carry the
// ordinals 4 + 2 + 2 + 1, which is the 9 asserted by ExampleSBQRTotalScore9:
// a past attempt intending to die, rare ideation over the last year, having told
// someone once, and no self-rated chance of a future attempt.
* item[+].linkId = "q1"
* item[=].answer.valueCoding = SBQRQ1Codes#4b
* item[+].linkId = "q2"
* item[=].answer.valueCoding = SBQRQ2Codes#2
* item[+].linkId = "q3"
* item[=].answer.valueCoding = SBQRQ3Codes#2b
* item[+].linkId = "q4"
* item[=].answer.valueCoding = SBQRQ4Codes#1
* item[+].linkId = "total-score"
* item[=].answer.valueInteger = 9
