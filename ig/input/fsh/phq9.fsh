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
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory
* code = http://loinc.org#44261-6
* subject 1..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS
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
// Gravity-pattern domain tag, so this resource is retrievable with the rest
// of the suicide-safer care record by category alone (#262).
* insert SuicideRiskDomainCategory
* code = http://loinc.org#44260-8
* subject 1..1
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS
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
* version = "0.1.0"
* title = "Administer PHQ-9"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Capture a PHQ-9 depression screen, persist as a QuestionnaireResponse, and derive total-score and item-9 Observations."
* purpose = "Screen for depression severity; any positive PHQ-9 item 9 score is the canonical suicide-risk trigger for Clarify Risk."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#171207006 "Depression screening (procedure)"
* code = http://loinc.org#44249-1 "PHQ-9 quick depression assessment panel [Reported.PHQ]"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "PHQ-9 questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/PHQ-9|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #public-domain
* copyright = "Developed with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute. Basis: the notice recorded on the SPiER PHQ-9 Questionnaire (FHIR-Resources/PHQ-9/). No licensing-audit memo is on file for the PHQ-9 under issue #64, so this notice has not been verified against the publisher's current terms."


Instance: ExamplePHQ9TotalScore18
InstanceOf: SPiERPHQ9TotalScore
Title: "Example — PHQ-9 Total Score 18 (Moderately Severe)"
Description: "Sample total-score Observation showing a Moderately Severe PHQ-9 result for an example patient."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#44261-6 "Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:30:00Z"
* derivedFrom = Reference(ExamplePHQ9Response)
* valueInteger = 18
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#H "High"
* interpretation[=].text = "Moderately Severe depression (score 18/27)"


Instance: ExamplePHQ9Item9Positive
InstanceOf: SPiERPHQ9Item9
Title: "Example — PHQ-9 Item 9 Positive"
Description: "Sample item-9 Observation showing endorsement of suicide-related thoughts (score 2 = 'More than half the days')."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#44260-8 "Thoughts that you would be better off dead, or of hurting yourself in some way in last 2 weeks [Reported.PHQ]"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:30:00Z"
* derivedFrom = Reference(ExamplePHQ9Response)
* valueInteger = 2
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#A "Abnormal"
* interpretation[=].text = "Positive — suicide risk screening indicated"


// Source QuestionnaireResponse the example Observations are derived from
// (Observation.derivedFrom) — the provenance link SDC $extract would set, and
// that the SPiER app stamps when it extracts Observations on submit.
Instance: ExamplePHQ9Response
InstanceOf: QuestionnaireResponse
Title: "Example — PHQ-9 QuestionnaireResponse"
Description: "Sample completed PHQ-9 QuestionnaireResponse that the example total-score and item-9 Observations reference via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/PHQ-9"
* subject = Reference(Patient/example)
* authored = "2026-03-19T10:30:00Z"
// q1–q9 are all `required` on the Questionnaire, so a partial response is not a
// conformant example (checked by `node scripts/validate-fhir.mjs`). The answers
// below sum to the 18 asserted by ExamplePHQ9TotalScore18 — a moderately severe
// profile — with q9 = 2 matching ExamplePHQ9Item9Positive.
* item[+].linkId = "q1"
* item[=].text = "Little interest or pleasure in doing things"
* item[=].answer.valueCoding = http://loinc.org#LA6571-9 "Nearly every day"
* item[+].linkId = "q2"
* item[=].text = "Feeling down, depressed, or hopeless"
* item[=].answer.valueCoding = http://loinc.org#LA6571-9 "Nearly every day"
* item[+].linkId = "q3"
* item[=].text = "Trouble falling or staying asleep, or sleeping too much"
* item[=].answer.valueCoding = http://loinc.org#LA6570-1 "More than half the days"
* item[+].linkId = "q4"
* item[=].text = "Feeling tired or having little energy"
* item[=].answer.valueCoding = http://loinc.org#LA6570-1 "More than half the days"
* item[+].linkId = "q5"
* item[=].text = "Poor appetite or overeating"
* item[=].answer.valueCoding = http://loinc.org#LA6570-1 "More than half the days"
* item[+].linkId = "q6"
* item[=].text = "Feeling bad about yourself — or that you are a failure or have let yourself or your family down"
* item[=].answer.valueCoding = http://loinc.org#LA6570-1 "More than half the days"
* item[+].linkId = "q7"
* item[=].text = "Trouble concentrating on things, such as reading the newspaper or watching television"
* item[=].answer.valueCoding = http://loinc.org#LA6569-3 "Several days"
* item[+].linkId = "q8"
* item[=].text = "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual"
* item[=].answer.valueCoding = http://loinc.org#LA6569-3 "Several days"
* item[+].linkId = "q9"
* item[=].text = "Thoughts that you would be better off dead or of hurting yourself in some way"
* item[=].answer.valueCoding = http://loinc.org#LA6570-1 "More than half the days"
* item[+].linkId = "total-score"
* item[=].answer.valueInteger = 18
