// =============================================================
// ASQ — Ask Suicide-Screening Questions
// =============================================================
// Flagship tool for the SPiER FHIR IG. Demonstrates the full
// chain from Questionnaire to ActivityDefinition to derived
// Observation to a PlanDefinition trigger that advances the
// patient from Flag Risk to Clarify Risk.
//
// References the existing Questionnaire authored at
// FHIR-Resources/ASQ/fhir/questionnaires/questionnaire.json
// (canonical: http://spier.org/Questionnaire/ASQ-Screening-Tool).
// =============================================================


// ─── CodeSystem ───────────────────────────────────────────────
// Local codes for ASQ outcomes. Mirrors the codes currently used
// by web/src/observationMappers.ts so the IG matches runtime
// data. Replace with published LOINC codes if/when they exist.

CodeSystem: ASQResultCodes
Id: asq-screening-result
Title: "ASQ Suicide Risk Screening Result Codes"
Description: "SPiER-local code system for the three possible outcomes of the NIMH ASQ screener. Used because no equivalent LOINC concepts have been published for the disposition tiers."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #negative "Negative" "All ASQ items 1–4 answered 'no'. No suicide-risk screening signal."
* #non-acute-positive "Non-Acute Positive" "Any of items 1–4 answered 'yes' AND the acuity question (item 5) answered 'no'. Refer for further suicide-risk assessment within the same visit."
* #acute-positive "Acute Positive" "The acuity question (item 5) answered 'yes'. Do not leave patient alone; initiate emergency safety procedures."


// ─── ValueSets ────────────────────────────────────────────────

ValueSet: ASQResult
Id: asq-result
Title: "ASQ Result"
Description: "All three possible outcomes of an ASQ screen."
* ^status = #draft
* ^experimental = true
* include codes from system ASQResultCodes


ValueSet: ASQResultPositive
Id: asq-result-positive
Title: "ASQ Positive Result"
Description: "The two ASQ outcomes that should trigger advancement to the Clarify Risk stage (excludes 'negative')."
* ^status = #draft
* ^experimental = true
* ASQResultCodes#non-acute-positive
* ASQResultCodes#acute-positive


// ─── Observation profile ─────────────────────────────────────
// SPiER ASQ Result Observation — the structured outcome
// resource derived from an ASQ QuestionnaireResponse.

Profile: SPiERASQResult
Parent: Observation
Id: spier-asq-result
Title: "SPiER ASQ Screening Result Observation"
Description: "An Observation representing the disposition of an ASQ suicide-risk screen. The value identifies one of three result tiers (negative / non-acute-positive / acute-positive) using a SPiER-local CodeSystem."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
// Survey category should appear as one of the codings; not formally sliced
// in v0.1 of the profile to keep the constraint readable. Future iterations
// can add a discriminator-based slice on category.coding when more category
// types are introduced.
* category.coding 1..*
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
* valueCodeableConcept from ASQResult (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition ──────────────────────────────────────
// Declares the "administer ASQ" workflow step that the pathway
// can plug in. Points at the existing Questionnaire and at the
// expected Observation shape.

Instance: AdministerASQ
InstanceOf: ActivityDefinition
Title: "Administer ASQ Suicide Screen"
Description: "Capture an ASQ screen from the patient (or proxy), persist responses as a QuestionnaireResponse, and derive a disposition Observation conformant to the SPiER ASQ Result profile."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerASQ"
* name = "AdministerASQ"
* version = "0.1.0"
* title = "Administer ASQ Suicide Screen"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Capture an ASQ screen from the patient (or proxy), persist responses as a QuestionnaireResponse, and derive a disposition Observation conformant to the SPiER ASQ Result profile."
* purpose = "Flag whether a patient has suicide-related signs warranting further clarification. Belongs to the Flag Risk stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
// The Questionnaire used to capture responses for this activity.
// Versioned canonical so future updates of the ASQ form can be tracked
// independent of this ActivityDefinition.
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "ASQ Screening Tool questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/ASQ-Screening-Tool|1.1.0-pilot"


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleASQResultNonAcutePositive
InstanceOf: SPiERASQResult
Title: "Example — ASQ Result: Non-Acute Positive"
Description: "Sample Observation showing a non-acute positive ASQ outcome for an example patient. Used as a conformance fixture and for human reviewers."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:35:00Z"
* valueCodeableConcept = ASQResultCodes#non-acute-positive "Non-Acute Positive"


Instance: ExampleASQResultAcutePositive
InstanceOf: SPiERASQResult
Title: "Example — ASQ Result: Acute Positive"
Description: "Sample Observation showing an acute positive ASQ outcome. Triggers the most urgent disposition (do-not-leave-alone, initiate emergency safety procedures)."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:35:00Z"
* valueCodeableConcept = ASQResultCodes#acute-positive "Acute Positive"


Instance: ExampleASQResponseNonAcute
InstanceOf: QuestionnaireResponse
Title: "Example — ASQ QuestionnaireResponse (non-acute positive)"
Description: "Source ASQ QuestionnaireResponse: a baseline item is 'yes' and the acuity item is 'no' — a non-acute positive screen. The derived SPiERASQResult and the harmonized concept Observation reference this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/ASQ-Screening-Tool"
* subject = Reference(Patient/example)
* authored = "2026-03-19T10:35:00Z"
* item[+].linkId = "q1"
* item[=].answer.valueCoding = http://snomed.info/sct#373066001
* item[+].linkId = "q5"
* item[=].answer.valueCoding = http://snomed.info/sct#373067005
