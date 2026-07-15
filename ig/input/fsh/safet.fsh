// =============================================================
// SAFE-T — Suicide Assessment Five-Step Evaluation and Triage
// =============================================================
// A SAMHSA structured clinical formulation (not a scored survey):
// identify risk factors, identify protective factors, conduct a
// suicide inquiry, determine a risk LEVEL + intervention by clinical
// judgment, and document. Belongs to the Define the Risk Picture
// stage.
//
// SAFE-T lands DIRECTLY on the SPiER concept layer: its derived
// Observation's value binds to the shared suicide-risk-tier ValueSet
// (concept-layer.fsh), so there is no per-instrument crosswalk — the
// risk level IS a common tier code.
//
// References the hand-authored Questionnaire at
// FHIR-Resources/SAFE-T/safet-questionnaire.json
// (canonical: http://spier.org/Questionnaire/SAFE-T).
// =============================================================


// ─── CodeSystems ──────────────────────────────────────────────
// SAFE-T's risk-factor and protective-factor checklists use SPiER-
// local codes (no published code set). The risk LEVEL uses the shared
// spier-suicide-risk-tier CodeSystem directly (see concept-layer.fsh).

CodeSystem: SAFETPanelCodes
Id: safet-panel
Title: "SAFE-T Panel Codes"
Description: "SPiER-local panel code for the SAMHSA SAFE-T structured formulation."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #safet "Suicide Assessment Five-Step Evaluation and Triage (SAFE-T) panel" "Root code for the SAFE-T formulation."


CodeSystem: SAFETRiskFactorCodes
Id: safet-risk-factor
Title: "SAFE-T Risk Factor Codes"
Description: "SPiER-local codes for the SAFE-T Step 1 risk factors (those that can be modified to reduce risk). Captured for context; not extracted as discrete Observations."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #prior-attempt "Prior suicide attempt(s)"
* #substance-use "Alcohol or substance use"
* #mental-health-history "History of mental health concerns, particularly depression and other mood disorders"
* #access-lethal-means "Access to lethal means, including firearms"
* #knows-suicide-loss "Knowing someone who died by suicide, particularly a family member"
* #social-isolation "Social isolation"
* #chronic-disease-disability "Chronic disease and/or disability"
* #lack-bh-access "Lack of access to behavioral health care"
* #prolonged-hopelessness "Prolonged feelings of hopelessness"


CodeSystem: SAFETProtectiveFactorCodes
Id: safet-protective-factor
Title: "SAFE-T Protective Factor Codes"
Description: "SPiER-local codes for the SAFE-T Step 2 protective factors (those that can be enhanced). Even if present, protective factors may not counteract significant acute risk."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #connectedness "Connectedness to people, family, community, and social supports"
* #effective-bh-care "Effective behavioral health care"
* #life-skills "Life skills (problem-solving, coping, emotional regulation, ability to adapt to change)"
* #self-esteem-purpose "Self-esteem and a sense of purpose or meaning in life"
* #beliefs-discourage-suicide "Cultural, religious, or personal beliefs that discourage suicide"
* #no-access-lethal-means "No access to lethal means"


// ─── ValueSets ────────────────────────────────────────────────

ValueSet: SAFETRiskFactor
Id: safet-risk-factor-vs
Title: "SAFE-T Risk Factors"
Description: "The SAFE-T Step 1 risk-factor checklist options."
* ^status = #draft
* ^experimental = true
* include codes from system SAFETRiskFactorCodes


ValueSet: SAFETProtectiveFactor
Id: safet-protective-factor-vs
Title: "SAFE-T Protective Factors"
Description: "The SAFE-T Step 2 protective-factor checklist options."
* ^status = #draft
* ^experimental = true
* include codes from system SAFETProtectiveFactorCodes


// ─── Observation profile ─────────────────────────────────────
// SPiER SAFE-T Risk Level — the structured outcome derived from a
// SAFE-T formulation. Unlike the ASQ/PSS-3 result profiles (which
// carry a per-instrument disposition value and are crosswalked to
// the tier), SAFE-T's value binds DIRECTLY to the shared
// suicide-risk-tier ValueSet — it lands on the concept layer with no
// intermediate crosswalk.

Profile: SPiERSAFETRiskLevel
Parent: Observation
Id: spier-safet-risk-level
Title: "SPiER SAFE-T Risk Level Observation"
Description: "An Observation representing the clinician-determined suicide-risk level from a SAFE-T formulation. The value is a common suicide-risk tier (low / moderate / high) bound directly to the shared SPiER Suicide Risk Tier ValueSet — SAFE-T lands on the concept layer without a per-instrument crosswalk."
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
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition ──────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. The AD id and
// canonical URL are unchanged so the TL-006 catalog mapping and the
// define-risk-picture stage PlanDefinition action stay stable.

Instance: AdministerSAFET
InstanceOf: ActivityDefinition
Title: "Administer SAFE-T"
Description: "Conduct a SAFE-T (Suicide Assessment Five-Step Evaluation and Triage) structured formulation, persist it as a QuestionnaireResponse, and derive a suicide-risk-level Observation conformant to the SPiER SAFE-T Risk Level profile (value = a common suicide-risk tier)."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerSAFET"
* name = "AdministerSAFET"
* version = "1.0.0"
* title = "Administer SAFE-T"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Conduct the SAMHSA SAFE-T (Suicide Assessment Five-Step Evaluation and Triage) structured formulation and derive a suicide-risk-level Observation conformant to the SPiER SAFE-T Risk Level profile. The risk level binds directly to the shared suicide-risk tier."
* purpose = "Support structured clinical formulation of suicide risk, the documented risk level with rationale, and corresponding triage/disposition. Belongs to the Define the Risk Picture stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "SAFE-T questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/SAFE-T|1.0.0"


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleSAFETRiskLevelModerate
InstanceOf: SPiERSAFETRiskLevel
Title: "Example — SAFE-T Risk Level: Moderate"
Description: "Sample Observation showing a moderate SAFE-T risk-level determination for an example patient. The value is the shared-tier code, so this Observation is directly comparable across instruments."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T15:05:00Z"
* derivedFrom[+] = Reference(ExampleSAFETResponse)
* valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* note.text = "Rationale: suicidal ideation with a plan but no intent or behavior; multiple risk factors, few protective factors."


Instance: ExampleSAFETResponse
InstanceOf: QuestionnaireResponse
Title: "Example — SAFE-T QuestionnaireResponse (moderate risk)"
Description: "Source SAFE-T QuestionnaireResponse: two risk factors, one protective factor, ideation and plan present without intent, and a moderate risk-level determination. The derived SPiERSAFETRiskLevel references this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/SAFE-T"
* subject = Reference(Patient/example)
* authored = "2026-07-15T15:05:00Z"
* item[+].linkId = "step1-risk-factors"
* item[=].answer[+].valueCoding = http://spier.org/CodeSystem/safet-risk-factor#prior-attempt "Prior suicide attempt(s)"
* item[=].answer[+].valueCoding = http://spier.org/CodeSystem/safet-risk-factor#prolonged-hopelessness "Prolonged feelings of hopelessness"
* item[+].linkId = "step2-protective-factors"
* item[=].answer.valueCoding = http://spier.org/CodeSystem/safet-protective-factor#connectedness "Connectedness to people, family, community, and social supports"
* item[+].linkId = "step4-risk-level-intervention"
* item[=].item[+].linkId = "risk-level"
* item[=].item[=].answer.valueCoding = http://spier.org/CodeSystem/spier-suicide-risk-tier#moderate "Moderate risk"
