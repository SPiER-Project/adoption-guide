# Inpatient Suicide-Care Scenario — FHIR & Functional Profile Mapping (Draft)

> **Draft, not yet reviewed by the subject-matter expert.** Drawn from one walkthrough with an inpatient behavioral-health leader (2026-05-29). It describes one large health system's practice and has not been circulated to the working group. Open questions for the SME are recorded as review notes on the steps they concern.
>
> **Generated** from [`inpatient-scenario-12.json`](inpatient-scenario-12.json) by the use-case workbook build, alongside the workbook in [`dist/`](dist/). Edit the JSON, not this file. See [`README.md`](README.md).
>
> **Scenario number 12 is provisional.** The working group assigns scenario numbers; this one takes the next number after the ED scenario until they assign one.
>
> **Steps the walkthrough described carry no marker; steps SPiER adds are marked "(proposed)"** and listed with their rationale under [Proposed additions](#proposed-additions).
>
> **This is the ED scenario's admission branch.** ED step 11.5-1D arranges a psychiatric admission; this scenario begins there (12.2-1D) and reuses the ED scenario's profiles wherever the two overlap.
>
> The clinical scenario names no real patient, site, or vendor. "Daniel, 41" is a scenario archetype, not a real person.

---

## Scenario summary

A 41-year-old is admitted to an inpatient psychiatric unit from an emergency department after an intentional medication overdose. The EHR-supported workflow covers:

1. **Entry and level of care** - three entry routes, a level-of-care assessment for community patients, and the outside record requested on admission.
2. **Admission screening and assessment** - a universal screen, a full assessment on a positive result, and a risk level that sets reassessment intensity.
3. **During the stay** - universal precautions, per-shift nursing reassessment for high-risk patients, and physician risk evaluation.
4. **Safety planning from admission** - lethal means first, aimed at the home environment, with triggers and protective factors added through the stay.
5. **Active treatment and measurement** - daily interventions captured as structured data, symptom measures at admission and discharge, and reporting across facilities.
6. **Discharge** - a universal discharge risk assessment, a co-signed safety plan, third-party confirmation of means safety, and limited discharge prescriptions.
7. **Transition and follow-up** - a confirmed appointment and handoff, and post-discharge outreach that is wanted but not yet resourced.

---

## 12.2 — Entry and Level of Care

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 12.2-1A | Admissions Clinician | Level-of-Care Assessor | `QuestionnaireResponse` or `Observation` (level-of-care determination) + `ServiceRequest` (admission or referral) | **gap** - no level-of-care assessment is modelled; SPiER carries no level-of-care instrument | DC.1.7.1 Capture Standardized Assessments; DC.2.3.1 Standard Assessments and Outcomes | n/a |
| 12.2-1B | Admissions Clinician | Admitting Coordinator | `Encounter` (class inpatient; hospitalization.admitSource) + `Organization` (referring facility) | R4 Encounter.hospitalization.admitSource is the element; **gap** - the HL7 admit-source value set has no law-enforcement code, and SPiER does not profile the inpatient encounter | DC.1.1.3 Manage Encounter Information | n/a |
| 12.2-1C | Admissions Staff | Records Requester | `DocumentReference` (received outside record) + `Provenance` (source and receipt) | Base FHIR DocumentReference; no SPiER profile needed for a document exchange | DC.1.5 Manage Patient History; IN.4 Manage Health Information Sharing | n/a |
| 12.2-1D (proposed) | EHR System | Receiver | `Bundle` (ED transition packet) + `Observation` (suicide risk level) + `Flag` (active precautions) + `CarePlan` (draft safety plan) | The risk level reuses SPiER's harmonized suicide-risk Observation ([built](../../ig/input/fsh/concept-layer.fsh)); **gap** - the transition packet itself, shared with ED step 11.7-1B | IN.4 Manage Health Information Sharing; DC.1.5 Manage Patient History | n/a |

---

## 12.3 — Admission Screening and Assessment

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 12.3-1A | Admitting Clinician (master's-prepared) | Screener | `QuestionnaireResponse` | SPiER C-SSRS Screener Questionnaire ([built](../../ig/input/resources/questionnaires/C-SSRS/)); any screener that feeds SPiER's harmonized risk concept satisfies the step | DC.1.7.1 Capture Standardized Assessments | n/a |
| 12.3-1B | EHR System | Router | `Observation` (screening outcome) + `Task` (full assessment) | SPiER's positive-screen trigger on the harmonized risk concept ([built](../../ig/input/fsh/pathway-stages.fsh)) is the same gate the ED scenario uses | IN.5.1 Support Decision Logic; DC.2.3.1 Standard Assessments and Outcomes | n/a |
| 12.3-1C | Admitting Clinician (master's-prepared) | Assessor | `QuestionnaireResponse` (full assessment) + `Observation` (suicide risk level) | SPiER C-SSRS full assessment ([built](../../ig/input/resources/questionnaires/C-SSRS/)); a site's AMSR-based or other local assessment fits SPiER's local-assessment slot ([placeholder](../../ig/input/fsh/pathway-tool-placeholders.fsh)) and feeds the same risk concept | DC.1.7.1 Capture Standardized Assessments; DC.2.3.1 Standard Assessments and Outcomes | n/a |
| 12.3-1D | EHR System | Status Manager | `Observation` (suicide risk level) + `Flag` (suicide risk) + `PlanDefinition` (reassessment frequency by risk level) | Risk level and the suicide-risk Flag reuse SPiER's harmonized concept and episode Flag ([built](../../ig/input/fsh/risk-episode.fsh)); **gap** - SPiER's published reassessment schedule is in days for outpatient care, and has no per-shift inpatient cadence | DC.1.3.1 Manage Alerts; DC.2.4.3 Support for Standard Care Plans, Guidelines, Protocols | n/a |

---

## 12.4 — During the Stay: Precautions and Reassessment

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 12.4-1A | Nursing Staff / Mental Health Technician | Safety Monitor | `List` (belongings inventory) + `Observation` series (15-minute checks) + `ServiceRequest` (admission labs) | **gap** - the same Belongings Inventory and Observation Log profiles the ED scenario lacks (11.3-1C, 11.3-1D) | DC.1.6.1 Order Entry; DC.1.1.3 Manage Encounter Information | n/a |
| 12.4-1B | EHR System | Task Scheduler | `Task` (per-shift reassessment) + `PlanDefinition` (cadence) | **gap** - depends on the per-shift cadence in 12.3-1D | DC.2.4.3 Support for Standard Care Plans, Guidelines, Protocols; IN.5.1 Support Decision Logic | n/a |
| 12.4-1C | Registered Nurse | Reassessor | `QuestionnaireResponse` (per-shift reassessment) + `Observation` (updated risk level) | SPiER C-SSRS Since Last Contact Questionnaire ([built](../../ig/input/resources/questionnaires/C-SSRS/)); a locally adapted version satisfies the step by feeding the same risk concept | DC.1.7.1 Capture Standardized Assessments; DC.2.3.1 Standard Assessments and Outcomes | n/a |
| 12.4-1D | Attending Physician | Assessor | `Observation` (suicide risk level, physician-authored) | Reuses SPiER's harmonized suicide-risk Observation ([built](../../ig/input/fsh/concept-layer.fsh)) | DC.2.3.1 Standard Assessments and Outcomes | n/a |

---

## 12.5 — Safety Planning from Admission

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 12.5-1A | Social Worker / Admitting Clinician | Safety Planner | `CarePlan` (safety plan, in progress) + `QuestionnaireResponse` | Stanley-Brown safety plan ([built](../../ig/input/resources/questionnaires/Stanley-Brown/)) | DC.2.4 Manage Care Plans | n/a |
| 12.5-1B | Social Worker | Means-Safety Planner | `Procedure` (lethal means counseling) + `Observation` (means-safety action, per item) | SPiER Lethal Means Safety Counseling Procedure and Means Safety Action Observation ([built](../../ig/input/fsh/lethal-means.fsh)); confirmation before discharge is 12.7-1D | DC.2.4 Manage Care Plans; DC.3.2 Support Patient Education and Self-Care | n/a |
| 12.5-1C | Patient, with Clinician | Collaborator | `CarePlan` (safety plan, revised) + `Provenance` (each revision) | Reuses the Stanley-Brown CarePlan; **gap** - the plan's version history, shared with ED 11.6-1B | DC.2.4 Manage Care Plans; DC.1.5 Manage Patient History | n/a |

---

## 12.6 — Active Treatment and Measurement

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 12.6-1A | Treatment Team (therapists, activity therapists, nursing) | Intervention Provider | `Procedure` (each group or session delivered) + `CarePlan.activity` (planned treatment) | CAMS ([built](../../ig/input/resources/questionnaires/CAMS/)) is the one suicide-specific intervention SPiER models; **gap** - group and skills-based interventions have no profile | DC.2.4 Manage Care Plans | n/a |
| 12.6-1B | EHR System | Structured Data Capture | `Procedure` (code from an intervention value set) | **gap** - no value set of inpatient behavioral-health interventions | DC.2.4.1 Support for Standard Care Plans; DC.2.3.1 Standard Assessments and Outcomes | n/a |
| 12.6-1C | Patient, with Clinician | Respondent | `QuestionnaireResponse` + `Observation` (scores) | PHQ-9 ([built](../../ig/input/resources/questionnaires/PHQ-9/)); **gap** - BASIS-32 is not modelled, and its licensing has not been checked | DC.1.7.1 Capture Standardized Assessments; DC.2.3.1 Standard Assessments and Outcomes | n/a |
| 12.6-1D | Behavioral Health Quality Leadership | Program Integrity Reviewer | `Measure` + `MeasureReport` (intervention delivery by facility and risk level) | SPiER's published Measures ([built](../../ig/input/fsh/measure-and-share.fsh)) are outpatient and transition measures; **gap** - no measure of intervention delivery during an inpatient stay | DC.2.3.1 Standard Assessments and Outcomes | n/a |

**This section holds the walkthrough's central gap.** The SME's most-wanted report was which interventions were actually delivered as a result of screening and assessment, comparable across facilities. That requires 12.6-1B to exist first.

---

## 12.7 — Discharge

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 12.7-1A | Registered Nurse / Physician | Assessor | `QuestionnaireResponse` + `Observation` (suicide risk level at discharge) | Reuses the C-SSRS Questionnaires ([built](../../ig/input/resources/questionnaires/C-SSRS/)) and SPiER's harmonized suicide-risk Observation | DC.1.7.1 Capture Standardized Assessments; DC.2.3.1 Standard Assessments and Outcomes | n/a |
| 12.7-1B | Physician, Registered Nurse, and Social Worker | Discharge Team | `Composition` (discharge instructions) + `CarePlan` (safety plan section) | The safety plan reuses the Stanley-Brown CarePlan; **gap** - a discharge-instructions document that carries the safety plan as a section | DC.2.7.2 Patient Discharge Summary; DC.1.9 Manage Patient Education | n/a |
| 12.7-1C | Patient, Clinicians, and Family or Significant Other | Co-Signers | `CarePlan` (final safety plan) + `Provenance` (one signature per signer) + `RelatedPerson` (family signer) + `DocumentReference` (scanned signed copy) | Reuses the Stanley-Brown CarePlan and SPiER's safety-plan-before-discharge measure ([built](../../ig/input/fsh/measure-and-share.fsh)); **gap** - multi-party signature on the plan, shared with ED 11.6-1C | DC.2.4 Manage Care Plans; IN.2.2 Auditable Records; IN.1.1 Entity Authentication | n/a |
| 12.7-1D | Social Worker | Means-Safety Verifier | `Observation` (means-safety action completed) + `Provenance` (third-party confirmer) + `RelatedPerson` | SPiER Means Safety Action Observation ([built](../../ig/input/fsh/lethal-means.fsh)); **gap** - who confirmed the action, as distinct from who reported it | DC.2.4 Manage Care Plans; IN.2.2 Auditable Records | n/a |
| 12.7-1E | Prescriber, with EHR System | Prescriber / Decision Support | `MedicationRequest` (discharge prescription, dispenseRequest.expectedSupplyDuration) | **gap** - SPiER publishes no discharge-quantity rule and no decision-support card for it | DC.1.6.1 Order Entry; IN.5 Clinical Decision Support | `order-sign` |

---

## 12.8 — Transition and Follow-Up

| Step | Actor | Actor Role | FHIR resources | Profile bindings | HL7 EHR functional model | CDS Hooks |
| --- | --- | --- | --- | --- | --- | --- |
| 12.8-1A | Social Worker / Discharge Planner | Transition Coordinator | `ServiceRequest` (referral) + `Appointment` + `Communication` (handoff) | SPiER Suicide-Safety Referral, Follow-Up Appointment and Handoff Communication ([built](../../ig/input/fsh/handoffs.fsh)), the same artifacts as ED 11.7-1A | DC.2.5 Order Entry — Referrals; IN.4 Manage Health Information Sharing | `order-select` |
| 12.8-1B | Registered Nurse / Social Worker | Educator | `Procedure` (patient education) or `Communication` | Base FHIR; no SPiER profile needed | DC.1.9 Manage Patient Education; DC.3.2 Support Patient Education and Self-Care | n/a |
| 12.8-1C | Care Team | Outreach | `Task` series + `Communication` (each outreach attempt) + `PlanDefinition` (contact schedule) | SPiER Caring Contact and Follow-Up Outreach Attempt ([built](../../ig/input/fsh/follow-up.fsh)); **gap** - no published schedule for the contacts, the same gap as ED 11.7-2A | DC.2.4.3 Support for Standard Care Plans, Guidelines, Protocols; DC.1.6.2 Order Documents and Reports | n/a |
| 12.8-1D (proposed) | EHR System | Monitor | `Appointment` (status noshow) + `Task` (escalation) + `Communication` | Reuses SPiER Follow-Up Appointment ([built](../../ig/input/fsh/handoffs.fsh)); **gap** - how attendance is reported back from the receiving provider | DC.1.3.1 Manage Alerts; IN.5.1 Support Decision Logic | n/a |

---

## Proposed additions

Steps SPiER proposes adding to the walkthrough as described. They are marked "(proposed)" wherever they appear so the SME can accept or reject each one. Their EHR-S FM references are drafts and need checking against the published EHR-S FM function list, like every other reference in this document.

- **12.2-1D — Receive the referring ED's suicide risk status, precautions, and draft safety plan as structured data** (EHR System / Receiver)
  The walkthrough describes the ED record arriving as a record request. Scenario 11 ends its admission branch (11.5-1D) by producing structured risk status and a transfer packet, so this handoff is where the two scenarios connect - and where structured data stops if nothing receives it.
- **12.8-1D — Detect a missed first appointment after discharge and escalate** (EHR System / Monitor)
  The walkthrough ends when the appointment is made, and today nothing tells the discharging team whether the patient attended. The ED scenario has the equivalent step (11.7-2B); leaving it out of the inpatient scenario would leave the post-discharge period without any closed-loop check.

---

## Profile gaps consolidated

Profiles that do not yet exist in the SPiER IG and are required by the inpatient scenario. Several are shared with the ED scenario, and say so:

1. Level-of-care determination (inpatient / partial hospitalization / outpatient) as a coded result
2. Inpatient psychiatric Encounter profile with an admit-source value set covering law-enforcement drop-off
3. Suicide-specific transition-of-care Bundle, consumed at inpatient admission (shared with ED 11.7-1B)
4. Setting-specific reassessment cadence: per shift during an inpatient stay, alongside the outpatient per-tier schedule
5. Belongings inventory and 15-minute observation log (shared with ED 11.3-1C and 11.3-1D)
6. Per-shift reassessment Task generation for an inpatient stay
7. Safety-plan versioning across an inpatient stay (shared with ED 11.6-1B)
8. Delivered-intervention record (group, skills session, therapy) for an inpatient stay
9. Inpatient behavioral-health intervention value set (groups, skills sessions, therapies), extensible
10. BASIS-32 Questionnaire, pending a licensing review
11. Measure of interventions delivered during an inpatient stay, stratified by risk level and facility
12. Inpatient discharge-instructions Composition with a safety-plan section
13. Multi-party attestation of the safety plan (each discipline, the patient, and family)
14. Third-party confirmation of a means-safety action (confirmer is not the patient)
15. Discharge days'-supply limit for patients with suicide risk, as a CDS rule
16. Attendance feedback from the receiving provider to the discharging facility

Nothing here is filed as an issue yet. File them after the SME review, so issues reflect the scenario they confirm rather than this draft.

## Gating issues

Open issues that must close for the inpatient profile to be complete:

- [#628 Caring-contact schedule](https://github.com/SPiER-Project/adoption-guide/issues/628) — TL-010 is built; still missing: a PlanDefinition that schedules the post-discharge cadence
