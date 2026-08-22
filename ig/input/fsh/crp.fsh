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
// Section identity comes from the shared SPiER-local CodeSystem
// http://thespierproject.org/fhir/CodeSystem/safety-plan-section, which the Stanley-Brown
// Safety Plan also uses — the CRP's five sections are a subset of
// Stanley-Brown's seven. There is no CRP-specific LOINC panel, and LOINC
// publishes nothing at safety-plan-section granularity at all; see
// safety-plan-section.fsh for the search and for the withdrawn 766xx-x codes
// this repo used to assert here (issue #220).
//
// Existing Questionnaire:
//   http://thespierproject.org/fhir/Questionnaire/CrisisResponsePlan|1.0.0
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
Description: "A CarePlan derived from a completed Crisis Response Plan QuestionnaireResponse. Carries one CarePlan.activity per CRP section; each activity is identified by a SPiER-local safety-plan section code in detail.code (shared with the Stanley-Brown Safety Plan), retains the human label in detail.code.text, and holds the patient-authored content in detail.description."
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
// Every activity IS a named section, so the section code is the discriminator.
// Slicing is left open, but with a required binding plus 1..1 on all five
// slices the sections are already exhaustive.
* activity 1..*
* activity ^slicing.discriminator.type = #pattern
* activity ^slicing.discriminator.path = "detail.code"
* activity ^slicing.rules = #open
* activity contains
    warningSigns 1..1 and
    copingStrategies 1..1 and
    reasonForLiving 1..1 and
    socialSupport 1..1 and
    professionalSupport 1..1
* activity[warningSigns].detail.code = SafetyPlanSectionCodes#warning-signs
* activity[copingStrategies].detail.code = SafetyPlanSectionCodes#internal-coping
* activity[reasonForLiving].detail.code = SafetyPlanSectionCodes#reason-for-living
* activity[socialSupport].detail.code = SafetyPlanSectionCodes#crisis-support
* activity[professionalSupport].detail.code = SafetyPlanSectionCodes#professional-support
* activity.detail.code 1..1
* activity.detail.code from CrisisResponsePlanSection (required)
* activity.detail.status 1..1
* activity.detail.description 0..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* subject MS
* category MS
// SNOMED treatment-escalation-plan artifact type, the LOINC suicide-prevention
// note type, and the Gravity-pattern domain tag, so this resource is retrievable
// with the rest of the suicide-safer care record by category alone (#262).
* insert SafetyPlanNoteAndSuicideRiskCategory
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
* url = "http://thespierproject.org/fhir/ActivityDefinition/AuthorCrisisResponsePlan"
* name = "AuthorCrisisResponsePlan"
* version = "1.0.0"
* title = "Author Crisis Response Plan / Crisis Planning"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Collaboratively complete a Crisis Response Plan (Bryan & Rudd) with the patient and persist the result as a CarePlan profiled by SPiERCrisisResponsePlan. Each of the five CRP sections becomes a CarePlan.activity carrying its SPiER-local safety-plan section code. An alternative/complement to the Stanley-Brown Safety Plan."
* purpose = "Establish a written, individualized crisis response plan the patient can use to manage suicidal crises. Belongs to the Document Safety Actions stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "Crisis Response Plan template"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/CrisisResponsePlan|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #registration
* copyright = "The Crisis Response Plan (CRP) is a published clinical intervention described by Craig J. Bryan and M. David Rudd. It is freely used in practice with attribution to Bryan & Rudd; there is no per-use instrument fee. SPiER publishes these artifacts under the permission/license held by the SPiER project — that permission covers SPiER, and does NOT transfer to an adopting system, which should confirm its own position and must attribute the CRP to Bryan & Rudd. Coded `registration` rather than `public-domain` for that reason. Basis: FHIR-Resources/CRP/licensing/MEMO.md (issue #64), maintainer-confirmed 2026-07-15."


// ─── Example ─────────────────────────────────────────────────

Instance: ExampleCrisisResponsePlan
InstanceOf: SPiERCrisisResponsePlan
Title: "Example — Completed Crisis Response Plan"
Description: "Sample CarePlan showing all five CRP sections populated for an example patient. Each activity carries its SPiER-local section code, with the human label retained in detail.code.text and the patient-authored content in detail.description."
Usage: #example
* status = #active
* category[suicidePreventionNote] = http://loinc.org#87626-8 "Suicide prevention note"
* intent = #plan
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* addresses[+].display = "Risk for suicide"
* activity[+].detail
  * code = SafetyPlanSectionCodes#warning-signs
  * code.text = "Warning Signs"
  * status = #in-progress
  * description = "Racing thoughts late at night; skipping meals; feeling like a burden"
* activity[+].detail
  * code = SafetyPlanSectionCodes#internal-coping
  * code.text = "Coping Strategies (Self-Management)"
  * status = #in-progress
  * description = "Go for a run; play guitar; box-breathing 4-4-4"
* activity[+].detail
  * code = SafetyPlanSectionCodes#reason-for-living
  * code.text = "Reasons for Living"
  * status = #in-progress
  * description = "My daughter; getting back to teaching; my dog Rufus"
* activity[+].detail
  * code = SafetyPlanSectionCodes#crisis-support
  * code.text = "Social Support"
  * status = #in-progress
  * description = "Call my sister (555-0170); text my sponsor; go to the community center"
* activity[+].detail
  * code = SafetyPlanSectionCodes#professional-support
  * code.text = "Professional & Crisis Support"
  * status = #in-progress
  * description = "Dr. Lee (555-0212); 988 Suicide & Crisis Lifeline; Crisis Text Line (text HOME to 741741); Memorial ED 555-0911"
