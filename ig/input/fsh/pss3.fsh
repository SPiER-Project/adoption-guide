// =============================================================
// PSS-3 — Patient Safety Screener 3
// =============================================================
// Brief universal suicide-risk screen for emergency departments
// and inpatient medical settings (ages 12+), from the NIMH-funded
// ED-SAFE study. Three items (depression, active ideation, lifetime
// attempt + recency) yield a binary suicide-risk result. Belongs to
// the Identify Possible Risk stage; a positive result triggers the
// Clarify Risk stage (see the on-pss3-positive action in
// pathway-stages.fsh), mirroring the ASQ trigger.
//
// References the hand-authored Questionnaire at
// FHIR-Resources/PSS-3/pss3-questionnaire.json
// (canonical: http://spier.org/Questionnaire/PSS-3).
//
// The result -> common suicide-risk-tier crosswalk lives in
// ig/input/fsh/crosswalk-pss3.fsh (pending clinical sign-off).
// =============================================================


// ─── CodeSystems ──────────────────────────────────────────────
// The PSS-3 has NO published panel or per-item LOINC codes, so the
// panel, discrete items, non-response answers, recency options, and
// result all use SPiER-local code systems. The computed result rides
// on the generic LOINC 93374-7 ("Suicide risk level").

CodeSystem: PSS3PanelCodes
Id: pss3-panel
Title: "PSS-3 Panel Codes"
Description: "SPiER-local panel code for the Patient Safety Screener 3. Used because the PSS-3 has no published panel LOINC."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #pss3 "Patient Safety Screener 3 (PSS-3) panel" "Root code for the PSS-3 screening form."


CodeSystem: PSS3ItemCodes
Id: pss3-item
Title: "PSS-3 Item Codes"
Description: "SPiER-local codes for the three PSS-3 screening items, extracted as discrete Observations. The PSS-3 has no published per-item LOINC codes. These MUST stay in sync with the Questionnaire item codes and web/src/lib/observationMappers/pss3.ts."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #depression-2wk "Depression in the past two weeks" "Item 1: felt down, depressed, or hopeless in the past two weeks (a depression lead-in; not counted toward the suicide-risk result)."
* #active-ideation-2wk "Active suicidal ideation in the past two weeks" "Item 2: thoughts of killing yourself in the past two weeks. A 'yes' is a positive suicide-risk screen."
* #lifetime-attempt "Lifetime suicide attempt" "Item 3: ever attempted to kill yourself. A recent attempt (within ~6 months, item 3a) is a positive screen."


CodeSystem: PSS3AnswerCodes
Id: pss3-answer
Title: "PSS-3 Non-Response Answer Codes"
Description: "SPiER-local codes for the PSS-3 non-response answer options (patient unable to complete / patient refused). Yes/No answers use SNOMED CT (373066001 / 373067005)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #unable-to-complete "Patient unable to complete"
* #patient-refused "Patient refused"


CodeSystem: PSS3AttemptRecencyCodes
Id: pss3-attempt-recency
Title: "PSS-3 Attempt Recency Codes"
Description: "SPiER-local codes for the PSS-3 item 3a recency of the most recent lifetime suicide attempt. An attempt within the last ~6 months (the first three codes) is a positive screen."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #within-24-hours "Within past 24 hours (including today)"
* #within-last-month "Within last month (but not today)"
* #between-1-and-6-months "Between 1 and 6 months ago"
* #more-than-6-months "More than 6 months ago"


CodeSystem: PSS3ResultCodes
Id: pss3-result
Title: "PSS-3 Suicide Risk Screening Result Codes"
Description: "SPiER-local code system for the binary PSS-3 suicide-risk screening result. Used because no equivalent LOINC concepts have been published for the PSS-3 result."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #negative "Negative Screen" "No active ideation in the past two weeks and no suicide attempt within the last six months."
* #positive "Positive Screen" "Active ideation in the past two weeks (item 2 'yes') OR a suicide attempt within the last six months (item 3a). Warrants a secondary risk-stratification assessment."


// ─── ValueSets ────────────────────────────────────────────────

ValueSet: PSS3Result
Id: pss3-result-vs
Title: "PSS-3 Result"
Description: "Both possible outcomes of a PSS-3 screen."
* ^status = #draft
* ^experimental = true
* include codes from system PSS3ResultCodes


ValueSet: PSS3ResultPositive
Id: pss3-result-positive
Title: "PSS-3 Positive Result"
Description: "The PSS-3 outcome that should trigger advancement to the Clarify Risk stage."
* ^status = #draft
* ^experimental = true
* PSS3ResultCodes#positive


ValueSet: PSS3AttemptRecency
Id: pss3-attempt-recency-vs
Title: "PSS-3 Attempt Recency"
Description: "The PSS-3 item 3a recency answer options."
* ^status = #draft
* ^experimental = true
* include codes from system PSS3AttemptRecencyCodes


// ─── Observation profile ─────────────────────────────────────
// SPiER PSS-3 Result Observation — the structured outcome resource
// derived from a PSS-3 QuestionnaireResponse. The value is one of two
// result tiers (negative / positive) using the SPiER-local CodeSystem;
// the Observation code is the generic LOINC 93374-7.

Profile: SPiERPSS3Result
Parent: Observation
Id: spier-pss3-result
Title: "SPiER PSS-3 Screening Result Observation"
Description: "An Observation representing the binary suicide-risk result of a Patient Safety Screener 3. The value identifies one of two result tiers (negative / positive) using a SPiER-local CodeSystem."
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
* valueCodeableConcept from PSS3Result (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition ──────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. The AD id and
// canonical URL are unchanged so the TL-011 catalog mapping and the
// identify-possible-risk stage PlanDefinition action stay stable.

Instance: AdministerPSS3
InstanceOf: ActivityDefinition
Title: "Administer Patient Safety Screener-3 (PSS-3)"
Description: "Capture a PSS-3 screen (depression, active ideation, lifetime attempt + recency), persist responses as a QuestionnaireResponse, and derive a binary suicide-risk result Observation conformant to the SPiER PSS-3 Result profile."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerPSS3"
* name = "AdministerPSS3"
* version = "1.0.0"
* title = "Administer Patient Safety Screener-3 (PSS-3)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Capture the Patient Safety Screener 3 (PSS-3), a brief universal suicide-risk screen for acute-care settings, and derive a binary suicide-risk result Observation conformant to the SPiER PSS-3 Result profile. A positive result triggers the Clarify Risk stage."
* purpose = "Provide a rapid universal suicide-risk screen in acute-care settings such as the emergency department. Belongs to the Identify Possible Risk stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "Patient Safety Screener 3 questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/PSS-3|1.0.0"


// ─── Examples ────────────────────────────────────────────────

Instance: ExamplePSS3Positive
InstanceOf: SPiERPSS3Result
Title: "Example — PSS-3 Result: Positive"
Description: "Sample Observation showing a positive PSS-3 suicide-risk screen for an example patient. Used as a conformance fixture and for human reviewers."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T09:10:00Z"
* derivedFrom[+] = Reference(ExamplePSS3ResponsePositive)
* valueCodeableConcept = PSS3ResultCodes#positive "Positive Screen"


Instance: ExamplePSS3ResponsePositive
InstanceOf: QuestionnaireResponse
Title: "Example — PSS-3 QuestionnaireResponse (positive)"
Description: "Source PSS-3 QuestionnaireResponse: depression 'yes', active ideation in the past two weeks 'yes' (→ positive), and no lifetime attempt. The derived SPiERPSS3Result references this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/PSS-3"
* subject = Reference(Patient/example)
* authored = "2026-07-15T09:10:00Z"
* item[+].linkId = "q1-depression"
* item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[+].linkId = "q2-ideation"
* item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[+].linkId = "q3-lifetime-attempt"
* item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "result"
* item[=].answer.valueCoding = http://spier.org/CodeSystem/pss3-result#positive "Positive Screen"
