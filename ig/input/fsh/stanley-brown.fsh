// =============================================================
// Stanley-Brown Safety Plan
// =============================================================
// Evidence-based safety planning intervention. Unlike the screeners,
// Stanley-Brown produces a CarePlan resource (not an Observation),
// with one activity per step of the safety plan template.
//
// SPiER models the seven canonical Stanley-Brown steps. The six core steps
// have no validated LOINC panel — codes previously asserted here had invalid
// check digits and did not resolve, so each activity now carries the step
// name in detail.code.text. Only step 7 has a real LOINC code.
//   1. Warning signs        2. Internal coping     3. Social distractions
//   4. Crisis support       5. Professional support  6. Lethal means safety
//   7. Reason for living    (LOINC 81344-4)
// Adding a verified Stanley-Brown LOINC panel, if one is published, is a
// follow-up.
//
// Existing Questionnaire:
//   http://spier.org/Questionnaire/StanleyBrownSafetyPlan|1.1.0
// =============================================================


// ─── CarePlan profile ────────────────────────────────────────

Profile: SPiERStanleyBrownSafetyPlan
Parent: CarePlan
Id: spier-stanley-brown-safety-plan
Title: "SPiER Stanley-Brown Safety Plan CarePlan"
Description: "A CarePlan derived from a completed Stanley-Brown Safety Plan QuestionnaireResponse. Carries one CarePlan.activity per safety-plan step; each activity names the step in detail.code.text (only 'Reason for living' has a validated LOINC code) and the patient-authored content in detail.description."
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


// ─── ActivityDefinition ──────────────────────────────────────

Instance: AdministerStanleyBrown
InstanceOf: ActivityDefinition
Title: "Author Stanley-Brown Safety Plan"
Description: "Collaboratively complete a Stanley-Brown Safety Plan with the patient and persist the result as a CarePlan with one activity per step."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerStanleyBrown"
* name = "AdministerStanleyBrown"
* title = "Author Stanley-Brown Safety Plan"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Collaboratively complete a Stanley-Brown Safety Plan with the patient and persist the result as a CarePlan profiled by SPiERStanleyBrownSafetyPlan. Each of the seven safety-plan steps becomes a CarePlan.activity with its own LOINC code."
* purpose = "Establish a written, individualized plan a patient can use to manage suicidal crises. Belongs to the Document Safety Actions stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "Stanley-Brown Safety Plan template"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/StanleyBrownSafetyPlan|1.1.0"


// ─── Example ─────────────────────────────────────────────────

Instance: ExampleStanleyBrownSafetyPlan
InstanceOf: SPiERStanleyBrownSafetyPlan
Title: "Example — Completed Stanley-Brown Safety Plan"
Description: "Sample CarePlan showing all seven Stanley-Brown steps populated for an example patient. Each activity names the step in detail.code.text (the six core steps have no validated LOINC panel; step 7 uses LOINC 81344-4) and the patient-authored content in detail.description."
Usage: #example
* status = #active
* intent = #plan
* category[+] = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* subject = Reference(Patient/example)
* addresses[+].display = "Risk for suicide"
* activity[+].detail
  * code.text = "Step 1: Warning Signs"
  * status = #in-progress
  * description = "Sleep disruption; isolation from friends; thoughts of being a burden"
* activity[+].detail
  * code.text = "Step 2: Internal Coping Strategies"
  * status = #in-progress
  * description = "Long walk; cold shower; breathing exercise from app"
* activity[+].detail
  * code.text = "Step 3: Social Distractions"
  * status = #in-progress
  * description = "Brother (555-0102); coffee shop on 2nd Ave"
* activity[+].detail
  * code.text = "Step 4: Crisis Support Contacts"
  * status = #in-progress
  * description = "Best friend Maria (555-0143); aunt Carol (555-0188)"
* activity[+].detail
  * code.text = "Step 5: Professional Support"
  * status = #in-progress
  * description = "Dr. Chen (555-0200) / Memorial ED, 100 Hospital Dr, 555-0911 / 988 Suicide & Crisis Lifeline"
* activity[+].detail
  * code.text = "Step 6: Lethal Means Safety"
  * status = #in-progress
  * description = "Roommate to hold medications until follow-up; gun-lock voucher accepted from clinic"
* activity[+].detail
  * code = http://loinc.org#81344-4 "Reason for living"
  * code.text = "Step 7: Reason for Living"
  * status = #in-progress
  * description = "Niece's high-school graduation in six weeks; finishing the novel I'm writing"
