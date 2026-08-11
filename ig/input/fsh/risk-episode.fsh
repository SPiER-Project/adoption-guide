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
//                    docs/plans/stage-7-track-risk-over-time.md.
//
// The five ActivityDefinitions live at the bottom of this file; the data
// layer, recorders, and registry work queue are in web/ (see the design doc).
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
Description: "SPiER-local reasons an episode or a failing follow-up is escalated. Lifted from the SSC 'What can trigger risk escalation?' multiselects — Stage Tile 7 tool 5 question 3, plus the Stage Tile 6 tool 5 additions (new safety concern, missed outreach window, failed contact sequence). One vocabulary serves both stages so escalations converge on one work queue."
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
// Added for Stage 6 (Track Follow-Up), whose SSC trigger list extends this one.
// Kept in THIS CodeSystem rather than forked so a case escalated from follow-up
// and one escalated from the risk registry land in the same work queue.
* #new-safety-concern "New safety concern" "Contact or review surfaced a new suicide-safety concern."
* #missed-outreach-window "Missed outreach window" "A required follow-up contact was not made inside its window."
* #failed-contact-sequence "Failed contact sequence" "A defined sequence of contact attempts completed without reaching the patient."


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


// The artifact that CAUSED the episode to open (#263, Decision 1).
//
// An episode is opened *because* a screen came back positive — which is Stage 1's
// output, not its input. So the episode cannot be the thing every Stage-1 artifact
// points at: at screening time it does not exist, and minting one per screen would
// assert suicide-safer care for every negative screen in the system.
//
// Hence the direction here. Artifacts created AFTER the episode opens carry it
// forward through their Encounter; the one artifact that caused the open is
// reached FROM the episode. Nothing already filed has to be back-stamped, which
// matters because in a real EHR those records may be immutable.
//
// `episode-entry-reason` says *why*; this says *which artifact*. The two are
// complementary and the invariant below ties them together.
Extension: EpisodeTriggerExtension
Id: episode-trigger
Title: "Suicide-Risk Episode Trigger"
Description: "The artifact whose result caused this episode to be opened — a screening/assessment Observation, or the QuestionnaireResponse it was derived from. Read with episode-entry-reason: that records why the patient entered, this records what evidenced it. Screening-level: it identifies the triggering record, not a confirmed clinical finding."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "EpisodeOfCare"
* value[x] only Reference(Observation or QuestionnaireResponse)


// First invariant in this IG, so a note on what checks it: FHIRPath constraints
// are evaluated by the IG Publisher and by the HL7 validator against instances —
// NOT by sushi. A green `npx fsh-sushi .` says nothing about whether this holds.
//
// Scoped deliberately to `positive-screen` rather than every artifact-driven
// reason. `elevated-assessment` ought to carry a trigger too, but the demo data
// cannot satisfy it yet: patient-007 enters on `elevated-assessment` and has no
// assessment artifact recorded at all — only a Stanley-Brown safety plan, which is
// not an assessment. Widening this invariant before that scenario has a real
// assessment would either fail the build or invite a fabricated artifact to
// satisfy it. `manual-add` is explicitly "without a structured triggering event"
// and must never require one.
Invariant: spier-episode-trigger-on-positive-screen
Description: "An episode entered on a positive screen SHALL name the artifact that evidenced it, via the episode-trigger extension."
Severity: #error
Expression: "extension('http://spier.org/StructureDefinition/episode-entry-reason').value.ofType(CodeableConcept).coding.where(system = 'http://spier.org/CodeSystem/spier-episode-entry-reason' and code = 'positive-screen').exists() implies extension('http://spier.org/StructureDefinition/episode-trigger').exists()"


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
    EpisodeCurrentRiskTierExtension named currentRiskTier 0..1 MS and
    EpisodeTriggerExtension named trigger 0..1 MS
// 0..1 rather than 1..1: several entry reasons are not evidenced by a structured
// artifact at all (`clinician-judgment`, `manual-add`, `transition-discharge`), and
// requiring one would invite a fabricated reference to satisfy the profile. The
// invariant makes it required exactly where it is knowable.
* obeys spier-episode-trigger-on-positive-screen
* status MS
* type MS
* patient MS
* period MS


// ─── Profile: the contact, and the correlation hinge (#263) ──
//
// R4 has no universal "this belongs to that episode" pointer. Most of the
// obvious candidates cannot reference an EpisodeOfCare at all:
// Observation.partOf takes Medication*/Procedure/Immunization/ImagingStudy,
// CarePlan.addresses takes Condition (R5 widened it; R4 did not),
// ServiceRequest.basedOn takes CarePlan/ServiceRequest/MedicationRequest, and
// Procedure.partOf takes Procedure/Observation/MedicationAdministration.
//
// What R4 *does* provide is Encounter as the hinge: nine of the eleven resource
// types SPiER emits carry a native `.encounter`, and Encounter.episodeOfCare
// points at the episode. So correlation is two standard hops — no SPiER
// extension, and searchable with stock parameters (`Observation?encounter=…`,
// `Encounter?episode-of-care=…`) on servers SPiER does not control. That is the
// deciding property: a custom extension would need a published SearchParameter
// and server support to be queryable at all, which is the appearance of
// correlation rather than correlation.
//
// See docs/plans/episode-correlation-key.md for the full comparison and the
// verified element table. Two notes that belong next to the profile:
//
//  * `Encounter` itself has NO `category` element, so it cannot carry the
//    concept-domain tag from #262 — same constraint as Appointment,
//    EpisodeOfCare and Task in #272. It is reached through episodeOfCare, not
//    by a domain query.
//  * `Encounter.appointment` is a native Reference(Appointment). That is how
//    Appointments — which have no `.encounter` of their own — join the chain,
//    and it is cleaner than routing through basedOn → ServiceRequest.

Profile: SPiEREncounter
Parent: Encounter
Id: spier-encounter
Title: "SPiER Encounter"
Description: "A contact during which suicide-safer care happened. This is the correlation hinge for the whole pathway: artifacts reference their Encounter through the native `.encounter` element they already have, and this Encounter references the episode, so a consumer can assemble one episode's record with standard search parameters rather than a SPiER-specific extension. Instances SHOULD carry meta.tag = SPiERPathwayStage#<stage> where the contact maps to a single pathway stage."
* ^status = #draft
* ^experimental = true
* status 1..1
* status MS
// `class` is already 1..1 in R4 and keeps its base binding (v3-ActCode):
// an ED visit, an ambulatory visit and a telephone contact are all in scope,
// and SPiER has no reason to narrow that.
* class MS
// The reason this profile exists. 1..* rather than 1..1 because a single
// contact can legitimately belong to more than one programme's episode; the
// requirement is that a suicide-safer-care contact names at least one.
* episodeOfCare 1..*
* episodeOfCare MS
* subject 1..1
* subject only Reference(Patient)
* subject MS
* period 1..1
* period.start 1..1
* period MS
// How Appointments reach the episode — see the note above.
* appointment MS


// ─── Profile: the chart banner ───────────────────────────────

Profile: SPiERSuicideRiskFlag
Parent: Flag
Id: spier-suicide-risk-flag
Title: "SPiER Suicide-Risk Flag"
Description: "The chart banner announcing an open suicide-safer care episode. Deliberately carries NO clinical detail beyond the fact of an active episode — risk tier and history live on the episode and its Observations, so the banner cannot leak assessment detail to every viewer of the chart. Flag.period.start matches the episode start; the flag is set inactive when the episode closes."
* ^status = #draft
* ^experimental = true
* status 1..1
// Flag.category carried a single fixed value, which is a pattern applied to
// EVERY repetition — so adding the Gravity domain tag (#262) alongside it was
// not possible without slicing. Both codes are now named slices: the standard
// HL7 safety category the chart banner needs, and the SPiER domain tag that
// makes the Flag retrievable with the rest of the record.
* insert SuicideRiskDomainSlicing
* category contains safety 1..1
* category[safety] = http://terminology.hl7.org/CodeSystem/flag-category#safety
* insert SuicideRiskDomainSlice
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


// ─── ActivityDefinitions ─────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. Every AD id and canonical
// URL is unchanged so the TL-0xx catalog mappings and the track-risk-over-time
// stage PlanDefinition actions stay stable.
//
// Note the asymmetry: four of these produce resources, but TL-037 (registry)
// produces NOTHING — it is a query over the other four's output. Its AD is
// kept because the tool is catalogued and the stage PD references it, but it
// deliberately declares no output profile.

Instance: MaintainRiskRegistry
InstanceOf: ActivityDefinition
Title: "Maintain Active Suicide-Safer Care Registry / Work Queue"
Description: "Present every open suicide-safer care episode in one work queue with risk tier, owner, due dates, and escalation state. Produces no resource of its own: the registry is a QUERY over open SPiERSuicideRiskEpisode resources and their SPiERSafetyTask children."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/MaintainRiskRegistry"
* name = "MaintainRiskRegistry"
* version = "1.0.0"
* title = "Maintain Active Suicide-Safer Care Registry / Work Queue"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Maintain an active suicide-safer care registry / work queue. This activity stores nothing — it reads. The canonical query is `EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on`, sorted/filtered by the episode's current-risk-tier extension and each task's restriction.period.end. Every column the SSC asks for (risk status, last assessment, next reassessment due, safety-plan status, open tasks, owner, escalation status) is derivable from that one query."
* purpose = "Keep every active suicide-risk patient visible in one place with clear ownership and due dates. Belongs to the Track Risk Over Time stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: TrackRiskEpisodeStatus
InstanceOf: ActivityDefinition
Title: "Track Suicide-Risk Episode / Pathway Status"
Description: "Open, maintain, and close an active suicide-safer care episode. Produces a SPiERSuicideRiskEpisode (EpisodeOfCare) plus the SPiERSuicideRiskFlag (Flag) chart banner that announces it."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/TrackRiskEpisodeStatus"
* name = "TrackRiskEpisodeStatus"
* version = "1.0.0"
* title = "Track Suicide-Risk Episode / Pathway Status"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Track suicide-risk episode / pathway status over time as a SPiERSuicideRiskEpisode: entry reason, current risk tier, assigned owner/team, and an open→closed lifecycle whose closure records both a reason and a final status. Raises a SPiERSuicideRiskFlag while the episode is open. This is the anchor resource for the whole Track Risk Over Time stage — reassessment, care-gap, and escalation Tasks all reference the episode via Task.basedOn."
* purpose = "Give the active suicide-safer care episode a structured, reportable lifecycle from entry to resolution. Belongs to the Track Risk Over Time stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: ScheduleRiskReassessment
InstanceOf: ActivityDefinition
Title: "Schedule Reassessment / Risk Review"
Description: "Schedule the next suicide-risk reassessment as a SPiERSafetyTask with an owner and a due date."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ScheduleRiskReassessment"
* name = "ScheduleRiskReassessment"
* version = "1.0.0"
* title = "Schedule Reassessment / Risk Review"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Schedule reassessment / risk review as a SPiERSafetyTask coded `reassessment-due`, owned by a person or team, with the due date on restriction.period.end. Due and overdue are computed from that date rather than stored, so the schedule cannot silently go stale."
* purpose = "Make reassessment cadence explicit and enforceable rather than dependent on memory. Belongs to the Track Risk Over Time stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


// ─── The cadence itself (#279) ────────────────────────────────
//
// The ActivityDefinition above says reassessment has a due date. It does NOT
// say what the due date should be, and until this PlanDefinition existed nothing
// in SPiER did: `Task.restriction.period.end` came from a date picker that
// defaulted to today, so the interval lived in a clinician's head. The Suicide
// Care Dashboard deck states one (High 7d / Moderate 14d / Low 30d) and calls it
// "automatically calculated" — this is where that calculation comes from.
//
// ─── Why a PlanDefinition and not the ActivityDefinition ─────
//
// The obvious home is `ActivityDefinition.timing`, and it does not work:
// `timing[x]` is 0..1 in R4, so one AD cannot carry four per-tier durations.
// The alternatives were a `CodeSystem.property` on SPiERSuicideRiskTier, and
// this. The property was rejected because an interval is not a fact about the
// concept — "high risk" means the same thing at a site that reassesses weekly
// and one that reassesses daily. It is a policy of THIS pathway, and a
// PlanDefinition is where FHIR puts conditional policy.
//
// ─── Why each action carries BOTH a code and a condition ─────
//
// `condition[applicability]` is the FHIRPath a real CDS engine evaluates.
// `action.code` restates the same tier as a plain Coding, because the demo app
// cannot evaluate arbitrary FHIRPath and should not have to: it reads
// (code, timingDuration) pairs straight off the generated JSON. Two spellings of
// one rule is a real duplication cost, accepted so that neither consumer has to
// reimplement the other's job — and `npm run check:reassessment` fails if they
// disagree.
//
// ─── The two tiers deliberately absent ──────────────────────
//
// `imminent` has NO interval, and that is not an omission. A patient at imminent
// risk is not on a routine outpatient cadence; they are in active escalation
// (see EscalateOverdueRisk). The deck's tiers stop at High and it is an open
// question with the deck's author whether imminent risk routes out of the
// registry entirely — inventing a 7-day cadence here would answer that question
// by accident. `no-risk` has none because such a patient is not on the pathway.
//
// The deck's fourth tier, "Historical — as indicated", has no SPiER tier to hang
// off at all; see the historical-risk axis question in
// docs/plans/suicide-care-dashboard.md.
Instance: SPiERReassessmentSchedule
InstanceOf: PlanDefinition
Title: "SPiER Reassessment Schedule"
Description: "Per-tier suicide-risk reassessment cadence: how long after the last assessment the next one is due, as a function of the patient's current risk tier."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERReassessmentSchedule"
* name = "SPiERReassessmentSchedule"
* version = "1.0.0"
* title = "SPiER Reassessment Schedule"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "The reassessment interval for each suicide-risk tier, so that a reassessment due date is derived from the patient's tier rather than typed by hand. Each action names its tier twice on purpose: as `condition[applicability]` FHIRPath for a CDS engine, and as `action.code` for consumers that read the schedule as data. Tiers with no action have no routine cadence — imminent risk is handled by escalation rather than a schedule, and no-risk patients are not on the pathway."
* purpose = "Make the reassessment interval machine-readable. Before this existed the interval was implicit, so SPiER could not tell a clinician when a reassessment was due, could not alert on one coming due, and could not measure whether reassessments happened on time."
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#track-risk-over-time

* action[+]
  * id = "reassess-high"
  * title = "Reassess high-risk patients every 7 days"
  * description = "A patient whose current suicide-risk tier is high is reassessed every 7 days."
  * code[+] = SPiERSuicideRiskTier#high "High risk"
  * condition[+]
    * kind = #applicability
    * expression.language = #text/fhirpath
    * expression.expression = "%episode.extension('http://spier.org/StructureDefinition/episode-current-risk-tier').value.coding.where(system = 'http://spier.org/CodeSystem/spier-suicide-risk-tier').code = 'high'"
  * timingDuration = 7 'd' "day"
  * definitionCanonical = "http://spier.org/ActivityDefinition/ScheduleRiskReassessment"

* action[+]
  * id = "reassess-moderate"
  * title = "Reassess moderate-risk patients every 14 days"
  * description = "A patient whose current suicide-risk tier is moderate is reassessed every 14 days."
  * code[+] = SPiERSuicideRiskTier#moderate "Moderate risk"
  * condition[+]
    * kind = #applicability
    * expression.language = #text/fhirpath
    * expression.expression = "%episode.extension('http://spier.org/StructureDefinition/episode-current-risk-tier').value.coding.where(system = 'http://spier.org/CodeSystem/spier-suicide-risk-tier').code = 'moderate'"
  * timingDuration = 14 'd' "day"
  * definitionCanonical = "http://spier.org/ActivityDefinition/ScheduleRiskReassessment"

* action[+]
  * id = "reassess-low"
  * title = "Reassess low-risk patients every 30 days"
  * description = "A patient whose current suicide-risk tier is low is reassessed every 30 days."
  * code[+] = SPiERSuicideRiskTier#low "Low risk"
  * condition[+]
    * kind = #applicability
    * expression.language = #text/fhirpath
    * expression.expression = "%episode.extension('http://spier.org/StructureDefinition/episode-current-risk-tier').value.coding.where(system = 'http://spier.org/CodeSystem/spier-suicide-risk-tier').code = 'low'"
  * timingDuration = 30 'd' "day"
  * definitionCanonical = "http://spier.org/ActivityDefinition/ScheduleRiskReassessment"


Instance: TrackOpenSafetyActions
InstanceOf: ActivityDefinition
Title: "Track Open Safety Actions / Care Gaps"
Description: "Track unfinished suicide-safety work as SPiERSafetyTask resources — safety plan needed, lethal-means action open, referral incomplete, appointment missing, and the rest of the SSC care-gap list."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/TrackOpenSafetyActions"
* name = "TrackOpenSafetyActions"
* version = "1.0.0"
* title = "Track Open Safety Actions / Care Gaps"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Track open safety actions / care gaps as SPiERSafetyTask resources, one per gap, each with an owner and a due date and each linked to its episode via Task.basedOn. Task.code carries which gap it is; completion is Task.status = completed."
* purpose = "Keep unfinished safety work visible and assignable until completed. Belongs to the Track Risk Over Time stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: EscalateOverdueRisk
InstanceOf: ActivityDefinition
Title: "Run Risk Escalation / Overdue Workflow"
Description: "Escalate an episode when risk worsens or key steps go overdue, as a SPiERSafetyTask coded `escalation` carrying one or more escalation triggers."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/EscalateOverdueRisk"
* name = "EscalateOverdueRisk"
* version = "1.0.0"
* title = "Run Risk Escalation / Overdue Workflow"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Run the risk escalation / overdue workflow as a SPiERSafetyTask coded `escalation`. The repeating escalation-trigger extension records why (high-risk status, worsening or missed reassessment, missed follow-up or appointment, overdue safety action, unable to reach, or manual clinician escalation — the SSC allows several at once); Task.owner routes it; Task.businessStatus records the outcome."
* purpose = "Ensure worsening or stalled episodes are surfaced and acted on, not silently aged out. Belongs to the Track Risk Over Time stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


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
// Decision 1: the episode names the artifact that opened it, rather than that
// artifact naming an episode which did not exist when it was filed.
* extension[trigger].valueReference = Reference(ExampleSuicideRiskConceptFromASQ)
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
* extension[trigger].valueReference = Reference(ExampleSuicideRiskConceptFromASQ)
* extension[closureReason].valueCodeableConcept = EpisodeClosureReasonCodes#risk-resolved "Risk resolved"
* extension[currentRiskTier].valueCodeableConcept = SPiERSuicideRiskTier#no-risk "No risk identified"
* patient = Reference(Patient/example)
* period.start = "2026-07-02"
* period.end = "2026-09-30"


Instance: ExampleEdEncounter
InstanceOf: SPiEREncounter
Title: "Example — ED contact where the risk episode began"
Description: "The emergency-department visit at which the positive screen happened, referencing the episode it belongs to. Artifacts produced during this visit (the QuestionnaireResponse, its Observations, the safety plan) set `.encounter` to this resource, which is how they are retrieved as one episode's record without a SPiER-specific extension."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#identify-possible-risk
* status = #finished
* class = http://terminology.hl7.org/CodeSystem/v3-ActCode#EMER "emergency"
* episodeOfCare[+] = Reference(ExampleActiveSuicideRiskEpisode)
* subject = Reference(Patient/example)
* period.start = "2026-07-02T08:15:00Z"
* period.end = "2026-07-02T16:40:00Z"


Instance: ExampleFollowUpEncounter
InstanceOf: SPiEREncounter
Title: "Example — Post-discharge follow-up contact"
Description: "A telephone follow-up during the same episode, showing that a second contact correlates to the same EpisodeOfCare. This is what makes two episodes six months apart distinguishable: membership is carried by reference, not inferred from resource ids or dates."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #finished
* class = http://terminology.hl7.org/CodeSystem/v3-ActCode#VR "virtual"
* episodeOfCare[+] = Reference(ExampleActiveSuicideRiskEpisode)
* subject = Reference(Patient/example)
* period.start = "2026-07-09T14:00:00Z"
* period.end = "2026-07-09T14:20:00Z"


Instance: ExampleSuicideRiskFlag
InstanceOf: SPiERSuicideRiskFlag
Title: "Example — Active suicide-risk chart banner"
Description: "The chart banner for an open episode. Carries no clinical detail beyond the existence of the episode."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-risk-over-time
* status = #active
* category[+] = http://terminology.hl7.org/CodeSystem/flag-category#safety
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
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
