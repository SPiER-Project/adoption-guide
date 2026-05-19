// =============================================================
// PHQ-9 — Patient Health Questionnaire 9-item
// =============================================================
// Depression screener whose Item 9 is the canonical entry to the
// SPiER pathway (any positive value advances to Clarify Risk).
//
// Existing Questionnaire:
//   http://spier.org/Questionnaire/PHQ-9|1.0.0
// =============================================================


Profile: SPiERPHQ9TotalScore
Parent: Observation
Id: spier-phq9-total-score
Title: "SPiER PHQ-9 Total Score Observation"
Description: "Integer total score (0–27) derived from a completed PHQ-9 QuestionnaireResponse. Severity tiers: 0–4 Minimal, 5–9 Mild, 10–14 Moderate, 15–19 Moderately Severe, 20+ Severe."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
* code = http://loinc.org#44261-6
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only integer


Profile: SPiERPHQ9Item9
Parent: Observation
Id: spier-phq9-item9
Title: "SPiER PHQ-9 Item 9 Observation"
Description: "Discrete Observation for PHQ-9 item 9 (\"Thoughts that you would be better off dead or of hurting yourself\"). Value 0–3 reflects the four answer options; any value > 0 should advance the patient to Clarify Risk."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
* code = http://loinc.org#44260-8
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only integer


Instance: AdministerPHQ9
InstanceOf: ActivityDefinition
Title: "Administer PHQ-9"
Description: "Capture a PHQ-9 depression screen, persist as a QuestionnaireResponse, and derive total-score and item-9 Observations. Item 9 advances the patient to Clarify Risk."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerPHQ9"
* name = "AdministerPHQ9"
* title = "Administer PHQ-9"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health) — pending Zero Suicide co-authorship"
* description = "Capture a PHQ-9 depression screen, persist as a QuestionnaireResponse, and derive total-score and item-9 Observations."
* purpose = "Screen for depression severity; any positive PHQ-9 item 9 score is the canonical suicide-risk trigger for Clarify Risk."
* kind = #ServiceRequest
* topic[+]
  * coding[+] = http://snomed.info/sct#171207006 "Depression screening (procedure)"
* code
  * coding[+] = http://loinc.org#44249-1 "Patient Health Questionnaire 9 item (PHQ-9) total score"
* extension[+]
  * url = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire"
  * valueCanonical = "http://spier.org/Questionnaire/PHQ-9|1.0.0"


Instance: ExamplePHQ9TotalScore18
InstanceOf: SPiERPHQ9TotalScore
Title: "Example — PHQ-9 Total Score 18 (Moderately Severe)"
Description: "Sample total-score Observation showing a Moderately Severe PHQ-9 result for an example patient."
Usage: #example
* status = #final
* category[+].coding[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#44261-6 "Patient Health Questionnaire 9 item total score"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:30:00Z"
* valueInteger = 18
* interpretation[+]
  * coding[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#H "High"
  * text = "Moderately Severe depression (score 18/27)"


Instance: ExamplePHQ9Item9Positive
InstanceOf: SPiERPHQ9Item9
Title: "Example — PHQ-9 Item 9 Positive"
Description: "Sample item-9 Observation showing endorsement of suicide-related thoughts (score 2 = 'More than half the days')."
Usage: #example
* status = #final
* category[+].coding[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#44260-8 "Thoughts that you would be better off dead or of hurting yourself"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:30:00Z"
* valueInteger = 2
* interpretation[+]
  * coding[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#A "Abnormal"
  * text = "Positive — suicide risk screening indicated"
