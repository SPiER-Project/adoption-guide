# ED Suicide-Care Scenario — FHIR & Functional Profile Mapping (Skeleton)

> **First-pass skeleton.** Source scenario authored by the SPiER clinical lead as an external CSV. This document captures the structure plus an initial draft mapping of each event step to FHIR resources, profile bindings, and HL7 EHR System Functional Model references. Cells marked *TBD* are open work; cells marked *gap* indicate no SPiER profile exists yet for that artifact.
>
> **Tracking epic:** [#61 — ED Functional Profile](https://github.com/bbthorson/SPiER/issues/61).
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

| Step | Actor / Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
|---|---|---|---|---|---|
| 11.2-1A | Triage Nurse / Screener | `QuestionnaireResponse` | SPiER ASQ Questionnaire ([built](../../FHIR-Resources/ASQ/)) or C-SSRS Screener ([built](../../FHIR-Resources/C-SSRS/)) | DC.1.5 Manage Patient History; DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.2-1B | EHR System / Retainer | `QuestionnaireResponse` with `encounter` reference + `Provenance` | Encounter linkage + audit | IN.1.1 Entity Authentication; IN.2.2 Auditable Records | n/a |
| 11.2-2A | EHR System / Analyzer | `Observation` (derived risk tier) | **gap** — needs a SPiER ASQ Outcome Observation profile (low/non-acute positive/acute positive) | DC.2.3.1 Standard Assessments and Outcomes; DC.2.4.1 Support for Standard Care Plans | `patient-view` |
| 11.2-2B | EHR System / Status Visibility Manager | `Flag` (suicide screening status) | **gap** — SPiER Suicide-Screening-Status Flag profile | DC.1.3.1 Manage Alerts; IN.5 Clinical Decision Support | n/a |
| 11.2-2C | EHR System / CDS Workflow Router | `Task` (role-routed) + `ServiceRequest` (BH consult / BSSA) + `PlanDefinition` reference | SPiER PlanDefinition for stage-1 → stage-2 transition ([`pathway-stages.fsh`](../../ig/input/fsh/pathway-stages.fsh)) | DC.2.4.3 Support for Standard Care Plans, Guidelines, Protocols; IN.5.1 Support Decision Logic | `order-select` / advisory |

**Open profile work:** ASQ Outcome Observation, Suicide-Screening-Status Flag. Both feed back to issue [#52](https://github.com/bbthorson/SPiER/issues/52) as non-Questionnaire workflow artifacts.

---

## 11.3 — Immediate Safety / Mitigation

| Step | Actor / Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
|---|---|---|---|---|---|
| 11.3-1A | ED Nurse / Implementer | `Task` (mitigation checklist) + `Procedure` (patient relocation) | **gap** — Mitigation Checklist Task profile | DC.2.4.3 Support for Standard Care Plans; DC.1.1.3 Manage Encounter Information | n/a |
| 11.3-1B | ED Provider / Orderer | `ServiceRequest` (suicide precautions, observation level) with required signature | **gap** — Suicide Precaution ServiceRequest profile | DC.1.6.1 Order Entry; IN.2.2 Auditable Records | `order-sign` |
| 11.3-1C | Nurse / Tech / Security / Safety Implementer | `Observation` (room clearance result) + `List` (belongings inventory) | **gap** — Room Clearance Checklist profile; Belongings Inventory profile | DC.1.6.2 Order Documents and Reports | n/a |
| 11.3-1D | Sitter / Continuous Observer | `Observation` series (time-stamped observations) + `CareTeam` (observer assignment) | **gap** — Continuous Observation Log profile | DC.2.4 Manage Care Plans; DC.1.3.1 Manage Alerts | n/a |
| 11.3-1E | EHR System / Status Visibility Manager | `Flag` (active precautions) with current parameters | **gap** — Active Precautions Flag profile | DC.1.3.1 Manage Alerts; IN.5 Clinical Decision Support | n/a |

**Open profile work:** Mitigation Checklist, Suicide Precaution Order, Room Clearance Checklist, Belongings Inventory, Continuous Observation Log, Active Precautions Flag. All flow to issue [#52](https://github.com/bbthorson/SPiER/issues/52).

---

## 11.4 — Brief Assessment and Suicide Risk Assessment

| Step | Actor / Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
|---|---|---|---|---|---|
| 11.4-0A | ED / BH Clinician / Assessor | `QuestionnaireResponse` (BSSA) | **gap** — needs FSH for BSSA ([TL-005](https://github.com/bbthorson/SPiER/issues/21), status:planned, promote priority) | DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.4-0B | EHR System / Analyzer + Router | `Observation` (BSSA outcome) + `Task` (next-step routing) + `Flag` (cannot leave until evaluated) | **gap** — BSSA Outcome Observation; "Hold for Evaluation" Flag | DC.2.3.1 Standard Assessments and Outcomes; DC.2.4.3 Care Plans Protocols | `patient-view` |
| 11.4-1A | BH Clinician / Assessor | `QuestionnaireResponse` (C-SSRS Full + SAFE-T framing) | C-SSRS Full ([built — `full-lifetime-recent.json`](../../FHIR-Resources/C-SSRS/fhir/questionnaires/full-lifetime-recent.json)); SAFE-T ([TL-006](https://github.com/bbthorson/SPiER/issues/22), status:planned, promote) | DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.4-1B | EHR System / Analyzer + Persister | `Observation` (current suicide risk level) + `Condition` (suicide-risk condition, coded) + `Flag` (longitudinal risk indicator) | **gap** — Current Suicide Risk Level Observation; Longitudinal Risk Flag | DC.1.3.1 Manage Alerts; DC.2.4 Manage Care Plans | n/a |

**Gating tools:** BSSA (#21) and SAFE-T (#22) must move from `status:planned` to `status:built` to satisfy this section.

---

## 11.5 — Boarding and Reassessment

| Step | Actor / Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
|---|---|---|---|---|---|
| 11.5-1A | EHR System / Task Scheduler | `Task` series with `restriction.period` + `PlanDefinition` (reassessment cadence) | **gap** — Reassessment Cadence PlanDefinition + Reassessment Task profile | DC.2.4.3 Care Plans Protocols; IN.5.1 Support Decision Logic | n/a |
| 11.5-1B | ED Clinician / Reassessor | `Observation` (updated risk) + `ServiceRequest` (updated precautions) with prior-value preservation | Reuses Current Suicide Risk Level Observation (11.4-1B) + Suicide Precaution ServiceRequest (11.3-1B) | DC.2.3.1 Standard Assessments; DC.1.6.1 Order Entry | n/a |
| 11.5-1C | Nurse / Charge Nurse / Safety Monitor | New instance of Room Clearance Checklist (11.3-1C) + updated `CareTeam` for observer handoff | Reuses 11.3-1C and 11.3-1D profiles | DC.1.6.2 Order Documents and Reports | n/a |

---

## 11.6 — Safety Planning and Discharge Planning

| Step | Actor / Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
|---|---|---|---|---|---|
| 11.6-1A | ED Clinician / Enterer | `QuestionnaireResponse` (Stanley-Brown safety plan) + `CarePlan` | Stanley-Brown ([built](../../FHIR-Resources/Stanley-Brown/)) | DC.2.4 Manage Care Plans; DC.1.7.1 Capture Standardized Assessments | n/a |
| 11.6-1B | EHR System / Retainer + Versioner | `CarePlan` with version history + `Provenance` for each version | Reuses Stanley-Brown CarePlan profile; **gap** — versioning extension | DC.2.4 Manage Care Plans; IN.2.2 Auditable Records | n/a |
| 11.6-2A | ED Clinician / Educator | `Procedure` (lethal means counseling delivered) + `CarePlan.activity` (means-safety actions, who/what/when/where) | **gap** — Lethal Means Counseling Procedure + Means-Safety Action profile ([TL-008](https://github.com/bbthorson/SPiER/issues/24), status:planned, promote) | DC.1.7 Patient Education; DC.2.4 Manage Care Plans | n/a |
| 11.6-2B | EHR System / Discharge Checklist Manager | `Task` (discharge readiness) + `Flag` (blocking alert if incomplete) | **gap** — Discharge Readiness Checklist profile | DC.1.6.1 Order Entry; IN.5.1 Support Decision Logic | `encounter-discharge` |
| 11.6-3A | EHR System / Patient Materials Generator | `Composition` (after-visit summary) + `DocumentReference` (printed/portal-delivered safety plan + discharge instructions) | **gap** — Suicide-Specific Discharge AVS Composition profile | DC.1.9 Manage Patient Education; DC.2.7.2 Patient Discharge Summary | n/a |

**Gating tools:** Means Counseling (#24) — promote priority.

---

## 11.7 — Care Transitions and Follow-Up

| Step | Actor / Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
|---|---|---|---|---|---|
| 11.7-1A | ED Clinician / Orderer | `ServiceRequest` (urgent outpatient referral) + `Appointment` request + `Communication` to receiving provider | **gap** — Urgent BH Follow-Up Referral profile ([TL-009 Transition](https://github.com/bbthorson/SPiER/issues/25), status:planned, promote) | DC.2.5 Order Entry — Referrals; DC.1.6.1 Order Entry | `order-select` |
| 11.7-1B | EHR System / Transmitter | `Bundle` (transition-of-care packet) + `Composition` + `Provenance` for delivery acknowledgement | **gap** — Suicide-Specific Transition-of-Care Bundle profile | DC.2.7.1 Care Plan, Guideline, Protocol Generation; IN.4 Manage Health Information Sharing | n/a |
| 11.7-2A | EHR System / Follow-Up Protocol Manager | `Task` series (24–48h call, 7-day visit) + `CommunicationRequest` + `Communication` (per-attempt outreach) + `PlanDefinition` (follow-up cadence) + registry enrollment | **gap** — Caring Contacts PlanDefinition + Caring Contact Task profile ([TL-010](https://github.com/bbthorson/SPiER/issues/26), status:planned, promote); ED-SAFE telephone follow-up profile ([TL-012](https://github.com/bbthorson/SPiER/issues/28), status:planned, promote) — ED-SAFE specifies the phone-call protocol that Caring Contacts envelopes; both are needed for an ED-anchored follow-up program | DC.2.4.3 Care Plans Protocols; DC.2.4 Manage Care Plans | n/a |
| 11.7-2B | Care Team / Outreach + Monitor | `Communication` (outreach attempt) + updated `Observation` (current risk) + updated `CarePlan` | Reuses earlier profiles | DC.2.4 Manage Care Plans; DC.1.3.1 Manage Alerts | n/a |
| 11.7-2C | EHR System / Exception + Escalation Manager | `Task` status transitions to overdue + `Communication` (supervisor alert) + `Flag` (escalated follow-up status) | **gap** — Follow-Up Overdue Escalation profile | IN.5.1 Support Decision Logic; DC.1.3.1 Manage Alerts | n/a |

**Gating tools:** Transition (#25), Caring Contacts (#26) — promote priority.

---

## Profile gaps consolidated

Profiles that do not yet exist in the SPiER IG and are required by the ED scenario:

1. ASQ Outcome Observation
2. Suicide-Screening-Status Flag
3. Mitigation Checklist Task
4. Suicide Precaution ServiceRequest (with required countersignature)
5. Room Clearance Checklist
6. Belongings Inventory
7. Continuous Observation Log
8. Active Precautions Flag
9. BSSA Outcome Observation
10. "Hold for Evaluation" Flag
11. Current Suicide Risk Level Observation
12. Longitudinal Suicide Risk Flag
13. Reassessment Cadence PlanDefinition + Reassessment Task
14. CarePlan versioning extension for Stanley-Brown safety plan
15. Lethal Means Counseling Procedure
16. Means-Safety Action (who/what/when/where)
17. Discharge Readiness Checklist with blocking behavior
18. Suicide-Specific Discharge AVS Composition
19. Urgent BH Follow-Up Referral
20. Suicide-Specific Transition-of-Care Bundle
21. Caring Contacts PlanDefinition + Caring Contact Task
22. Follow-Up Overdue Escalation

These map to issue [#52](https://github.com/bbthorson/SPiER/issues/52) (non-Questionnaire workflows) for catalog modeling and to issue [#53](https://github.com/bbthorson/SPiER/issues/53) for IG profile-page publication.

## Gating tool promotions

Existing tool epics that must advance from `status:planned` to `status:built` for the ED profile to be complete:

- [#21 BSSA](https://github.com/bbthorson/SPiER/issues/21)
- [#22 SAFE-T](https://github.com/bbthorson/SPiER/issues/22)
- [#24 Means Counseling](https://github.com/bbthorson/SPiER/issues/24)
- [#25 Transition](https://github.com/bbthorson/SPiER/issues/25)
- [#26 Caring Contacts](https://github.com/bbthorson/SPiER/issues/26)
- [#28 ED-SAFE](https://github.com/bbthorson/SPiER/issues/28)
