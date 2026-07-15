// =============================================================
// Lethal Means Safety (TL-008)
// =============================================================
// A safety-ACTION documentation tool (no questionnaire): records that
// lethal-means safety counseling was provided (a Procedure) and the
// concrete per-method means-safety actions agreed/taken (Observations).
// Belongs to the Document Safety Actions stage. Covers named protocols
// such as CALM (Counseling on Access to Lethal Means).
//
// No validated LOINC/SNOMED panel exists for the SPiER method/action
// vocabularies, so they use SPiER-local CodeSystems. The counseling
// Procedure carries a general SNOMED counseling code plus clarifying text.
// =============================================================


// ─── CodeSystems ─────────────────────────────────────────────

CodeSystem: LethalMeansMethodCodes
Id: spier-lethal-means-method
Title: "Lethal Means Method Codes"
Description: "SPiER-local codes for categories of lethal means addressed during means-safety counseling."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #firearm "Firearm" "Guns / firearms and ammunition."
* #medication "Medication" "Prescription or over-the-counter medications (overdose risk)."
* #sharps "Sharp objects" "Knives, razors, or other sharp objects."
* #ligature "Ligature / hanging risk" "Ropes, cords, belts, or other ligature/anchor points."
* #household-poison "Household poisons / chemicals" "Toxic household substances (e.g., cleaning chemicals, pesticides)."
* #other-means "Other means" "Other lethal means specific to the patient's context."


CodeSystem: MeansSafetyActionCodes
Id: spier-means-safety-action
Title: "Means Safety Action Codes"
Description: "SPiER-local codes for the concrete means-safety action agreed or taken for a given lethal means."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #removed-from-environment "Removed from the environment" "The means was removed from the patient's home/environment."
* #locked-and-secured "Locked and secured" "The means was locked or secured (e.g., gun lock/safe, lockbox for medications)."
* #transferred-to-other-party "Transferred to a trusted party" "The means was transferred to a trusted person for safekeeping."
* #safely-disposed "Safely disposed" "The means was safely disposed of (e.g., medication take-back)."
* #no-access-confirmed "No access confirmed" "Confirmed the patient has no access to this means."
* #declined "Declined / not yet addressed" "The patient declined or the action is not yet completed."


ValueSet: LethalMeansMethod
Id: spier-lethal-means-method-vs
Title: "Lethal Means Method"
Description: "Categories of lethal means addressed during means-safety counseling."
* ^status = #draft
* ^experimental = true
* include codes from system LethalMeansMethodCodes


ValueSet: MeansSafetyAction
Id: spier-means-safety-action-vs
Title: "Means Safety Action"
Description: "Concrete means-safety actions for a given lethal means."
* ^status = #draft
* ^experimental = true
* include codes from system MeansSafetyActionCodes


// ─── Procedure profile: counseling provided ──────────────────

Profile: SPiERLethalMeansCounseling
Parent: Procedure
Id: spier-lethal-means-counseling
Title: "SPiER Lethal Means Safety Counseling Procedure"
Description: "A Procedure recording that lethal-means safety counseling (e.g., CALM) was provided to the patient/family. The concrete per-method actions are recorded as separate SPiERMeansSafetyAction Observations."
* ^status = #draft
* ^experimental = true
* status 1..1
* status = #completed (exactly)
* code 1..1
* subject 1..1
* subject only Reference(Patient)
* performed[x] 1..1
* performed[x] only dateTime or Period
* status MS
* code MS
* subject MS
* performed[x] MS


// ─── Observation profile: per-method means-safety action ─────

Profile: SPiERMeansSafetyAction
Parent: Observation
Id: spier-means-safety-action
Title: "SPiER Means Safety Action Observation"
Description: "One means-safety action for a specific lethal means. Observation.code identifies the means (SPiER lethal-means-method); the value is the action taken (SPiER means-safety-action). status = final for a completed action, preliminary for a planned/agreed one; the responsible party and plan details go in note."
* ^status = #draft
* ^experimental = true
* status 1..1
* category 1..*
* category.coding 1..*
* code 1..1
* code from LethalMeansMethod (required)
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
* valueCodeableConcept from MeansSafetyAction (required)
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition ──────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. AD id + canonical URL
// unchanged so the TL-008 catalog mapping and the document-safety-actions
// stage PlanDefinition action stay stable.

Instance: ProvideMeansSafetyCounseling
InstanceOf: ActivityDefinition
Title: "Provide Lethal Means Safety Counseling / Means Safety Actions"
Description: "Provide lethal-means safety counseling and document the counseling (Procedure) plus the concrete per-method means-safety actions (Observations)."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ProvideMeansSafetyCounseling"
* name = "ProvideMeansSafetyCounseling"
* version = "1.0.0"
* title = "Provide Lethal Means Safety Counseling / Means Safety Actions"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Provide lethal-means safety counseling (e.g., CALM — Counseling on Access to Lethal Means) and document it as a SPiERLethalMeansCounseling Procedure plus one SPiERMeansSafetyAction Observation per lethal means addressed."
* purpose = "Reduce the patient's access to lethal means as a concrete, documented, reportable safety action. Belongs to the Document Safety Actions stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://snomed.info/sct#409063005 "Counseling"


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleLethalMeansCounseling
InstanceOf: SPiERLethalMeansCounseling
Title: "Example — Lethal Means Safety Counseling Procedure"
Description: "Sample Procedure recording that means-safety counseling was provided."
Usage: #example
* status = #completed
* code = http://snomed.info/sct#409063005 "Counseling"
* code.text = "Lethal means safety counseling (CALM)"
* subject = Reference(Patient/example)
* performedDateTime = "2026-07-15T16:30:00Z"


Instance: ExampleMeansSafetyActionFirearm
InstanceOf: SPiERMeansSafetyAction
Title: "Example — Means Safety Action: Firearm secured"
Description: "Sample means-safety action Observation: the patient's firearm was transferred to a trusted party for safekeeping."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#procedure
* code = LethalMeansMethodCodes#firearm "Firearm"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T16:30:00Z"
* valueCodeableConcept = MeansSafetyActionCodes#transferred-to-other-party "Transferred to a trusted party"
* note.text = "Responsible party: patient's brother. Firearm + ammunition transferred and stored off-site until follow-up."


Instance: ExampleMeansSafetyActionMedication
InstanceOf: SPiERMeansSafetyAction
Title: "Example — Means Safety Action: Medication locked"
Description: "Sample means-safety action Observation: medications locked in a lockbox held by a family member."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#procedure
* code = LethalMeansMethodCodes#medication "Medication"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T16:30:00Z"
* valueCodeableConcept = MeansSafetyActionCodes#locked-and-secured "Locked and secured"
* note.text = "Responsible party: spouse holds the lockbox key; only single daily doses dispensed."
