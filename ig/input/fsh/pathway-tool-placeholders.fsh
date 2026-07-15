// =============================================================
// Pathway Tool Placeholders — minimal ActivityDefinitions
// =============================================================
// Minimal, machine-readable ActivityDefinitions for pathway tools
// that are catalogued in the adoption guide but not yet fully
// FHIR-modelled. Each carries only structural metadata: url, name,
// version, title, status (draft), description, purpose, and kind.
//
// Deliberately NO codes (LOINC/SNOMED topic/code), NO
// sdc-questionnaire binding, and NO derived-Observation profiles —
// those require verified terminology and a hand-authored
// Questionnaire, which these tools do not have yet. When a tool is
// fully authored (see the `assessment-to-ig` skill), move it to its
// own `<instrument>.fsh` file and enrich it there.
//
// Stage linkage lives in `pathway-stages.fsh`: each AD below is
// referenced by exactly one stage PlanDefinition action, which is
// how the React catalog derives the tool's stage. The AD `name`
// values are also mapped to their stable `TL-xxx` catalog ids in
// `web/src/data/catalog/tools.ts` (AD_TO_TOOL_ID) so UI metadata
// keyed by `TL-xxx` continues to match.
//
// `kind` reflects the workflow the tool produces so the catalog can
// derive `workflowType`: #CommunicationRequest for outreach/handoff
// tools, #ServiceRequest for assessment/counseling tools, #Task for
// registry/tracking/reporting functionality, #Appointment for
// scheduling.
// =============================================================


// ─── Identify Possible Risk ──────────────────────────────────

// AdministerCSSRSPediatric has been promoted out of this placeholder file into
// the full artifact set at ig/input/fsh/cssrs.fsh (Questionnaire binding,
// reusing the shared SPiERCSSRSRiskLevel Observation profile and the existing
// cssrs-risk-level → suicide-risk-tier crosswalk).


// AdministerPSS3 has been promoted out of this placeholder file into the full
// artifact set at ig/input/fsh/pss3.fsh (Questionnaire binding, result
// CodeSystem/ValueSets, SPiERPSS3Result Observation profile, and a
// result → suicide-risk-tier crosswalk in crosswalk-pss3.fsh).


Instance: TriggerSuicideRiskWorkflow
InstanceOf: ActivityDefinition
Title: "Positive Screen Flag / Suicide-Risk Workflow Trigger"
Description: "Create a suicide-risk flag or start the suicide-risk workflow after a positive screen (any enabled tool or clinical judgment)."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/TriggerSuicideRiskWorkflow"
* name = "TriggerSuicideRiskWorkflow"
* version = "0.1.0"
* title = "Positive Screen Flag / Suicide-Risk Workflow Trigger"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Create a suicide-risk flag or start the suicide-risk workflow after a positive screen. Placeholder ActivityDefinition — the ASQ and PHQ-9 Item 9 cases are already FHIR-encoded as Clarify Risk stage triggers; this placeholder catalogues the generalized flag/workflow capability."
* purpose = "Make positive screens actionable: chart flag, work-queue entry, notification, and next-step routing."
* kind = #Task


// ─── Clarify Risk ────────────────────────────────────────────

// AdministerCSSRSSinceLastContact has been promoted out of this placeholder file
// into the full artifact set at ig/input/fsh/cssrs.fsh (Questionnaire binding,
// reusing the shared SPiERCSSRSRiskLevel Observation profile and the existing
// cssrs-risk-level → suicide-risk-tier crosswalk).


// AdministerBSSA has been promoted out of this placeholder file into the full
// artifact set at ig/input/fsh/bssa.fsh (Questionnaire binding, disposition
// CodeSystem/ValueSets, SPiERBSSADispositionResult Observation profile, and a
// disposition → suicide-risk-tier crosswalk in crosswalk-bssa.fsh).


Instance: AdministerPSSFull
InstanceOf: ActivityDefinition
Title: "Administer Patient Safety Screener / Suicide Risk Screener (Full)"
Description: "Administer the full Patient Safety Screener / Suicide Risk Screener, a combined acute-care screen with local risk stratification."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerPSSFull"
* name = "AdministerPSSFull"
* version = "0.1.0"
* title = "Administer Patient Safety Screener / Suicide Risk Screener (Full)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the full Patient Safety Screener / Suicide Risk Screener — a combined acute-care screen with local risk stratification. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Clarify suicide risk in acute care with a combined screen and site-defined risk-stratification step."
* kind = #ServiceRequest


Instance: AdministerCARSS
InstanceOf: ActivityDefinition
Title: "Administer Cultural Assessment of Risk for Suicide (CARS-S)"
Description: "Administer the Cultural Assessment of Risk for Suicide (CARS-S), a culturally informed assessment of risk and protective factors."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCARSS"
* name = "AdministerCARSS"
* version = "0.1.0"
* title = "Administer Cultural Assessment of Risk for Suicide (CARS-S)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the Cultural Assessment of Risk for Suicide (CARS-S). Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Capture cultural risk and protective factors, identity/community context, and barriers to disclosure that inform suicide-risk formulation."
* kind = #ServiceRequest


Instance: AdministerLocalRiskAssessment
InstanceOf: ActivityDefinition
Title: "Administer Full Suicide-Risk Assessment / Local Assessment Tool"
Description: "Administer a site-defined full suicide-risk assessment for EHRs that do not use one of the named assessment tools."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerLocalRiskAssessment"
* name = "AdministerLocalRiskAssessment"
* version = "0.1.0"
* title = "Administer Full Suicide-Risk Assessment / Local Assessment Tool"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer a site-defined full suicide-risk assessment. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Capture thoughts, plan, intent, behavior history, access to means, and risk/protective factors where a local assessment form is used instead of a named tool."
* kind = #ServiceRequest


// AdministerCAMSOutcomeDisposition has been promoted out of this placeholder file
// into the full artifact set at ig/input/fsh/cams.fsh (Questionnaire binding,
// CAMSDisposition CodeSystem/ValueSet, and the SPiERCAMSOutcomeDisposition
// Observation profile). Still one CAMS SSF-5 tool — maps to TL-020.


// ─── Define the Risk Picture ─────────────────────────────────

// AdministerSAFET has been promoted out of this placeholder file into the full
// artifact set at ig/input/fsh/safet.fsh (Questionnaire binding, factor
// CodeSystems/ValueSets, and the SPiERSAFETRiskLevel Observation profile whose
// value binds directly to the shared suicide-risk tier — no crosswalk needed).


// ─── Document Safety Actions ─────────────────────────────────

Instance: ProvideMeansSafetyCounseling
InstanceOf: ActivityDefinition
Title: "Provide Lethal Means Safety Counseling / Means Safety Actions"
Description: "Provide lethal-means safety counseling and document the agreed means-safety actions (storage/removal plans, responsible parties, completion)."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ProvideMeansSafetyCounseling"
* name = "ProvideMeansSafetyCounseling"
* version = "0.1.0"
* title = "Provide Lethal Means Safety Counseling / Means Safety Actions"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Provide lethal-means safety counseling and document means-safety actions. Covers named protocols such as CALM (Counseling on Access to Lethal Means). Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Reduce the patient's access to lethal means as a concrete, documented, and reportable safety action."
* kind = #ServiceRequest


// AuthorCrisisResponsePlan has been promoted out of this placeholder file into
// the full artifact set at ig/input/fsh/crp.fsh (Questionnaire binding + the
// SPiERCrisisResponsePlan CarePlan profile, modeled on the Stanley-Brown plan).


Instance: ShareCrisisResources
InstanceOf: ActivityDefinition
Title: "Share Patient-Facing Crisis Resources / Coping Supports"
Description: "Document that patient-facing crisis resources or coping supports (988, Crisis Text Line, Now Matters Now, safety-plan copy, local crisis lines) were provided."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ShareCrisisResources"
* name = "ShareCrisisResources"
* version = "0.1.0"
* title = "Share Patient-Facing Crisis Resources / Coping Supports"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Document that patient-facing crisis resources or coping supports were provided (988, Crisis Text Line, Now Matters Now, coping-skills resources). Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Connect the patient to crisis resources and coping supports and record what was shared, when, and how."
* kind = #CommunicationRequest


// ─── Coordinate Handoffs ─────────────────────────────────────

Instance: RecordTransitionCheckpoint
InstanceOf: ActivityDefinition
Title: "Record Suicide-Safety Handoff / Transition Checklist"
Description: "Record a suicide-safety handoff / transition checklist communicating risk status, safety-plan status, follow-up plan, and responsibility to the next setting."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/RecordTransitionCheckpoint"
* name = "RecordTransitionCheckpoint"
* version = "0.1.0"
* title = "Record Suicide-Safety Handoff / Transition Checklist"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Record a suicide-safety handoff / transition checklist. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Transfer essential suicide-safety information, responsibility for the next step, and follow-up details before discharge or transition."
* kind = #CommunicationRequest


Instance: GenerateDischargeSafetyPacket
InstanceOf: ActivityDefinition
Title: "Generate Discharge Safety Packet / Transition Bundle"
Description: "Generate a discharge safety packet / transition bundle: safety plan, crisis resources, current risk status, means-safety actions, follow-up appointment, and care-team contact."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/GenerateDischargeSafetyPacket"
* name = "GenerateDischargeSafetyPacket"
* version = "0.1.0"
* title = "Generate Discharge Safety Packet / Transition Bundle"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Generate a discharge safety packet / transition bundle for the patient and receiving provider. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Hand the patient and the receiving provider everything needed to keep the patient safe through the transition."
* kind = #CommunicationRequest


Instance: SendRapidReferral
InstanceOf: ActivityDefinition
Title: "Send Referral / Next Provider Handoff"
Description: "Send a referral or next-provider handoff with the suicide-risk concern, safety-plan status, and follow-up needs; track acceptance and completion."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/SendRapidReferral"
* name = "SendRapidReferral"
* version = "0.1.0"
* title = "Send Referral / Next Provider Handoff"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Send a referral / next-provider handoff. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Enable a warm handoff and accelerated access to follow-up behavioral-health care, with referral status tracked to completion."
* kind = #CommunicationRequest


Instance: ScheduleFollowUpAppointment
InstanceOf: ActivityDefinition
Title: "Schedule Next Appointment / Follow-Up Visit"
Description: "Document or schedule the next follow-up visit before transition/discharge, with structured date, provider, and status."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ScheduleFollowUpAppointment"
* name = "ScheduleFollowUpAppointment"
* version = "0.1.0"
* title = "Schedule Next Appointment / Follow-Up Visit"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Document or schedule the next follow-up visit before transition/discharge. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Ensure a concrete follow-up appointment exists before the patient leaves, and alert staff when it is missing."
* kind = #Appointment


Instance: RecordConsentSharingStatus
InstanceOf: ActivityDefinition
Title: "Record Consent / Information-Sharing Status"
Description: "Document whether suicide-safety information can be shared with another provider, team, or support person, and use that status to guide what is sent or withheld."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/RecordConsentSharingStatus"
* name = "RecordConsentSharingStatus"
* version = "0.1.0"
* title = "Record Consent / Information-Sharing Status"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Document consent / information-sharing status for suicide-safety information. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Capture consent status, restrictions, and permitted recipients so handoffs and packets share only what is allowed."
* kind = #Task


// ─── Track Follow-Up ─────────────────────────────────────────

Instance: RecordFollowUpOutreach
InstanceOf: ActivityDefinition
Title: "Record Follow-Up Outreach / Contact Attempts"
Description: "Document follow-up outreach and contact attempts: due date, method, outcome, and next attempt needed."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/RecordFollowUpOutreach"
* name = "RecordFollowUpOutreach"
* version = "0.1.0"
* title = "Record Follow-Up Outreach / Contact Attempts"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Document follow-up outreach and contact attempts. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Track whether outreach happens after the encounter, with structured attempts, outcomes, and assignments."
* kind = #CommunicationRequest


Instance: SendCaringContact
InstanceOf: ActivityDefinition
Title: "Send Caring Contact"
Description: "Send a caring-contact outreach as part of a scheduled sequence of non-demanding post-discharge contacts."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/SendCaringContact"
* name = "SendCaringContact"
* version = "0.1.0"
* title = "Send Caring Contact"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Send a caring-contact outreach. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Maintain closed-loop follow-up through non-demanding caring contacts after the encounter, with enrollment, schedule, and opt-out tracked."
* kind = #CommunicationRequest


Instance: TrackFollowUpAppointment
InstanceOf: ActivityDefinition
Title: "Track Follow-Up Appointment"
Description: "Track whether the follow-up appointment occurred: scheduled, attended, cancelled, no-show, rescheduled, completed within 7/30 days."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/TrackFollowUpAppointment"
* name = "TrackFollowUpAppointment"
* version = "0.1.0"
* title = "Track Follow-Up Appointment"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Track whether the follow-up appointment occurred. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Identify completed, missed, and overdue follow-up so timeliness measures (7-day / 30-day) are reportable."
* kind = #Task


Instance: FollowUpMissedAppointment
InstanceOf: ActivityDefinition
Title: "Follow Up Missed Appointment / No-Show"
Description: "Identify missed appointments or no-shows for patients with suicide risk and connect them to outreach and escalation."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/FollowUpMissedAppointment"
* name = "FollowUpMissedAppointment"
* version = "0.1.0"
* title = "Follow Up Missed Appointment / No-Show"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Identify and follow up missed appointments / no-shows for patients with suicide risk. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Make a no-show by a high-risk patient an actionable event: outreach, safety check, or escalation."
* kind = #CommunicationRequest


Instance: EscalateFollowUp
InstanceOf: ActivityDefinition
Title: "Run Follow-Up Escalation Workflow"
Description: "Escalate when follow-up is missed, the patient is unreachable, or a new safety concern emerges; route to the right person or team and document the outcome."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/EscalateFollowUp"
* name = "EscalateFollowUp"
* version = "0.1.0"
* title = "Run Follow-Up Escalation Workflow"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Run the follow-up escalation workflow. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Close the loop when follow-up fails: escalate to the responsible clinician, team, or supervisor and record the outcome."
* kind = #Task


// ─── Track Risk Over Time ────────────────────────────────────

Instance: MaintainRiskRegistry
InstanceOf: ActivityDefinition
Title: "Maintain Active Suicide-Safer Care Registry / Work Queue"
Description: "Maintain a registry / work queue of active suicide-risk patients with risk status, last/next assessment, safety-plan status, owner, and escalation state."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/MaintainRiskRegistry"
* name = "MaintainRiskRegistry"
* version = "0.1.0"
* title = "Maintain Active Suicide-Safer Care Registry / Work Queue"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Maintain an active suicide-safer care registry / work queue. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Keep every active suicide-risk patient visible in one place with clear ownership and due dates."
* kind = #Task


Instance: TrackRiskEpisodeStatus
InstanceOf: ActivityDefinition
Title: "Track Suicide-Risk Episode / Pathway Status"
Description: "Track an active suicide-risk episode / pathway status over time: entry reason, current tier, owner, open/closed state, and closure reason."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/TrackRiskEpisodeStatus"
* name = "TrackRiskEpisodeStatus"
* version = "0.1.0"
* title = "Track Suicide-Risk Episode / Pathway Status"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Track suicide-risk episode / pathway status. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Give the active suicide-safer care episode a structured, reportable lifecycle from entry to resolution."
* kind = #Task


Instance: ScheduleRiskReassessment
InstanceOf: ActivityDefinition
Title: "Schedule Reassessment / Risk Review"
Description: "Track when suicide-risk reassessment or review is due — driven by risk tier, last assessment date, or clinical judgment — and alert when due or overdue."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ScheduleRiskReassessment"
* name = "ScheduleRiskReassessment"
* version = "0.1.0"
* title = "Schedule Reassessment / Risk Review"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Track reassessment / risk-review schedules. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Make reassessment cadence explicit and enforceable rather than dependent on memory."
* kind = #Task


Instance: TrackOpenSafetyActions
InstanceOf: ActivityDefinition
Title: "Track Open Safety Actions / Care Gaps"
Description: "Track open suicide-safety actions and care gaps (assessment needed, safety plan needed/update, means-safety action open, outreach due, referral incomplete) with owner and due date."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/TrackOpenSafetyActions"
* name = "TrackOpenSafetyActions"
* version = "0.1.0"
* title = "Track Open Safety Actions / Care Gaps"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Track open safety actions / care gaps. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Keep unfinished safety work visible and assignable until completed."
* kind = #Task


Instance: EscalateOverdueRisk
InstanceOf: ActivityDefinition
Title: "Run Risk Escalation / Overdue Workflow"
Description: "Escalate active suicide-risk cases when key steps are overdue or risk worsens; route to the responsible clinician, team, or supervisor and document the outcome."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/EscalateOverdueRisk"
* name = "EscalateOverdueRisk"
* version = "0.1.0"
* title = "Run Risk Escalation / Overdue Workflow"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Run the risk escalation / overdue workflow. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Ensure worsening or stalled episodes are surfaced and acted on, not silently aged out."
* kind = #Task


// ─── Measure and Share the Data ──────────────────────────────

Instance: ReportSuicideSaferCareMeasures
InstanceOf: ActivityDefinition
Title: "Report Suicide-Safer Care KPIs / Measures"
Description: "Calculate and report suicide-safer care measures: screening-to-assessment, risk documented, safety plan before discharge, means counseling, follow-up timeliness (24–48h / 7-day / 30-day), and caring-contact adherence."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ReportSuicideSaferCareMeasures"
* name = "ReportSuicideSaferCareMeasures"
* version = "0.1.0"
* title = "Report Suicide-Safer Care KPIs / Measures"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Report suicide-safer care KPIs / measures. Placeholder ActivityDefinition — no Measure resources authored yet."
* purpose = "Turn pathway activity into numerators and denominators that quality improvement can act on."
* kind = #Task


Instance: ProvideReportingDashboard
InstanceOf: ActivityDefinition
Title: "Provide Reporting Dashboard / Aggregate View"
Description: "Provide a dashboard / aggregate view of pathway activity — screening volume, positive screens, assessments, safety plans, handoffs, follow-up, active episodes, and overdue items — filterable by site, team, and time."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ProvideReportingDashboard"
* name = "ProvideReportingDashboard"
* version = "0.1.0"
* title = "Provide Reporting Dashboard / Aggregate View"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Provide a reporting dashboard / aggregate view of suicide-safer care activity. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Give clinicians, supervisors, and QI teams a routinely refreshed aggregate view of pathway performance."
* kind = #Task


Instance: ExportSuicideSaferCareData
InstanceOf: ActivityDefinition
Title: "Export Data / Analytics Extract"
Description: "Export suicide-safer care data — structured fields with timestamps, not only narrative — for analysis and quality improvement (CSV, warehouse, or FHIR API)."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ExportSuicideSaferCareData"
* name = "ExportSuicideSaferCareData"
* version = "0.1.0"
* title = "Export Data / Analytics Extract"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Export suicide-safer care data for analytics. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Make the structured pathway data available to analytics and evaluation without manual chart abstraction."
* kind = #Task


Instance: ShareSuicideSaferCareData
InstanceOf: ActivityDefinition
Title: "Share Data / Interoperability Output"
Description: "Share suicide-safer care data outside the EHR — risk status, assessment summary, safety-plan status and document, follow-up plan — over HIE, FHIR API, Direct, or referral platforms, honoring consent restrictions."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ShareSuicideSaferCareData"
* name = "ShareSuicideSaferCareData"
* version = "0.1.0"
* title = "Share Data / Interoperability Output"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Share suicide-safer care data outside the EHR with structure and provenance preserved. Placeholder ActivityDefinition — no artifacts authored yet."
* purpose = "Let a patient's suicide-risk signal follow them across facilities and platforms, within consent."
* kind = #CommunicationRequest
