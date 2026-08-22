// =============================================================
// Stage 6 — Track Follow-Up
// =============================================================
// Five tools, but only TWO new profiles. Stage 6 is where the earlier
// stages start paying off, and the economical encoding is the point:
//
//   TL-033 Follow-Up Outreach / Contact Attempts → SPiEROutreachAttempt  (new)
//   TL-010 Caring Contacts                       → SPiERCaringContact    (new)
//   TL-034 Follow-Up Appointment Tracking        → REUSES SPiERFollowUpAppointment
//                                                  (handoffs.fsh, TL-031)
//   TL-035 Missed Appointment / No-Show Follow-Up→ REUSES SPiEROutreachAttempt
//                                                  (prompted by a no-show)
//   TL-036 Follow-Up Escalation Workflow         → REUSES SPiERSafetyTask
//                                                  (risk-episode.fsh, code=escalation)
//
// Why the reuse is real, not laziness:
//
//  - TL-034: every detail the SSC asks for (scheduled, date/time, attended,
//    cancelled, no-show, rescheduled, completed within 7/30 days) is already
//    carried by Appointment.status + Appointment.start on the appointment
//    TL-031 created. Tracking is a READ over that resource; minting a parallel
//    "appointment tracking" resource would just create something to keep in
//    sync. The 7-/30-day figures are Stage-8 measures computed from it.
//
//  - TL-035: a no-show follow-up IS an outreach attempt — same artifact, same
//    outcome vocabulary. What differs is what PROMPTED it, which the
//    outreach-prompt extension records. The SSC's other no-show details
//    compose from existing resources: "follow-up rescheduled" is a new
//    Appointment, "escalation needed" is a SafetyTask.
//
//  - TL-036: Stage 7 already models escalation as a SafetyTask carrying
//    repeating triggers, and its trigger vocabulary already covered
//    missed-follow-up / missed-appointment / unable-to-reach / high-risk /
//    manual. Stage 6 adds the three triggers it needs that were missing
//    (new safety concern, missed outreach window, failed contact sequence)
//    to that SAME CodeSystem rather than forking a parallel one.
//
// Both new profiles are deliberately LOW floors: the caring-contact recorder
// at /patient/workflow/caring-contact already emits a plain stage-tagged
// Communication, and profiling tightly would make the app non-conformant to
// its own IG (the same call made for the Stage-5 handoff).
// =============================================================


// ─── Outreach vocabulary (TL-033 + TL-035) ───────────────────

CodeSystem: OutreachOutcomeCodes
Id: spier-outreach-outcome
Title: "Follow-Up Outreach Outcome Codes"
Description: "The result of one follow-up outreach attempt. Lifted from the SSC 'What follow-up outreach details can the EHR capture?' multiselect (Stage Tile 6, tool 1, question 5)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #patient-reached "Patient reached" "Direct contact with the patient was made."
* #no-answer "No answer" "The attempt was made; nobody answered."
* #message-left "Message left" "A voicemail or message was left."
* #unable-to-reach "Unable to reach" "Contact could not be made after this attempt."
* #wrong-contact-info "Wrong or outdated contact information" "The contact details on file are not valid."
* #patient-declined "Patient declined contact" "The patient was reached and declined further follow-up."
* #reached-support-person "Reached a support person" "A caregiver or support person was reached instead of the patient."


ValueSet: OutreachOutcome
Id: spier-outreach-outcome-vs
Title: "Follow-Up Outreach Outcome"
Description: "Outcomes of a follow-up outreach attempt."
* ^status = #draft
* ^experimental = true
* include codes from system OutreachOutcomeCodes


CodeSystem: OutreachPromptCodes
Id: spier-outreach-prompt
Title: "Follow-Up Outreach Prompt Codes"
Description: "What prompted an outreach attempt. This is the ONLY thing distinguishing a routine follow-up contact (TL-033) from a no-show follow-up (TL-035) — the artifact and its outcome vocabulary are identical, so one profile serves both tools."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #scheduled-follow-up "Scheduled follow-up" "A planned follow-up contact came due."
* #post-discharge "Post-discharge follow-up" "Contact following a discharge or transition."
* #missed-appointment "Missed appointment" "The patient missed a scheduled appointment."
* #no-show "No-show" "The patient did not attend without cancelling."
* #cancelled-appointment "Cancelled appointment" "The patient cancelled and needs re-engagement."
* #missed-reassessment "Missed reassessment" "A due reassessment was not completed."
* #open-care-gap "Open care gap" "An outstanding safety action prompted contact."


ValueSet: OutreachPrompt
Id: spier-outreach-prompt-vs
Title: "Follow-Up Outreach Prompt"
Description: "Reasons a follow-up outreach attempt was made."
* ^status = #draft
* ^experimental = true
* include codes from system OutreachPromptCodes


Extension: OutreachOutcomeExtension
Id: outreach-outcome
Title: "Follow-Up Outreach Outcome"
Description: "The result of this outreach attempt. Communication has no native outcome element — `status` only says whether the message was sent, not whether anyone answered."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Communication"
* value[x] only CodeableConcept
* valueCodeableConcept from OutreachOutcome (required)


Extension: OutreachPromptExtension
Id: outreach-prompt
Title: "Follow-Up Outreach Prompt"
Description: "What prompted this outreach attempt. Distinguishes a routine follow-up (TL-033) from a no-show follow-up (TL-035) without needing two resource shapes."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Communication"
* value[x] only CodeableConcept
* valueCodeableConcept from OutreachPrompt (required)


Extension: SafetyConcernIdentified
Id: safety-concern-identified
Title: "Safety Concern Identified"
Description: "Whether the contact surfaced a new suicide-safety concern. Deliberately SEPARATE from the outcome: a concern can be identified on a reached call, and 'unable to reach' can itself be the concern — the two axes are orthogonal, so collapsing them into one code list would lose information."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Communication"
* value[x] only boolean


Extension: CaringContactOptOut
Id: caring-contact-opt-out
Title: "Caring Contact Opt-Out"
Description: "Whether the patient has opted out of the caring-contacts series. Recorded on the contact because opt-out is what stops the schedule; the SSC asks for it explicitly (Stage Tile 6, tool 2, question 5)."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Communication"
* value[x] only boolean


// ─── TL-033 / TL-035 — Outreach attempt ──────────────────────

Profile: SPiEROutreachAttempt
Parent: Communication
Id: spier-outreach-attempt
Title: "SPiER Follow-Up Outreach Attempt"
Description: "One follow-up contact attempt and what came of it. Serves BOTH routine follow-up outreach (TL-033) and missed-appointment / no-show follow-up (TL-035) — the artifact is the same; the outreach-prompt extension records which. `sent` is the attempt time, `medium` the method, and the outreach-outcome extension the result (Communication has no native outcome element). A new safety concern is flagged separately from the outcome because the two are orthogonal."
* ^status = #draft
* ^experimental = true
* status 1..1
* subject 1..1
* subject only Reference(Patient)
* sent 1..1
* medium MS
* extension contains
    OutreachOutcomeExtension named outcome 1..1 MS and
    OutreachPromptExtension named prompt 0..1 MS and
    SafetyConcernIdentified named safetyConcern 0..1 MS
* status MS
* subject MS
* sent MS
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory


// ─── TL-010 — Caring contact ─────────────────────────────────

Profile: SPiERCaringContact
Parent: Communication
Id: spier-caring-contact
Title: "SPiER Caring Contact"
Description: "A caring contact: a brief, non-demanding supportive message sent on a schedule after an episode of risk — an evidence-based intervention in its own right, not an outreach attempt. Kept distinct from SPiEROutreachAttempt because it asks nothing of the patient and has no 'outcome' to record: what matters is that it was sent, by what method, and whether the patient has opted out. Deliberately a LOW floor so the existing demo recorder's plain Communication stays conformant."
* ^status = #draft
* ^experimental = true
* status 1..1
* subject 1..1
* subject only Reference(Patient)
* sent 1..1
* medium MS
* extension contains CaringContactOptOut named optOut 0..1 MS
* status MS
* subject MS
* sent MS
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory


// ─── ActivityDefinitions ─────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh; ids and canonical URLs
// unchanged so catalog mappings and stage PD actions stay stable.

Instance: RecordFollowUpOutreach
InstanceOf: ActivityDefinition
Title: "Record Follow-Up Outreach / Contact Attempt"
Description: "Record one follow-up contact attempt and its outcome as a SPiEROutreachAttempt."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/RecordFollowUpOutreach"
* name = "RecordFollowUpOutreach"
* version = "1.0.0"
* title = "Record Follow-Up Outreach / Contact Attempt"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Record a follow-up outreach attempt: when it was made, by what method, what came of it (reached / no answer / message left / unable to reach), and whether it surfaced a new safety concern."
* purpose = "Make follow-up contact auditable attempt-by-attempt rather than as a vague 'we tried'. Belongs to the Track Follow-Up stage."
* kind = #CommunicationRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: SendCaringContact
InstanceOf: ActivityDefinition
Title: "Send Caring Contact"
Description: "Send a scheduled caring contact — a brief supportive, non-demanding message — as a SPiERCaringContact."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/SendCaringContact"
* name = "SendCaringContact"
* version = "1.0.0"
* title = "Send Caring Contact"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Send and record a caring contact: a brief, non-demanding supportive message on a defined schedule after an episode of risk. Captures method, sent date, and opt-out status. Distinct from outreach — a caring contact asks nothing of the patient, so it has no reached/unreached outcome."
* purpose = "Sustain low-burden supportive contact after an episode of risk — one of the few interventions with direct evidence for reducing repeat attempts. Belongs to the Track Follow-Up stage."
* kind = #CommunicationRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #spier-authored
* copyright = "SPiER-authored workflow content: this activity records that a caring contact was sent and how the patient responded. Caring contacts are a published intervention pattern rather than a proprietary instrument, and SPiER ships no message text of its own here. The activity and its SPiER profiles are published with the SPiER Implementation Guide under the guide's own license (CC0-1.0). Message templates a site adopts from a published caring-contacts program carry that program's own terms, which SPiER has not audited."


Instance: TrackFollowUpAppointment
InstanceOf: ActivityDefinition
Title: "Track Follow-Up Appointment"
Description: "Track whether the follow-up appointment actually happened. Produces NO new resource — reads the SPiERFollowUpAppointment created at handoff."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/TrackFollowUpAppointment"
* name = "TrackFollowUpAppointment"
* version = "1.0.0"
* title = "Track Follow-Up Appointment"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Track whether the follow-up appointment occurred. This activity stores nothing new: Appointment.status already carries booked / fulfilled / cancelled / noshow and Appointment.start the date, so attended, cancelled, no-show, rescheduled, and the 7- and 30-day completion windows are all derivable from the SPiERFollowUpAppointment created at handoff (TL-031). The 7-/30-day figures are Stage-8 measures computed over these."
* purpose = "Know whether follow-up actually happened, not just that it was booked. Belongs to the Track Follow-Up stage."
* kind = #Appointment
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: FollowUpMissedAppointment
InstanceOf: ActivityDefinition
Title: "Follow Up on a Missed Appointment / No-Show"
Description: "Re-engage a patient who missed or no-showed a follow-up appointment, recorded as a SPiEROutreachAttempt prompted by the no-show."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/FollowUpMissedAppointment"
* name = "FollowUpMissedAppointment"
* version = "1.0.0"
* title = "Follow Up on a Missed Appointment / No-Show"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Re-engage a patient after a missed or no-showed appointment. The attempt is a SPiEROutreachAttempt whose outreach-prompt is missed-appointment or no-show — the same artifact as routine outreach, differing only in what triggered it. The remaining SSC details compose from existing resources: a rescheduled visit is a new SPiERFollowUpAppointment, and escalation is a SPiERSafetyTask."
* purpose = "Treat a missed appointment by a high-risk patient as a safety event rather than an empty slot. Belongs to the Track Follow-Up stage."
* kind = #CommunicationRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: EscalateFollowUp
InstanceOf: ActivityDefinition
Title: "Run Follow-Up Escalation Workflow"
Description: "Escalate when follow-up fails, as a SPiERSafetyTask coded escalation — the same escalation resource Stage 7 uses."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/EscalateFollowUp"
* name = "EscalateFollowUp"
* version = "1.0.0"
* title = "Run Follow-Up Escalation Workflow"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Escalate when follow-up fails — missed follow-up, no-show, unable to reach, a new safety concern, a missed outreach window, or a failed contact sequence. Deliberately reuses the Stage-7 SPiERSafetyTask (code = escalation) with its repeating escalation-trigger extension rather than defining a parallel escalation resource, so a case escalated from follow-up and one escalated from the risk registry land in the same work queue."
* purpose = "Ensure failed follow-up is surfaced and acted on rather than quietly aging out. Belongs to the Track Follow-Up stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleOutreachAttemptReached
InstanceOf: SPiEROutreachAttempt
Title: "Example — Routine follow-up outreach, patient reached"
Description: "A scheduled 7-day follow-up call where the patient was reached and no new concern surfaced."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-follow-up
* status = #completed
* category[+].text = "Follow-up outreach attempt"
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* sent = "2026-07-27T16:30:00Z"
* medium[+] = http://terminology.hl7.org/CodeSystem/v3-ParticipationMode#PHONE "Telephone"
* extension[outcome].valueCodeableConcept = OutreachOutcomeCodes#patient-reached "Patient reached"
* extension[prompt].valueCodeableConcept = OutreachPromptCodes#scheduled-follow-up "Scheduled follow-up"
* extension[safetyConcern].valueBoolean = false


Instance: ExampleOutreachAttemptNoShow
InstanceOf: SPiEROutreachAttempt
Title: "Example — No-show follow-up, unable to reach"
Description: "The TL-035 case: the same outreach artifact, prompted by a no-show, where contact failed and a safety concern was flagged. This is what would trigger the escalation task below."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-follow-up
* status = #completed
* category[+].text = "No-show follow-up"
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* sent = "2026-07-28T09:15:00Z"
* medium[+] = http://terminology.hl7.org/CodeSystem/v3-ParticipationMode#PHONE "Telephone"
* extension[outcome].valueCodeableConcept = OutreachOutcomeCodes#unable-to-reach "Unable to reach"
* extension[prompt].valueCodeableConcept = OutreachPromptCodes#no-show "No-show"
* extension[safetyConcern].valueBoolean = true
* note.text = "Third attempt. No answer, mailbox full. Escalated to care manager."


Instance: ExampleCaringContact
InstanceOf: SPiERCaringContact
Title: "Example — Caring contact sent"
Description: "A scheduled supportive card, asking nothing of the patient; the patient has not opted out."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-follow-up
* status = #completed
* category[+].text = "Caring contact"
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* sent = "2026-08-03T10:00:00Z"
* medium[+] = http://terminology.hl7.org/CodeSystem/v3-ParticipationMode#WRITTEN "Written"
* extension[optOut].valueBoolean = false
* payload[+].contentString = "Thinking of you and hoping things are going well. No reply needed."
