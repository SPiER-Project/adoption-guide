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
// tools, #ServiceRequest for assessment/counseling tools.
// =============================================================


// ─── Flag Risk ───────────────────────────────────────────────

Instance: AdministerPSS3
InstanceOf: ActivityDefinition
Title: "Administer Patient Safety Screener-3 (PSS-3)"
Description: "Administer the Patient Safety Screener-3 (PSS-3), a brief acute-care suicide screen."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerPSS3"
* name = "AdministerPSS3"
* version = "0.1.0"
* title = "Administer Patient Safety Screener-3 (PSS-3)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the Patient Safety Screener-3 (PSS-3), a brief acute-care suicide screen. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Provide a rapid suicide-risk screen in acute-care settings such as the emergency department."
* kind = #ServiceRequest


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
* purpose = "Combine acute-care suicide screening with a site-defined risk-stratification step."
* kind = #ServiceRequest


// ─── Clarify Risk ────────────────────────────────────────────

Instance: AdministerCSSRSSinceLastContact
InstanceOf: ActivityDefinition
Title: "Administer Columbia C-SSRS Since Last Contact"
Description: "Administer the Columbia-Suicide Severity Rating Scale 'Since Last Contact' version — a repeat assessment covering the interval since the prior contact."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCSSRSSinceLastContact"
* name = "AdministerCSSRSSinceLastContact"
* version = "0.1.0"
* title = "Administer Columbia C-SSRS Since Last Contact"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the Columbia-Suicide Severity Rating Scale 'Since Last Contact' version. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Reassess suicide risk over the interval since the patient's prior contact."
* kind = #ServiceRequest


Instance: AdministerBSSA
InstanceOf: ActivityDefinition
Title: "Administer NIMH Brief Suicide Safety Assessment (BSSA)"
Description: "Administer the NIMH Brief Suicide Safety Assessment (BSSA), a disposition-oriented assessment used after a positive ASQ screen."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerBSSA"
* name = "AdministerBSSA"
* version = "0.1.0"
* title = "Administer NIMH Brief Suicide Safety Assessment (BSSA)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the NIMH Brief Suicide Safety Assessment (BSSA). Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Guide clinical disposition after a positive brief screen (e.g. ASQ)."
* kind = #ServiceRequest


// ─── Set Risk Status ─────────────────────────────────────────

Instance: AdministerSAFET
InstanceOf: ActivityDefinition
Title: "Administer SAFE-T"
Description: "Administer the SAFE-T (Suicide Assessment Five-step Evaluation and Triage) structured clinical formulation and triage protocol."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerSAFET"
* name = "AdministerSAFET"
* version = "0.1.0"
* title = "Administer SAFE-T"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the SAFE-T (Suicide Assessment Five-step Evaluation and Triage). Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Support structured clinical formulation of suicide risk and corresponding triage."
* kind = #ServiceRequest


// ─── Document Safety Actions ─────────────────────────────────

Instance: ProvideMeansSafetyCounseling
InstanceOf: ActivityDefinition
Title: "Provide Means Safety Counseling"
Description: "Provide lethal-means safety counseling to reduce access to methods of self-harm."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ProvideMeansSafetyCounseling"
* name = "ProvideMeansSafetyCounseling"
* version = "0.1.0"
* title = "Provide Means Safety Counseling"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Provide lethal-means safety counseling. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Reduce the patient's access to lethal means as a concrete safety action."
* kind = #ServiceRequest


Instance: RecommendNowMattersNow
InstanceOf: ActivityDefinition
Title: "Recommend Now Matters Now"
Description: "Recommend the Now Matters Now patient-facing coping-skills and safety-plan support resource."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/RecommendNowMattersNow"
* name = "RecommendNowMattersNow"
* version = "0.1.0"
* title = "Recommend Now Matters Now"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Recommend the Now Matters Now patient-facing coping-skills and safety-plan support resource. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Connect the patient to a self-directed coping-skills and safety-plan support resource."
* kind = #ServiceRequest


Instance: AuthorCrisisResponsePlan
InstanceOf: ActivityDefinition
Title: "Author Crisis Response Plan"
Description: "Author a Crisis Response Plan (CRP), an alternative crisis-planning framework."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AuthorCrisisResponsePlan"
* name = "AuthorCrisisResponsePlan"
* version = "0.1.0"
* title = "Author Crisis Response Plan"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Author a Crisis Response Plan (CRP). Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Provide an alternative crisis-planning framework to the Stanley-Brown Safety Plan."
* kind = #ServiceRequest


Instance: ProvideCALMMeansSafety
InstanceOf: ActivityDefinition
Title: "Provide CALM / Means Safety Counseling Protocol"
Description: "Provide the CALM (Counseling on Access to Lethal Means) named means-safety protocol."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ProvideCALMMeansSafety"
* name = "ProvideCALMMeansSafety"
* version = "0.1.0"
* title = "Provide CALM / Means Safety Counseling Protocol"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Provide the CALM (Counseling on Access to Lethal Means) protocol. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Deliver means-safety counseling using the named CALM protocol as a structured option."
* kind = #ServiceRequest


// ─── Coordinate Handoffs ─────────────────────────────────────

Instance: RecordTransitionCheckpoint
InstanceOf: ActivityDefinition
Title: "Record Transition Checkpoint"
Description: "Record a pre-discharge transfer-of-care checkpoint communicating suicide-safety information to the next setting."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/RecordTransitionCheckpoint"
* name = "RecordTransitionCheckpoint"
* version = "0.1.0"
* title = "Record Transition Checkpoint"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Record a pre-discharge transfer-of-care checkpoint. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Transfer essential suicide-safety information and responsibility before discharge."
* kind = #CommunicationRequest


Instance: AdministerCAMSOutcomeDisposition
InstanceOf: ActivityDefinition
Title: "Administer CAMS SSF-5 Outcome/Disposition (Final Session)"
Description: "Administer the CAMS SSF-5 Outcome/Disposition final-session assessment covering episode closure, disposition, and next-step planning."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerCAMSOutcomeDisposition"
* name = "AdministerCAMSOutcomeDisposition"
* version = "0.1.0"
* title = "Administer CAMS SSF-5 Outcome/Disposition (Final Session)"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Administer the CAMS SSF-5 Outcome/Disposition final-session assessment. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Document episode closure, disposition, and next-step planning at the final CAMS session."
* kind = #ServiceRequest


Instance: SendRapidReferral
InstanceOf: ActivityDefinition
Title: "Send Rapid Referral to Outpatient Behavioral Healthcare"
Description: "Send a rapid referral for a warm handoff and accelerated access to outpatient behavioral-health follow-up."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/SendRapidReferral"
* name = "SendRapidReferral"
* version = "0.1.0"
* title = "Send Rapid Referral to Outpatient Behavioral Healthcare"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Send a rapid referral to outpatient behavioral healthcare. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Enable a warm handoff and accelerated access to follow-up behavioral-health care."
* kind = #CommunicationRequest


// ─── Track Follow-Up ─────────────────────────────────────────

Instance: SendCaringContact
InstanceOf: ActivityDefinition
Title: "Send Outreach / Caring Contact"
Description: "Send a caring-contact outreach as part of closed-loop post-discharge follow-up."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/SendCaringContact"
* name = "SendCaringContact"
* version = "0.1.0"
* title = "Send Outreach / Caring Contact"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Send a caring-contact outreach. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Maintain closed-loop follow-up through non-demanding caring contacts after the encounter."
* kind = #CommunicationRequest


Instance: ConductEDSAFEFollowUp
InstanceOf: ActivityDefinition
Title: "Conduct ED-SAFE / CLASP-ED Follow-up"
Description: "Conduct protocol-based post-discharge follow-up using the ED-SAFE / CLASP-ED follow-up protocol."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ConductEDSAFEFollowUp"
* name = "ConductEDSAFEFollowUp"
* version = "0.1.0"
* title = "Conduct ED-SAFE / CLASP-ED Follow-up"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Conduct ED-SAFE / CLASP-ED protocol-based post-discharge follow-up. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Deliver structured, protocol-based follow-up after an emergency-department discharge."
* kind = #CommunicationRequest


Instance: ConductColoradoPostVisitFollowUp
InstanceOf: ActivityDefinition
Title: "Conduct Colorado Post-Visit Protocol Follow-up"
Description: "Conduct protocol-based post-visit outreach using the Colorado Post-Visit Protocol."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ConductColoradoPostVisitFollowUp"
* name = "ConductColoradoPostVisitFollowUp"
* version = "0.1.0"
* title = "Conduct Colorado Post-Visit Protocol Follow-up"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Conduct Colorado Post-Visit Protocol outreach. Placeholder ActivityDefinition — no Questionnaire binding or derived-Observation profile authored yet."
* purpose = "Deliver protocol-based post-visit outreach to support continued engagement."
* kind = #CommunicationRequest
