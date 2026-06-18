// =============================================================
// C-SSRS — Columbia Suicide Severity Rating Scale
// =============================================================
// SPiER models two C-SSRS variants:
//   - Screener (Flag Risk): 6-item rapid screen
//   - Full Lifetime/Recent (Clarify Risk): full instrument with
//     lifetime and recent ideation/behavior tracking and an
//     intensity section
//
// Both produce a derived suicide-risk-level Observation using a
// shared SPiER-local CodeSystem (none/low/moderate/high).
//
// Existing Questionnaires:
//   http://spier.org/Questionnaire/C-SSRS-Screener|1.0.0
//   http://spier.org/Questionnaire/C-SSRS-Full-Lifetime-Recent|1.0.0
// =============================================================


// ─── Shared CodeSystem + ValueSet ────────────────────────────

CodeSystem: CSSRSRiskLevelCodes
Id: cssrs-risk-level
Title: "C-SSRS Risk Level Codes"
Description: "SPiER-local code system for the derived risk level from a C-SSRS screener or full assessment. LOINC 93374-7 'Suicide risk level' carries a normative answer list (LL465-6: Low / Moderate / High); this local system extends that list with a `none` value (no C-SSRS items endorsed) that LOINC does not provide, and aligns display names with the SPiER suicide-risk tier. The derived Observation SHOULD dual-code its value with the matching LOINC answer code (LA9194-7 / LA6751-7 / LA9193-9) so HL7-aligned consumers — e.g. the HL7 US Behavioral Health Profiles IG — can interpret it without understanding the SPiER-local vocabulary."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #none "None" "No C-SSRS items endorsed. No risk identified."
* #low "Low" "Wish to be dead or non-specific active suicidal thoughts (items 1–2 positive) without method, intent, plan, or behavior."
* #moderate "Moderate" "Active ideation with methods or some intent (items 3–4 positive)."
* #high "High" "Active ideation with specific plan and intent (item 5), and/or any suicidal behavior (item 6)."


ValueSet: CSSRSRiskLevel
Id: cssrs-risk-level
Title: "C-SSRS Risk Level"
Description: "All four C-SSRS derived risk levels."
* ^status = #draft
* ^experimental = true
* include codes from system CSSRSRiskLevelCodes


// ─── Shared Observation profile ──────────────────────────────

Profile: SPiERCSSRSRiskLevel
Parent: Observation
Id: spier-cssrs-risk-level
Title: "SPiER C-SSRS Risk Level Observation"
Description: "Derived risk-level Observation produced by either the C-SSRS Screener or the full C-SSRS Lifetime/Recent assessment. Value is one of none/low/moderate/high from the SPiER C-SSRS risk-level CodeSystem."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
* code = http://loinc.org#93374-7
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
// Required: at least one coding from the SPiER-local C-SSRS risk-level set
// (this is the only set with a `none` value). Producers SHOULD additionally
// include the matching LOINC answer code (LL465-6: LA9194-7 Low / LA6751-7
// Moderate / LA9193-9 High) as a second coding so HL7-aligned consumers can
// read the value natively. The `none` level has no LOINC equivalent.
* valueCodeableConcept from CSSRSRiskLevel (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition: C-SSRS Screener ─────────────────────

Instance: AdministerCSSRSScreener
InstanceOf: ActivityDefinition
Title: "Administer C-SSRS Screener"
Description: "Capture a 6-item Columbia Suicide Severity Rating Scale screener and derive a suicide-risk-level Observation."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCSSRSScreener"
* name = "AdministerCSSRSScreener"
* version = "0.1.0"
* title = "Administer C-SSRS Screener"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Capture a 6-item C-SSRS screener (items 1–5 for ideation, item 6 for behavior) and derive a suicide-risk-level Observation."
* purpose = "Rapidly screen for suicide ideation and behavior at the Flag Risk stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "C-SSRS Screener questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/C-SSRS-Screener|1.0.0"


// ─── ActivityDefinition: C-SSRS Full ─────────────────────────

Instance: AdministerCSSRSFull
InstanceOf: ActivityDefinition
Title: "Administer C-SSRS Full (Lifetime/Recent)"
Description: "Capture the full Columbia Suicide Severity Rating Scale with both lifetime and recent ideation/behavior tracking, plus an intensity section, and derive a suicide-risk-level Observation."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCSSRSFull"
* name = "AdministerCSSRSFull"
* version = "0.1.0"
* title = "Administer C-SSRS Full (Lifetime/Recent)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Capture the full C-SSRS instrument (ideation 1–5 with lifetime/recent dimensions, behavior with attempt subtypes, intensity section), and derive a suicide-risk-level Observation."
* purpose = "Clarify the nature, severity, and timing of suicide-related ideation and behavior. Used at the Clarify Risk stage following a positive screen."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "C-SSRS Full (Lifetime/Recent) questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/C-SSRS-Full-Lifetime-Recent|1.0.0"


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleCSSRSScreenerHighRisk
InstanceOf: SPiERCSSRSRiskLevel
Title: "Example — C-SSRS Screener: High Risk"
Description: "Sample risk-level Observation from a C-SSRS screener with item 5 (active ideation with specific plan and intent) endorsed."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T11:00:00Z"
// Dual-coded: SPiER-local tier + matching LOINC answer (LL465-6) for HL7 interop.
* valueCodeableConcept.coding[0] = CSSRSRiskLevelCodes#high "High"
* valueCodeableConcept.coding[1] = http://loinc.org#LA9193-9 "High"
* valueCodeableConcept.text = "High Risk — specific plan with intent"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#H "High"


Instance: ExampleCSSRSFullModerateRisk
InstanceOf: SPiERCSSRSRiskLevel
Title: "Example — C-SSRS Full: Moderate Risk"
Description: "Sample risk-level Observation from a full C-SSRS with item 3 (active ideation with methods, no intent) endorsed in the recent timeframe."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T11:15:00Z"
// Dual-coded: SPiER-local tier + matching LOINC answer (LL465-6) for HL7 interop.
* valueCodeableConcept.coding[0] = CSSRSRiskLevelCodes#moderate "Moderate"
* valueCodeableConcept.coding[1] = http://loinc.org#LA6751-7 "Moderate"
* valueCodeableConcept.text = "Moderate Risk — ideation with method, no intent"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#A "Abnormal"


Instance: ExampleCSSRSScreenerResponse
InstanceOf: QuestionnaireResponse
Title: "Example — C-SSRS Screener QuestionnaireResponse (high risk)"
Description: "Source C-SSRS Screener QuestionnaireResponse with high-risk ideation endorsed. The derived SPiERCSSRSRiskLevel and the harmonized concept Observation reference this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/C-SSRS-Screener"
* subject = Reference(Patient/example)
* authored = "2026-03-19T11:00:00Z"
* item[+].linkId = "q1"
* item[=].answer.valueBoolean = true
* item[+].linkId = "q5"
* item[=].answer.valueBoolean = true
