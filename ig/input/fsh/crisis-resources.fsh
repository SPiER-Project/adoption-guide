// =============================================================
// Crisis Resources / Coping Supports (TL-013)
// =============================================================
// A safety-ACTION documentation tool (no questionnaire): records that
// patient-facing crisis resources / coping supports were provided
// (988, Crisis Text Line, Now Matters Now, a copy of the safety plan,
// local crisis lines). Modeled as a stage-tagged Communication, mirroring
// the caring-contact / referral workflow recorders. Belongs to the
// Document Safety Actions stage.
// =============================================================


// ─── CodeSystem / ValueSet: crisis resources ─────────────────

CodeSystem: CrisisResourceCodes
Id: spier-crisis-resource
Title: "Crisis Resource Codes"
Description: "SPiER-local codes for patient-facing crisis resources and coping supports that can be shared with a patient."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #lifeline-988 "988 Suicide & Crisis Lifeline" "The 988 Suicide & Crisis Lifeline (call/text/chat)."
* #crisis-text-line "Crisis Text Line" "Crisis Text Line — text HOME to 741741."
* #now-matters-now "Now Matters Now" "Now Matters Now — coping-skills resource (nowmattersnow.org)."
* #safety-plan-copy "Safety plan copy" "A copy of the patient's completed safety/crisis response plan."
* #local-crisis-line "Local crisis line" "A local/regional crisis or warm line."
* #warmline "Peer warmline" "A peer-support warmline."


ValueSet: CrisisResource
Id: spier-crisis-resource-vs
Title: "Crisis Resource"
Description: "Patient-facing crisis resources and coping supports."
* ^status = #draft
* ^experimental = true
* include codes from system CrisisResourceCodes


// ─── Extension: coded crisis resource on a payload ──────────

Extension: CrisisResourceCode
Id: crisis-resource-code
Title: "Crisis Resource Code"
Description: "Codes a Communication.payload entry with the specific patient-facing crisis resource shared (SPiER crisis-resource ValueSet), since Communication.payload has no native coded slot."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Communication.payload"
* value[x] only Coding
* valueCoding from CrisisResource (required)


// ─── Communication profile ───────────────────────────────────

Profile: SPiERCrisisResourcesShared
Parent: Communication
Id: spier-crisis-resources-shared
Title: "SPiER Crisis Resources Shared Communication"
Description: "A Communication recording that one or more patient-facing crisis resources / coping supports were provided to the patient. Each shared resource is carried as a payload with a coding from the SPiER crisis-resource ValueSet; `sent` timestamps the sharing. Tagged to the Document Safety Actions pathway stage via meta.tag."
* ^status = #draft
* ^experimental = true
* status 1..1
* status = #completed (exactly)
* subject 1..1
* subject only Reference(Patient)
* sent 1..1
* payload 1..*
* status MS
* subject MS
* sent MS
* payload MS


// ─── ActivityDefinition ──────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh. AD id + canonical URL
// unchanged so the TL-013 catalog mapping and the document-safety-actions
// stage PlanDefinition action stay stable.

Instance: ShareCrisisResources
InstanceOf: ActivityDefinition
Title: "Share Patient-Facing Crisis Resources / Coping Supports"
Description: "Document that patient-facing crisis resources or coping supports (988, Crisis Text Line, Now Matters Now, a safety-plan copy, local crisis lines) were provided, as a SPiERCrisisResourcesShared Communication."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ShareCrisisResources"
* name = "ShareCrisisResources"
* version = "1.0.0"
* title = "Share Patient-Facing Crisis Resources / Coping Supports"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Record that patient-facing crisis resources / coping supports were provided to the patient, as a stage-tagged Communication carrying the shared resources (SPiER crisis-resource codes)."
* purpose = "Ensure the patient leaves with concrete, documented access to crisis support. Belongs to the Document Safety Actions stage."
* kind = #CommunicationRequest


// ─── Example ─────────────────────────────────────────────────

Instance: ExampleCrisisResourcesShared
InstanceOf: SPiERCrisisResourcesShared
Title: "Example — Crisis Resources Shared"
Description: "Sample Communication recording that the 988 Lifeline, Crisis Text Line, and a copy of the safety plan were shared with the patient."
Usage: #example
* status = #completed
* category[+].text = "Crisis resources shared"
* subject = Reference(Patient/example)
* sent = "2026-07-15T16:45:00Z"
* payload[+].contentString = "988 Suicide & Crisis Lifeline (call/text/chat 988)"
* payload[=].extension[+].url = "http://spier.org/StructureDefinition/crisis-resource-code"
* payload[=].extension[=].valueCoding = CrisisResourceCodes#lifeline-988 "988 Suicide & Crisis Lifeline"
* payload[+].contentString = "Crisis Text Line — text HOME to 741741"
* payload[=].extension[+].url = "http://spier.org/StructureDefinition/crisis-resource-code"
* payload[=].extension[=].valueCoding = CrisisResourceCodes#crisis-text-line "Crisis Text Line"
* payload[+].contentString = "Copy of your safety plan"
* payload[=].extension[+].url = "http://spier.org/StructureDefinition/crisis-resource-code"
* payload[=].extension[=].valueCoding = CrisisResourceCodes#safety-plan-copy "Safety plan copy"
