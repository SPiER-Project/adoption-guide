// =============================================================
// ASQ — Ask Suicide-Screening Questions
// =============================================================
// Flagship tool for the SPiER FHIR IG. Demonstrates the full
// chain from Questionnaire to ActivityDefinition to derived
// Observation to a PlanDefinition trigger that advances the
// patient from Flag Risk to Clarify Risk.
//
// References the existing Questionnaire authored at
// FHIR-Resources/1-Flag-Risk/ASQ/fhir/questionnaires/questionnaire.json
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
* code = http://loinc.org#93243-5
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
* valueCodeableConcept from ASQResult (required)


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
* title = "Administer ASQ Suicide Screen"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Capture an ASQ screen from the patient (or proxy), persist responses as a QuestionnaireResponse, and derive a disposition Observation conformant to the SPiER ASQ Result profile."
* purpose = "Flag whether a patient has suicide-related signs warranting further clarification. Belongs to the Flag Risk stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225336008 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93243-5 "ASQ suicide risk screening result"
// The Questionnaire used to capture responses for this activity.
// Versioned canonical so future updates of the ASQ form can be tracked
// independent of this ActivityDefinition.
* extension[+]
  * url = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire"
  * valueCanonical = "http://spier.org/Questionnaire/ASQ-Screening-Tool|1.1.0-pilot"


// ─── PlanDefinition: Flag Risk stage ─────────────────────────
// Models the first pathway stage with ASQ as a concrete action.
// Other Flag Risk tools (PHQ-9, C-SSRS Screener, SBQ-R) will be
// added as additional actions when their ActivityDefinitions
// are authored.

Instance: SPiERFlagRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Flag Risk Stage"
Description: "Stage 1 of 8 in the SPiER suicide-safer care pathway: capture a suicide-related signal and indicate whether further review is needed. ASQ is the flagship action; other screening tools will be added as additional actions over time."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERFlagRiskStage"
* name = "SPiERFlagRiskStage"
* title = "SPiER Pathway — Flag Risk Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#flag-risk
* action[+]
  * id = "administer-asq"
  * title = "Administer ASQ"
  * description = "Capture an ASQ screen and derive a disposition Observation."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerASQ"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-asq-result"
* action[+]
  * id = "administer-phq9"
  * title = "Administer PHQ-9"
  * description = "Capture a PHQ-9 depression screen; Item 9 is the gateway to Clarify Risk."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerPHQ9"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-phq9-total-score"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-phq9-item9"
* action[+]
  * id = "administer-cssrs-screener"
  * title = "Administer C-SSRS Screener"
  * description = "Capture a 6-item C-SSRS screener and derive a suicide-risk-level Observation."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCSSRSScreener"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-cssrs-risk-level"
* action[+]
  * id = "administer-sbqr"
  * title = "Administer SBQ-R"
  * description = "Capture a Suicide Behaviors Questionnaire-Revised; score ≥7 advances to Clarify Risk."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerSBQR"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-sbqr-total-score"


// ─── PlanDefinition: Clarify Risk stage (stub with ASQ trigger) ──
// Demonstrates how a positive ASQ result advances the pathway.
// This stage's tools (C-SSRS Full, BSSA, CAMS SSF-5) will be
// authored later; for now the stage exists primarily to anchor
// the trigger logic.

Instance: SPiERClarifyRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Clarify Risk Stage"
Description: "Stage 2 of 8: capture the details needed to understand the nature, severity, and context of suicide risk. Triggered by a positive ASQ result. Specific clarify-risk activities (C-SSRS Full, BSSA, CAMS SSF-5) are stubbed pending future authoring."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERClarifyRiskStage"
* name = "SPiERClarifyRiskStage"
* title = "SPiER Pathway — Clarify Risk Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#clarify-risk
* action[+]
  * id = "on-asq-positive"
  * title = "Evaluate Clarify Risk activities after a positive ASQ"
  * description = "Fires when an Observation conformant to the SPiER ASQ Result profile is recorded with a value in the ASQ Positive Result ValueSet."
  * trigger[+]
    * type = #data-added
    * name = "asq-positive-result"
    * data[+]
      * type = #Observation
      * profile[+] = "http://spier.org/StructureDefinition/spier-asq-result"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#93243-5
      * codeFilter[+]
        * path = "value"
        * valueSet = "http://spier.org/ValueSet/asq-result-positive"
* action[+]
  * id = "on-phq9-item9-positive"
  * title = "Evaluate Clarify Risk activities after PHQ-9 Item 9 positive"
  * description = "Fires when a PHQ-9 Item 9 Observation is recorded with any value > 0 (any endorsement of thoughts of death or self-harm)."
  * trigger[+]
    * type = #data-added
    * name = "phq9-item9-positive"
    * data[+]
      * type = #Observation
      * profile[+] = "http://spier.org/StructureDefinition/spier-phq9-item9"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#44260-8
* action[+]
  * id = "administer-cssrs-full"
  * title = "Administer C-SSRS Full"
  * description = "Capture the full C-SSRS (lifetime/recent) to clarify suicide-risk nature, severity, and timing."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCSSRSFull"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-cssrs-risk-level"


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleASQResultNonAcutePositive
InstanceOf: SPiERASQResult
Title: "Example — ASQ Result: Non-Acute Positive"
Description: "Sample Observation showing a non-acute positive ASQ outcome for an example patient. Used as a conformance fixture and for human reviewers."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93243-5 "ASQ suicide risk screening result"
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
* code = http://loinc.org#93243-5 "ASQ suicide risk screening result"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:35:00Z"
* valueCodeableConcept = ASQResultCodes#acute-positive "Acute Positive"
