// =============================================================
// Stage 7 — Track Risk Over Time: the shared episode pattern
// =============================================================
// DESIGN FILE. Stage 7 ("Track Risk Over Time") catalogues five tools:
//   TL-037 Active Suicide-Safer Care Registry / Work Queue
//   TL-038 Suicide-Risk Episode / Pathway Status
//   TL-039 Reassessment / Risk Review Schedule
//   TL-040 Open Safety Actions / Care Gap Tracking
//   TL-041 Risk Escalation / Overdue Workflow
//
// They are NOT five independent artifacts. They are five views of ONE
// longitudinal structure, which this file defines:
//
//   EpisodeOfCare  → the episode itself (TL-038) — entry reason, current
//                    tier, owner/team, open/closed lifecycle + closure reason
//   Flag           → the chart banner announcing an active episode
//   Task           → every piece of open, owned, due-dated work hanging off
//                    the episode (TL-039 reassessment, TL-040 care gaps,
//                    TL-041 escalation) — differentiated by Task.code
//   (no resource)  → TL-037 the registry/work queue is a QUERY over the
//                    above, not a stored artifact. See the design doc at
//                    docs/design/stage-7-track-risk-over-time.md.
//
// Per-tool ActivityDefinition promotion, catalog wiring, and demo recorders
// are deliberately NOT in this file — this PR establishes the shape first
// (per docs/plans/ssc-stage-tiles-rollout.md, Wave 5).
//
// Resources conformant to these profiles carry the SPiER pathway-stage
// `meta.tag` (track-risk-over-time) so web/src/lib/patientPathway.ts stages
// them with no resolver change — see the examples below.
//
// Terminology note: no published LOINC/SNOMED value sets cover the SSC
// episode-entry, closure, safety-task, or escalation-trigger vocabularies,
// so all five CodeSystems below are SPiER-local. Codes are lifted directly
// from the SSC stage-tile question set (docs/reference/ssc-stage-tiles-question-set.md)
// so the encoding stays answerable against the SSC instrument.
// =============================================================


// ─── CodeSystems ─────────────────────────────────────────────

CodeSystem: SuicideRiskEpisodeTypeCodes
Id: spier-episode-type
Title: "Suicide-Risk Episode Type Codes"
Description: "SPiER-local EpisodeOfCare.type for the suicide-safer care episode."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #suicide-safer-care "Suicide-safer care episode" "An active episode of suicide-safer care being tracked along the SPiER pathway."


CodeSystem: EpisodeEntryReasonCodes
Id: spier-episode-entry-reason
Title: "Suicide-Risk Episode Entry Reason Codes"
Description: "SPiER-local reasons a patient enters an active suicide-safer care episode. Mirrors the SSC 'reason for entry' / registry-inclusion options (Stage Tile 7, tools 1–2)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #positive-screen "Positive screen" "A suicide-risk screen was positive (ASQ, PSS-3, C-SSRS screener, PHQ-9 item 9, SBQ-R)."
* #elevated-assessment "Elevated risk on assessment" "A clarifying assessment placed the patient at an elevated risk tier."
* #suicide-attempt "Suicide attempt" "The patient presented with, or reported, a suicide attempt."
* #safety-plan-needed "Safety plan needed" "The patient needs a safety plan that is not yet in place."
* #transition-discharge "Transition or discharge" "Entry driven by a discharge/transition of care requiring follow-up."
* #referral "Referral" "Entered via referral from another provider or team."
* #clinician-judgment "Clinician judgment" "A clinician added the patient based on clinical judgment."
* #manual-add "Manual add" "Added manually without a structured triggering event."


CodeSystem: EpisodeClosureReasonCodes
Id: spier-episode-closure-reason
Title: "Suicide-Risk Episode Closure Reason Codes"
Description: "SPiER-local reasons an active suicide-safer care episode is closed. The SSC asks whether closure requires a reason plus a final status (Stage Tile 7, tool 2, question 6); this is the reason half."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #risk-resolved "Risk resolved" "Risk resolved per reassessment and clinical judgment; safety actions complete."
* #transferred "Transferred to other care" "Care transferred to another provider, team, or organization."
* #stepped-down "Stepped down to routine care" "No longer requires active suicide-safer care tracking."
* #patient-declined "Patient declined" "The patient declined further suicide-safer care follow-up."
* #lost-to-follow-up "Lost to follow-up" "The patient could not be reached after documented outreach attempts."
* #deceased "Deceased" "The patient died. Record cause separately; do not infer suicide from this code."
* #administrative "Administrative closure" "Closed for administrative reasons (duplicate, entered in error handled separately)."


CodeSystem: SafetyTaskTypeCodes
Id: spier-safety-task-type
Title: "Safety Task Type Codes"
Description: "SPiER-local Task.code values for open suicide-safety work tracked over time. Lifted from the SSC 'What open safety actions or gaps can the EHR track?' multiselect (Stage Tile 7, tool 4, question 4) plus the escalation workflow (tool 5)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #assessment-needed "Assessment needed" "A suicide-risk assessment is outstanding."
* #reassessment-due "Reassessment due" "A scheduled reassessment / risk review is due (TL-039)."
* #safety-plan-needed "Safety plan needed" "No safety plan is on file."
* #safety-plan-update "Safety plan update needed" "The existing safety plan needs review or update."
* #lethal-means-action-open "Lethal means action open" "An agreed means-safety action is not yet confirmed complete."
* #follow-up-outreach-due "Follow-up outreach due" "A follow-up contact is due."
* #referral-incomplete "Referral / handoff incomplete" "A referral or handoff has not been completed or acknowledged."
* #appointment-missing "Appointment missing" "No follow-up appointment is scheduled."
* #escalation "Risk escalation" "The episode has been escalated for review or intervention (TL-041)."


CodeSystem: EscalationTriggerCodes
Id: spier-escalation-trigger
Title: "Risk Escalation Trigger Codes"
Description: "SPiER-local reasons an active episode is escalated. Lifted from the SSC 'What can trigger risk escalation?' multiselect (Stage Tile 7, tool 5, question 3)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #high-risk-status "High-risk status" "The patient's current risk tier is high or imminent."
* #worsening-reassessment "Worsening reassessment" "A reassessment showed deterioration versus the prior result."
* #missed-reassessment "Missed reassessment" "A scheduled reassessment was not completed."
* #missed-follow-up "Missed follow-up" "A scheduled follow-up contact did not occur."
* #safety-action-overdue "Open safety action overdue" "An open safety action passed its due date."
* #missed-appointment "Missed appointment / no-show" "The patient did not attend a scheduled appointment."
* #unable-to-reach "Unable to reach patient" "Documented outreach attempts failed."
* #manual-escalation "Clinician manually escalated" "A clinician escalated the case on judgment."


CodeSystem: SuicideRiskFlagCodes
Id: spier-risk-flag
Title: "Suicide-Risk Flag Codes"
Description: "SPiER-local Flag.code for the active suicide-safer care chart banner. A SNOMED CT binding is a follow-up: candidate concept 'At risk for suicide' must be validated against a real SNOMED release before it is asserted here (earlier SPiER artifacts carried codes with invalid check digits — see stanley-brown.fsh)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #active-suicide-risk-episode "Active suicide-safer care episode" "The patient has an open suicide-safer care episode being tracked on the SPiER pathway."


// ─── ValueSets ───────────────────────────────────────────────

ValueSet: SuicideRiskEpisodeType
Id: spier-episode-type-vs
Title: "Suicide-Risk Episode Type"
Description: "Episode types for suicide-safer care tracking."
* ^status = #draft
* ^experimental = true
* include codes from system SuicideRiskEpisodeTypeCodes


ValueSet: EpisodeEntryReason
Id: spier-episode-entry-reason-vs
Title: "Suicide-Risk Episode Entry Reason"
Description: "Reasons a patient enters an active suicide-safer care episode."
* ^status = #draft
* ^experimental = true
* include codes from system EpisodeEntryReasonCodes


ValueSet: EpisodeClosureReason
Id: spier-episode-closure-reason-vs
Title: "Suicide-Risk Episode Closure Reason"
Description: "Reasons an active suicide-safer care episode is closed."
* ^status = #draft
* ^experimental = true
* include codes from system EpisodeClosureReasonCodes


ValueSet: SafetyTaskType
Id: spier-safety-task-type-vs
Title: "Safety Task Type"
Description: "Kinds of open suicide-safety work tracked over time."
* ^status = #draft
* ^experimental = true
* include codes from system SafetyTaskTypeCodes


ValueSet: EscalationTrigger
Id: spier-escalation-trigger-vs
Title: "Risk Escalation Trigger"
Description: "Reasons an active suicide-safer care episode is escalated."
* ^status = #draft
* ^experimental = true
* include codes from system EscalationTriggerCodes


ValueSet: SuicideRiskFlagCode
Id: spier-risk-flag-vs
Title: "Suicide-Risk Flag Code"
Description: "Flag codes for the active suicide-safer care chart banner."
* ^status = #draft
* ^experimental = true
* include codes from system SuicideRiskFlagCodes


// ─── Extensions ──────────────────────────────────────────────
// R4 EpisodeOfCare has no `reason` element (that is R5), so entry and
// closure reasons — both explicitly required by the SSC question set —
// ride as extensions.

Extension: EpisodeEntryReasonExtension
Id: episode-entry-reason
Title: "Suicide-Risk Episode Entry Reason"
Description: "Why the patient entered the active suicide-safer care episode. R4 EpisodeOfCare has no reason element; R5 adds EpisodeOfCare.reason, which this extension anticipates."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "EpisodeOfCare"
* value[x] only CodeableConcept
* valueCodeableConcept from EpisodeEntryReason (required)


Extension: EpisodeClosureReasonExtension
Id: episode-closure-reason
Title: "Suicide-Risk Episode Closure Reason"
Description: "Why the active suicide-safer care episode was closed. Populated when EpisodeOfCare.status becomes finished or cancelled."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "EpisodeOfCare"
* value[x] only CodeableConcept
* valueCodeableConcept from EpisodeClosureReason (required)


Extension: EpisodeCurrentRiskTierExtension
Id: episode-current-risk-tier
Title: "Suicide-Risk Episode Current Risk Tier"
Description: "The episode's CURRENT suicide-risk tier, on the shared instrument-agnostic vocabulary (concept-layer.fsh). This is a denormalized cache of the most recent SPiERSuicideRiskConcept Observation, carried on the episode so a registry/work-queue query can filter and sort by tier without joining the observation history. The Observation history remains the source of truth; producers MUST refresh this when a newer risk Observation is recorded."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "EpisodeOfCare"
* value[x] only CodeableConcept
* valueCodeableConcept from SPiERSuicideRiskTierVS (required)


Extension: EscalationTriggerExtension
Id: escalation-trigger
Title: "Risk Escalation Trigger"
Description: "What caused an escalation task to be raised. Repeats: an escalation can have more than one trigger (e.g. missed reassessment AND unable to reach)."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Task"
* value[x] only CodeableConcept
* valueCodeableConcept from EscalationTrigger (required)


// ─── Profile: the episode (TL-038, and the registry's subject) ───

Profile: SPiERSuicideRiskEpisode
Parent: EpisodeOfCare
Id: spier-suicide-risk-episode
Title: "SPiER Suicide-Risk Episode"
Description: "An active episode of suicide-safer care, tracked from entry to resolution. This is the anchor resource for Stage 7: the registry/work queue (TL-037) is a query over these, the episode/pathway status tool (TL-038) IS this resource, and every Stage-7 Task hangs off it via Task.basedOn. Instances SHOULD carry meta.tag = SPiERPathwayStage#track-risk-over-time so the SPiER pathway resolver stages them."
* ^status = #draft
* ^experimental = true
// Lifecycle: active = open episode, finished/cancelled = closed.
// statusHistory gives the reportable status-change trail the SSC asks for
// ("What happens when the episode/pathway status changes?").
* status 1..1
* statusHistory MS
* type 1..*
* type from SuicideRiskEpisodeType (extensible)
* patient 1..1
* patient only Reference(Patient)
// period.start = episode start date; period.end set at closure.
* period 1..1
* period.start 1..1
// Assigned owner and/or team — the SSC requires responsibility assignment.
* careManager MS
* team MS
* extension contains
    EpisodeEntryReasonExtension named entryReason 1..1 MS and
    EpisodeClosureReasonExtension named closureReason 0..1 MS and
    EpisodeCurrentRiskTierExtension named currentRiskTier 0..1 MS
* status MS
* type MS
* patient MS
* period MS


// ─── Profile: the chart banner ───────────────────────────────

Profile: SPiERSuicideRiskFlag
Parent: Flag
Id: spier-suicide-risk-flag
Title: "SPiER Suicide-Risk Flag"
Description: "The chart banner announcing an open suicide-safer care episode. Deliberately carries NO clinical detail beyond the fact of an active episode — risk tier and history live on the episode and its Observations, so the banner cannot leak assessment detail to every viewer of the chart. Flag.period.start matches the episode start; the flag is set inactive when the episode closes."
* ^status = #draft
* ^experimental = true
* status 1..1
* category 1..*
* category = http://terminology.hl7.org/CodeSystem/flag-category#safety
* code 1..1
* code from SuicideRiskFlagCode (required)
* subject 1..1
* subject only Reference(Patient)
* period MS
* status MS
* category MS
* code MS
* subject MS


// ─── Profile: open, owned, due-dated safety work ─────────────

Profile: SPiERSafetyTask
Parent: Task
Id: spier-safety-task
Title: "SPiER Safety Task"
Description: "One piece of open suicide-safety work with an owner and a due date. ONE profile serves three Stage-7 tools, differentiated by Task.code: reassessment-due is the Reassessment / Risk Review Schedule (TL-039); the care-gap codes are Open Safety Actions / Care Gap Tracking (TL-040); the escalation code plus the escalation-trigger extension is the Risk Escalation / Overdue Workflow (TL-041). Task.restriction.period.end carries the due date, so 'overdue' is a computed query (restriction.period.end < now AND status != completed) rather than a stored state that can go stale."
* ^status = #draft
* ^experimental = true
* status 1..1
* intent 1..1
* intent = #plan (exactly)
* code 1..1
* code from SafetyTaskType (required)
* for 1..1
* for only Reference(Patient)
// basedOn links the task to its episode so the registry can roll tasks up.
* basedOn 0..*
// Owner = the person or team responsible (SSC: "owner plus due date" scores highest).
* owner MS
// Due date. restriction.period.end is the FHIR idiom for "fulfil by".
* restriction MS
* restriction.period MS
// businessStatus carries workflow state beyond Task.status (e.g. "overdue",
// "escalated to crisis team") without overloading the required status codes.
* businessStatus MS
* extension contains EscalationTriggerExtension named escalationTrigger 0..* MS
* status MS
* intent MS
* code MS
* for MS


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleActiveSuicideRiskEpisode
InstanceOf: SPiERSuicideRiskEpisode
Title: "Example — Active suicide-safer care episode"
Description: "An open episode entered from a positive screen, currently at the moderate tier, owned by a care manager. Tagged to the Track Risk Over Time stage."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #active
* type[+] = SuicideRiskEpisodeTypeCodes#suicide-safer-care "Suicide-safer care episode"
* extension[entryReason].valueCodeableConcept = EpisodeEntryReasonCodes#positive-screen "Positive screen"
* extension[currentRiskTier].valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* patient = Reference(Patient/example)
* period.start = "2026-07-02"


Instance: ExampleClosedSuicideRiskEpisode
InstanceOf: SPiERSuicideRiskEpisode
Title: "Example — Closed suicide-safer care episode"
Description: "The same episode after resolution: status finished, an end date, and a closure reason — the reason-plus-final-status combination the SSC scores highest."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #finished
* statusHistory[+].status = #active
* statusHistory[=].period.start = "2026-07-02"
* statusHistory[=].period.end = "2026-09-30"
* statusHistory[+].status = #finished
* statusHistory[=].period.start = "2026-09-30"
* type[+] = SuicideRiskEpisodeTypeCodes#suicide-safer-care "Suicide-safer care episode"
* extension[entryReason].valueCodeableConcept = EpisodeEntryReasonCodes#positive-screen "Positive screen"
* extension[closureReason].valueCodeableConcept = EpisodeClosureReasonCodes#risk-resolved "Risk resolved"
* extension[currentRiskTier].valueCodeableConcept = SPiERSuicideRiskTier#no-risk "No risk identified"
* patient = Reference(Patient/example)
* period.start = "2026-07-02"
* period.end = "2026-09-30"


Instance: ExampleSuicideRiskFlag
InstanceOf: SPiERSuicideRiskFlag
Title: "Example — Active suicide-risk chart banner"
Description: "The chart banner for an open episode. Carries no clinical detail beyond the existence of the episode."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #active
* category[+] = http://terminology.hl7.org/CodeSystem/flag-category#safety
* code = SuicideRiskFlagCodes#active-suicide-risk-episode "Active suicide-safer care episode"
* subject = Reference(Patient/example)
* period.start = "2026-07-02"


Instance: ExampleReassessmentDueTask
InstanceOf: SPiERSafetyTask
Title: "Example — Reassessment due (TL-039)"
Description: "A scheduled risk review with an owner and a due date, linked to its episode. 'Overdue' is computed from restriction.period.end, not stored."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #requested
* intent = #plan
* code = SafetyTaskTypeCodes#reassessment-due "Reassessment due"
* for = Reference(Patient/example)
* basedOn[+] = Reference(ExampleActiveSuicideRiskEpisode)
* authoredOn = "2026-07-02T09:00:00Z"
* restriction.period.end = "2026-07-16T23:59:59Z"
* note.text = "Two-week risk review per moderate-tier cadence."


Instance: ExampleCareGapTask
InstanceOf: SPiERSafetyTask
Title: "Example — Open care gap: safety plan needed (TL-040)"
Description: "An open safety action: the patient has no safety plan on file yet."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #requested
* intent = #plan
* code = SafetyTaskTypeCodes#safety-plan-needed "Safety plan needed"
* for = Reference(Patient/example)
* basedOn[+] = Reference(ExampleActiveSuicideRiskEpisode)
* authoredOn = "2026-07-02T09:05:00Z"
* restriction.period.end = "2026-07-05T23:59:59Z"


Instance: ExampleEscalationTask
InstanceOf: SPiERSafetyTask
Title: "Example — Risk escalation (TL-041)"
Description: "An escalation raised by two triggers (missed reassessment plus unable to reach the patient), routed to the crisis team with the outcome carried in businessStatus."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #in-progress
* intent = #plan
* code = SafetyTaskTypeCodes#escalation "Risk escalation"
* extension[escalationTrigger][+].valueCodeableConcept = EscalationTriggerCodes#missed-reassessment "Missed reassessment"
* extension[escalationTrigger][+].valueCodeableConcept = EscalationTriggerCodes#unable-to-reach "Unable to reach patient"
* for = Reference(Patient/example)
* basedOn[+] = Reference(ExampleActiveSuicideRiskEpisode)
* authoredOn = "2026-07-17T08:00:00Z"
* businessStatus.text = "Routed to crisis team; outreach attempt scheduled same day"
* note.text = "Reassessment 1 day overdue and three outreach attempts unanswered."
