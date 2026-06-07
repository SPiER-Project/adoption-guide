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
// SBQ-R total score uses SNOMED CT — no published LOINC equivalent
// for this specific instrument.
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
* title = "Administer SBQ-R"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Capture a Suicide Behaviors Questionnaire-Revised (SBQ-R) and derive a total-score Observation. Total ≥7 advances the patient to Clarify Risk; ≥8 indicates higher acuity warranting a full safety assessment."
* purpose = "Screen for lifetime and recent suicide-related ideation, plans, and behavior. Validated in both general-population and psychiatric-inpatient settings."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "SBQ-R questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/SBQ-R|1.0.0"


Instance: ExampleSBQRTotalScore9
InstanceOf: SPiERSBQRTotalScore
Title: "Example — SBQ-R Total Score 9 (Above Inpatient Cutoff)"
Description: "Sample SBQ-R total-score Observation indicating a score above both the general-population and psychiatric-inpatient cutoffs."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
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
* item[+].linkId = "q1"
* item[=].answer.valueCoding = SBQRQ1Codes#4b
