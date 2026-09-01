// =============================================================
// C-SSRS — Columbia Suicide Severity Rating Scale
// =============================================================
// SPiER models two C-SSRS variants:
//   - Screener (Identify Possible Risk): 6-item rapid screen
//   - Full Lifetime/Recent (Clarify Risk): full instrument with
//     lifetime and recent ideation/behavior tracking and an
//     intensity section
//
// Both produce a derived suicide-risk-level Observation using a
// shared SPiER-local CodeSystem (none/low/moderate/high).
//
// Existing Questionnaires:
//   http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener|1.0.0
//   http://thespierproject.org/fhir/Questionnaire/C-SSRS-Full-Lifetime-Recent|1.0.0
// =============================================================


// ─── Shared CodeSystem + ValueSet ────────────────────────────

CodeSystem: CSSRSRiskLevelCodes
Id: cssrs-risk-level
Title: "C-SSRS Risk Level Codes"
Description: "SPiER-local code system for the derived risk level from a C-SSRS screener or full assessment. LOINC 93374-7 'Suicide risk level' carries a normative answer list (LL465-6: Low / Moderate / High); this local system extends that list with a `none` value (no C-SSRS items endorsed) that LOINC does not provide, and aligns display names with the SPiER suicide-risk tier. The derived Observation SHOULD dual-code its value with the matching LOINC answer code (LA9194-7 / LA6751-7 / LA9193-9) so HL7-aligned consumers — e.g. the HL7 US Behavioral Health Profiles IG — can interpret it without understanding the SPiER-local vocabulary."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
// The item→level ladder in these definitions is the published C-SSRS Screener
// with Triage Points, verified against the CMS-hosted 2008 "Screen Version —
// Recent" PDF and the Columbia Lighthouse Project's 2026 "Screen with Triage
// Points for Primary Care" — record in
// docs/reference/suicide-safer-care-pathway-spec.md §"Published-instrument
// verification (Phase 1b)". It is the same ladder the mappers derive
// (packages/core/src/lib/observationMappers/cssrsScreener.ts).
//
// One variant reads the behavior recency differently, and legitimately: the
// Since Last Visit / Since Last Contact form asks NO recency follow-up, because
// its whole reference period is the interval since the patient's last contact —
// so a positive item 6 there is recent by construction and scores High.
* #none "None" "No C-SSRS items endorsed. No risk identified."
* #low "Low" "Wish to be dead or non-specific active suicidal thoughts (items 1–2 positive) without method, intent, plan, or behavior."
* #moderate "Moderate" "Active ideation with a method but no intent (item 3 positive), and/or lifetime-only suicidal behavior — item 6 positive without the past-three-months recency follow-up."
* #high "High" "Active ideation with some intent to act (item 4) or with a specific plan and intent (item 5), and/or suicidal behavior within the past three months (item 6)."

// The C-SSRS Questionnaires label the risk-level answerOptions "Low Risk" /
// "Moderate Risk" / "High Risk" — a bare "Low" is ambiguous next to the other
// answer options on the form. `Coding.display` must match the CodeSystem, so
// the qualified labels are registered here as designations.
* #low ^designation[+].language = #en
* #low ^designation[=].value = "Low Risk"
* #moderate ^designation[+].language = #en
* #moderate ^designation[=].value = "Moderate Risk"
* #high ^designation[+].language = #en
* #high ^designation[=].value = "High Risk"


ValueSet: CSSRSRiskLevel
Id: cssrs-risk-level
Title: "C-SSRS Risk Level"
Description: "All four C-SSRS derived risk levels."
* ^status = #draft
* ^experimental = true
* include codes from system CSSRSRiskLevelCodes


// ─── Interval-scoped item codes (Since Last Visit/Contact) ───
//
// LOINC codes every C-SSRS item per *timeframe*: a Lifetime variant, a 1-month
// variant for the ideation items and a 3-month variant for the behaviour items.
// It publishes nothing for "since the patient's last visit or contact", which is
// the whole point of the Since Last Visit administration — the interval is
// whatever has elapsed, from days to many months.
//
// The Since Last Visit Questionnaire previously carried the 1-month ideation
// codes (93246-7 … 93250-9) and the Lifetime preparatory-acts code (93267-3).
// Those resolve, so no gate objected, but they assert a window the instrument
// does not claim — a receiving system would read interval data as past-month
// data. Issue #220.
//
// The only non-timeframed C-SSRS codes LOINC offers are the two section panels
// (93278-0 "Suicidal ideation [C-SSRS]", 93304-4 "Suicidal behavior [C-SSRS]"),
// which the Questionnaire now carries at group level. They cannot identify
// individual items, so the six extracted per-item Observations bind here
// instead. Every use is tagged #no-standard-binding.
//
// Item semantics are otherwise identical to the screener's, so a consumer that
// needs to compare across administrations should read the LOINC panel code on
// the section plus these item codes, or use the derived risk-level Observation,
// which is timeframe-agnostic and shared by every C-SSRS variant.

CodeSystem: CSSRSIntervalItemCodes
Id: cssrs-interval-item
Title: "C-SSRS Interval-Scoped Item Codes"
Description: "SPiER-local per-item codes for the C-SSRS Since Last Visit / Since Last Contact administration, whose reference period is the interval since the patient's prior contact. Local because LOINC codes C-SSRS items only for Lifetime, 1-month and 3-month windows, none of which matches this administration; using a LOINC item code here would assert a reference period the instrument does not claim."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #wish-to-be-dead "Wish to be dead (since last contact)" "Item 1 — wished to be dead or to go to sleep and not wake up, during the interval since the patient's last visit or contact."
* #non-specific-active-thoughts "Non-specific active suicidal thoughts (since last contact)" "Item 2 — had any thoughts of killing oneself, during the interval since the patient's last visit or contact."
* #active-ideation-any-methods "Active suicidal ideation with any methods, without intent to act (since last contact)" "Item 3 — thought about how one might do it, without intent to act, during the interval since the patient's last visit or contact."
* #active-ideation-some-intent "Active suicidal ideation with some intent to act, without specific plan (since last contact)" "Item 4 — had such thoughts with some intention of acting on them, during the interval since the patient's last visit or contact."
* #active-ideation-plan-and-intent "Active suicidal ideation with specific plan and intent (since last contact)" "Item 5 — worked out details of a plan and intends to carry it out, during the interval since the patient's last visit or contact."
* #suicidal-behavior "Suicidal behavior (since last contact)" "Item 6 — did anything, started to do anything, or prepared to do anything to end one's life, during the interval since the patient's last visit or contact. Covers the composite of actual, interrupted and aborted attempts and preparatory acts, as the screener's item 6 does."


ValueSet: CSSRSIntervalItem
Id: cssrs-interval-item
Title: "C-SSRS Interval-Scoped Item"
Description: "The six C-SSRS Since Last Visit / Since Last Contact items, as used in Questionnaire.item.code and the extracted per-item Observation.code."
* ^status = #draft
* ^experimental = true
* include codes from system CSSRSIntervalItemCodes


// ─── Shared Observation profile ──────────────────────────────

Profile: SPiERCSSRSRiskLevel
Parent: Observation
Id: spier-cssrs-risk-level
Title: "SPiER C-SSRS Risk Level Observation"
Description: "Derived risk-level Observation produced by either the C-SSRS Screener or the full C-SSRS Lifetime/Recent assessment. Value is one of none/low/moderate/high from the SPiER C-SSRS risk-level CodeSystem."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* category 1..*
* category.coding 1..*
// Standard `survey` category + the Gravity-pattern domain tag, so this resource
// is retrievable with the rest of the suicide-safer care record by category
// alone (#262) and satisfies us-core-observation-screening-assessment.
* insert SurveyAndSuicideRiskCategory
* code = http://loinc.org#93374-7
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period
* value[x] 1..1
* value[x] only CodeableConcept
// Required: at least one coding from the SPiER-local C-SSRS risk-level set
// (this is the only set with a `none` value). Producers SHOULD additionally
// include the matching LOINC answer code (LL465-6: LA9194-7 Low / LA6751-7
// Moderate / LA9193-9 High) as a second coding so HL7-aligned consumers can
// read the value natively. The `none` level has no LOINC equivalent.
* valueCodeableConcept from CSSRSRiskLevel (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS


// ─── ActivityDefinition: C-SSRS Screener ─────────────────────

Instance: AdministerCSSRSScreener
InstanceOf: ActivityDefinition
Title: "Administer C-SSRS Screener"
Description: "Capture a 6-item Columbia Suicide Severity Rating Scale screener and derive a suicide-risk-level Observation."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSScreener"
* name = "AdministerCSSRSScreener"
* version = "0.1.0"
* title = "Administer C-SSRS Screener"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Capture a 6-item C-SSRS screener (items 1–5 for ideation, item 6 for behavior) and derive a suicide-risk-level Observation."
* purpose = "Rapidly screen for suicide ideation and behavior at the Identify Possible Risk stage."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "C-SSRS Screener questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCSSRS


// ─── ActivityDefinition: C-SSRS Full ─────────────────────────

Instance: AdministerCSSRSFull
InstanceOf: ActivityDefinition
Title: "Administer C-SSRS Full (Lifetime/Recent)"
Description: "Capture the full Columbia Suicide Severity Rating Scale with both lifetime and recent ideation/behavior tracking, plus an intensity section, and derive a suicide-risk-level Observation."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSFull"
* name = "AdministerCSSRSFull"
* version = "0.1.0"
* title = "Administer C-SSRS Full (Lifetime/Recent)"
* status = #draft
* experimental = true
* publisher = "SPiER"
* description = "Capture the full C-SSRS instrument (ideation 1–5 with lifetime/recent dimensions, behavior with attempt subtypes, intensity section), and derive a suicide-risk-level Observation."
* purpose = "Clarify the nature, severity, and timing of suicide-related ideation and behavior. Used at the Clarify Risk stage following a positive screen."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "C-SSRS Full (Lifetime/Recent) questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/C-SSRS-Full-Lifetime-Recent|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCSSRS


// ─── ActivityDefinition: C-SSRS Since Last Visit / Since Last Contact ─
// Promoted out of pathway-tool-placeholders.fsh. The AD id and canonical
// URL are unchanged so the TL-019 catalog mapping and the clarify-risk
// stage PlanDefinition action stay stable. Reuses the shared
// SPiERCSSRSRiskLevel profile — the Since-Last-Visit version differs from
// the recent screener only in its administration reference period.

Instance: AdministerCSSRSSinceLastContact
InstanceOf: ActivityDefinition
Title: "Administer C-SSRS Since Last Visit / Since Last Contact"
Description: "Capture a C-SSRS Since Last Visit / Since Last Contact screen (the 6-item set framed to the interval since the patient's prior contact) and derive a suicide-risk-level Observation conformant to the shared SPiER C-SSRS Risk Level profile."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSSinceLastContact"
* name = "AdministerCSSRSSinceLastContact"
* version = "1.0.0"
* title = "Administer C-SSRS Since Last Visit / Since Last Contact"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Capture the C-SSRS Since Last Visit / Since Last Contact version — the same 6-item C-SSRS assessment scoped to the interval since the patient's prior contact — and derive a suicide-risk-level Observation conformant to the shared SPiER C-SSRS Risk Level profile."
* purpose = "Reassess suicide risk over the interval since the patient's prior contact and update the current risk workflow. Belongs to the Clarify Risk stage as a repeat assessment."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "C-SSRS Since Last Visit / Since Last Contact questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/C-SSRS-Since-Last-Contact|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCSSRS


// ─── ActivityDefinition: C-SSRS Pediatric / Adolescent ───────
// Promoted out of pathway-tool-placeholders.fsh. The AD id and canonical
// URL are unchanged so the TL-027 catalog mapping and the
// identify-possible-risk stage PlanDefinition action stay stable. Reuses
// the shared SPiERCSSRSRiskLevel profile. This encoding uses the validated
// screener wording targeted at pediatric/adolescent settings; the Columbia
// Children's-version younger-child wording is a pending licensing gate
// (see FHIR-Resources/C-SSRS/licensing/MEMO.md).

Instance: AdministerCSSRSPediatric
InstanceOf: ActivityDefinition
Title: "Administer C-SSRS Pediatric / Adolescent Version"
Description: "Capture a C-SSRS screener for pediatric/adolescent patients and derive a suicide-risk-level Observation conformant to the shared SPiER C-SSRS Risk Level profile."
Usage: #definition
* url = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSPediatric"
* name = "AdministerCSSRSPediatric"
* version = "1.0.0"
* title = "Administer C-SSRS Pediatric / Adolescent Version"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Capture a C-SSRS screener for pediatric and adolescent patients (validated screener item set) and derive a suicide-risk-level Observation conformant to the shared SPiER C-SSRS Risk Level profile."
* purpose = "Screen pediatric and adolescent patients for suicide risk at the Identify Possible Risk stage. For youth, involve a parent/guardian per protocol."
* kind = #ServiceRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
* code = http://loinc.org#93374-7 "Suicide risk level"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].display = "C-SSRS Pediatric / Adolescent questionnaire"
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Questionnaire/C-SSRS-Pediatric|1.0.0"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingCSSRS


// ─── Examples ────────────────────────────────────────────────

Instance: ExampleCSSRSScreenerHighRisk
InstanceOf: SPiERCSSRSRiskLevel
Title: "Example — C-SSRS Screener: High Risk"
Description: "Sample risk-level Observation from a C-SSRS screener with item 5 (active ideation with specific plan and intent) endorsed."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T11:00:00Z"
// Dual-coded: SPiER-local tier + matching LOINC answer (LL465-6) for HL7 interop.
* valueCodeableConcept.coding[0] = CSSRSRiskLevelCodes#high "High"
* valueCodeableConcept.coding[1] = http://loinc.org#LA9193-9 "High"
* valueCodeableConcept.text = "High Risk — specific plan with intent"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#H "High"


Instance: ExampleCSSRSFullModerateRisk
InstanceOf: SPiERCSSRSRiskLevel
Title: "Example — C-SSRS Full: Moderate Risk"
Description: "Sample risk-level Observation from a full C-SSRS with item 3 (active ideation with methods, no intent) endorsed in the recent timeframe."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T11:15:00Z"
// Dual-coded: SPiER-local tier + matching LOINC answer (LL465-6) for HL7 interop.
* valueCodeableConcept.coding[0] = CSSRSRiskLevelCodes#moderate "Moderate"
* valueCodeableConcept.coding[1] = http://loinc.org#LA6751-7 "Moderate"
* valueCodeableConcept.text = "Moderate Risk — ideation with method, no intent"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#A "Abnormal"


Instance: ExampleCSSRSScreenerResponse
InstanceOf: QuestionnaireResponse
Title: "Example — C-SSRS Screener QuestionnaireResponse (high risk)"
Description: "Source C-SSRS Screener QuestionnaireResponse with high-risk ideation endorsed. The derived SPiERCSSRSRiskLevel and the harmonized concept Observation reference this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener"
* subject = Reference(Patient/example)
* authored = "2026-03-19T11:00:00Z"
// Nesting mirrors the Questionnaire (ideation-section > q1–q5,
// behavior-section > q6, then risk-level at the root), and every `required`
// item carries an answer — both checked by `node scripts/validate-fhir.mjs`.
* item[+].linkId = "ideation-section"
* item[=].item[+].linkId = "q1"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q2"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q3"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q4"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q5"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[+].linkId = "behavior-section"
* item[=].item[+].linkId = "q6"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "risk-level"
* item[=].answer.valueCoding = CSSRSRiskLevelCodes#high "High Risk"


Instance: ExampleCSSRSSinceLastContactModerateRisk
InstanceOf: SPiERCSSRSRiskLevel
Title: "Example — C-SSRS Since Last Visit: Moderate Risk"
Description: "Sample risk-level Observation from a C-SSRS Since Last Visit assessment with item 3 (active ideation with methods, no intent) endorsed over the interval since the prior contact."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T12:00:00Z"
* derivedFrom[+] = Reference(ExampleCSSRSSinceLastContactResponse)
// Dual-coded: SPiER-local tier + matching LOINC answer (LL465-6) for HL7 interop.
* valueCodeableConcept.coding[0] = CSSRSRiskLevelCodes#moderate "Moderate"
* valueCodeableConcept.coding[1] = http://loinc.org#LA6751-7 "Moderate"
* valueCodeableConcept.text = "Moderate Risk — ideation with method, no intent (since last visit)"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#A "Abnormal"


Instance: ExampleCSSRSSinceLastContactResponse
InstanceOf: QuestionnaireResponse
Title: "Example — C-SSRS Since Last Visit QuestionnaireResponse (moderate risk)"
Description: "Source C-SSRS Since Last Visit QuestionnaireResponse: active suicidal thoughts (q2) with a method (q3) endorsed over the interval, no intent. The derived SPiERCSSRSRiskLevel references this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://thespierproject.org/fhir/Questionnaire/C-SSRS-Since-Last-Contact"
* subject = Reference(Patient/example)
* authored = "2026-07-15T12:00:00Z"
* item[+].linkId = "ideation-section"
* item[=].item[+].linkId = "q1"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[=].item[+].linkId = "q2"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q3"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q4"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[=].item[+].linkId = "q5"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "behavior-section"
* item[=].item[+].linkId = "q6"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "risk-level"
* item[=].answer.valueCoding = CSSRSRiskLevelCodes#moderate "Moderate Risk"


Instance: ExampleCSSRSPediatricLowRisk
InstanceOf: SPiERCSSRSRiskLevel
Title: "Example — C-SSRS Pediatric: Low Risk"
Description: "Sample risk-level Observation from a pediatric/adolescent C-SSRS screener with only item 1 (wish to be dead) endorsed."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-07-15T13:30:00Z"
* derivedFrom[+] = Reference(ExampleCSSRSPediatricResponse)
// Dual-coded: SPiER-local tier + matching LOINC answer (LL465-6) for HL7 interop.
* valueCodeableConcept.coding[0] = CSSRSRiskLevelCodes#low "Low"
* valueCodeableConcept.coding[1] = http://loinc.org#LA9194-7 "Low"
* valueCodeableConcept.text = "Low Risk — wish to be dead (pediatric/adolescent)"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#L "Low"


Instance: ExampleCSSRSPediatricResponse
InstanceOf: QuestionnaireResponse
Title: "Example — C-SSRS Pediatric QuestionnaireResponse (low risk)"
Description: "Source pediatric/adolescent C-SSRS Screener QuestionnaireResponse: wish to be dead (q1) endorsed, no active thoughts. The derived SPiERCSSRSRiskLevel references this via Observation.derivedFrom."
Usage: #example
* status = #completed
* questionnaire = "http://thespierproject.org/fhir/Questionnaire/C-SSRS-Pediatric"
* subject = Reference(Patient/example)
* authored = "2026-07-15T13:30:00Z"
* item[+].linkId = "ideation-section"
* item[=].item[+].linkId = "q1"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373066001 "Yes"
* item[=].item[+].linkId = "q2"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
// q3–q5 are gated `enableWhen q2 = Yes`. Answering a disabled item is itself a
// conformance error, so a negative q2 correctly ends the ideation branch here —
// which is also why q3–q5 being `required` does not apply.
* item[+].linkId = "behavior-section"
* item[=].item[+].linkId = "q6"
* item[=].item[=].answer.valueCoding = http://snomed.info/sct#373067005 "No"
* item[+].linkId = "risk-level"
* item[=].answer.valueCoding = CSSRSRiskLevelCodes#low "Low Risk"
