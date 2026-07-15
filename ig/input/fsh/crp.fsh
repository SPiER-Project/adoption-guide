// =============================================================
// Crisis Response Plan (CRP)
// =============================================================
// A brief, collaboratively-authored suicide-prevention intervention
// (Bryan & Rudd). Like the Stanley-Brown Safety Plan, the CRP produces
// a CarePlan resource (not an Observation), with one activity per
// section. SPiER models the five canonical CRP sections:
//   1. Warning signs      2. Coping strategies (self-management)
//   3. Reasons for living 4. Social support
//   5. Professional & crisis support
//
// LOINC codes are reused from the Stanley-Brown safety-plan panel where
// the concepts overlap; there is no validated CRP-specific LOINC panel.
//
// Existing Questionnaire:
//   http://spier.org/Questionnaire/CrisisResponsePlan|1.0.0
//
// Licensing: the CRP is a published clinical technique (Bryan & Rudd).
// Used under the permission/license held by the SPiER project (maintainer-
// confirmed 2026-07-15); attribute to Bryan & Rudd. See
// FHIR-Resources/CRP/licensing/MEMO.md.
// =============================================================


// ─── CarePlan profile ────────────────────────────────────────

Profile: SPiERCrisisResponsePlan
Parent: CarePlan
Id: spier-crisis-response-plan
Title: "SPiER Crisis Response Plan CarePlan"
Description: "A CarePlan derived from a completed Crisis Response Plan QuestionnaireResponse. Carries one CarePlan.activity per CRP section; each activity names the section in detail.code.text (LOINC reused from the Stanley-Brown panel where concepts overlap) and the patient-authored content in detail.description."
* ^status = #draft
* ^experimental = true
* status 1..1
* status = #active (exactly)
* intent 1..1
* intent = #plan (exactly)
* category 1..*
* category.coding 1..*
* subject 1..1
* subject only Reference(Patient)
* activity 1..*
* activity.detail.code 1..1
* activity.detail.status 1..1
* activity.detail.description 0..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* subject MS
* category MS
* activity MS
* activity.detail.code MS


// ─── ActivityDefinition ──────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. The AD id and canonical
// URL are unchanged so the TL-015 catalog mapping and the
// document-safety-actions stage PlanDefinition action stay stable.

Instance: AuthorCrisisResponsePlan
InstanceOf: ActivityDefinition
Title: "Author Crisis Response Plan / Crisis Planning"
Description: "Collaboratively complete a Crisis Response Plan (CRP) with the patient and persist the result as a CarePlan with one activity per CRP section."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AuthorCrisisResponsePlan"
* name = "AuthorCrisisResponsePlan"
* version = "1.0.0"
* title = "Author Crisis Response Plan / Crisis Planning"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Collaboratively complete a Crisis Response Plan (Bryan & Rudd) with the patient and persist the result as a CarePlan profiled by SPiERCrisisResponsePlan. Each of the five CRP sections becomes a CarePlan.activity. An alternative/complement to the Stanley-Brown Safety Plan."
* purpose = "Establish a written, individualized crisis response plan the patient can use to manage suicidal crises. Belongs to the Document Safety Actions stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "Crisis Response Plan template"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/CrisisResponsePlan|1.0.0"


// ─── Example ─────────────────────────────────────────────────

Instance: ExampleCrisisResponsePlan
InstanceOf: SPiERCrisisResponsePlan
Title: "Example — Completed Crisis Response Plan"
Description: "Sample CarePlan showing all five CRP sections populated for an example patient. Each activity names the section in detail.code.text and the patient-authored content in detail.description."
Usage: #example
* status = #active
* intent = #plan
* category[+] = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* subject = Reference(Patient/example)
* addresses[+].display = "Risk for suicide"
* activity[+].detail
  * code.text = "Warning Signs"
  * status = #in-progress
  * description = "Racing thoughts late at night; skipping meals; feeling like a burden"
* activity[+].detail
  * code.text = "Coping Strategies (Self-Management)"
  * status = #in-progress
  * description = "Go for a run; play guitar; box-breathing 4-4-4"
* activity[+].detail
  * code.text = "Reasons for Living"
  * status = #in-progress
  * description = "My daughter; getting back to teaching; my dog Rufus"
* activity[+].detail
  * code.text = "Social Support"
  * status = #in-progress
  * description = "Call my sister (555-0170); text my sponsor; go to the community center"
* activity[+].detail
  * code.text = "Professional & Crisis Support"
  * status = #in-progress
  * description = "Dr. Lee (555-0212); 988 Suicide & Crisis Lifeline; Crisis Text Line (text HOME to 741741); Memorial ED 555-0911"
