// SPiER Pathway PlanDefinitions
//
// One file per pathway stage's PlanDefinition. Each PD carries a `useContext`
// pointing at the corresponding SPiERPathwayStage code, and groups together
// the ActivityDefinitions (referenced via definitionCanonical) and triggers
// that compose that stage.
//
// Previously these PDs lived inside the tool FSH files that defined their
// flagship ActivityDefinition (e.g. SPiERFlagRiskStage in asq.fsh). They were
// consolidated here so each tool file declares only tool artifacts and the
// pathway assembly happens in one place. (See docs/repo-audit.md §2.)
//
// Stages not yet authored: 5 (Coordinate Handoffs), 6 (Track Follow-Up),
// 8 (Measure and Share).


// ─── Stage 1: Flag Risk ──────────────────────────────────────
// First pathway stage with ASQ as the flagship action. Other Flag Risk tools
// (PHQ-9, C-SSRS Screener, SBQ-R) are layered in as additional actions —
// the order here is presentational; sites can enable any subset.

Instance: SPiERFlagRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Flag Risk Stage"
Description: "Stage 1 of 8 in the SPiER suicide-safer care pathway: capture a suicide-related signal and indicate whether further review is needed. ASQ is the flagship action; PHQ-9, C-SSRS Screener, and SBQ-R are alternates that an implementation can enable in any combination."
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


// ─── Stage 2: Clarify Risk ───────────────────────────────────
// Triggered by a positive ASQ result or a non-zero PHQ-9 Item 9.

Instance: SPiERClarifyRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Clarify Risk Stage"
Description: "Stage 2 of 8: capture the details needed to understand the nature, severity, and context of suicide risk. Triggered by a positive ASQ result or a positive PHQ-9 Item 9. Defined clarify-risk activities are C-SSRS Full and CAMS SSF-5 Section A + Section B."
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
  * description = "Fires when a PHQ-9 Item 9 Observation (LOINC 44260-8) is recorded; the action condition further narrows to any positive integer value (1, 2, or 3 — any endorsement of thoughts of death or self-harm). Item 9 is integer-typed under spier-phq9-item9, so the threshold is expressed via PlanDefinition.action.condition (FHIRPath) rather than DataRequirement.codeFilter, which only filters coded values."
  * trigger[+]
    * type = #data-added
    * name = "phq9Item9Observation"
    * data[+]
      * type = #Observation
      * profile[+] = "http://spier.org/StructureDefinition/spier-phq9-item9"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#44260-8
  * condition[+]
    * kind = #applicability
    * expression
      * language = #text/fhirpath
      * expression = "%phq9Item9Observation.value.exists() and %phq9Item9Observation.value > 0"
* action[+]
  * id = "administer-cssrs-full"
  * title = "Administer C-SSRS Full"
  * description = "Capture the full C-SSRS (lifetime/recent) to clarify suicide-risk nature, severity, and timing."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCSSRSFull"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-cssrs-risk-level"
* action[+]
  * id = "administer-cams-section-a"
  * title = "Administer CAMS SSF-5 Section A (Patient Vitals)"
  * description = "Patient-completed CAMS SSF Core Assessment. Produces six SSF Vital Observations."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSSectionA"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-cams-ssf-vital"
* action[+]
  * id = "administer-cams-section-b"
  * title = "Administer CAMS SSF-5 Section B (Clinician Drivers)"
  * description = "Clinician-completed CAMS driver assessment. Materializes drivers as Condition resources on the problem list."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSSectionB"
  * output[+]
    * type = #Condition
    * profile = "http://spier.org/StructureDefinition/spier-cams-suicide-driver"


// ─── Stage 3: Set Risk Status ────────────────────────────────

Instance: SPiERSetRiskStatusStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Set Risk Status Stage"
Description: "Stage 3 of 8 in the SPiER suicide-safer care pathway: document the current risk status and the clinical reasoning that guides next steps. The CAMS Therapeutic Worksheet is the first concrete action; SAFE-T and similar disposition tools will be added when authored."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERSetRiskStatusStage"
* name = "SPiERSetRiskStatusStage"
* title = "SPiER Pathway — Set Risk Status Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#set-risk-status
* action[+]
  * id = "author-cams-therapeutic-worksheet"
  * title = "Author CAMS Therapeutic Worksheet"
  * description = "Capture the personal narrative, drivers, and crisis working model that inform the patient's risk status and treatment plan."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSTherapeuticWorksheet"
  * output[+]
    * type = #CarePlan
    * profile = "http://spier.org/StructureDefinition/spier-cams-therapeutic-worksheet"


// ─── Stage 4: Document Safety Actions ────────────────────────

Instance: SPiERDocumentSafetyActionsStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Document Safety Actions Stage"
Description: "Stage 4 of 8 in the SPiER suicide-safer care pathway: document concrete actions used to reduce risk and support safety. Stanley-Brown and CAMS Stabilization are the two safety-plan actions an implementation can enable; sites typically pick one based on their treatment model."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERDocumentSafetyActionsStage"
* name = "SPiERDocumentSafetyActionsStage"
* title = "SPiER Pathway — Document Safety Actions Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#document-safety-actions
* action[+]
  * id = "administer-stanley-brown"
  * title = "Author Stanley-Brown Safety Plan"
  * description = "Collaboratively complete a Stanley-Brown Safety Plan with the patient."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerStanleyBrown"
  * output[+]
    * type = #CarePlan
    * profile = "http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan"
* action[+]
  * id = "administer-cams-stabilization-plan"
  * title = "Author CAMS Stabilization Plan"
  * description = "CAMS-framework alternative to Stanley-Brown — five-section plan reviewed and updated each session."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSStabilizationPlan"
  * output[+]
    * type = #CarePlan
    * profile = "http://spier.org/StructureDefinition/spier-cams-stabilization-plan"


// ─── Stage 7: Manage Active Risk ─────────────────────────────

Instance: SPiERManageActiveRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Manage Active Risk Stage"
Description: "Stage 7 of 8 in the SPiER suicide-safer care pathway: keep active suicide-safer care episodes visible, trackable, and escalated when needed. The CAMS interim session is the first concrete action — repeats the SSF Core Assessment at every visit and tracks trend toward resolution."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERManageActiveRiskStage"
* name = "SPiERManageActiveRiskStage"
* title = "SPiER Pathway — Manage Active Risk Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#manage-active-risk
* action[+]
  * id = "administer-cams-interim-session"
  * title = "Administer CAMS Interim Session"
  * description = "Repeat the CAMS Section A SSF Core Assessment to track risk-level trend across CAMS treatment episodes."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSInterimSession"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-cams-ssf-vital"
