# ED Suicide-Care Scenario — FHIR & Functional Profile Mapping (Skeleton)

> **First-pass skeleton.** This document captures the structure plus an initial draft mapping of each event step to FHIR resources, profile bindings, and HL7 EHR System Functional Model references. Cells marked *TBD* are open work; cells marked *gap* indicate no SPiER profile exists yet for that artifact.
>
> **Generated** from [`ed-scenario-11.json`](ed-scenario-11.json) by `scripts/build-use-case-workbook.mjs`, alongside the working group's workbook in [`dist/`](dist/). Edit the JSON, not this file. See [`README.md`](README.md).
>
> **27 of the steps below are the scenario as circulated; 10 are SPiER proposals** marked "(proposed)" and listed with their rationale under [Proposed additions](#proposed-additions). Nothing renumbers the original steps — proposals take the next free letter in their group.
>
> **Tracking epic:** [#61 — ED Functional Profile](https://github.com/SPiER-Project/adoption-guide/issues/61).
>
> The clinical scenario itself stays generic — no real patient, no named site, no named vendor. The pseudonymous patient ("Maria, 28, chronic pain and recent job loss") is a scenario archetype, not a real person.

---

## Scenario summary

A 28-year-old woman with chronic pain and recent job loss presents to a general medical Emergency Department with severe insomnia and anxiety. The EHR-supported workflow covers:

1. **Screening and identification** — triage-time ASQ or C-SSRS ED screener, captured as discrete data, classified, surfaced on the trackboard, and routed via role-based tasks.
2. **Immediate safety / mitigation** — environmental safety, observation/sitter, belongings security.
3. **Brief assessment and risk assessment** — BSSA (after positive ASQ) and SAFE-T with C-SSRS when indicated.
4. **Boarding and reassessment** — time-based reassessment during ED boarding.
5. **Safety planning and discharge planning** — collaborative safety plan, lethal means counseling, discharge readiness gating.
6. **Care transitions and follow-up** — transition-of-care packet, post-discharge caring contacts with overdue escalation.

---

## 11.2 — Screening and Identification

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 11.2-1A | Triage Nurse | Screener / Enterer | `QuestionnaireResponse` | SPiER ASQ Questionnaire ([built](../../FHIR-Resources/ASQ/)) or C-SSRS Screener ([built](../../FHIR-Resources/C-SSRS/)) | DC.1.5 Manage Patient History; DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.2-1B | EHR System | Retainer / Persister | `QuestionnaireResponse` with `encounter` reference + `Provenance` | Encounter linkage + audit | IN.1.1 Entity Authentication; IN.2.2 Auditable Records | n/a |
| 11.2-1C (proposed) | Patient (or caregiver) | Respondent | `QuestionnaireResponse` (author = `Patient`) + `Provenance` (self-reported source) | Reuses the ASQ / C-SSRS Screener Questionnaires (11.2-1A); **gap** — no convention yet for self-report authorship | DC.1.7.1 Capture Standardized Assessments; DC.3.2 Support Patient Education and Self-Care | n/a |
| 11.2-1D (proposed) | Triage Nurse | Screener | `QuestionnaireResponse` (status `stopped`) or `Observation` (screening not performed, with reason) + `Task` (re-attempt) | Demonstrated with native `Observation.dataAbsentReason` (HL7 `temp-unknown`) on the risk-concept Observation — see `p013-screen-not-done`; **gap** — the convention is not profiled or written down, so nothing stops a site recording a deferral as a negative screen | DC.1.7.1 Capture Standardized Assessments; DC.2.3.1 Standard Assessments and Outcomes; IN.2.2 Auditable Records | n/a |
| 11.2-2A | EHR System | Analyzer | `Observation` (derived risk tier) | SPiER ASQ Screening Result Observation ([built — `spier-asq-result`](../../ig/input/fsh/asq.fsh)), valued from the ASQ screening-result CodeSystem (negative / non-acute-positive / acute-positive) | DC.2.3.1 Standard Assessments and Outcomes; DC.2.4.1 Support for Standard Care Plans | `patient-view` |
| 11.2-2B | EHR System | Status / Visibility Manager | `Flag` (suicide screening status) | SPiER Suicide-Risk Flag ([built](../../ig/input/fsh/risk-episode.fsh)) is the adjacent artifact, but it is deliberately the *episode* banner and carries no clinical detail; **gap** — a screening-status flag distinct from it | DC.1.3.1 Manage Alerts; IN.5 Clinical Decision Support | n/a |
| 11.2-2C | EHR System | CDS / Workflow Router | `Task` (role-routed) + `ServiceRequest` (BH consult / BSSA) + `PlanDefinition` reference | SPiER PlanDefinition for stage-1 → stage-2 transition ([`pathway-stages.fsh`](../../ig/input/fsh/pathway-stages.fsh)) | DC.2.4.3 Support for Standard Care Plans, Guidelines, Protocols; IN.5.1 Support Decision Logic | `order-select` / advisory |
| 11.2-2D (proposed) | EHR System | Router | `Observation` (negative screening outcome) + `Task` (re-screen at interval) | Reuses the screening outcome Observation (11.2-2A); **gap** — negative-result handling and re-screen interval are unspecified | DC.2.3.1 Standard Assessments and Outcomes; IN.5.1 Support Decision Logic | n/a |

**Open profile work:** Suicide-Screening-Status Flag, and the screening-deferred convention (11.2-1D). The ASQ Outcome Observation is no longer open — `spier-asq-result` is built. Both remaining items feed back to issue [#52](https://github.com/SPiER-Project/adoption-guide/issues/52) as non-Questionnaire workflow artifacts.

---

## 11.3 — Immediate Safety / Mitigation

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 11.3-1A | ED Nurse | Implementer / Initiator | `Task` (mitigation checklist) + `Procedure` (patient relocation) | **gap** — Mitigation Checklist Task profile | DC.2.4.3 Support for Standard Care Plans; DC.1.1.3 Manage Encounter Information | n/a |
| 11.3-1B | ED Provider (MD/APP) | Orderer / Authorizer | `ServiceRequest` (suicide precautions, observation level) with required signature | **gap** — Suicide Precaution ServiceRequest profile | DC.1.6.1 Order Entry; IN.2.2 Auditable Records | `order-sign` |
| 11.3-1C | ED Nurse / Tech / Security | Safety Implementer | `Observation` (room clearance result) + `List` (belongings inventory) | **gap** — Room Clearance Checklist profile; Belongings Inventory profile | DC.1.6.2 Order Documents and Reports | n/a |
| 11.3-1D | Observer (Sitter) | Continuous Observer | `Observation` series (time-stamped observations) + `CareTeam` (observer assignment) | **gap** — Continuous Observation Log profile | DC.2.4 Manage Care Plans; DC.1.3.1 Manage Alerts | n/a |
| 11.3-1E | EHR System | Status / Visibility Manager | `Flag` (active precautions) with current parameters | **gap** — Active Precautions Flag profile | DC.1.3.1 Manage Alerts; IN.5 Clinical Decision Support | n/a |

**Open profile work:** Mitigation Checklist, Suicide Precaution Order, Room Clearance Checklist, Belongings Inventory, Continuous Observation Log, Active Precautions Flag. All flow to issue [#52](https://github.com/SPiER-Project/adoption-guide/issues/52).

---

## 11.4 — Brief Assessment and Suicide Risk Assessment

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 11.4-0A | ED Clinician / Behavioral Health Clinician | Assessor | `QuestionnaireResponse` (BSSA) | SPiER BSSA Questionnaire ([built](../../FHIR-Resources/BSSA/bssa-questionnaire.json)) + AdministerBSSA ActivityDefinition ([built](../../ig/input/fsh/bssa.fsh)) — TL-005 is built and launchable at `/patient/assessments/bssa` | DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.4-0B | EHR System | Analyzer / Router | `Observation` (BSSA outcome) + `Task` (next-step routing) + `Flag` (cannot leave until evaluated) | SPiER BSSA Disposition Result Observation ([built — `spier-bssa-disposition-result`](../../ig/input/fsh/bssa.fsh)); **gap** — the "Hold for Evaluation" Flag | DC.2.3.1 Standard Assessments and Outcomes; DC.2.4.3 Care Plans Protocols | `patient-view` |
| 11.4-1A | Behavioral Health Clinician | Assessor | `QuestionnaireResponse` (C-SSRS Full + SAFE-T framing) | C-SSRS Full ([built — `cssrs-full-lifetime-recent.json`](../../FHIR-Resources/C-SSRS/cssrs-full-lifetime-recent.json)); SAFE-T ([built — `safet-questionnaire.json`](../../FHIR-Resources/SAFE-T/safet-questionnaire.json)) — TL-006 is built and launchable at `/patient/assessments/safe-t` | DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.4-1B | EHR System | Analyzer / Persister | `Observation` (current suicide risk level) + `Condition` (suicide-risk condition, coded) + `Flag` (longitudinal risk indicator) | SPiER Suicide Risk Concept Observation ([built — `spier-suicide-risk-concept`](../../ig/input/fsh/concept-layer.fsh)) carrying the risk tier; SPiER Suicide-Risk Flag ([built — `spier-suicide-risk-flag`](../../ig/input/fsh/risk-episode.fsh)) as the longitudinal chart banner | DC.1.3.1 Manage Alerts; DC.2.4 Manage Care Plans | n/a |

**Gating tools:** none. BSSA (#21) and SAFE-T (#22) are both built — Questionnaire, ActivityDefinition and result Observation profile each exist, and both launch in the demo. What remains in this section is the "Hold for Evaluation" Flag (11.4-0B).

---

## 11.5 — Boarding and Reassessment

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 11.5-1A | EHR System | Task Scheduler | `Task` series with `restriction.period` + `PlanDefinition` (reassessment cadence) | SPiER Reassessment Schedule PlanDefinition ([built](../../ig/input/fsh/risk-episode.fsh)) + SPiER Safety Task ([built — `spier-safety-task`, `Task.code = reassessment-due`](../../ig/input/fsh/risk-episode.fsh)) | DC.2.4.3 Care Plans Protocols; IN.5.1 Support Decision Logic | n/a |
| 11.5-1B | ED Clinician | Reassessor | `Observation` (updated risk) + `ServiceRequest` (updated precautions) with prior-value preservation | Reuses Current Suicide Risk Level Observation (11.4-1B) + Suicide Precaution ServiceRequest (11.3-1B) | DC.2.3.1 Standard Assessments; DC.1.6.1 Order Entry | n/a |
| 11.5-1C | ED Nurse / Charge Nurse | Safety Monitor | New instance of Room Clearance Checklist (11.3-1C) + updated `CareTeam` for observer handoff | Reuses 11.3-1C and 11.3-1D profiles | DC.1.6.2 Order Documents and Reports | n/a |
| 11.5-1D (proposed) | ED Provider (MD/APP) | Disposition Manager | `ServiceRequest` (admission or transfer) + `Encounter` (disposition and boarding period) + `Organization` (receiving facility) + `Communication` (acceptance) | `Encounter.hospitalization.dischargeDisposition` carries the transfer itself (`psy`), and the lethal-means measure now reads it as a denominator exception; **gap** — the per-attempt placement log | DC.1.6.1 Order Entry; DC.2.5 Order Entry — Referrals; IN.4 Manage Health Information Sharing | n/a |
| 11.5-1E (proposed) | ED Nurse / Charge Nurse | Safety Monitor | `Encounter` (disposition: left without completing treatment) + `Flag` (elopement) + `Communication` (notification and outreach attempts) + `Task` (follow-up) | **gap** — Elopement / left-against-advice handling for an at-risk patient, including the notification and outreach chain | DC.1.1.3 Manage Encounter Information; DC.1.3.1 Manage Alerts; IN.5.1 Support Decision Logic | n/a |

---

## 11.6 — Safety Planning and Discharge Planning

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 11.6-1A | ED Clinician | Enterer | `QuestionnaireResponse` (Stanley-Brown safety plan) + `CarePlan` | Stanley-Brown ([built](../../FHIR-Resources/Stanley-Brown/)) | DC.2.4 Manage Care Plans; DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.6-1B | EHR System | Retainer / Versioner | `CarePlan` with version history + `Provenance` for each version | Reuses Stanley-Brown CarePlan profile; **gap** — versioning extension | DC.2.4 Manage Care Plans; IN.2.2 Auditable Records | n/a |
| 11.6-1C (proposed) | Patient (with support person, if present) | Collaborator | `CarePlan` (patient-confirmed) + `Provenance` (patient as author) + `RelatedPerson` (named support, with agreement) | Reuses the Stanley-Brown CarePlan (11.6-1A); **gap** — patient authorship and per-element accept/decline are unmodelled | DC.2.4 Manage Care Plans; DC.3.2 Support Patient Education and Self-Care; IN.2.2 Auditable Records | n/a |
| 11.6-2A | ED Clinician | Educator | `Procedure` (lethal means counseling delivered) + `CarePlan.activity` (means-safety actions, who/what/when/where) | SPiER Lethal Means Safety Counseling Procedure ([built — `spier-lethal-means-counseling`](../../ig/input/fsh/lethal-means.fsh)) + SPiER Means Safety Action Observation ([built — `spier-means-safety-action`](../../ig/input/fsh/lethal-means.fsh)) — TL-008 is built and launchable at `/patient/workflow/lethal-means` | DC.1.7 Patient Education; DC.2.4 Manage Care Plans | n/a |
| 11.6-2B | EHR System | Discharge Checklist Manager | `Task` (discharge readiness) + `Flag` (blocking alert if incomplete) | **gap** — Discharge Readiness Checklist profile | DC.1.6.1 Order Entry; IN.5.1 Support Decision Logic | `encounter-discharge` |
| 11.6-2C (proposed) | Patient and/or caregiver | Means-Safety Participant | `CarePlan.activity` (per-action owner and due date) + `RelatedPerson` (caregiver) + `Task` (outstanding action) | SPiER Means Safety Action Observation ([built](../../ig/input/fsh/lethal-means.fsh)) carries the completion state (`status` final = done, preliminary = agreed); **gap** — the responsible party and due date are narrative `note` text, not discrete elements, so neither is queryable or reportable | DC.1.7 Patient Education; DC.2.4 Manage Care Plans | n/a |
| 11.6-3A | EHR System | Patient Materials Generator | `Composition` (after-visit summary) + `DocumentReference` (printed/portal-delivered safety plan + discharge instructions) | SPiER Discharge Safety Packet DocumentReference ([built — `spier-discharge-safety-packet`](../../ig/input/fsh/handoffs.fsh)) carries the packet and its content items; **gap** — the AVS Composition itself | DC.1.9 Manage Patient Education; DC.2.7.2 Patient Discharge Summary | n/a |
| 11.6-3B (proposed) | EHR System | Release Manager | `DocumentReference` (with security labels) + `Consent` (release directives) | **gap** — Release / confidentiality rule evaluation, including adolescent proxy access | IN.1.9 Manage Patient Privacy and Confidentiality; DC.1.9 Manage Patient Education; IN.2.2 Auditable Records | n/a |

**Gating tools:** none. Means Counseling (#24) is built — `spier-lethal-means-counseling` and `spier-means-safety-action`, launchable at `/patient/workflow/lethal-means`. What remains is discrete owner/due-date tracking on the means-safety actions (11.6-2C), the discharge-readiness checklist (11.6-2B) and the AVS Composition (11.6-3A).

---

## 11.7 — Care Transitions and Follow-Up

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 11.7-0A (proposed) | ED Clinician | Consent and Privacy Manager | `Consent` (scope, recipients, expiry) + `Provenance` (basis for an emergency disclosure) | SPiER Suicide-Safety Information-Sharing Consent ([built — `spier-information-sharing-consent`](../../ig/input/fsh/handoffs.fsh)) carries permit/deny, the named recipient and the period; **gap** — the legal-basis specifics | IN.1.9 Manage Patient Privacy and Confidentiality; IN.4 Manage Health Information Sharing; IN.2.2 Auditable Records | n/a |
| 11.7-1A | ED Clinician | Orderer | `ServiceRequest` (urgent outpatient referral) + `Appointment` request + `Communication` to receiving provider | SPiER Suicide-Safety Referral ServiceRequest ([built — `spier-safety-referral`](../../ig/input/fsh/handoffs.fsh)) + SPiER Follow-Up Appointment ([built — `spier-follow-up-appointment`](../../ig/input/fsh/handoffs.fsh)) + SPiER Suicide-Safety Handoff Communication ([built — `spier-safety-handoff`](../../ig/input/fsh/handoffs.fsh)) — TL-009 is built and launchable at `/patient/workflow/transition` | DC.2.5 Order Entry — Referrals; DC.1.6.1 Order Entry | `order-select` |
| 11.7-1B | EHR System | Transmitter / Care Transition Packager | `Bundle` (transition-of-care packet) + `Composition` + `Provenance` for delivery acknowledgement | **gap** — Suicide-Specific Transition-of-Care Bundle profile | DC.2.7.1 Care Plan, Guideline, Protocol Generation; IN.4 Manage Health Information Sharing | n/a |
| 11.7-2A | EHR System | Follow-Up Protocol Manager | `Task` series (24–48h call, 7-day visit) + `CommunicationRequest` + `Communication` (per-attempt outreach) + `PlanDefinition` (follow-up cadence) + registry enrollment | SPiER Caring Contact ([built — `spier-caring-contact`](../../ig/input/fsh/follow-up.fsh)) — TL-010 is built and launchable at `/patient/workflow/caring-contact`; **gap** — no PlanDefinition schedules the series, and the ED-SAFE telephone protocol ([TL-012](https://github.com/SPiER-Project/adoption-guide/issues/28)) it would envelope is not modelled | DC.2.4.3 Care Plans Protocols; DC.2.4 Manage Care Plans | n/a |
| 11.7-2B | Care Team | Outreach / Monitor | `Communication` (outreach attempt) + updated `Observation` (current risk) + updated `CarePlan` | Reuses earlier profiles | DC.2.4 Manage Care Plans; DC.1.3.1 Manage Alerts | n/a |
| 11.7-2C | EHR System | Exception / Escalation Manager | `Task` status transitions to overdue + `Communication` (supervisor alert) + `Flag` (escalated follow-up status) | SPiER Safety Task ([built — `spier-safety-task`](../../ig/input/fsh/risk-episode.fsh)) with the escalation-trigger extension ([`spier-escalation-trigger`](../../ig/input/fsh/risk-episode.fsh)), whose codes include `missed-follow-up`, `missed-outreach-window` and `failed-contact-sequence` | IN.5.1 Support Decision Logic; DC.1.3.1 Manage Alerts | n/a |
| 11.7-2D (proposed) | Patient (or caregiver) | Follow-Up Participant | `Communication` (received, with outcome) + `Consent` (withdrawal or channel change) | SPiER Follow-Up Outreach Attempt ([built — `spier-outreach-attempt`](../../ig/input/fsh/follow-up.fsh)) with the outreach-outcome extension ([`spier-outreach-outcome`](../../ig/input/fsh/follow-up.fsh): `patient-reached`, `no-answer`, `message-left`, `unable-to-reach`, `wrong-contact-info`, `patient-declined`, `reached-support-person`); a withdrawal of consent is a deny provision on the SPiER Information-Sharing Consent ([built](../../ig/input/fsh/handoffs.fsh)) | DC.2.4 Manage Care Plans; DC.1.3.1 Manage Alerts | n/a |

**Gating tools:** Caring Contacts (#26) — the contact itself is built (`spier-caring-contact`); what is missing is a PlanDefinition to schedule the series, and the ED-SAFE protocol (#28) it would envelope. Transition (#25) is built and no longer gates this section.

---

## Proposed additions

Steps SPiER proposes adding to the scenario. They are **not** part of the workbook the working group circulated, and are marked "(proposed)" wherever they appear so a reviewer can accept or reject each one. They close three gaps in the original: the patient is never an actor, there are no alternate or exception flows, and consent appears as an input but never as a step. Their EHR-S FM references are drafts and need checking against the published EHR-S FM function list, like every other reference in this document.

- **11.2-1C — Complete a self-administered suicide risk screener on a patient-facing device** (Patient (or caregiver) / Respondent)
  The scenario permits patient self-report in 11.2-1A but never gives the patient an Actor row, so nothing distinguishes a self-completed screen — including whether the patient was alone when answering, which changes how the answers should be read.
- **11.2-1D — Document a declined, deferred, or incompletable screen** (Triage Nurse / Screener)
  A blank is currently indistinguishable from a negative screen. That difference drives both the clinical follow-up and the denominator of every screening measure.
- **11.2-2D — Close the loop on a negative screen** (EHR System / Router)
  11.2-2A defines three outcomes but only the positive ones are consumed anywhere. A negative screen still has consequences: a re-screen interval, and the standing ability of a clinician to escalate anyway.
- **11.5-1D — Arrange psychiatric admission or transfer when ED discharge is not appropriate** (ED Provider (MD/APP) / Disposition Manager)
  11.5's own preamble describes patients awaiting psychiatric placement or transfer, but every step after it follows the discharge-home branch. The placement itself — and the log of failed attempts that explains a long boarding stay — is unmodelled.
- **11.5-1E — Manage elopement or departure against advice by a patient at risk** (ED Nurse / Charge Nurse / Safety Monitor)
  A patient on suicide precautions who leaves is among the highest-risk events an ED sees, and the scenario has no path for it. With no modelled event the encounter simply closes, and the follow-up protocol in 11.7 never fires.
- **11.6-1C — Review, contribute to, and accept the safety plan** (Patient (with support person, if present) / Collaborator)
  The scenario calls the plan collaborative but models only the clinician side. A safety plan the patient did not actually agree to is a documented artifact rather than an intervention — and naming a support person the patient has not agreed to name is itself a disclosure.
- **11.6-2C — Commit to and carry out the agreed means-safety actions** (Patient and/or caregiver / Means-Safety Participant)
  11.6-2A documents that counseling happened and what was agreed, but nothing owns the actions or closes them out. Means-safety is the intervention with the strongest evidence base here, and "agreed" is not "done".
- **11.6-3B — Apply release and confidentiality rules before portal delivery** (EHR System / Release Manager)
  For an adolescent whose guardian holds proxy access, or a plan naming a member of the household the patient is unsafe with, automatic portal release can be the harm. Real deployments gate this, and the scenario should say so rather than describing release as automatic.
- **11.7-0A — Capture consent and privacy directives before any disclosure** (ED Clinician / Consent and Privacy Manager)
  Consent appears only as an input to 11.7-1A and 11.7-1B. Whether the packet may lawfully be sent is a decision with an actor, a timestamp, and a record — and for a minor or a Part 2 program it can forbid the transmission the scenario assumes.
- **11.7-2D — Respond to post-discharge outreach, or not** (Patient (or caregiver) / Follow-Up Participant)
  11.7-2C escalates on missed follow-up, but nothing models the patient side of the contact. "No answer" and "asked us to stop" are clinically and legally different, and only one of them should escalate.

---

## Profile gaps consolidated

Profiles that do not yet exist in the SPiER IG and are required by the ED scenario:

1. Self-report screening authorship convention (QuestionnaireResponse.author + Provenance)
2. Screening-deferred convention: profile `Observation.dataAbsentReason` and publish the reason value set
3. Suicide-Screening-Status Flag, distinct from the episode banner Flag
4. Negative-screen handling: re-screen interval and clinician-override-despite-negative path
5. Mitigation Checklist Task
6. Suicide Precaution ServiceRequest (with required countersignature)
7. Room Clearance Checklist
8. Belongings Inventory
9. Continuous Observation Log
10. Active Precautions Flag
11. "Hold for Evaluation" Flag (cannot-leave-until-evaluated status)
12. Per-attempt inpatient placement log (which facilities were called, and what each answered)
13. Elopement / left-against-advice handling for an at-risk patient
14. CarePlan versioning extension for Stanley-Brown safety plan
15. Patient authorship and per-element accept/decline on the safety plan
16. Discharge Readiness Checklist with blocking behavior
17. Means-safety action tracking: responsible party and due date as discrete elements, not note text
18. Suicide-Specific Discharge AVS Composition
19. Release and confidentiality rule evaluation before portal delivery (incl. proxy access)
20. Disclosure consent legal basis: 42 CFR Part 2 programs, minor consent, and the emergency exception
21. Suicide-Specific Transition-of-Care Bundle
22. Caring Contacts PlanDefinition (the schedule, not the contact)
23. ED-SAFE telephone follow-up protocol

These map to issue [#52](https://github.com/SPiER-Project/adoption-guide/issues/52) (non-Questionnaire workflows) for catalog modeling and to issue [#53](https://github.com/SPiER-Project/adoption-guide/issues/53) for IG profile-page publication.

## Gating tool promotions

Existing tool epics that must advance from `status:planned` to `status:built` for the ED profile to be complete:

- [#26 Caring Contacts](https://github.com/SPiER-Project/adoption-guide/issues/26)
- [#28 ED-SAFE](https://github.com/SPiER-Project/adoption-guide/issues/28)
