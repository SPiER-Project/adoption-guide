// =============================================================
// Concept Layer — Cross-Instrument Suicide-Risk Harmonization
// =============================================================
// The instrument-agnostic representation every suicide-risk tool
// (ASQ, C-SSRS, PHQ-9 Item 9, SBQ-R, CAMS) maps INTO, so a partner
// system can act on a result without understanding the originating
// instrument. This is the "translation layer" the Big Sky Care
// Connect pilot requires, modeled on the HL7 Gravity Project and
// built on HL7 SDC extraction mechanics.
//
// Two-layer model: the instrument capture layer (per-tool LOINC/
// SNOMED, observationExtract) is preserved; the concept layer is
// DERIVED from it and linked back via Observation.derivedFrom.
//
// Conformance rules: see .claude/skills/concept-harmonization/ and
// docs/best-practices/concept-harmonization.md.
//
// DECISIONS BAKED IN HERE (epic #77):
//  - Interpretation uses POS/NEG (v3 ObservationInterpretation), the
//    Gravity/SDOH-aligned choice, NOT the A/N currently used by the
//    instrument mappers. Settling on POS/NEG is the harmonization
//    decision; instrument-layer examples (e.g. phq9.fsh) will migrate.
//  - The harmonized concept rides on the GENERIC LOINC 93374-7
//    ("Suicide risk level"), never an instrument item code.
//
// PENDING CLINICAL SIGN-OFF: every instrument-result -> tier crosswalk
// (the ConceptMap/StructureMap per instrument, child tasks of #77) is
// a clinical-equivalence claim and must be reviewed by an SME. The
// example below is illustrative only.
// =============================================================


// --- Common risk-tier vocabulary -----------------------------------

CodeSystem: SPiERSuicideRiskTier
Id: spier-suicide-risk-tier
Title: "SPiER Suicide Risk Tier"
Description: "Instrument-agnostic suicide-risk severity tiers. Every SPiER screening/assessment instrument maps its native result or disposition into exactly this set, so downstream systems consume one common, ordered concept regardless of which tool was administered. Lower-fidelity instruments map to the widest defensible tier (recorded as a 'wider' equivalence in the per-instrument ConceptMap); the layer never fabricates precision the instrument cannot support."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #no-risk "No risk identified" "Screen negative; no suicidal ideation, behavior, or history endorsed. Clinical judgment can always override a negative screen."
* #low "Low risk" "Minimal indicators; passive ideation without intent, plan, or recent behavior."
* #moderate "Moderate risk" "Suicidal ideation or relevant history endorsed without acute features; brief suicide safety assessment indicated."
* #high "High risk" "Significant active ideation, intent, or recent behavior; full safety evaluation indicated."
* #imminent "Imminent risk" "Active suicidal ideation right now, or intent/plan with means; STAT/urgent safety evaluation required and the patient should not be left alone."

// SAFE-T asks the clinician to *assign* a tier rather than read one off a
// score, so its Questionnaire answerOptions restate the tier's defining
// features inline — the clinician is choosing between definitions, not labels.
// `Coding.display` must match the CodeSystem, so those long-form labels are
// registered here as designations.
* #low ^designation[+].language = #en
* #low ^designation[=].value = "Low — thoughts of death; no plan, intent, or behavior; manageable risk factors, strong protective factors"
* #moderate ^designation[+].language = #en
* #moderate ^designation[=].value = "Moderate — suicidal ideation with plan, but no intent or behavior; multiple risk factors, few protective factors"
* #high ^designation[+].language = #en
* #high ^designation[=].value = "High — suicidal ideation with plan, method, and intent to carry out; severe symptoms or acute precipitating event"


ValueSet: SPiERSuicideRiskTierVS
Id: spier-suicide-risk-tier-vs
Title: "SPiER Suicide Risk Tier Value Set"
Description: "The bindable set of instrument-agnostic suicide-risk tiers. Bound (required) to the value of the SPiER Suicide Risk Concept Observation."
* ^status = #draft
* ^experimental = true
* include codes from system SPiERSuicideRiskTier


// --- Concept domain (category) -------------------------------------
// Gravity tags each harmonized Observation with a domain category so a
// consumer can filter "show me suicide-risk screens" across instruments.

CodeSystem: SPiERConceptDomain
Id: spier-concept-domain
Title: "SPiER Concept Domain"
Description: "Domain categories for SPiER harmonized concept Observations, used as Observation.category so consumers can query the concept layer by domain independent of the originating instrument."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #suicide-risk "Suicide risk" "The Observation expresses an instrument-agnostic suicide-risk concept. It indicates the domain addressed; it does not by itself confirm a clinical finding."


ValueSet: SPiERConceptDomainVS
Id: spier-concept-domain-vs
Title: "SPiER Concept Domain Value Set"
Description: "Bindable set of SPiER concept-domain categories."
* ^status = #draft
* ^experimental = true
* include codes from system SPiERConceptDomain


// --- The domain category, as a reusable rule (#262) -----------------
//
// Gravity's leverage does not come from having a domain list. It comes from
// the SAME domain code riding on `.category` of every resource in the chain,
// so a consumer can ask each resource type the same question and assemble the
// whole record without understanding which instrument produced any of it.
//
// SPiER defined the domain here and then applied it in exactly one place — the
// harmonized concept Observation below — so a domain query returned concept
// Observations and nothing else: not the safety plan, not the driver
// Conditions, not the referral, not the caring contact.
//
// This RuleSet is that slice, written once. It is inserted by every profile
// whose resource type has a native `category` element. Repeating the block per
// profile would have been ~28 copies of a discriminator that must stay
// identical to be queryable at all, which is the kind of duplication that
// drifts silently — the same failure this epic keeps finding.
//
// Shape notes, all deliberate:
//  * `#pattern` discriminator on `$this`, slicing `#open` — the US Core vitals
//    idiom, already used by SPiERSuicideRiskConcept. Open slicing is what lets
//    standard categories (`survey`, `encounter-diagnosis`, a LOINC document
//    type) sit alongside the domain code instead of competing with it. A
//    blanket extensible binding on the whole array would raise validator
//    warnings for exactly those legitimate neighbours.
//  * `1..1` on the slice, not `0..1`. An optional domain tag answers "some of
//    the record, sometimes", which is not a queryable guarantee — a consumer
//    could not tell a missing tag from an absent resource.
//  * The rule is ADDITIVE. No profile loses a category it already had, and the
//    pathway-stage `meta.tag` is untouched. The two axes are orthogonal on
//    purpose: stage says where in the pathway, domain says what it is about.
// Split in two so a profile that ALREADY slices `category` can take the slice
// without re-declaring the slicing — re-declaring would either duplicate the
// discriminator or fight the existing one. SPiERInformationSharingConsent is
// that case: it slices category for its own consent-category code, so it
// inserts only the second half.
RuleSet: SuicideRiskDomainSlicing
* category 1..*
* category ^slicing.discriminator.type = #pattern
* category ^slicing.discriminator.path = "$this"
* category ^slicing.rules = #open
* category ^slicing.description = "Open slicing so resource-specific categories coexist with the SPiER concept-domain tag."

RuleSet: SuicideRiskDomainSlice
* category contains suicideRisk 1..1
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* category[suicideRisk] ^short = "SPiER concept domain — suicide risk"
* category[suicideRisk] ^definition = "Marks this resource as part of the suicide-safer care record, so a consumer can retrieve the whole chain by domain without knowing which instrument or workflow step produced it. Screening-level: it indicates the domain addressed, not a confirmed clinical finding."

// The common case — a profile whose `category` is not yet sliced.
RuleSet: SuicideRiskDomainCategory
* insert SuicideRiskDomainSlicing
* insert SuicideRiskDomainSlice

// EXPECTED SUSHI WARNINGS, so the next reader does not "fix" them.
//
// Slicing `category` makes SUSHI advise slice names for every rule that reaches
// the element by numeric index — so each example Instance that sets its own
// category (`* category[+] = …#survey`) now emits:
//
//   Sliced element Observation.category is being accessed via numeric index.
//
// Those entries are the UNSLICED neighbours the open slicing exists to permit;
// they have no slice name because they are deliberately not slices. The warning
// is advisory and the resources validate cleanly — `validate-fhir.mjs` reports
// 0 errors across all 353.
//
// The way to silence it would be to declare a named slice for every standard
// category too (a `survey` slice on each Observation profile, and so on). That
// is a real option, but it means constraining ~28 profiles further in order to
// quiet a linter rather than because the constraint is wanted — and it would
// pin instances to one standard category each, which several do not have. If a
// future change wants those slices for their own sake, add them; do not add
// them for the warning count.


// --- Harmonized concept Observation profile ------------------------

Profile: SPiERSuicideRiskConcept
Parent: Observation
Id: spier-suicide-risk-concept
Title: "SPiER Suicide Risk Concept Observation"
Description: "The instrument-agnostic, actionable suicide-risk concept derived from a completed screening/assessment. Carries the generic LOINC 93374-7 ('Suicide risk level'), a common risk-tier value, a universal interpretation flag, a domain category, and a derivedFrom link back to the source QuestionnaireResponse (and/or instrument-specific Observations). This is a screening-level, UNCONFIRMED concept that flags a need for follow-up — it does not confirm a diagnosis and should be verified by a care team member."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
// Generic concept code — NOT an instrument item code.
* code = http://loinc.org#93374-7
// Require a suicide-risk domain category (Gravity pattern). The slice itself
// now lives in the SuicideRiskDomainCategory RuleSet above, shared with every
// other profile in the chain — see #262. This profile is where the pattern
// started; it is no longer the only place it applies.
* insert SuicideRiskDomainCategory
// Value is the common, ordered risk tier.
* value[x] 1..1
* value[x] only CodeableConcept
* value[x] from SPiERSuicideRiskTierVS (required)
// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS
* interpretation MS
* category[suicideRisk] MS
* derivedFrom MS
// Universal actionable flag — POS/NEG (see header decision).
* interpretation 1..1
* interpretation from http://hl7.org/fhir/ValueSet/observation-interpretation (extensible)
// Provenance is mandatory: the concept is derived, never freestanding.
* derivedFrom 1..*
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period


// --- Illustrative example (PENDING CLINICAL SIGN-OFF) --------------
// A non-acute positive ASQ screen harmonized to the moderate tier.
// ASQ produces only 3 dispositions, so this is a 'wider' (lossy)
// mapping — ASQ cannot resolve low vs. moderate vs. high. The real
// ASQ -> tier crosswalk is a child task of #77 and needs SME review.

Instance: ExampleSuicideRiskConceptFromASQ
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from a non-acute positive ASQ"
Description: "Illustrative harmonized concept Observation: a non-acute positive ASQ screen mapped to the moderate tier, derived from the ASQ result Observation. Crosswalk pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-06-05T14:20:00Z"
* derivedFrom[+] = Reference(ExampleASQResultNonAcutePositive)
* valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"
* interpretation[=].text = "Non-acute positive ASQ screen mapped to the moderate tier (wider — ASQ cannot resolve finer severity). Illustrative; pending clinical sign-off."


Instance: ExampleSuicideRiskConceptFromCSSRS
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from a high-risk C-SSRS"
Description: "Harmonized concept Observation: a high-risk C-SSRS screener mapped to the high tier, derived from the C-SSRS risk-level Observation. Illustrative; pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T11:00:00Z"
* derivedFrom[+] = Reference(ExampleCSSRSScreenerHighRisk)
* valueCodeableConcept = SPiERSuicideRiskTier#high "High risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"


Instance: ExampleSuicideRiskConceptFromPHQ9
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from PHQ-9 Item 9"
Description: "Harmonized concept Observation: a PHQ-9 Item 9 score of 2 mapped to the moderate tier, derived from the PHQ-9 Item 9 Observation. Illustrative; pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:30:00Z"
* derivedFrom[+] = Reference(ExamplePHQ9Item9Positive)
* valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"


Instance: ExampleSuicideRiskConceptFromSBQR
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from SBQ-R"
Description: "Harmonized concept Observation: an SBQ-R total of 9 (above the inpatient cutoff) mapped to the high tier, derived from the SBQ-R total-score Observation. Illustrative; pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:45:00Z"
* derivedFrom[+] = Reference(ExampleSBQRTotalScore9)
* valueCodeableConcept = SPiERSuicideRiskTier#high "High risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"
