// =============================================================
// ASQ — Ask Suicide-Screening Questions
// =============================================================
// Flagship tool for the SPiER FHIR IG. Demonstrates the full
// chain from Questionnaire to ActivityDefinition to derived
// Observation to a PlanDefinition trigger that advances the
// patient from Identify Possible Risk to Clarify Risk.
//
// References the existing Questionnaire authored at
// FHIR-Resources/ASQ/fhir/questionnaires/questionnaire.json
// (canonical: http://spier.org/Questionnaire/ASQ-Screening-Tool).
// =============================================================


// ─── CodeSystem ───────────────────────────────────────────────
// Local codes for ASQ outcomes. Mirrors the codes currently used
// by web/src/observationMappers.ts so the IG matches runtime
// data. Replace with published LOINC codes if/when they exist.

// ─── Per-item codes ──────────────────────────────────────────
// Moved here from FHIR-Resources/ASQ/asq-item.json (#261 follow-up).
//
// It was the last SPiER-local CodeSystem the dictionary references that lived
// only under FHIR-Resources/, and that had two consequences worth stating,
// because neither was visible from the JSON:
//
//  1. The IG Publisher is triggered by `ig/**` alone, so it never built a page
//     for it — `/ig/CodeSystem-asq-item.html` was a 404 while every sibling
//     CodeSystem resolved. Once the data dictionary links a code to its
//     definition, that 404 becomes a broken promise on the page an implementer
//     is most likely to trust.
//  2. Living outside `ig/` also kept it outside the publisher's terminology
//     validation, which is the gate that catches display drift in the IG tree.
//
// Concepts, displays and definitions are carried over verbatim; the ASQ
// Questionnaire, `web/src/lib/observationMappers/asq.ts`, the data dictionary
// and `check:extract` all bind to these exact codes, and the canonical URL is
// unchanged (http://spier.org/CodeSystem/asq-item), so this is a move rather
// than a redefinition. The JSON is deleted in the same change — per CLAUDE.md,
// the same canonical must never be defined in both trees.

CodeSystem: ASQItemCodes
Id: asq-item
Title: "ASQ Screening Item Codes (local)"
Description: "SPiER-local codes for the five NIMH ASQ screening questions (q1–q5). Used because the ASQ has NO published per-item LOINC codes: verification against LOINC (June 2026) confirmed that (a) the codes previously placed on these items (93246-7, 93247-5, 93248-3, 93249-1) are members of the C-SSRS screener panel 93373-9, not ASQ, and (b) the codes previously emitted by the observation mapper (93267-4, 93266-6, 93265-8, 93264-1, 93263-3) do not exist in LOINC at all (failed check-digits of C-SSRS suicidal-behavior codes). The ASQ is documented at the encounter level as an overall screening result; no authoritative per-question LOINC binding exists. These local codes give the items stable identifiers so the Questionnaire, the observation mapper, and the observationExtract anti-drift check can agree. Replace with published LOINC concepts if/when NIMH/Regenstrief assign them."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* ^version = "1.0.0"
* ^publisher = "SPiER Project"
* #wished-dead "Wished you were dead" "ASQ Q1 — In the past few weeks, have you wished you were dead? (passive death wish)"
* #family-better-off-dead "Family better off if dead" "ASQ Q2 — In the past few weeks, have you felt that you or your family would be better off if you were dead? (perceived burdensomeness)"
* #thoughts-killing-self "Thoughts about killing yourself" "ASQ Q3 — In the past week, have you been having thoughts about killing yourself? (active ideation)"
* #ever-attempted "Ever tried to kill yourself" "ASQ Q4 — Have you ever tried to kill yourself? (lifetime attempt history)"
* #acute-ideation-now "Killing yourself right now (acuity)" "ASQ Q5 (acuity) — Are you having thoughts of killing yourself right now? Asked only when any of Q1–Q4 is 'yes'."


CodeSystem: ASQResultCodes
Id: asq-screening-result
Title: "ASQ Suicide Risk Screening Result Codes"
Description: "SPiER-local code system for the three possible outcomes of the NIMH ASQ screener. Used because no equivalent LOINC concepts have been published for the disposition tiers."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #negative "Negative Screen" "All ASQ items 1–4 answered 'no'. No suicide-risk screening signal."
* #non-acute-positive "Non-Acute Positive Screen" "Any of items 1–4 answered 'yes' AND the acuity question (item 5) answered 'no'. Refer for further suicide-risk assessment within the same visit."
* #acute-positive "Acute Positive Screen" "The acuity question (item 5) answered 'yes'. Do not leave patient alone; initiate emergency safety procedures."

// The ASQ Questionnaire's disposition answerOptions (and the runtime mapper in
// web/src/lib/observationMappers/asq.ts) label these tiers with the clinical
// consequence appended, because the bare tier name is not self-explanatory to a
// clinician picking an option. `Coding.display` must match the CodeSystem, so
// the longer labels are registered here as designations rather than being
// silently divergent display strings.
* #non-acute-positive ^designation[+].language = #en
* #non-acute-positive ^designation[=].value = "Non-Acute Positive Screen (potential risk identified)"
* #acute-positive ^designation[+].language = #en
* #acute-positive ^designation[=].value = "Acute Positive Screen (imminent/acute risk identified)"


// ─── ValueSets ────────────────────────────────────────────────

ValueSet: ASQResult
Id: asq-result
Title: "ASQ Result"
Description: "All three possible outcomes of an ASQ screen."
* ^status = #draft
* ^experimental = true
* include codes from system ASQResultCodes


ValueSet: ASQResultPositive
Id: asq-result-positive
Title: "ASQ Positive Result"
Description: "The two ASQ outcomes that should trigger advancement to the Clarify Risk stage (excludes 'negative')."
* ^status = #draft
* ^experimental = true
* ASQResultCodes#non-acute-positive
* ASQResultCodes#acute-positive


// ─── Observation profile ─────────────────────────────────────
// SPiER ASQ Result Observation — the structured outcome
// resource derived from an ASQ QuestionnaireResponse.

Profile: SPiERASQResult
Parent: Observation
Id: spier-asq-result
Title: "SPiER ASQ Screening Result Observation"
Description: "An Observation representing the disposition of an ASQ suicide-risk screen. The value identifies one of three result tiers (negative / non-acute-positive / acute-positive) using a SPiER-local CodeSystem."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
// Survey category should appear as one of the codings; not formally sliced
// in v0.1 of the profile to keep the constraint readable. Future iterations
// can add a discriminator-based slice on category.coding when more category
// types are introduced.
* category.coding 1..*
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
* valueCodeableConcept from ASQResult (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition ──────────────────────────────────────
// Declares the "administer ASQ" workflow step that the pathway
// can plug in. Points at the existing Questionnaire and at the
// expected Observation shape.

Instance: AdministerASQ
InstanceOf: ActivityDefinition
Title: "Administer ASQ Suicide Screen"
Description: "Capture an ASQ screen from the patient (or proxy), persist responses as a QuestionnaireResponse, and derive a disposition Observation conformant to the SPiER ASQ Result profile."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/AdministerASQ"
* name = "AdministerASQ"
* version = "0.1.0"
* title = "Administer ASQ Suicide Screen"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Capture an ASQ screen from the patient (or proxy), persist responses as a QuestionnaireResponse, and derive a disposition Observation conformant to the SPiER ASQ Result profile."
* purpose = "Flag whether a patient has suicide-related signs warranting further clarification. Belongs to the Identify Possible Risk stage of the SPiER pathway."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
// The Questionnaire used to capture responses for this activity.
// Versioned canonical so future updates of the ASQ form can be tracked
// independent of this ActivityDefinition.
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "ASQ Screening Tool questionnaire"
* relatedArtifact[=].resource = "http://spier.org/Questionnaire/ASQ-Screening-Tool|1.1.0-pilot"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #public-domain
* copyright = "The ASQ (Ask Suicide-Screening Questions) is a public domain instrument developed by the National Institute of Mental Health (NIMH). No permission is required for use. The audit memo asks that use attribute the instrument to NIMH and cite the canonical publication. Basis: FHIR-Resources/ASQ/licensing/MEMO.md (issue #64). Open items recorded there: the permission letter it references is still to be filed in-repo, and whether item wording may be modified is not yet settled — the SPiER Questionnaire reproduces the five core items verbatim."


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleASQResultNonAcutePositive
InstanceOf: SPiERASQResult
Title: "Example — ASQ Result: Non-Acute Positive"
Description: "Sample Observation showing a non-acute positive ASQ outcome for an example patient. Used as a conformance fixture and for human reviewers."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:35:00Z"
* valueCodeableConcept = ASQResultCodes#non-acute-positive "Non-Acute Positive Screen"


Instance: ExampleASQResultAcutePositive
InstanceOf: SPiERASQResult
Title: "Example — ASQ Result: Acute Positive"
Description: "Sample Observation showing an acute positive ASQ outcome. Triggers the most urgent disposition (do-not-leave-alone, initiate emergency safety procedures)."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:35:00Z"
* valueCodeableConcept = ASQResultCodes#acute-positive "Acute Positive Screen"


Instance: ExampleASQResponseNonAcute
InstanceOf: QuestionnaireResponse
Title: "Example — ASQ QuestionnaireResponse (non-acute positive)"
Description: "Source ASQ QuestionnaireResponse: a baseline item is 'yes' and the acuity item is 'no' — a non-acute positive screen. The derived SPiERASQResult and the harmonized concept Observation reference this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://spier.org/Questionnaire/ASQ-Screening-Tool"
* subject = Reference(Patient/example)
* authored = "2026-03-19T10:35:00Z"
// Item nesting mirrors the Questionnaire's groups: a QuestionnaireResponse item
// must sit under the same parent as the Questionnaire item it answers, and every
// `required` item must carry an answer. Both are checked by
// `node scripts/validate-fhir.mjs`, not by SUSHI.
* item[+].linkId = "screening-questions"
* item[=].item[+].linkId = "q1"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q2"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[=].item[+].linkId = "q3"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[=].item[+].linkId = "q4"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "acuity-section"
* item[=].item[+].linkId = "q5"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "screening-result"
* item[=].item[+].linkId = "result-category"
* item[=].item[=].answer.valueCoding = ASQResultCodes#non-acute-positive "Non-Acute Positive Screen (potential risk identified)"
