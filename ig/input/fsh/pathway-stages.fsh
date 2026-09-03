// SPiER Pathway PlanDefinitions
//
// One file per pathway stage's PlanDefinition. Each PD carries a `useContext`
// pointing at the corresponding SPiERPathwayStage code, and groups together
// the ActivityDefinitions (referenced via definitionCanonical) and triggers
// that compose that stage.
//
// Previously these PDs lived inside the tool FSH files that defined their
// flagship ActivityDefinition (e.g. the Identify stage PD in asq.fsh). They
// were consolidated here so each tool file declares only tool artifacts and
// the pathway assembly happens in one place. (See docs/repo-audit.md §2.)
//
// Stage structure follows the SSC-mapped Salesforce stage tiles (see
// docs/reference/ssc-stage-tiles-question-set.md): eight tiles, each with a
// defined tool/functionality list. Tools without full FHIR modelling use the
// minimal placeholder ActivityDefinitions in pathway-tool-placeholders.fsh.


// ─── Stage 1: Identify Possible Risk ─────────────────────────
// First pathway stage with ASQ as the flagship action. Other identification
// tools (PHQ-9 Item 9, SBQ-R, PSS-3) are layered in as additional actions — the
// order here is presentational; sites can enable any subset.
// ⚠️ The C-SSRS Screener is NOT listed here: it is the Clarify Risk stage's
// demonstrated realization (see that stage, and suicide-safer-care-pathway.fsh).

Instance: SPiERIdentifyPossibleRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Identify Possible Risk Stage"
Description: "Stage 1 of 8 in the SPiER suicide-safer care pathway: find a suicide-risk signal and determine whether more review is needed. ASQ is the flagship action; PHQ-9 Item 9, SBQ-R and PSS-3 are alternates that an implementation can enable in any combination. The C-SSRS Screener with Triage Points belongs to the Clarify Risk stage as the pathway's demonstrated realization of assessing after a positive screen; its result also crosswalks into the concept layer, so a site that leads with it satisfies this stage too."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERIdentifyPossibleRiskStage"
* name = "SPiERIdentifyPossibleRiskStage"
* version = "0.1.0"
* title = "SPiER Pathway — Identify Possible Risk Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#identify-possible-risk
* action[+]
  * id = "administer-asq"
  * title = "Administer ASQ"
  * description = "Capture an ASQ screen and derive a disposition Observation."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerASQ"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-asq-result"
* action[+]
  * id = "administer-phq9"
  * title = "Administer PHQ-9 / PHQ-A (Item 9 Trigger)"
  * description = "Capture a PHQ-9 depression screen; Item 9 is the gateway to Clarify Risk."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerPHQ9"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-total-score"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-item9"
* action[+]
  * id = "administer-sbqr"
  * title = "Administer SBQ-R"
  * description = "Capture a Suicide Behaviors Questionnaire-Revised; score ≥7 advances to Clarify Risk."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerSBQR"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-sbqr-total-score"
* action[+]
  * id = "administer-pss3"
  * title = "Administer Patient Safety Screener-3 (PSS-3)"
  * description = "Brief universal acute-care suicide screen. Yields a binary result Observation (SPiERPSS3Result); a positive result triggers the Clarify Risk stage."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerPSS3"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-pss3-result"
* action[+]
  * id = "administer-cssrs-pediatric"
  * title = "Administer C-SSRS Pediatric / Adolescent Version"
  * description = "Pediatric/adolescent C-SSRS screening. Yields a suicide-risk-level Observation (shared SPiERCSSRSRiskLevel profile)."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSPediatric"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cssrs-risk-level"
// Placeholder tool (see pathway-tool-placeholders.fsh) — catalogued but not yet
// fully FHIR-modelled, so no output profile is declared.
* action[+]
  * id = "trigger-suicide-risk-workflow"
  * title = "Positive Screen Flag / Suicide-Risk Workflow Trigger"
  * description = "Create a suicide-risk flag or start the suicide-risk workflow after a positive screen. Placeholder — trigger logic not yet FHIR-modelled here (see the Clarify Risk stage triggers for the encoded ASQ/PHQ-9 cases)."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/TriggerSuicideRiskWorkflow"


// ─── Stage 2: Clarify Risk ───────────────────────────────────
// Triggered by a positive ASQ result or a non-zero PHQ-9 Item 9.

Instance: SPiERClarifyRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Clarify Risk Stage"
Description: "Stage 2 of 8: after a suicide-risk signal is identified, capture what is going on clinically — suicidal thoughts, plan, intent, behavior history, access to means, risk and protective factors, and whether further action is needed. Triggered by a positive ASQ result or a positive PHQ-9 Item 9. Fully modelled clarify-risk activities are the C-SSRS Screener with Triage Points (the SPiER Suicide Safer Care Pathway's demonstrated realization of this step), C-SSRS Full and the CAMS SSF-5 (Sections A and B plus interim re-ratings and outcome/disposition)."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERClarifyRiskStage"
* name = "SPiERClarifyRiskStage"
* version = "0.1.0"
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
      * profile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-asq-result"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#93374-7
      * codeFilter[+]
        * path = "value"
        * valueSet = "http://thespierproject.org/fhir/ValueSet/asq-result-positive"
* action[+]
  * id = "on-pss3-positive"
  * title = "Evaluate Clarify Risk activities after a positive PSS-3"
  * description = "Fires when an Observation conformant to the SPiER PSS-3 Result profile is recorded with a value in the PSS-3 Positive Result ValueSet."
  * trigger[+]
    * type = #data-added
    * name = "pss3-positive-result"
    * data[+]
      * type = #Observation
      * profile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-pss3-result"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#93374-7
      * codeFilter[+]
        * path = "value"
        * valueSet = "http://thespierproject.org/fhir/ValueSet/pss3-result-positive"
* action[+]
  * id = "on-phq9-item9-positive"
  * title = "Evaluate Clarify Risk activities after PHQ-9 Item 9 positive"
  * description = "Fires when a PHQ-9 Item 9 Observation (LOINC 44260-8) is recorded; the action condition further narrows to any positive integer value (1, 2, or 3 — any endorsement of thoughts of death or self-harm). Item 9 is integer-typed under spier-phq9-item9, so the threshold is expressed via PlanDefinition.action.condition (FHIRPath) rather than DataRequirement.codeFilter, which only filters coded values."
  * trigger[+]
    * type = #data-added
    * name = "phq9Item9Observation"
    * data[+]
      * type = #Observation
      * profile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-item9"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#44260-8
  * condition[+]
    * kind = #applicability
    * expression
      * language = #text/fhirpath
      * expression = "%phq9Item9Observation.value.exists() and %phq9Item9Observation.value > 0"
// ⚠️ The C-SSRS Screener is a CLARIFY RISK tool, not a screen — moved here from
// the Identify stage on 2026-09-02. PlanDefinition/SPiERSuicideSaferCarePathway
// names AdministerCSSRSScreener as the demonstrated realization of "assess
// suicide risk after a positive screen" (suicide-safer-care-pathway.fsh), and
// the tool catalog derives EVERY tool's stage from which stage PlanDefinition
// references its ActivityDefinition (tools.ts, STAGE_BY_AD_URL). Listed under
// Identify, the PHQ-9 → C-SSRS workflow could not flow: a completed screener
// landed in stage 1, "Clarify Risk" stayed active offering only the full scale,
// and the pathway page and the chart disagreed about what the screener is for.
// Its result still crosswalks into the concept layer, so a site that leads with
// it satisfies the screen step as well (the pathway's Transportability note).
* action[+]
  * id = "administer-cssrs-screener"
  * title = "Administer C-SSRS Screener with Triage Points"
  * description = "Capture the 6-item C-SSRS Screener with Triage Points after a positive screen and derive the harmonized suicide-risk-level Observation the tier branch reads."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSScreener"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cssrs-risk-level"
* action[+]
  * id = "administer-cssrs-full"
  * title = "Administer C-SSRS Full Scale (Lifetime + Recent)"
  * description = "Capture the full C-SSRS (lifetime/recent) to clarify suicide-risk nature, severity, and timing."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSFull"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cssrs-risk-level"
// The CAMS SSF-5 is ONE catalogued tool spanning its session-specific forms
// (First Session Sections A/B, Interim re-ratings, Outcome/Disposition) — do
// not split it into separate stage tools. The session forms remain distinct
// ActivityDefinitions so each keeps its own output contract.
* action[+]
  * id = "administer-cams-section-a"
  * title = "Administer CAMS SSF-5 Section A (Patient Vitals)"
  * description = "Patient-completed CAMS SSF Core Assessment. Produces six SSF Vital Observations."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSSectionA"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-ssf-vital"
* action[+]
  * id = "administer-cams-section-b"
  * title = "Administer CAMS SSF-5 Section B (Clinician Drivers)"
  * description = "Clinician-completed CAMS driver assessment. Materializes drivers as Condition resources on the problem list."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSSectionB"
  * output[+]
    * type = #Condition
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-suicide-driver"
* action[+]
  * id = "administer-cams-interim-session"
  * title = "Administer CAMS Interim Session (SSF Re-Rating)"
  * description = "Repeat the CAMS Section A SSF Core Assessment to track risk-level trend across the CAMS episode."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSInterimSession"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-ssf-vital"
* action[+]
  * id = "administer-cams-outcome-disposition"
  * title = "Administer CAMS SSF-5 Outcome/Disposition (Final Session)"
  * description = "Final CAMS session: re-rate SSF vitals and record the episode disposition. Yields SSF Vital Observations plus a disposition Observation (SPiERCAMSOutcomeDisposition)."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSOutcomeDisposition"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-ssf-vital"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-outcome-disposition"
// BSSA and C-SSRS Since Last Visit are fully FHIR-modelled (bssa.fsh, cssrs.fsh).
// The remaining placeholder tools below (see pathway-tool-placeholders.fsh) are
// catalogued but not yet fully FHIR-modelled, so no output profile is declared.
* action[+]
  * id = "administer-bssa"
  * title = "Administer NIMH Brief Suicide Safety Assessment (BSSA)"
  * description = "Disposition-oriented assessment after a positive ASQ. Yields a disposition Observation (SPiERBSSADispositionResult) crosswalked to the common suicide-risk tier."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerBSSA"
* action[+]
  * id = "administer-cssrs-since-last-contact"
  * title = "Administer C-SSRS Since Last Visit / Since Last Contact"
  * description = "Repeat C-SSRS assessment scoped to the interval since the prior contact. Yields a suicide-risk-level Observation (shared SPiERCSSRSRiskLevel profile)."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSSinceLastContact"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cssrs-risk-level"
* action[+]
  * id = "administer-pss-full"
  * title = "Administer Patient Safety Screener / Suicide Risk Screener (Full)"
  * description = "Combined acute-care screen (PSS-3 items) with a site-defined stratification step. Yields a suicide-risk-level Observation (SPiERPSSFullRiskLevel) whose value is a common suicide-risk tier."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerPSSFull"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-pss-full-risk-level"
* action[+]
  * id = "administer-cars-s"
  * title = "Administer Cultural Assessment of Risk for Suicide (CARS-S)"
  * description = "Culturally informed risk and protective-factor assessment. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCARSS"
* action[+]
  * id = "administer-local-risk-assessment"
  * title = "Administer Full Suicide-Risk Assessment / Local Assessment Tool"
  * description = "Site-defined full suicide-risk assessment for EHRs that do not use one of the named tools. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerLocalRiskAssessment"


// ─── Stage 3: Define the Risk Picture ────────────────────────

Instance: SPiERDefineRiskPictureStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Define the Risk Picture Stage"
Description: "Stage 3 of 8 in the SPiER suicide-safer care pathway: document the current risk status and the clinical reasoning that guides next steps. The CAMS Therapeutic Worksheet is the first concrete action; SAFE-T remains a catalogued placeholder."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERDefineRiskPictureStage"
* name = "SPiERDefineRiskPictureStage"
* version = "0.1.0"
* title = "SPiER Pathway — Define the Risk Picture Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#define-risk-picture
* action[+]
  * id = "author-cams-therapeutic-worksheet"
  * title = "Author CAMS Therapeutic Worksheet"
  * description = "Capture the personal narrative, drivers, and crisis working model that inform the patient's risk status and treatment plan."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSTherapeuticWorksheet"
  * output[+]
    * type = #CarePlan
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-therapeutic-worksheet"
* action[+]
  * id = "administer-safe-t"
  * title = "Administer SAFE-T"
  * description = "Structured clinical formulation and triage. Yields a suicide-risk-level Observation (SPiERSAFETRiskLevel) whose value is a common suicide-risk tier."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerSAFET"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-safet-risk-level"


// ─── Stage 4: Document Safety Actions ────────────────────────

Instance: SPiERDocumentSafetyActionsStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Document Safety Actions Stage"
Description: "Stage 4 of 8 in the SPiER suicide-safer care pathway: document concrete actions used to reduce risk and support safety. Stanley-Brown and the CAMS Stabilization Support Plan are the two safety-plan actions an implementation can enable; lethal means safety counseling, crisis response planning, and patient-facing crisis resources complete the tile."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERDocumentSafetyActionsStage"
* name = "SPiERDocumentSafetyActionsStage"
* version = "0.1.0"
* title = "SPiER Pathway — Document Safety Actions Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#document-safety-actions
// The only action in the pathway that declares its transformation. The
// safety plan is captured as a QuestionnaireResponse and has to become a
// CarePlan; until #229 that step existed only as TypeScript in the demo app
// (web/src/lib/carePlanMappers/stanleyBrown.ts), so a partner could read the
// Questionnaire and the CarePlan profile and still not know how one becomes
// the other. `transform` names the StructureMap that says.
* action[+]
  * id = "administer-stanley-brown"
  * title = "Author Stanley-Brown Safety Plan / Safety Planning Intervention"
  * description = "Collaboratively complete a Stanley-Brown Safety Plan with the patient. The completed QuestionnaireResponse is transformed into the safety-plan CarePlan by StanleyBrownQRToCarePlan."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown"
  // Declared so `transform` is unambiguous: it consumes the QuestionnaireResponse
  // for http://thespierproject.org/fhir/Questionnaire/StanleyBrownSafetyPlan, which the
  // ActivityDefinition names as its depends-on relatedArtifact.
  * input[+]
    * type = #QuestionnaireResponse
  * transform = "http://thespierproject.org/fhir/StructureMap/StanleyBrownQRToCarePlan"
  * output[+]
    * type = #CarePlan
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan"
* action[+]
  * id = "administer-cams-stabilization-plan"
  * title = "Author CAMS Stabilization Support Plan"
  * description = "CAMS-framework alternative to Stanley-Brown — five-section plan reviewed and updated each session."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCAMSStabilizationPlan"
  * output[+]
    * type = #CarePlan
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-cams-stabilization-plan"
* action[+]
  * id = "provide-means-safety-counseling"
  * title = "Provide Lethal Means Safety Counseling / Means Safety Actions"
  * description = "Lethal-means reduction counseling (covers named protocols such as CALM). Yields a counseling Procedure (SPiERLethalMeansCounseling) plus per-method means-safety Observations (SPiERMeansSafetyAction)."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ProvideMeansSafetyCounseling"
  * output[+]
    * type = #Procedure
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-lethal-means-counseling"
  * output[+]
    * type = #Observation
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-means-safety-action"
* action[+]
  * id = "author-crisis-response-plan"
  * title = "Author Crisis Response Plan / Crisis Planning"
  * description = "Crisis Response Plan (Bryan & Rudd) — five-section patient-held plan. Yields a CarePlan (SPiERCrisisResponsePlan); an alternative/complement to Stanley-Brown."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AuthorCrisisResponsePlan"
  * output[+]
    * type = #CarePlan
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-crisis-response-plan"
* action[+]
  * id = "share-crisis-resources"
  * title = "Share Patient-Facing Crisis Resources / Coping Supports"
  * description = "Document that crisis resources (988, Crisis Text Line, Now Matters Now, safety-plan copy, coping supports) were provided. Yields a stage-tagged Communication (SPiERCrisisResourcesShared)."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources"
  * output[+]
    * type = #Communication
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-crisis-resources-shared"


// ─── Stage 5: Coordinate Handoffs ────────────────────────────
// Stage assembly for the catalogued Coordinate Handoffs tools. These are
// placeholder ActivityDefinitions (see pathway-tool-placeholders.fsh) — no
// output profiles are declared until each tool is fully FHIR-modelled.

Instance: SPiERCoordinateHandoffsStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Coordinate Handoffs Stage"
Description: "Stage 5 of 8 in the SPiER suicide-safer care pathway: transfer essential suicide-safety information, responsibility, and follow-up details across people, settings, and time points. Actions here are catalogued placeholder tools pending full FHIR modelling."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERCoordinateHandoffsStage"
* name = "SPiERCoordinateHandoffsStage"
* version = "0.1.0"
* title = "SPiER Pathway — Coordinate Handoffs Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#coordinate-handoffs
* action[+]
  * id = "record-transition-checkpoint"
  * title = "Record Suicide-Safety Handoff / Transition Checklist"
  * description = "Pre-discharge transfer of care with suicide-safety information, responsibility, and next steps. Yields a SPiERSafetyHandoff Communication listing what travelled with the patient."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/RecordTransitionCheckpoint"
  * output[+]
    * type = #Communication
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-handoff"
* action[+]
  * id = "generate-discharge-safety-packet"
  * title = "Generate Discharge Safety Packet / Transition Bundle"
  * description = "Assemble the safety plan, crisis resources, risk status, and follow-up details for the patient and receiving provider. Yields a SPiERDischargeSafetyPacket DocumentReference."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/GenerateDischargeSafetyPacket"
  * output[+]
    * type = #DocumentReference
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-discharge-safety-packet"
* action[+]
  * id = "send-referral-handoff"
  * title = "Send Referral / Next Provider Handoff"
  * description = "Warm handoff and accelerated access to follow-up behavioral healthcare. Yields a SPiERSafetyReferral ServiceRequest, trackable past sent through accepted/completed."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/SendRapidReferral"
  * output[+]
    * type = #ServiceRequest
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-referral"
* action[+]
  * id = "schedule-follow-up-appointment"
  * title = "Schedule Next Appointment / Follow-Up Visit"
  * description = "Document or schedule the next follow-up visit before transition or discharge. Yields a SPiERFollowUpAppointment."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ScheduleFollowUpAppointment"
  * output[+]
    * type = #Appointment
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-follow-up-appointment"
* action[+]
  * id = "record-consent-sharing-status"
  * title = "Record Consent / Information-Sharing Status"
  * description = "Document whether suicide-safety information can be shared with another provider, team, or support person. Yields a SPiERInformationSharingConsent; a patient declining is a deny provision."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/RecordConsentSharingStatus"
  * output[+]
    * type = #Consent
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-information-sharing-consent"


// ─── Stage 6: Track Follow-Up ────────────────────────────────
// Stage assembly for the catalogued Track Follow-Up tools. These are
// placeholder ActivityDefinitions (see pathway-tool-placeholders.fsh) — no
// output profiles are declared until each tool is fully FHIR-modelled.

Instance: SPiERTrackFollowUpStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Track Follow-Up Stage"
Description: "Stage 6 of 8 in the SPiER suicide-safer care pathway: track whether outreach and follow-up steps occur after the immediate encounter. Actions here are catalogued placeholder tools pending full FHIR modelling."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERTrackFollowUpStage"
* name = "SPiERTrackFollowUpStage"
* version = "0.1.0"
* title = "SPiER Pathway — Track Follow-Up Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#track-follow-up
* action[+]
  * id = "record-follow-up-outreach"
  * title = "Record Follow-Up Outreach / Contact Attempts"
  * description = "Document outreach attempts, outcomes, and next attempts after the encounter. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/RecordFollowUpOutreach"
  * output[+]
    * type = #Communication
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-outreach-attempt"
* action[+]
  * id = "send-caring-contact"
  * title = "Send Caring Contact"
  * description = "Non-demanding caring-contact outreach on a schedule or sequence. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/SendCaringContact"
  * output[+]
    * type = #Communication
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-caring-contact"
* action[+]
  * id = "track-follow-up-appointment"
  * title = "Track Follow-Up Appointment"
  * description = "Track whether the follow-up appointment occurred (attended, cancelled, no-show, within 7/30 days). Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/TrackFollowUpAppointment"
  * output[+]
    * type = #Appointment
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-follow-up-appointment"
* action[+]
  * id = "follow-up-missed-appointment"
  * title = "Follow Up Missed Appointment / No-Show"
  * description = "Identify missed appointments for patients with suicide risk and prompt outreach or escalation. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/FollowUpMissedAppointment"
  * output[+]
    * type = #Communication
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-outreach-attempt"
* action[+]
  * id = "escalate-follow-up"
  * title = "Run Follow-Up Escalation Workflow"
  * description = "Escalate when follow-up is missed, the patient is unreachable, or a new safety concern emerges. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/EscalateFollowUp"
  * output[+]
    * type = #Task
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-task"


// ─── Stage 7: Track Risk Over Time ───────────────────────────
// Stage assembly for the catalogued Track Risk Over Time tools. These are
// placeholder ActivityDefinitions (see pathway-tool-placeholders.fsh) — no
// output profiles are declared until each tool is fully FHIR-modelled.

Instance: SPiERTrackRiskOverTimeStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Track Risk Over Time Stage"
Description: "Stage 7 of 8 in the SPiER suicide-safer care pathway: keep active suicide-safer care episodes visible, trackable, and escalated when needed — registry/work queue, episode status, reassessment schedules, open safety actions, and overdue-risk escalation."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERTrackRiskOverTimeStage"
* name = "SPiERTrackRiskOverTimeStage"
* version = "0.1.0"
* title = "SPiER Pathway — Track Risk Over Time Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#track-risk-over-time
// The registry is a QUERY over the other four actions' output (open episodes
// + their tasks), so it deliberately declares no output profile of its own.
* action[+]
  * id = "maintain-risk-registry"
  * title = "Maintain Active Suicide-Safer Care Registry / Work Queue"
  * description = "Keep active suicide-risk patients visible in one place with status, owner, and due dates. Produces no resource — reads open SPiERSuicideRiskEpisode resources and their SPiERSafetyTask children."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/MaintainRiskRegistry"
* action[+]
  * id = "track-risk-episode-status"
  * title = "Track Suicide-Risk Episode / Pathway Status"
  * description = "Track an active suicide-risk episode over time — entry reason, current tier, owner, and closure with reason plus final status. Yields the episode (SPiERSuicideRiskEpisode) and its chart banner (SPiERSuicideRiskFlag). Anchor for the whole stage."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/TrackRiskEpisodeStatus"
  * output[+]
    * type = #EpisodeOfCare
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-episode"
  * output[+]
    * type = #Flag
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-flag"
* action[+]
  * id = "schedule-risk-reassessment"
  * title = "Schedule Reassessment / Risk Review"
  * description = "Track when suicide-risk reassessment or review is due and alert when overdue. Yields a SPiERSafetyTask coded reassessment-due; overdue is computed from the task due date."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ScheduleRiskReassessment"
  * output[+]
    * type = #Task
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-task"
* action[+]
  * id = "track-open-safety-actions"
  * title = "Track Open Safety Actions / Care Gaps"
  * description = "Track open suicide-safety actions and care gaps with owner, due date, and completion. Yields one SPiERSafetyTask per gap, linked to the episode."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/TrackOpenSafetyActions"
  * output[+]
    * type = #Task
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-task"
* action[+]
  * id = "escalate-overdue-risk"
  * title = "Run Risk Escalation / Overdue Workflow"
  * description = "Escalate active cases when key steps are overdue or risk worsens. Yields a SPiERSafetyTask coded escalation, carrying one or more escalation triggers."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/EscalateOverdueRisk"
  * output[+]
    * type = #Task
    * profile = "http://thespierproject.org/fhir/StructureDefinition/spier-safety-task"


// ─── Stage 8: Measure and Share the Data ─────────────────────
// Stage assembly for the Measure and Share the Data tools, fully modelled in
// ig/input/fsh/measure-and-share.fsh.
//
// Only TL-042 declares an output. That is the same asymmetry Stage 7 has with
// TL-037: a dashboard is a rendering, an export is a serialization, and
// interoperability is a transport — all three are capabilities over artifacts
// that already exist, so they produce nothing new to profile. Their expected
// behaviour is declared on the role CapabilityStatements instead.

Instance: SPiERMeasureAndShareStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Measure and Share the Data Stage"
Description: "Stage 8 of 8 in the SPiER suicide-safer care pathway: make pathway activity usable for reporting, quality improvement, accountability, and information sharing — KPI/measure reporting, dashboards, analytics extracts, and interoperability output."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERMeasureAndShareStage"
* name = "SPiERMeasureAndShareStage"
* version = "0.1.0"
* title = "SPiER Pathway — Measure and Share the Data Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#measure-and-share
* action[+]
  * id = "report-suicide-safer-care-measures"
  * title = "Report Suicide-Safer Care KPIs / Measures"
  * description = "Calculate the seven SPiER suicide-safer care Measures — screen-to-assessment, risk status documented, safety plan before discharge, lethal means counseling, follow-up timeliness at 48h/7d/30d, caring-contact adherence, and referral loop closure — and emit MeasureReports."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ReportSuicideSaferCareMeasures"
  * output[+]
    * type = #MeasureReport
* action[+]
  * id = "provide-reporting-dashboard"
  * title = "Provide Reporting Dashboard / Aggregate View"
  * description = "Aggregate view of pathway activity for clinicians, supervisors, and QI teams. Produces no resource: the measure tiles read summary MeasureReports and the operational counts read the TL-037 registry query."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ProvideReportingDashboard"
* action[+]
  * id = "export-suicide-safer-care-data"
  * title = "Export Data / Analytics Extract"
  * description = "Structured, timestamped export of the suicide-safer care artifacts. Produces no new resource — the conforming export is a Bulk Data $export of the profiles stages 1–7 already define, each of which mandates a discrete date."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ExportSuicideSaferCareData"
* action[+]
  * id = "share-suicide-safer-care-data"
  * title = "Share Data / Interoperability Output"
  * description = "Share suicide-safer care data outside the EHR (HIE, FHIR API, Direct, referral platforms), honoring the sharing restrictions recorded as a SPiERInformationSharingConsent at TL-032. Produces no new resource — the shared payload is the existing profiles."
  * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ShareSuicideSaferCareData"
