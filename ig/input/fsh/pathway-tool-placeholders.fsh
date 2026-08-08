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
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


// ─── Clarify Risk ────────────────────────────────────────────

// AdministerCSSRSSinceLastContact has been promoted out of this placeholder file
// into the full artifact set at ig/input/fsh/cssrs.fsh (Questionnaire binding,
// reusing the shared SPiERCSSRSRiskLevel Observation profile and the existing
// cssrs-risk-level → suicide-risk-tier crosswalk).


// AdministerBSSA has been promoted out of this placeholder file into the full
// artifact set at ig/input/fsh/bssa.fsh (Questionnaire binding, disposition
// CodeSystem/ValueSets, SPiERBSSADispositionResult Observation profile, and a
// disposition → suicide-risk-tier crosswalk in crosswalk-bssa.fsh).


// AdministerPSSFull has been promoted out of this placeholder file into the full
// artifact set at ig/input/fsh/pss-full.fsh (Questionnaire binding + the
// SPiERPSSFullRiskLevel Observation profile whose value binds directly to the
// shared suicide-risk tier — combined PSS-3 screen + site-defined stratification).


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
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #commercial
* copyright = "NO-GO — permission not obtained. The Cultural Assessment of Risk for Suicide (CARS/CARS-S, Chu et al., 2013, *Psychological Assessment*) is a copyrighted research measure held by the authors and/or the American Psychological Association. It is neither public domain nor a free-registration instrument: reproducing its items requires written permission from the authors/publisher, or purchase of the measure. No permission grant is on file, so this ActivityDefinition is a catalogued placeholder that deliberately reproduces NO CARS item content, and SPiER publishes no CARS Questionnaire. Attribution, modification and commercial-use conditions would all have to be captured from a future permission grant. Basis: FHIR-Resources/CARS-S/licensing/MEMO.md (issue #64)."


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
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #spier-authored
* copyright = "SPiER-authored placeholder for a site's own locally-defined risk assessment. SPiER supplies only the workflow slot — no items, no scoring, no third-party content — published with the SPiER Implementation Guide under the guide's own license (CC0-1.0). Whatever instrument a site plugs into this step carries ITS licensing, which the site must establish itself; this ActivityDefinition makes no claim about it."


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

// ProvideMeansSafetyCounseling has been promoted out of this placeholder file
// into the full artifact set at ig/input/fsh/lethal-means.fsh (SPiERLethalMeansCounseling
// Procedure profile + SPiERMeansSafetyAction Observation profile + method/action
// CodeSystems).


// AuthorCrisisResponsePlan has been promoted out of this placeholder file into
// the full artifact set at ig/input/fsh/crp.fsh (Questionnaire binding + the
// SPiERCrisisResponsePlan CarePlan profile, modeled on the Stanley-Brown plan).


// ShareCrisisResources has been promoted out of this placeholder file into the
// full artifact set at ig/input/fsh/crisis-resources.fsh (SPiERCrisisResourcesShared
// Communication profile + crisis-resource CodeSystem/ValueSet + CrisisResourceCode
// extension).


// ─── Coordinate Handoffs ─────────────────────────────────────

// RecordTransitionCheckpoint has been promoted out of this placeholder file into the Stage 5
// handoff artifacts at ig/input/fsh/handoffs.fsh.


// GenerateDischargeSafetyPacket has been promoted out of this placeholder file into the Stage 5
// handoff artifacts at ig/input/fsh/handoffs.fsh.


// SendRapidReferral has been promoted out of this placeholder file into the Stage 5
// handoff artifacts at ig/input/fsh/handoffs.fsh.


// ScheduleFollowUpAppointment has been promoted out of this placeholder file into the Stage 5
// handoff artifacts at ig/input/fsh/handoffs.fsh.


// RecordConsentSharingStatus has been promoted out of this placeholder file into the Stage 5
// handoff artifacts at ig/input/fsh/handoffs.fsh.


// ─── Track Follow-Up ─────────────────────────────────────────

// RecordFollowUpOutreach has been promoted out of this placeholder file into the Stage 6
// follow-up artifacts at ig/input/fsh/follow-up.fsh.


// SendCaringContact has been promoted out of this placeholder file into the Stage 6
// follow-up artifacts at ig/input/fsh/follow-up.fsh.


// TrackFollowUpAppointment has been promoted out of this placeholder file into the Stage 6
// follow-up artifacts at ig/input/fsh/follow-up.fsh.


// FollowUpMissedAppointment has been promoted out of this placeholder file into the Stage 6
// follow-up artifacts at ig/input/fsh/follow-up.fsh.


// EscalateFollowUp has been promoted out of this placeholder file into the Stage 6
// follow-up artifacts at ig/input/fsh/follow-up.fsh.


// ─── Track Risk Over Time ────────────────────────────────────

// MaintainRiskRegistry has been promoted out of this placeholder file into the shared
// stage-7 episode pattern at ig/input/fsh/risk-episode.fsh.


// TrackRiskEpisodeStatus has been promoted out of this placeholder file into the shared
// stage-7 episode pattern at ig/input/fsh/risk-episode.fsh.


// ScheduleRiskReassessment has been promoted out of this placeholder file into the shared
// stage-7 episode pattern at ig/input/fsh/risk-episode.fsh.


// TrackOpenSafetyActions has been promoted out of this placeholder file into the shared
// stage-7 episode pattern at ig/input/fsh/risk-episode.fsh.


// EscalateOverdueRisk has been promoted out of this placeholder file into the shared
// stage-7 episode pattern at ig/input/fsh/risk-episode.fsh.


// ─── Measure and Share the Data ──────────────────────────────

// ReportSuicideSaferCareMeasures has been promoted out of this placeholder file into the Stage 8
// measurement artifacts at ig/input/fsh/measure-and-share.fsh.


// ProvideReportingDashboard has been promoted out of this placeholder file into the Stage 8
// measurement artifacts at ig/input/fsh/measure-and-share.fsh.


// ExportSuicideSaferCareData has been promoted out of this placeholder file into the Stage 8
// measurement artifacts at ig/input/fsh/measure-and-share.fsh.


// ShareSuicideSaferCareData has been promoted out of this placeholder file into the Stage 8
// measurement artifacts at ig/input/fsh/measure-and-share.fsh.
