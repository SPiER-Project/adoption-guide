// =============================================================
// PSS Full — Patient Safety Screener / Suicide Risk Screener (Full)
// =============================================================
// A combined acute-care instrument: the public ED-SAFE PSS-3 universal
// screen (three items) paired with a SITE-DEFINED risk-stratification
// step. Used at the Clarify Risk stage where a single combined
// screen-and-stratify tool is preferred.
//
// The risk level is a site-defined clinical-judgment determination that
// maps onto the common tiers, so — like SAFE-T — the derived Observation's
// value binds DIRECTLY to the shared suicide-risk-tier ValueSet
// (concept-layer.fsh); there is no per-instrument crosswalk.
//
// Licensing: the PSS-3 screening items are the free ED-SAFE/SAMHSA/SPRC
// public tool; the stratification step is site-defined. Used under the
// license/permission held by the SPiER project (maintainer-confirmed
// 2026-07-15). See FHIR-Resources/PSS-Full/licensing/MEMO.md.
//
// Existing Questionnaire:
//   http://spier.org/Questionnaire/PSS-Full|1.0.0
// =============================================================


// ─── Observation profile ─────────────────────────────────────

Profile: SPiERPSSFullRiskLevel
Parent: Observation
Id: spier-pss-full-risk-level
Title: "SPiER PSS Full Risk Level Observation"
Description: "The site-stratified suicide-risk level from the full Patient Safety Screener / Suicide Risk Screener. Value is a common suicide-risk tier (low / moderate / high) bound directly to the shared SPiER Suicide Risk Tier ValueSet — the combined screen lands on the concept layer without a per-instrument crosswalk."
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
* valueCodeableConcept from SPiERSuicideRiskTierVS (required)
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition ──────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. The AD id and canonical
// URL are unchanged so the TL-014 catalog mapping and the clarify-risk
// stage PlanDefinition action stay stable.

Instance: AdministerPSSFull
InstanceOf: ActivityDefinition
Title: "Administer Patient Safety Screener / Suicide Risk Screener (Full)"
Description: "Capture the full Patient Safety Screener / Suicide Risk Screener — the ED-SAFE PSS-3 universal screen plus a site-defined risk-stratification step — and derive a suicide-risk-level Observation conformant to the SPiER PSS Full Risk Level profile (value on the shared tier)."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerPSSFull"
* name = "AdministerPSSFull"
* version = "1.0.0"
* title = "Administer Patient Safety Screener / Suicide Risk Screener (Full)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Capture the full Patient Safety Screener / Suicide Risk Screener — a combined acute-care screen (public ED-SAFE PSS-3 items) with a site-defined risk-stratification step — and derive a suicide-risk-level Observation whose value is a common suicide-risk tier."
* purpose = "Clarify suicide risk in acute care with a combined screen and a site-defined risk-stratification step. Belongs to the Clarify Risk stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "Patient Safety Screener / Suicide Risk Screener (Full) questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/PSS-Full|1.0.0"


// ─── Examples ────────────────────────────────────────────────

Instance: ExamplePSSFullModerateRisk
InstanceOf: SPiERPSSFullRiskLevel
Title: "Example — PSS Full Risk Level: Moderate"
Description: "Sample risk-level Observation from a full PSS combined screen where the site protocol stratified the patient to moderate risk. Value is the shared-tier code, so it is directly comparable across instruments."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T09:40:00Z"
* derivedFrom[+] = Reference(ExamplePSSFullResponse)
* valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* note.text = "Positive universal screen (active ideation); site protocol stratified to moderate risk."


Instance: ExamplePSSFullResponse
InstanceOf: QuestionnaireResponse
Title: "Example — PSS Full QuestionnaireResponse (moderate risk)"
Description: "Source PSS Full QuestionnaireResponse: positive active ideation on the universal screen, stratified to moderate risk by the site protocol. The derived SPiERPSSFullRiskLevel references this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/PSS-Full"
* subject = Reference(Patient/example)
* authored = "2026-07-15T09:40:00Z"
* item[+].linkId = "q2-ideation"
* item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[+].linkId = "risk-level"
* item[=].answer.valueCoding = http://spier.org/CodeSystem/spier-suicide-risk-tier#moderate "Moderate risk"
