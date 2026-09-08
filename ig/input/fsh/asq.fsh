// =============================================================
// ASQ — Ask Suicide-Screening Questions
// =============================================================
// Flagship tool for the SPiER FHIR IG. Demonstrates the full
// chain from Questionnaire to ActivityDefinition to derived
// Observation to a PlanDefinition trigger that advances the
// patient from Identify Possible Risk to Clarify Risk.
//
// References the existing Questionnaire authored at
// FHIR-Resources/ASQ/asq-questionnaire.json
// (canonical: http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool).
// =============================================================


// ─── Per-item codes: now LOINC ───────────────────────────────
// The ASQ items carry published LOINC codes. LOINC 2.83 added the panel
// 115564-7 "Ask Suicide-Screening Questions Tool [ASQ]" and a code for each
// item, so the Questionnaire, the observation mapper and the data dictionary
// all bind to LOINC and there is no SPiER-local item CodeSystem any more:
//
//   115565-4  "Ask the Patient:"  (LOINC's section header; SPiER models this as
//                                  a `group`, so it carries no code here)
//   115566-2  q1                  wished you were dead
//   115567-0  q2                  you or your family better off if you were dead
//   115568-8  q3                  thoughts about killing yourself
//   115569-6  q4                  ever tried to kill yourself
//   115570-4  q4-recent-attempt   when the most recent attempt was
//   115571-2  q5                  thoughts of killing yourself right now
//   115572-0  q5-describe         free-text description
//
// The `asq-item` CodeSystem that used to live here is DELETED, rather than
// retained-and-deprecated, and that is safe only because of what it was: a
// stand-in whose own Description said "Replace with published LOINC concepts
// if/when NIMH/Regenstrief assign them", on an artifact that has never left
// `status: #draft` / `experimental: true`. Nothing outside SPiER could have
// bound to it, and nothing inside does — no ConceptMap, no crosswalk, no
// profile. Retaining it would leave two codes for one concept and no rule for
// which to emit.
//
// ⚠️ This is the ASQ's THIRD item-coding, and the first two are why the second
// paragraph above is stated rather than assumed. #220 found the items carrying
// 93246-7/93247-5/93248-3/93249-1 — real LOINC codes belonging to the C-SSRS
// screener panel 93373-9, a different instrument — and the mapper emitting
// 93267-4/93266-6/93265-8/93264-1/93263-3, which are not LOINC codes at all
// (failed check-digits of C-SSRS behaviour codes). Both validated far enough to
// ship. The codes above were read off the LOINC-derived Questionnaire that NLM
// publishes for panel 115564-7, item by item.
//
// ⚠️ VERIFIED against Regenstrief, and the first attempt got every display
// WRONG. Both facts belong here, because the second is the reusable one.
//
// The codes were first taken from the LOINC-derived Questionnaire NLM publishes
// for panel 115564-7 (lforms-fhir.nlm.nih.gov). The CODES were right. Every
// DISPLAY was wrong, because NLM puts the question wording in `display`
// ("In the past few weeks, have you wished you were dead?") while LOINC's own
// display drops the comma and the question mark. All eight failed
// `$validate-code` with "The code exists but the display is not valid" — the
// #220 defect shape exactly: a real code carrying a string its authority does
// not publish, which no amount of code-only checking would ever surface.
//
// The displays below are LOINC 2.83's, read from fhir.loinc.org `$lookup` on
// 2026-09-08 (a free Regenstrief account; the service is authenticated). That
// run also confirmed the release is 2.83, which until then was only attributed
// by a search summary of loinc.org's highlights page. `LA37190-8`, `LA37191-6`
// and `93374-7` passed on the first attempt and were not changed.
//
// ⚠️ Do NOT re-derive these from a rendering of the instrument, from NLM's
// LForms conversion, or from the Questionnaire's own `item.text`. `item.text`
// is the human wording and deliberately keeps its punctuation; `code.display`
// is LOINC's string and must match it byte for byte. They differ on every item
// here, and that difference is correct.
//
// ⚠️ tx.fhir.org and CSIRO's ontoserver both still served LOINC 2.82 on that
// date and report all eight codes unknown. That is why the nightly is expected
// to stay red on the resource half — `docs/scheduled-checks-triage.md`
// § Cause 1b — and it is a server lag, not a defect in these codes.
//
// ⚠️ The ANSWERS split, and the split is the point:
//  - **q4-recent-attempt IS on LOINC** (LA37190-8 "Within last 12 months" /
//    LA37191-6 "Over 1 year ago"). Its local `asq-attempt-recency` pair matched
//    those display-for-display, so it was a stand-in with a published
//    equivalent and the CodeSystem is deleted. This is the one item on the form
//    whose answers are LOINC.
//  - **The yes/no items are NOT.** LOINC binds them to LA33-6/LA32-8, but SPiER
//    answers every yes/no item in every instrument with SNOMED 373066001 /
//    373067005, read by the one shared `getYesNoBoolean`. Switching those is a
//    repo-wide change (#327's family) and does not belong in an ASQ recoding.
//    The inconsistency is deliberate and is cheaper than the alternative: a
//    partner reading these items reads a Coding either way, and `getYesNoBoolean`
//    already accepts the LOINC pair on the way in.
//
// ⚠️ Not promoted, deliberately:
//  - The disposition tiers. LOINC publishes nothing for negative /
//    non-acute-positive / acute-positive; ASQResultCodes below stays local, and
//    the result Observation keeps LOINC 93374-7 "Suicide risk level".


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
// Standard `survey` category + the Gravity-pattern domain tag, so this resource
// is retrievable with the rest of the suicide-safer care record by category
// alone (#262) and satisfies us-core-observation-screening-assessment.
* insert SurveyAndSuicideRiskCategory
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
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerASQ"
* identifier[+].system = "http://thespierproject.org/fhir/identifier/tool-id"
* identifier[=].value = "TL-001"
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
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool|1.1.0-pilot"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #public-domain
* copyright = "The ASQ (Ask Suicide-Screening Questions) is a public domain instrument developed by the National Institute of Mental Health (NIMH). No permission is required for use. The audit memo asks that use attribute the instrument to NIMH and cite the canonical publication. Basis: FHIR-Resources/ASQ/licensing/MEMO.md (issue #64). Open items recorded there: the permission letter it references is still to be filed in-repo, and whether item wording may be modified is not yet settled — the SPiER Questionnaire reproduces the five core items verbatim."


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleASQResultNonAcutePositive
InstanceOf: SPiERASQResult
Title: "Example — ASQ Result: Non-Acute Positive"
Description: "Sample Observation showing a non-acute positive ASQ outcome for an example patient. Used as a conformance fixture and for human reviewers."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
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
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
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
* questionnaire = "http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool"
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
