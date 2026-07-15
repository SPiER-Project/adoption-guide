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
// tools (PHQ-9 Item 9, C-SSRS Screener, SBQ-R) are layered in as additional
// actions — the order here is presentational; sites can enable any subset.

Instance: SPiERIdentifyPossibleRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Identify Possible Risk Stage"
Description: "Stage 1 of 8 in the SPiER suicide-safer care pathway: find a suicide-risk signal and determine whether more review is needed. ASQ is the flagship action; PHQ-9 Item 9, C-SSRS Screener, and SBQ-R are alternates that an implementation can enable in any combination."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERIdentifyPossibleRiskStage"
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
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerASQ"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-asq-result"
* action[+]
  * id = "administer-phq9"
  * title = "Administer PHQ-9 / PHQ-A (Item 9 Trigger)"
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
  * title = "Administer C-SSRS Screener / Triage Points"
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
// Placeholder tools (see pathway-tool-placeholders.fsh) — catalogued but not yet
// fully FHIR-modelled, so no output profile is declared.
* action[+]
  * id = "administer-cssrs-pediatric"
  * title = "Administer C-SSRS Pediatric / Adolescent Version"
  * description = "Age-appropriate C-SSRS screening. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCSSRSPediatric"
* action[+]
  * id = "administer-pss3"
  * title = "Administer Patient Safety Screener-3 (PSS-3)"
  * description = "Brief acute-care suicide screen. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerPSS3"
* action[+]
  * id = "trigger-suicide-risk-workflow"
  * title = "Positive Screen Flag / Suicide-Risk Workflow Trigger"
  * description = "Create a suicide-risk flag or start the suicide-risk workflow after a positive screen. Placeholder — trigger logic not yet FHIR-modelled here (see the Clarify Risk stage triggers for the encoded ASQ/PHQ-9 cases)."
  * definitionCanonical = "http://spier.org/ActivityDefinition/TriggerSuicideRiskWorkflow"


// ─── Stage 2: Clarify Risk ───────────────────────────────────
// Triggered by a positive ASQ result or a non-zero PHQ-9 Item 9.

Instance: SPiERClarifyRiskStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Clarify Risk Stage"
Description: "Stage 2 of 8: after a suicide-risk signal is identified, capture what is going on clinically — suicidal thoughts, plan, intent, behavior history, access to means, risk and protective factors, and whether further action is needed. Triggered by a positive ASQ result or a positive PHQ-9 Item 9. Fully modelled clarify-risk activities are C-SSRS Full and the CAMS SSF-5 (Sections A and B plus interim re-ratings and outcome/disposition)."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERClarifyRiskStage"
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
      * profile[+] = "http://spier.org/StructureDefinition/spier-asq-result"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#93374-7
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
  * title = "Administer C-SSRS Full Scale (Lifetime + Recent)"
  * description = "Capture the full C-SSRS (lifetime/recent) to clarify suicide-risk nature, severity, and timing."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCSSRSFull"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-cssrs-risk-level"
// The CAMS SSF-5 is ONE catalogued tool spanning its session-specific forms
// (First Session Sections A/B, Interim re-ratings, Outcome/Disposition) — do
// not split it into separate stage tools. The session forms remain distinct
// ActivityDefinitions so each keeps its own output contract.
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
* action[+]
  * id = "administer-cams-interim-session"
  * title = "Administer CAMS Interim Session (SSF Re-Rating)"
  * description = "Repeat the CAMS Section A SSF Core Assessment to track risk-level trend across the CAMS episode."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSInterimSession"
  * output[+]
    * type = #Observation
    * profile = "http://spier.org/StructureDefinition/spier-cams-ssf-vital"
* action[+]
  * id = "administer-cams-outcome-disposition"
  * title = "Administer CAMS SSF-5 Outcome/Disposition (Final Session)"
  * description = "Episode closure, disposition, and next-step planning. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSOutcomeDisposition"
// BSSA is fully FHIR-modelled (ig/input/fsh/bssa.fsh). The remaining
// placeholder tools below (see pathway-tool-placeholders.fsh) are catalogued
// but not yet fully FHIR-modelled, so no output profile is declared.
* action[+]
  * id = "administer-bssa"
  * title = "Administer NIMH Brief Suicide Safety Assessment (BSSA)"
  * description = "Disposition-oriented assessment after a positive ASQ. Yields a disposition Observation (SPiERBSSADispositionResult) crosswalked to the common suicide-risk tier."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerBSSA"
* action[+]
  * id = "administer-cssrs-since-last-contact"
  * title = "Administer C-SSRS Since Last Visit / Since Last Contact"
  * description = "Repeat assessment since the prior contact. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCSSRSSinceLastContact"
* action[+]
  * id = "administer-pss-full"
  * title = "Administer Patient Safety Screener / Suicide Risk Screener (Full)"
  * description = "Combined acute-care screen with local stratification. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerPSSFull"
* action[+]
  * id = "administer-cars-s"
  * title = "Administer Cultural Assessment of Risk for Suicide (CARS-S)"
  * description = "Culturally informed risk and protective-factor assessment. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCARSS"
* action[+]
  * id = "administer-local-risk-assessment"
  * title = "Administer Full Suicide-Risk Assessment / Local Assessment Tool"
  * description = "Site-defined full suicide-risk assessment for EHRs that do not use one of the named tools. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerLocalRiskAssessment"


// ─── Stage 3: Define the Risk Picture ────────────────────────

Instance: SPiERDefineRiskPictureStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Define the Risk Picture Stage"
Description: "Stage 3 of 8 in the SPiER suicide-safer care pathway: document the current risk status and the clinical reasoning that guides next steps. The CAMS Therapeutic Worksheet is the first concrete action; SAFE-T remains a catalogued placeholder."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERDefineRiskPictureStage"
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
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSTherapeuticWorksheet"
  * output[+]
    * type = #CarePlan
    * profile = "http://spier.org/StructureDefinition/spier-cams-therapeutic-worksheet"
// Placeholder tool (see pathway-tool-placeholders.fsh) — catalogued but not yet
// fully FHIR-modelled, so no output profile is declared.
* action[+]
  * id = "administer-safe-t"
  * title = "Administer SAFE-T"
  * description = "Structured clinical formulation and triage. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerSAFET"


// ─── Stage 4: Document Safety Actions ────────────────────────

Instance: SPiERDocumentSafetyActionsStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Document Safety Actions Stage"
Description: "Stage 4 of 8 in the SPiER suicide-safer care pathway: document concrete actions used to reduce risk and support safety. Stanley-Brown and the CAMS Stabilization Support Plan are the two safety-plan actions an implementation can enable; lethal means safety counseling, crisis response planning, and patient-facing crisis resources complete the tile."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERDocumentSafetyActionsStage"
* name = "SPiERDocumentSafetyActionsStage"
* version = "0.1.0"
* title = "SPiER Pathway — Document Safety Actions Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#document-safety-actions
* action[+]
  * id = "administer-stanley-brown"
  * title = "Author Stanley-Brown Safety Plan / Safety Planning Intervention"
  * description = "Collaboratively complete a Stanley-Brown Safety Plan with the patient."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerStanleyBrown"
  * output[+]
    * type = #CarePlan
    * profile = "http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan"
* action[+]
  * id = "administer-cams-stabilization-plan"
  * title = "Author CAMS Stabilization Support Plan"
  * description = "CAMS-framework alternative to Stanley-Brown — five-section plan reviewed and updated each session."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerCAMSStabilizationPlan"
  * output[+]
    * type = #CarePlan
    * profile = "http://spier.org/StructureDefinition/spier-cams-stabilization-plan"
// Placeholder tools (see pathway-tool-placeholders.fsh) — catalogued but not yet
// fully FHIR-modelled, so no output profile is declared.
* action[+]
  * id = "provide-means-safety-counseling"
  * title = "Provide Lethal Means Safety Counseling / Means Safety Actions"
  * description = "Lethal-means reduction counseling and documented means-safety actions (covers named protocols such as CALM). Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ProvideMeansSafetyCounseling"
* action[+]
  * id = "author-crisis-response-plan"
  * title = "Author Crisis Response Plan / Crisis Planning"
  * description = "Alternative crisis-planning framework. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AuthorCrisisResponsePlan"
* action[+]
  * id = "share-crisis-resources"
  * title = "Share Patient-Facing Crisis Resources / Coping Supports"
  * description = "Document that crisis resources (988, Crisis Text Line, Now Matters Now, coping supports) were provided. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ShareCrisisResources"


// ─── Stage 5: Coordinate Handoffs ────────────────────────────
// Stage assembly for the catalogued Coordinate Handoffs tools. These are
// placeholder ActivityDefinitions (see pathway-tool-placeholders.fsh) — no
// output profiles are declared until each tool is fully FHIR-modelled.

Instance: SPiERCoordinateHandoffsStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Coordinate Handoffs Stage"
Description: "Stage 5 of 8 in the SPiER suicide-safer care pathway: transfer essential suicide-safety information, responsibility, and follow-up details across people, settings, and time points. Actions here are catalogued placeholder tools pending full FHIR modelling."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERCoordinateHandoffsStage"
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
  * description = "Pre-discharge transfer of care with suicide-safety information, responsibility, and next steps. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/RecordTransitionCheckpoint"
* action[+]
  * id = "generate-discharge-safety-packet"
  * title = "Generate Discharge Safety Packet / Transition Bundle"
  * description = "Assemble the safety plan, crisis resources, risk status, and follow-up details for the patient and receiving provider. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/GenerateDischargeSafetyPacket"
* action[+]
  * id = "send-referral-handoff"
  * title = "Send Referral / Next Provider Handoff"
  * description = "Warm handoff and accelerated access to follow-up behavioral healthcare. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/SendRapidReferral"
* action[+]
  * id = "schedule-follow-up-appointment"
  * title = "Schedule Next Appointment / Follow-Up Visit"
  * description = "Document or schedule the next follow-up visit before transition or discharge. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ScheduleFollowUpAppointment"
* action[+]
  * id = "record-consent-sharing-status"
  * title = "Record Consent / Information-Sharing Status"
  * description = "Document whether suicide-safety information can be shared with another provider, team, or support person. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/RecordConsentSharingStatus"


// ─── Stage 6: Track Follow-Up ────────────────────────────────
// Stage assembly for the catalogued Track Follow-Up tools. These are
// placeholder ActivityDefinitions (see pathway-tool-placeholders.fsh) — no
// output profiles are declared until each tool is fully FHIR-modelled.

Instance: SPiERTrackFollowUpStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Track Follow-Up Stage"
Description: "Stage 6 of 8 in the SPiER suicide-safer care pathway: track whether outreach and follow-up steps occur after the immediate encounter. Actions here are catalogued placeholder tools pending full FHIR modelling."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERTrackFollowUpStage"
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
  * definitionCanonical = "http://spier.org/ActivityDefinition/RecordFollowUpOutreach"
* action[+]
  * id = "send-caring-contact"
  * title = "Send Caring Contact"
  * description = "Non-demanding caring-contact outreach on a schedule or sequence. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/SendCaringContact"
* action[+]
  * id = "track-follow-up-appointment"
  * title = "Track Follow-Up Appointment"
  * description = "Track whether the follow-up appointment occurred (attended, cancelled, no-show, within 7/30 days). Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/TrackFollowUpAppointment"
* action[+]
  * id = "follow-up-missed-appointment"
  * title = "Follow Up Missed Appointment / No-Show"
  * description = "Identify missed appointments for patients with suicide risk and prompt outreach or escalation. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/FollowUpMissedAppointment"
* action[+]
  * id = "escalate-follow-up"
  * title = "Run Follow-Up Escalation Workflow"
  * description = "Escalate when follow-up is missed, the patient is unreachable, or a new safety concern emerges. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/EscalateFollowUp"


// ─── Stage 7: Track Risk Over Time ───────────────────────────
// Stage assembly for the catalogued Track Risk Over Time tools. These are
// placeholder ActivityDefinitions (see pathway-tool-placeholders.fsh) — no
// output profiles are declared until each tool is fully FHIR-modelled.

Instance: SPiERTrackRiskOverTimeStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Track Risk Over Time Stage"
Description: "Stage 7 of 8 in the SPiER suicide-safer care pathway: keep active suicide-safer care episodes visible, trackable, and escalated when needed — registry/work queue, episode status, reassessment schedules, open safety actions, and overdue-risk escalation."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERTrackRiskOverTimeStage"
* name = "SPiERTrackRiskOverTimeStage"
* version = "0.1.0"
* title = "SPiER Pathway — Track Risk Over Time Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#track-risk-over-time
* action[+]
  * id = "maintain-risk-registry"
  * title = "Maintain Active Suicide-Safer Care Registry / Work Queue"
  * description = "Keep active suicide-risk patients visible in one place with status, owner, and due dates. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/MaintainRiskRegistry"
* action[+]
  * id = "track-risk-episode-status"
  * title = "Track Suicide-Risk Episode / Pathway Status"
  * description = "Track an active suicide-risk episode over time, including entry reason, current tier, owner, and closure. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/TrackRiskEpisodeStatus"
* action[+]
  * id = "schedule-risk-reassessment"
  * title = "Schedule Reassessment / Risk Review"
  * description = "Track when suicide-risk reassessment or review is due and alert when overdue. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ScheduleRiskReassessment"
* action[+]
  * id = "track-open-safety-actions"
  * title = "Track Open Safety Actions / Care Gaps"
  * description = "Track open suicide-safety actions and care gaps with owner, due date, and completion. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/TrackOpenSafetyActions"
* action[+]
  * id = "escalate-overdue-risk"
  * title = "Run Risk Escalation / Overdue Workflow"
  * description = "Escalate active cases when key steps are overdue or risk worsens. Placeholder — no Questionnaire binding yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/EscalateOverdueRisk"


// ─── Stage 8: Measure and Share the Data ─────────────────────
// Stage assembly for the catalogued Measure and Share the Data tools. These
// are placeholder ActivityDefinitions (see pathway-tool-placeholders.fsh) — no
// output profiles are declared until each tool is fully FHIR-modelled.

Instance: SPiERMeasureAndShareStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Measure and Share the Data Stage"
Description: "Stage 8 of 8 in the SPiER suicide-safer care pathway: make pathway activity usable for reporting, quality improvement, accountability, and information sharing — KPI/measure reporting, dashboards, analytics extracts, and interoperability output."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERMeasureAndShareStage"
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
  * description = "Calculate and report suicide-safer care measures (screening-to-assessment, safety-plan completion, follow-up timeliness). Placeholder — no Measure resources authored yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ReportSuicideSaferCareMeasures"
* action[+]
  * id = "provide-reporting-dashboard"
  * title = "Provide Reporting Dashboard / Aggregate View"
  * description = "Aggregate view of pathway activity for clinicians, supervisors, and QI teams. Placeholder — no artifacts authored yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ProvideReportingDashboard"
* action[+]
  * id = "export-suicide-safer-care-data"
  * title = "Export Data / Analytics Extract"
  * description = "Structured export of suicide-safer care data for analysis and quality improvement. Placeholder — no artifacts authored yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ExportSuicideSaferCareData"
* action[+]
  * id = "share-suicide-safer-care-data"
  * title = "Share Data / Interoperability Output"
  * description = "Share suicide-safer care data outside the EHR (HIE, FHIR API, Direct, referral platforms) with consent honored. Placeholder — no artifacts authored yet."
  * definitionCanonical = "http://spier.org/ActivityDefinition/ShareSuicideSaferCareData"
