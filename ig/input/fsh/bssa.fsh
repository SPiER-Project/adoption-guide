// =============================================================
// BSSA — NIMH Brief Suicide Safety Assessment
// =============================================================
// The clinician assessment guide used AFTER a positive suicide-
// risk screen (e.g. a positive ASQ). Belongs to the Clarify Risk
// stage. The BSSA is a guide, not a scored survey: the clinician
// conducts a structured interview and selects one of four
// dispositions. This IG treats the DISPOSITION as the primary
// derived Observation (mirroring the ASQ result pattern) and
// captures a handful of clinically-decisive interview findings
// as discrete Observations.
//
// References the hand-authored Questionnaire at
// FHIR-Resources/BSSA/bssa-questionnaire.json
// (canonical: http://spier.org/Questionnaire/BSSA).
//
// The disposition -> common suicide-risk-tier crosswalk lives in
// ig/input/fsh/crosswalk-bssa.fsh (pending clinical sign-off).
// =============================================================


// ─── CodeSystems ──────────────────────────────────────────────
// The BSSA has NO published panel or per-item LOINC codes, so the
// panel, discrete items, symptom checklist, and dispositions all use
// SPiER-local code systems. The one exception is the disposition
// Observation code, which rides on the generic LOINC 93374-7
// ("Suicide risk level"), the same code the ASQ result uses.

CodeSystem: BSSAPanelCodes
Id: bssa-panel
Title: "BSSA Panel Codes"
Description: "SPiER-local panel code for the NIMH Brief Suicide Safety Assessment. Used because the BSSA has no published panel LOINC."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #bssa "Brief Suicide Safety Assessment (BSSA) panel" "Root code for the BSSA assessment form."


CodeSystem: BSSAItemCodes
Id: bssa-item
Title: "BSSA Discrete Item Codes"
Description: "SPiER-local codes for the clinically-decisive BSSA interview findings that are extracted as discrete Observations. The BSSA has no published per-item LOINC codes. These MUST stay in sync with the Questionnaire item codes and web/src/lib/observationMappers/bssa.ts."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #current-ideation "Current suicidal ideation (right now)" "Whether the patient reports thoughts of killing themselves right now — the acuity signal driving urgent evaluation."
* #suicide-plan "Has a suicide plan" "Whether the patient reports a plan to kill themselves."
* #intent-scale "Intent to die (0–10 self-rating)" "Patient self-rating of how serious they are about killing themselves, 0 (no chance) to 10 (absolutely certain)."
* #past-suicide-attempt "History of suicide attempt" "Whether the patient reports ever having tried to kill themselves — the strongest risk factor for future attempts."
* #needs-help-to-be-safe "Reports needing help to stay safe" "Patient response to 'Do you think you need help to keep yourself safe?' A 'yes' is a reason to act immediately."


CodeSystem: BSSASymptomCodes
Id: bssa-symptom
Title: "BSSA Symptom Checklist Codes"
Description: "SPiER-local codes for the BSSA symptom checklist (a multi-select interview aid). Captured in the QuestionnaireResponse for context; not extracted as discrete Observations."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #depression "Depression"
* #anxiety "Anxiety"
* #impulsivity "Impulsivity / recklessness"
* #hopelessness "Hopelessness"
* #anhedonia "Anhedonia"
* #isolation "Isolation / social withdrawal"
* #irritability "Irritability"
* #substance-alcohol-use "Substance and alcohol use"
* #sleep-disturbance "Sleep disturbance"
* #appetite-change "Appetite change"
* #other "Other concerning change in thinking or feeling"


CodeSystem: BSSADispositionCodes
Id: bssa-disposition
Title: "BSSA Disposition Codes"
Description: "SPiER-local code system for the four BSSA dispositions a clinician selects after completing the assessment. Used because no equivalent LOINC/SNOMED concept set exists for the BSSA disposition tiers."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #emergency-psychiatric-evaluation "Emergency psychiatric evaluation" "Patient is at imminent risk for suicide (current suicidal thoughts). Send to emergency department for extensive mental health evaluation; do not leave alone."
* #further-evaluation-necessary "Further evaluation of risk is necessary" "Elevated but not imminent. Review the safety plan and send home with a mental health referral, preferably within 72 hours."
* #non-urgent-followup "Non-urgent mental health follow-up" "Patient might benefit from non-urgent mental health follow-up. Review the safety plan and send home with a mental health referral."
* #no-intervention "No further intervention necessary at this time" "No ongoing concern warranting further intervention. For all positive screens, follow up at the next appointment."


// ─── ValueSets ────────────────────────────────────────────────

ValueSet: BSSADisposition
Id: bssa-disposition-vs
Title: "BSSA Disposition"
Description: "All four possible BSSA dispositions."
* ^status = #draft
* ^experimental = true
* include codes from system BSSADispositionCodes


ValueSet: BSSADispositionElevated
Id: bssa-disposition-elevated
Title: "BSSA Elevated Disposition"
Description: "The three BSSA dispositions that warrant continued safety action (excludes 'no-intervention'): emergency evaluation, further evaluation, and non-urgent follow-up."
* ^status = #draft
* ^experimental = true
* BSSADispositionCodes#emergency-psychiatric-evaluation
* BSSADispositionCodes#further-evaluation-necessary
* BSSADispositionCodes#non-urgent-followup


ValueSet: BSSASymptom
Id: bssa-symptom-vs
Title: "BSSA Symptom Checklist"
Description: "The BSSA symptom checklist answer options."
* ^status = #draft
* ^experimental = true
* include codes from system BSSASymptomCodes


// ─── Observation profile ─────────────────────────────────────
// SPiER BSSA Disposition Result — the structured outcome resource
// derived from a completed BSSA. The value identifies one of the
// four dispositions using the SPiER-local disposition CodeSystem;
// the Observation code is the generic LOINC 93374-7.

Profile: SPiERBSSADispositionResult
Parent: Observation
Id: spier-bssa-disposition-result
Title: "SPiER BSSA Disposition Result Observation"
Description: "An Observation representing the clinician-selected disposition of a NIMH Brief Suicide Safety Assessment. The value identifies one of four dispositions (emergency psychiatric evaluation / further evaluation necessary / non-urgent follow-up / no intervention) using a SPiER-local CodeSystem."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
* valueCodeableConcept from BSSADisposition (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition ──────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. The AD id and
// canonical URL are unchanged so the TL-005 catalog mapping and the
// clarify-risk stage PlanDefinition action stay stable.

Instance: AdministerBSSA
InstanceOf: ActivityDefinition
Title: "Administer NIMH Brief Suicide Safety Assessment (BSSA)"
Description: "Conduct a Brief Suicide Safety Assessment after a positive suicide-risk screen, persist the interview as a QuestionnaireResponse, and derive a disposition Observation conformant to the SPiER BSSA Disposition Result profile."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerBSSA"
* name = "AdministerBSSA"
* version = "1.0.0"
* title = "Administer NIMH Brief Suicide Safety Assessment (BSSA)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Conduct the NIMH Brief Suicide Safety Assessment (BSSA), a disposition-oriented assessment used after a positive brief screen (e.g. ASQ). Persist responses as a QuestionnaireResponse and derive a disposition Observation conformant to the SPiER BSSA Disposition Result profile."
* purpose = "Gather enough information to determine a clinical disposition after a positive suicide-risk screen. Belongs to the Clarify Risk stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "Brief Suicide Safety Assessment questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/BSSA|1.0.0"


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleBSSADispositionFurtherEval
InstanceOf: SPiERBSSADispositionResult
Title: "Example — BSSA Disposition: Further Evaluation Necessary"
Description: "Sample Observation showing a 'further evaluation of risk is necessary' BSSA disposition for an example patient. Used as a conformance fixture and for human reviewers."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T14:20:00Z"
* derivedFrom[+] = Reference(ExampleBSSAResponse)
* valueCodeableConcept = BSSADispositionCodes#further-evaluation-necessary "Further evaluation of risk is necessary"


Instance: ExampleBSSADispositionEmergency
InstanceOf: SPiERBSSADispositionResult
Title: "Example — BSSA Disposition: Emergency Psychiatric Evaluation"
Description: "Sample Observation showing an 'emergency psychiatric evaluation' BSSA disposition — the most urgent tier (imminent risk; send to ED, do not leave alone)."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T14:20:00Z"
* valueCodeableConcept = BSSADispositionCodes#emergency-psychiatric-evaluation "Emergency psychiatric evaluation"


Instance: ExampleBSSAResponse
InstanceOf: QuestionnaireResponse
Title: "Example — BSSA QuestionnaireResponse (further evaluation necessary)"
Description: "Source BSSA QuestionnaireResponse: past-few-weeks ideation present, no current ideation, has no plan, a prior attempt, intent 3/10, and a 'further evaluation necessary' disposition. The derived SPiERBSSADispositionResult references this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/BSSA"
* subject = Reference(Patient/example)
* authored = "2026-07-15T14:20:00Z"
* item[+].linkId = "current-ideation"
* item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "has-plan"
* item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "intent-scale"
* item[=].answer.valueInteger = 3
* item[+].linkId = "ever-attempt"
* item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[+].linkId = "needs-help-to-be-safe"
* item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[+].linkId = "disposition"
* item[=].answer.valueCoding = http://spier.org/CodeSystem/bssa-disposition#further-evaluation-necessary "Further evaluation of risk is necessary"
