// =============================================================
// Stage 5 — Coordinate Handoffs
// =============================================================
// Five tools, four FHIR resource types. Unlike Stage 7 (one episode with
// work hanging off it), these are genuinely distinct artifacts — what unites
// them is a single question: "when this patient moves to the next provider,
// does the suicide-safety context move with them?"
//
//   TL-009 Suicide-Safety Handoff / Transition Checklist → Communication
//   TL-030 Discharge Safety Packet / Transition Bundle   → DocumentReference
//   TL-017 Referral or Next Provider Handoff             → ServiceRequest
//   TL-031 Next Appointment / Follow-Up Scheduling       → Appointment
//   TL-032 Consent / Information-Sharing Status          → Consent
//
// TL-009 and TL-030 answer overlapping SSC checklists ("what is included in
// the handoff / the packet?"), so they SHARE one content vocabulary and one
// extension rather than carrying two near-identical code sets.
//
// Why ServiceRequest for the referral (TL-017): the SSC asks whether the EHR
// can track that a referral was "accepted or completed" (Stage Tile 5, tool 3,
// question 5). ServiceRequest.status models that lifecycle natively;
// Communication — which only records that something was *sent* — cannot.
// NOTE: the current demo recorder at /patient/workflow/rapid-referral still
// emits a Communication. That app/IG gap is deliberate and tracked, not
// silent drift; see docs/plans/stage-5-coordinate-handoffs.md.
//
// Resources conformant to these profiles carry the pathway-stage meta.tag
// (coordinate-handoffs) so patientPathway.ts stages them unchanged.
// =============================================================


// ─── Shared content vocabulary (TL-009 + TL-030) ─────────────

CodeSystem: HandoffContentCodes
Id: spier-handoff-content
Title: "Suicide-Safety Handoff Content Codes"
Description: "What a suicide-safety handoff or discharge packet includes. One vocabulary serves both the transition checklist (TL-009) and the discharge safety packet (TL-030) — the SSC asks nearly the same 'what is included?' multiselect for each (Stage Tile 5, tools 1 and 2)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #current-risk-status "Current risk status" "The patient's current suicide-risk status/tier."
* #recent-assessment "Most recent suicide-risk assessment" "The most recent assessment result."
* #safety-plan-status "Safety plan status" "Whether a safety plan exists and its state."
* #safety-plan-copy "Safety plan copy" "A copy of the safety plan itself."
* #lethal-means-actions "Lethal means safety actions" "Agreed or completed means-safety actions."
* #crisis-resources "Crisis contacts / resources" "988, Crisis Text Line, local crisis lines."
* #follow-up-plan "Follow-up plan" "The agreed follow-up plan."
* #next-provider "Next provider / team" "Who is receiving the patient."
* #appointment-details "Appointment details" "Date, time, location of the next appointment."
* #referral-details "Referral details" "Details of the referral being made."
* #care-team-contact "Care team contact" "How to reach the sending care team."
* #patient-instructions "Patient instructions" "Written instructions given to the patient."
* #pending-tasks "Pending tasks" "Safety work still open at the point of transition."


ValueSet: HandoffContent
Id: spier-handoff-content-vs
Title: "Suicide-Safety Handoff Content"
Description: "Items that can be included in a suicide-safety handoff or discharge packet."
* ^status = #draft
* ^experimental = true
* include codes from system HandoffContentCodes


Extension: HandoffContentItem
Id: handoff-content-item
Title: "Handoff Content Item"
Description: "One item included in a suicide-safety handoff or discharge packet. Repeats. Used on Communication (TL-009) and DocumentReference (TL-030) because neither has a native coded slot for 'what was included'."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Communication"
* ^context[+].type = #element
* ^context[=].expression = "DocumentReference"
* value[x] only CodeableConcept
* valueCodeableConcept from HandoffContent (required)


// ─── Why something is NOT in the packet (TL-030 × TL-032) ────
// A packet that is silently missing a section is indistinguishable from a
// bug. These codes are what make an omission readable as a respected patient
// preference — and are the reason the withheld-item extension pairs the
// content code with a basis rather than simply dropping the code.

CodeSystem: HandoffWithholdingBasisCodes
Id: spier-withholding-basis
Title: "Suicide-Safety Handoff Withholding Basis Codes"
Description: "Why an item a suicide-safety discharge packet would otherwise have carried was left out of it. Every code here traces to something recorded on a SPiERInformationSharingConsent (TL-032), or to the deliberate default applied when no such record exists."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #patient-declined-sharing "Patient declined sharing" "The governing consent's root provision is a deny: the patient declined sharing this information at all."
* #category-excluded "Category excluded by the patient" "The governing consent carries a deny provision naming this content category."
* #recipient-excluded "Recipient excluded by the patient" "The governing consent carries a deny provision naming the recipient this packet was assembled for."
* #recipient-not-authorised "Recipient not authorised by the consent" "The governing consent permits sharing with named recipients only, and this packet's recipient is not among them. A permit naming one party is not a permit naming any party."
* #consent-expired "Sharing consent expired" "The governing consent's provision.period has ended, so it no longer authorises release."
* #no-consent-recorded "No sharing consent on file" "No active suicide-safety sharing consent exists for this patient, and the withholding default was applied rather than an assumption of permission."


ValueSet: HandoffWithholdingBasis
Id: spier-withholding-basis-vs
Title: "Suicide-Safety Handoff Withholding Basis"
Description: "Reasons an item was withheld from a suicide-safety discharge packet."
* ^status = #draft
* ^experimental = true
* include codes from system HandoffWithholdingBasisCodes


Extension: HandoffWithheldItem
Id: handoff-withheld-item
Title: "Handoff Withheld Item"
Description: "One item deliberately left OUT of a suicide-safety discharge packet, paired with the basis for leaving it out. The counterpart to handoff-content-item: together they let a packet state both what it carries and what it does not, so a reader can distinguish a respected patient preference from a missing section. Contexted on DocumentReference only — the TL-009 handoff Communication has no assembly step to gate."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "DocumentReference"
* value[x] 0..0
* extension contains
    item 1..1 and
    basis 1..1
* extension[item] ^short = "The content item that was withheld"
* extension[item].value[x] only CodeableConcept
* extension[item].valueCodeableConcept from HandoffContent (required)
* extension[basis] ^short = "Why it was withheld"
* extension[basis].value[x] only CodeableConcept
* extension[basis].valueCodeableConcept from HandoffWithholdingBasis (required)


// ─── Referral reason (TL-017) ────────────────────────────────

CodeSystem: ReferralReasonCodes
Id: spier-referral-reason
Title: "Suicide-Safety Referral Reason Codes"
Description: "Why a suicide-safety referral or next-provider handoff is being made (SSC 'reason for referral' / 'suicide-risk concern')."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #elevated-risk "Elevated suicide risk" "Referral driven by an elevated risk tier."
* #safety-planning "Safety planning" "Referral for safety planning or safety-plan review."
* #ongoing-treatment "Ongoing behavioral health treatment" "Referral into continuing treatment."
* #higher-level-of-care "Higher level of care" "Referral to a more intensive setting."
* #specialty-assessment "Specialty assessment" "Referral for a specialist suicide-risk assessment."
* #post-discharge-follow-up "Post-discharge follow-up" "Referral to establish follow-up after discharge."


ValueSet: ReferralReason
Id: spier-referral-reason-vs
Title: "Suicide-Safety Referral Reason"
Description: "Reasons for a suicide-safety referral or next-provider handoff."
* ^status = #draft
* ^experimental = true
* include codes from system ReferralReasonCodes


// ─── Consent category (TL-032) ───────────────────────────────

CodeSystem: ConsentCategoryCodes
Id: spier-consent-category
Title: "Suicide-Safety Consent Category Codes"
Description: "SPiER-local Consent.category marking a consent record as governing the sharing of suicide-safety information."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #suicide-safety-sharing "Suicide-safety information sharing" "Consent governing whether suicide-safety information may be shared with another provider, team, or support person."


ValueSet: ConsentCategory
Id: spier-consent-category-vs
Title: "Suicide-Safety Consent Category"
Description: "Consent categories for suicide-safety information sharing."
* ^status = #draft
* ^experimental = true
* include codes from system ConsentCategoryCodes


// ─── TL-009 — Suicide-Safety Handoff / Transition Checklist ──

Profile: SPiERSafetyHandoff
Parent: Communication
Id: spier-safety-handoff
Title: "SPiER Suicide-Safety Handoff Communication"
Description: "A documented suicide-safety handoff at a transition of care: who it went to, when, and what suicide-safety context travelled with it. The content checklist rides as repeating handoff-content-item extensions. Deliberately a LOW floor — the existing demo recorder emits a plain stage-tagged Communication, and this profile is written so that output stays conformant while richer coded capture is possible."
* ^status = #draft
* ^experimental = true
* status 1..1
* status = #completed (exactly)
* subject 1..1
* subject only Reference(Patient)
* sent 1..1
* extension contains HandoffContentItem named contentItem 0..* MS
* status MS
* subject MS
* sent MS
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory


// ─── TL-030 — Discharge Safety Packet / Transition Bundle ────

Profile: SPiERDischargeSafetyPacket
Parent: DocumentReference
Id: spier-discharge-safety-packet
Title: "SPiER Discharge Safety Packet DocumentReference"
Description: "The bundle of suicide-safety material given to a patient (and/or the next provider) at discharge or transition. DocumentReference rather than Communication because the packet is an ARTIFACT that persists and can be re-retrieved, not a one-time transmission: `content.attachment` is the packet itself, `context.related` points at the live resources it was assembled from (safety plan CarePlan, risk Observation, follow-up Appointment), and the repeating handoff-content-item extensions record what was included even where no discrete resource exists. Where the patient's sharing consent (TL-032) excluded something, the packet says so: the withheld item and its basis ride as handoff-withheld-item extensions, and the governing Consent is itself listed in `context.related` so a reader can see the preference that produced the omission."
* ^status = #draft
* ^experimental = true
* status 1..1
* status = #current (exactly)
* subject 1..1
* subject only Reference(Patient)
* date 1..1
* content 1..*
// Two halves of one statement — what the packet carries, and what it does not.
// A packet asserting neither is conformant (both are 0..*); a packet asserting
// only the first cannot be told apart from one assembled before anyone asked.
* extension contains
    HandoffContentItem named contentItem 0..* MS and
    HandoffWithheldItem named withheldItem 0..* MS
* status MS
* subject MS
* date MS
* content MS
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory


// ─── TL-017 — Referral or Next Provider Handoff ──────────────

Profile: SPiERSafetyReferral
Parent: ServiceRequest
Id: spier-safety-referral
Title: "SPiER Suicide-Safety Referral ServiceRequest"
Description: "A referral or handoff to the next provider/team for suicide-safety care. ServiceRequest because the SSC requires tracking whether the referral was accepted or completed — ServiceRequest.status models draft → active → completed (or revoked) natively, which a Communication cannot. `performer` is the receiving provider/team, `reasonCode` the suicide-safety reason."
* ^status = #draft
* ^experimental = true
* status 1..1
* intent 1..1
* intent = #order (exactly)
* subject 1..1
* subject only Reference(Patient)
* authoredOn 1..1
* reasonCode 0..*
* reasonCode from ReferralReason (extensible)
* performer MS
* status MS
* intent MS
* subject MS
* authoredOn MS
* reasonCode MS
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory


// ─── TL-031 — Next Appointment / Follow-Up Scheduling ────────

Profile: SPiERFollowUpAppointment
Parent: Appointment
Id: spier-follow-up-appointment
Title: "SPiER Follow-Up Appointment"
Description: "The next follow-up visit scheduled before transition or discharge. Appointment.status carries the lifecycle the SSC asks about (booked → fulfilled, or noshow / cancelled — which is what makes the Stage-6 no-show workflow possible without a second resource type)."
* ^status = #draft
* ^experimental = true
* status 1..1
* start 1..1
* participant 1..*
* participant.status 1..1
// #272 — the domain tag, in the only slot R4 Appointment offers. Appointment has
// no `category`; `serviceCategory` is the searchable equivalent
// (`Appointment?service-category=…`), so this is a one-hop query rather than
// reading the episode's Encounters and following `Encounter.appointment`. Both
// paths stay valid; this one does not require knowing the episode first.
* insert SuicideRiskDomainServiceCategory
* status MS
* start MS
* participant MS
* serviceCategory[suicideRisk] MS


// ─── TL-032 — Consent / Information-Sharing Status ───────────

Profile: SPiERInformationSharingConsent
Parent: Consent
Id: spier-information-sharing-consent
Title: "SPiER Suicide-Safety Information-Sharing Consent"
Description: "Whether suicide-safety information may be shared with another provider, team, or support person — and with whom, for how long. Modelled with native Consent structures rather than SPiER-local codes: `provision.type` permit/deny is the grant-or-decline decision (so 'patient declined' is a deny provision, not a separate status), `provision.actor` names the recipient, and `provision.period` carries any expiry. Nested deny provisions carry the exclusions: `provision.provision.actor` a recipient the patient excluded, `provision.provision.code` the content categories they excluded (from the TL-009/TL-030 handoff-content vocabulary). This record is not decorative — the discharge safety packet (TL-030) reads it before asserting what it carries, and records anything it withheld. Only the category is SPiER-local, marking the record as governing suicide-safety sharing."
* ^status = #draft
* ^experimental = true
* status 1..1
* scope 1..1
// The content categories a provision applies to, drawn from the same vocabulary
// the packet uses — that shared vocabulary is what lets one resource gate the
// other without SPiER-specific logic.
//
// ⚠️ Only the ROOT provision can be constrained here. `Consent.provision.provision`
// is a contentReference back to `Consent.provision`, and a contentReference
// cannot be profiled — so there is NO way to bind the nested slice where the
// exclusions actually live. The binding below documents the vocabulary and
// applies at the root; what enforces it on nested provisions is
// web/src/lib/handoffs.ts and its unit tests, not this profile.
* provision.code from HandoffContent (extensible)
* category 1..*
// Pattern-discriminated slice (same approach as SPiERSuicideRiskConcept.category)
// so a site's own Consent categories can coexist with the SPiER marker.
* category ^slicing.discriminator.type = #pattern
* category ^slicing.discriminator.path = "$this"
* category ^slicing.rules = #open
* category contains suicideSafety 1..1
* category[suicideSafety] = ConsentCategoryCodes#suicide-safety-sharing
// Gravity-pattern domain tag (#262). Only the SLICE half of the RuleSet is
// inserted here: this profile already declares the slicing above, and
// re-declaring the discriminator would either duplicate it or fight it.
* insert SuicideRiskDomainSlice
* patient 1..1
* patient only Reference(Patient)
* dateTime 1..1
* provision MS
* status MS
* category MS
* patient MS
* dateTime MS


// ─── ActivityDefinitions ─────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh; ids and canonical URLs
// unchanged so catalog mappings and stage PD actions stay stable.

Instance: RecordTransitionCheckpoint
InstanceOf: ActivityDefinition
Title: "Record Suicide-Safety Handoff / Transition Checkpoint"
Description: "Document a suicide-safety handoff at a transition of care as a SPiERSafetyHandoff Communication."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/RecordTransitionCheckpoint"
* name = "RecordTransitionCheckpoint"
* version = "1.0.0"
* title = "Record Suicide-Safety Handoff / Transition Checkpoint"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Record that a suicide-safety handoff happened at a transition of care, capturing who received it, when, and which safety context travelled with the patient (current risk status, safety-plan status, means-safety actions, crisis resources, follow-up plan, pending tasks)."
* purpose = "Make sure suicide-safety context survives a transition of care. Belongs to the Coordinate Handoffs stage."
* kind = #CommunicationRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: GenerateDischargeSafetyPacket
InstanceOf: ActivityDefinition
Title: "Generate Discharge Safety Packet / Transition Bundle"
Description: "Assemble the suicide-safety discharge packet as a SPiERDischargeSafetyPacket DocumentReference listing what it contains."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/GenerateDischargeSafetyPacket"
* name = "GenerateDischargeSafetyPacket"
* version = "1.0.0"
* title = "Generate Discharge Safety Packet / Transition Bundle"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Assemble and record the discharge safety packet as a DocumentReference: the packet artifact in content.attachment, the live resources it was built from in context.related, and the included-item checklist as repeating handoff-content-item extensions."
* purpose = "Give the patient and the next provider one retrievable bundle of the suicide-safety essentials. Belongs to the Coordinate Handoffs stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: SendRapidReferral
InstanceOf: ActivityDefinition
Title: "Send Referral or Next Provider Handoff"
Description: "Refer the patient to the next provider/team as a SPiERSafetyReferral ServiceRequest, tracked through to accepted/completed."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/SendRapidReferral"
* name = "SendRapidReferral"
* version = "1.0.0"
* title = "Send Referral or Next Provider Handoff"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Send a suicide-safety referral to the next provider or team as a ServiceRequest, so the handoff can be tracked past 'sent' through accepted and completed. The receiving provider/team is the performer; the suicide-safety driver is the reasonCode."
* purpose = "Close the loop on referrals rather than assuming a sent referral was received. Belongs to the Coordinate Handoffs stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: ScheduleFollowUpAppointment
InstanceOf: ActivityDefinition
Title: "Schedule Next Appointment / Follow-Up Visit"
Description: "Schedule or document the next follow-up visit before transition/discharge as a SPiERFollowUpAppointment."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ScheduleFollowUpAppointment"
* name = "ScheduleFollowUpAppointment"
* version = "1.0.0"
* title = "Schedule Next Appointment / Follow-Up Visit"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Schedule or document the next follow-up visit before the patient leaves, as an Appointment carrying date/time, receiving provider or team, location, and status."
* purpose = "Ensure the patient leaves with a follow-up already in place rather than an instruction to call. Belongs to the Coordinate Handoffs stage."
* kind = #Appointment
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: RecordConsentSharingStatus
InstanceOf: ActivityDefinition
Title: "Record Consent / Information-Sharing Status"
Description: "Document whether suicide-safety information may be shared, and with whom, as a SPiERInformationSharingConsent."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/RecordConsentSharingStatus"
* name = "RecordConsentSharingStatus"
* version = "1.0.0"
* title = "Record Consent / Information-Sharing Status"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Record whether suicide-safety information may be shared with another provider, team, or support person, using native Consent provisions: permit/deny as the decision (a patient declining is a deny provision), the recipient as provision.actor, and any expiry as provision.period."
* purpose = "Let the EHR decide what may be sent or withheld at a handoff, instead of guessing. Belongs to the Coordinate Handoffs stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleSafetyHandoff
InstanceOf: SPiERSafetyHandoff
Title: "Example — Suicide-safety handoff at discharge"
Description: "A handoff Communication recording which safety context travelled with the patient to the receiving team."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#coordinate-handoffs
* status = #completed
* category[+].text = "Suicide-safety handoff"
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* sent = "2026-07-20T15:00:00Z"
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#current-risk-status "Current risk status"
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#safety-plan-status "Safety plan status"
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#lethal-means-actions "Lethal means safety actions"
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#follow-up-plan "Follow-up plan"
* payload[+].contentString = "Warm handoff to Riverside BH team; accepting clinician confirmed by phone."


Instance: ExampleDischargeSafetyPacket
InstanceOf: SPiERDischargeSafetyPacket
Title: "Example — Discharge safety packet assembled under a sharing consent"
Description: "The packet given to the patient at discharge: what it contains, the live safety plan it was built from, and — because the patient's consent excluded that category — the one thing it deliberately does not contain."
Usage: #example
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* meta.tag[+] = SPiERPathwayStage#coordinate-handoffs
* status = #current
* type.text = "Suicide-safety discharge packet"
* subject = Reference(Patient/example)
* date = "2026-07-20T15:10:00Z"
* content[+].attachment.title = "Suicide-safety discharge packet (PDF)"
* content[=].attachment.contentType = #application/pdf
* context.related[+] = Reference(ExampleStanleyBrownSafetyPlan)
// The consent that governed assembly, so the omission below is traceable to
// the preference that caused it rather than reading as a missing section.
* context.related[+] = Reference(ExampleInformationSharingConsent)
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#safety-plan-copy "Safety plan copy"
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#crisis-resources "Crisis contacts / resources"
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#appointment-details "Appointment details"
* extension[contentItem][+].valueCodeableConcept = HandoffContentCodes#patient-instructions "Patient instructions"
* extension[withheldItem][+].extension[item].valueCodeableConcept = HandoffContentCodes#recent-assessment "Most recent suicide-risk assessment"
* extension[withheldItem][=].extension[basis].valueCodeableConcept = HandoffWithholdingBasisCodes#category-excluded "Category excluded by the patient"


Instance: ExampleSafetyReferral
InstanceOf: SPiERSafetyReferral
Title: "Example — Referral accepted by the receiving team"
Description: "A suicide-safety referral tracked past 'sent': status active means the receiving team has taken it up."
Usage: #example
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* meta.tag[+] = SPiERPathwayStage#coordinate-handoffs
* status = #active
* intent = #order
* code.text = "Referral to outpatient behavioral health"
* subject = Reference(Patient/example)
* authoredOn = "2026-07-20T15:05:00Z"
* reasonCode[+] = ReferralReasonCodes#post-discharge-follow-up "Post-discharge follow-up"
* performer[+].display = "Riverside Behavioral Health"


Instance: ExampleFollowUpAppointment
InstanceOf: SPiERFollowUpAppointment
Title: "Example — Follow-up visit booked before discharge"
Description: "A booked follow-up appointment with the receiving behavioral-health team."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#coordinate-handoffs
* status = #booked
* description = "Post-discharge behavioral health follow-up"
* start = "2026-07-27T14:00:00Z"
* end = "2026-07-27T14:45:00Z"
* participant[+].actor = Reference(Patient/example)
* participant[=].status = #accepted
* participant[+].actor.display = "Riverside Behavioral Health"
* participant[=].status = #accepted


Instance: ExampleInformationSharingConsent
InstanceOf: SPiERInformationSharingConsent
Title: "Example — Consent to share safety information with a support person"
Description: "Permit sharing with the receiving team, with two explicit denies: one named support person, and one content category the patient did not want forwarded. The SSC's 'patient declined' case, modelled as deny provisions rather than a separate status — and read by the discharge packet above, which withheld the excluded category and said so."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#coordinate-handoffs
* status = #active
* scope = http://terminology.hl7.org/CodeSystem/consentscope#patient-privacy
* category[suicideSafety] = ConsentCategoryCodes#suicide-safety-sharing
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* patient = Reference(Patient/example)
* dateTime = "2026-07-20T14:55:00Z"
// Required by the base Consent invariant ppc-1 ("Either a Policy or
// PolicyRule"). Caught by the IG Publisher QA run in #201 — SUSHI does not
// evaluate FHIRPath invariants, so this example shipped invalid in Wave 5 and
// no light-CI job could have flagged it.
* policyRule = http://terminology.hl7.org/CodeSystem/consentpolicycodes#hipaa-auth "HIPAA Authorization"
* provision.type = #permit
* provision.period.start = "2026-07-20"
* provision.period.end = "2027-07-20"
* provision.actor[+].role = http://terminology.hl7.org/CodeSystem/v3-ParticipationType#IRCP "information recipient"
* provision.actor[=].reference.display = "Riverside Behavioral Health"
// Two nested denies, NOT one. Within a single provision the criteria are ANDed
// — actor + code in the same provision would mean "deny this category to this
// person only", which is a narrower statement than the patient made. Separate
// provisions keep the two preferences independent.
* provision.provision[+].type = #deny
* provision.provision[=].actor[+].role = http://terminology.hl7.org/CodeSystem/v3-ParticipationType#IRCP "information recipient"
* provision.provision[=].actor[=].reference.display = "Support person — declined by patient"
* provision.provision[+].type = #deny
* provision.provision[=].code[+] = HandoffContentCodes#recent-assessment "Most recent suicide-risk assessment"
