// =============================================================
// Stanley-Brown Safety Plan
// =============================================================
// Evidence-based safety planning intervention. Unlike the screeners,
// Stanley-Brown produces a CarePlan resource (not an Observation),
// with one activity per step of the safety plan template.
//
// SPiER models the seven canonical Stanley-Brown steps:
//   1. Warning signs        2. Internal coping       3. Social distractions
//   4. Crisis support       5. Professional support  6. Lethal means safety
//   7. Reason for living
//
// Each activity is identified by a SPiER-local section code from
// http://thespierproject.org/fhir/CodeSystem/safety-plan-section, with the human label kept in
// detail.code.text. LOINC publishes nothing at this granularity — see
// safety-plan-section.fsh for the exhaustive LOINC 2.82 search behind that
// conclusion and for why the six 766xx-x codes this repo used to assert had to
// be withdrawn (they do not exist; issue #220).
//
// Existing Questionnaire:
//   http://thespierproject.org/fhir/Questionnaire/StanleyBrownSafetyPlan|1.1.0
// =============================================================


// ─── CarePlan profile ────────────────────────────────────────

Profile: SPiERStanleyBrownSafetyPlan
Parent: CarePlan
Id: spier-stanley-brown-safety-plan
Title: "SPiER Stanley-Brown Safety Plan CarePlan"
Description: "A CarePlan derived from a completed Stanley-Brown Safety Plan QuestionnaireResponse. Carries one CarePlan.activity per safety-plan step; each activity is identified by a SPiER-local safety-plan section code in detail.code, retains the human label in detail.code.text, and holds the patient-authored content in detail.description."
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
// When the plan took effect. The safety-plan-before-discharge measure dates a
// plan by period.start and nothing else, so a plan without it can never count.
// `created` is when the record was written — the same instant for a plan
// derived from a completed response, but not the element the measure reads.
* period 1..1
* period.start 1..1
// Every activity IS a named step, so the section code is the discriminator.
// Slicing is left open, but with a required binding plus 1..1 on all seven
// slices the steps are already exhaustive.
* activity 1..*
* activity ^slicing.discriminator.type = #pattern
* activity ^slicing.discriminator.path = "detail.code"
* activity ^slicing.rules = #open
* activity contains
    warningSigns 1..1 and
    internalCoping 1..1 and
    socialDistraction 1..1 and
    crisisSupport 1..1 and
    professionalSupport 1..1 and
    lethalMeansSafety 1..1 and
    reasonForLiving 1..1
* activity[warningSigns].detail.code = SafetyPlanSectionCodes#warning-signs
* activity[internalCoping].detail.code = SafetyPlanSectionCodes#internal-coping
* activity[socialDistraction].detail.code = SafetyPlanSectionCodes#social-distraction
* activity[crisisSupport].detail.code = SafetyPlanSectionCodes#crisis-support
* activity[professionalSupport].detail.code = SafetyPlanSectionCodes#professional-support
* activity[lethalMeansSafety].detail.code = SafetyPlanSectionCodes#lethal-means-safety
* activity[reasonForLiving].detail.code = SafetyPlanSectionCodes#reason-for-living
* activity.detail.code 1..1
* activity.detail.code from StanleyBrownSafetyPlanSection (required)
* activity.detail.status 1..1
* activity.detail.description 0..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* subject MS
* period MS
* period.start MS
* created MS
* category MS
// SNOMED treatment-escalation-plan artifact type, the LOINC suicide-prevention
// note type, and the Gravity-pattern domain tag, so this resource is retrievable
// with the rest of the suicide-safer care record by category alone (#262).
* insert SafetyPlanNoteAndSuicideRiskCategory
* activity MS
* activity.detail.code MS


// ─── ActivityDefinition ──────────────────────────────────────

Instance: AdministerStanleyBrown
InstanceOf: ActivityDefinition
Title: "Author Stanley-Brown Safety Plan"
Description: "Collaboratively complete a Stanley-Brown Safety Plan with the patient and persist the result as a CarePlan with one activity per step."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown"
* identifier[+].system = "http://thespierproject.org/fhir/identifier/tool-id"
* identifier[=].value = "TL-007"
* name = "AdministerStanleyBrown"
* version = "0.1.0"
* title = "Author Stanley-Brown Safety Plan"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Collaboratively complete a Stanley-Brown Safety Plan with the patient and persist the result as a CarePlan profiled by SPiERStanleyBrownSafetyPlan. Each of the seven safety-plan steps becomes a CarePlan.activity carrying its SPiER-local safety-plan section code."
* purpose = "Establish a written, individualized plan a patient can use to manage suicidal crises. Belongs to the Document Safety Actions stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "Stanley-Brown Safety Plan template"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/StanleyBrownSafetyPlan|1.1.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #registration
* copyright = "The Stanley-Brown Safety Plan is copyrighted by Barbara Stanley, PhD and Gregory K. Brown, PhD (2008, 2021). Individual use of the form is permitted. **Written permission from the authors is required for any changes to the form, or for use of the form in the electronic medical record** — which is exactly what an EHR integration built from this ActivityDefinition would be. See www.suicidesafetyplan.com. Basis: the notice recorded on the SPiER Stanley-Brown Questionnaire (ig/input/resources/questionnaires/Stanley-Brown/). No licensing-audit memo is on file under issue #64 and SPiER has filed no such permission, so an adopting system must obtain its own before deploying this in an EHR."


// ─── Example ─────────────────────────────────────────────────

Instance: ExampleStanleyBrownSafetyPlan
InstanceOf: SPiERStanleyBrownSafetyPlan
Title: "Example — Completed Stanley-Brown Safety Plan"
Description: "Sample CarePlan showing all seven Stanley-Brown steps populated for an example patient. Each activity carries its SPiER-local section code, with the human label retained in detail.code.text and the patient-authored content in detail.description."
Usage: #example
* status = #active
* category[suicidePreventionNote] = http://loinc.org#87626-8 "Suicide prevention note"
* intent = #plan
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* subject = Reference(Patient/example)
* created = "2026-08-08T14:30:00Z"
* period.start = "2026-08-08T14:30:00Z"
* addresses[+].display = "Risk for suicide"
* activity[+].detail
  * code = SafetyPlanSectionCodes#warning-signs
  * code.text = "Step 1: Warning Signs"
  * status = #in-progress
  * description = "Sleep disruption; isolation from friends; thoughts of being a burden"
* activity[+].detail
  * code = SafetyPlanSectionCodes#internal-coping
  * code.text = "Step 2: Internal Coping Strategies"
  * status = #in-progress
  * description = "Long walk; cold shower; breathing exercise from app"
* activity[+].detail
  * code = SafetyPlanSectionCodes#social-distraction
  * code.text = "Step 3: Social Distractions"
  * status = #in-progress
  * description = "Brother (555-0102); coffee shop on 2nd Ave"
* activity[+].detail
  * code = SafetyPlanSectionCodes#crisis-support
  * code.text = "Step 4: Crisis Support Contacts"
  * status = #in-progress
  * description = "Best friend Maria (555-0143); aunt Carol (555-0188)"
* activity[+].detail
  * code = SafetyPlanSectionCodes#professional-support
  * code.text = "Step 5: Professional Support"
  * status = #in-progress
  * description = "Dr. Chen (555-0200) / Memorial ED, 100 Hospital Dr, 555-0911 / 988 Suicide & Crisis Lifeline"
* activity[+].detail
  * code = SafetyPlanSectionCodes#lethal-means-safety
  * code.text = "Step 6: Lethal Means Safety"
  * status = #in-progress
  * description = "Roommate to hold medications until follow-up; gun-lock voucher accepted from clinic"
* activity[+].detail
  * code = SafetyPlanSectionCodes#reason-for-living
  * code.text = "Step 7: Reason for Living"
  * status = #in-progress
  * description = "Niece's high-school graduation in six weeks; finishing the novel I'm writing"


Instance: ExampleStanleyBrownSafetyPlanResponse
InstanceOf: QuestionnaireResponse
Title: "Example — Stanley-Brown Safety Plan QuestionnaireResponse"
Description: "Source Stanley-Brown Safety Plan QuestionnaireResponse carrying the same content as the ExampleStanleyBrownSafetyPlan CarePlan, all seven steps answered. It is the input the StanleyBrownQRToCarePlan StructureMap transforms into a safety-plan CarePlan."
Usage: #example
* status = #completed
* questionnaire = "http://thespierproject.org/fhir/Questionnaire/StanleyBrownSafetyPlan"
* subject = Reference(Patient/example)
* authored = "2026-08-08T14:00:00Z"
* item[+].linkId = "step-1-warning-signs"
* item[=].item[+].linkId = "1-1-warning-sign"
* item[=].item[=].answer[+].valueString = "Sleep disruption"
* item[=].item[=].answer[+].valueString = "Isolation from friends"
* item[=].item[=].answer[+].valueString = "Thoughts of being a burden"
* item[+].linkId = "step-2-internal-coping"
* item[=].item[+].linkId = "2-1-coping-strategy"
* item[=].item[=].answer[+].valueString = "Long walk"
* item[=].item[=].answer[+].valueString = "Cold shower"
* item[=].item[=].answer[+].valueString = "Breathing exercise from app"
* item[+].linkId = "step-3-distraction-contacts"
* item[=].item[+].linkId = "3-1-distraction-contact-group"
* item[=].item[=].item[+].linkId = "3-1-name-place"
* item[=].item[=].item[=].answer.valueString = "Brother"
* item[=].item[=].item[+].linkId = "3-2-contact-info"
* item[=].item[=].item[=].answer.valueString = "555-0102"
* item[=].item[+].linkId = "3-1-distraction-contact-group"
* item[=].item[=].item[+].linkId = "3-1-name-place"
* item[=].item[=].item[=].answer.valueString = "Coffee shop on 2nd Ave"
* item[=].item[=].item[+].linkId = "3-2-contact-info"
* item[=].item[=].item[=].answer.valueString = "2nd Ave and Main St"
* item[+].linkId = "step-4-crisis-support"
* item[=].item[+].linkId = "4-1-support-person-group"
* item[=].item[=].item[+].linkId = "4-1-name"
* item[=].item[=].item[=].answer.valueString = "Best friend Maria"
* item[=].item[=].item[+].linkId = "4-2-contact-info"
* item[=].item[=].item[=].answer.valueString = "555-0143"
* item[=].item[+].linkId = "4-1-support-person-group"
* item[=].item[=].item[+].linkId = "4-1-name"
* item[=].item[=].item[=].answer.valueString = "Aunt Carol"
* item[=].item[=].item[+].linkId = "4-2-contact-info"
* item[=].item[=].item[=].answer.valueString = "555-0188"
* item[+].linkId = "step-5-professionals"
* item[=].item[+].linkId = "5-1-clinician-agency-group"
* item[=].item[=].item[+].linkId = "5-1-name"
* item[=].item[=].item[=].answer.valueString = "Dr. Chen"
* item[=].item[=].item[+].linkId = "5-2-contact-info"
* item[=].item[=].item[=].answer.valueString = "555-0200"
* item[=].item[+].linkId = "5-3-emergency-dept"
* item[=].item[=].item[+].linkId = "5-3-name"
* item[=].item[=].item[=].answer.valueString = "Memorial ED"
* item[=].item[=].item[+].linkId = "5-4-address"
* item[=].item[=].item[=].answer.valueString = "100 Hospital Dr"
* item[=].item[=].item[+].linkId = "5-5-phone"
* item[=].item[=].item[=].answer.valueString = "555-0911"
* item[+].linkId = "step-6-lethal-means"
* item[=].item[+].linkId = "6-1-safety-action"
* item[=].item[=].answer[+].valueString = "Roommate to hold medications until follow-up"
* item[=].item[=].answer[+].valueString = "Gun-lock voucher accepted from clinic"
* item[+].linkId = "step-7-reason-for-living"
* item[=].item[+].linkId = "7-1-worth-living"
* item[=].item[=].answer.valueString = "Niece's high-school graduation in six weeks; finishing the novel I'm writing"
