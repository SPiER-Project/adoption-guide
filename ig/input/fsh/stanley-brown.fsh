// =============================================================
// Stanley-Brown Safety Plan
// =============================================================
// Evidence-based safety planning intervention. Unlike the screeners,
// Stanley-Brown produces a CarePlan resource (not an Observation),
// with one activity per step of the safety plan template.
//
// SPiER models seven steps following the canonical Stanley-Brown
// protocol:
//   1. Warning signs        (LOINC 76689-1)
//   2. Internal coping      (LOINC 76690-9)
//   3. Social distractions  (LOINC 76691-7)
//   4. Crisis support       (LOINC 76692-5)
//   5. Professional support (LOINC 76693-3)
//   6. Lethal means safety  (LOINC 76694-1)
//   7. Reason for living    (LOINC 81344-4)
//
// Existing Questionnaire:
//   http://spier.org/Questionnaire/StanleyBrownSafetyPlan|1.1.0
// =============================================================


// ─── CarePlan profile ────────────────────────────────────────

Profile: SPiERStanleyBrownSafetyPlan
Parent: CarePlan
Id: spier-stanley-brown-safety-plan
Title: "SPiER Stanley-Brown Safety Plan CarePlan"
Description: "A CarePlan derived from a completed Stanley-Brown Safety Plan QuestionnaireResponse. Carries one CarePlan.activity per safety-plan step; each activity references the step's LOINC code in its detail.code and the patient-authored content in detail.description."
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
* topic[+] = http://snomed.info/sct#763304007 "Suicide prevention strategy (regime/therapy)"
* code = http://snomed.info/sct#735324008 "Treatment plan for suicide prevention"
* extension[+]
  * url = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire"
  * valueCanonical = "http://spier.org/Questionnaire/StanleyBrownSafetyPlan|1.1.0"


// ─── PlanDefinition: Document Safety Actions stage ───────────

Instance: SPiERDocumentSafetyActionsStage
InstanceOf: PlanDefinition
Title: "SPiER Pathway — Document Safety Actions Stage"
Description: "Stage 4 of 8 in the SPiER suicide-safer care pathway: document concrete actions used to reduce risk and support safety. Stanley-Brown is the flagship safety-planning action; CAMS Stabilization will be added when that artifact set is authored (Move 6c)."
Usage: #definition
* url = "http://spier.org/PlanDefinition/SPiERDocumentSafetyActionsStage"
* name = "SPiERDocumentSafetyActionsStage"
* title = "SPiER Pathway — Document Safety Actions Stage"
* status = #draft
* experimental = true
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#workflow-definition
* useContext[+].code = http://terminology.hl7.org/CodeSystem/usage-context-type#focus
* useContext[=].valueCodeableConcept = SPiERPathwayStage#document-safety-actions
* action[+]
  * id = "administer-stanley-brown"
  * title = "Author Stanley-Brown Safety Plan"
  * description = "Collaboratively complete a Stanley-Brown Safety Plan with the patient."
  * definitionCanonical = "http://spier.org/ActivityDefinition/AdministerStanleyBrown"
  * output[+]
    * type = #CarePlan
    * profile = "http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan"


// ─── Example ─────────────────────────────────────────────────

Instance: ExampleStanleyBrownSafetyPlan
InstanceOf: SPiERStanleyBrownSafetyPlan
Title: "Example — Completed Stanley-Brown Safety Plan"
Description: "Sample CarePlan showing all seven Stanley-Brown steps populated for an example patient. Each activity carries its step-specific LOINC code in detail.code and the patient-authored content in detail.description."
Usage: #example
* status = #active
* intent = #plan
* category[+] = http://snomed.info/sct#735324008 "Treatment plan for suicide prevention"
* subject = Reference(Patient/example)
* addresses[+].display = "Risk for suicide"
* activity[+].detail
  * code = http://loinc.org#76689-1 "Stanley-Brown safety plan — warning signs"
  * code.text = "Step 1: Warning Signs"
  * status = #in-progress
  * description = "Sleep disruption; isolation from friends; thoughts of being a burden"
* activity[+].detail
  * code = http://loinc.org#76690-9 "Stanley-Brown safety plan — internal coping"
  * code.text = "Step 2: Internal Coping Strategies"
  * status = #in-progress
  * description = "Long walk; cold shower; breathing exercise from app"
* activity[+].detail
  * code = http://loinc.org#76691-7 "Stanley-Brown safety plan — social distractions"
  * code.text = "Step 3: Social Distractions"
  * status = #in-progress
  * description = "Brother (555-0102); coffee shop on 2nd Ave"
* activity[+].detail
  * code = http://loinc.org#76692-5 "Stanley-Brown safety plan — crisis support"
  * code.text = "Step 4: Crisis Support Contacts"
  * status = #in-progress
  * description = "Best friend Maria (555-0143); aunt Carol (555-0188)"
* activity[+].detail
  * code = http://loinc.org#76693-3 "Stanley-Brown safety plan — professional support"
  * code.text = "Step 5: Professional Support"
  * status = #in-progress
  * description = "Dr. Chen (555-0200) / Memorial ED, 100 Hospital Dr, 555-0911 / 988 Suicide & Crisis Lifeline"
* activity[+].detail
  * code = http://loinc.org#76694-1 "Stanley-Brown safety plan — lethal means safety"
  * code.text = "Step 6: Lethal Means Safety"
  * status = #in-progress
  * description = "Roommate to hold medications until follow-up; gun-lock voucher accepted from clinic"
* activity[+].detail
  * code = http://loinc.org#81344-4 "Reason for living"
  * code.text = "Step 7: Reason for Living"
  * status = #in-progress
  * description = "Niece's high-school graduation in six weeks; finishing the novel I'm writing"
