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
// Domain category for cross-instrument filtering (Gravity pattern).
* category 1..*
* category.coding 1..*
* category from SPiERConceptDomainVS (extensible)
// Value is the common, ordered risk tier.
* value[x] 1..1
* value[x] only CodeableConcept
* value[x] from SPiERSuicideRiskTierVS (required)
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
Description: "Illustrative harmonized concept Observation: a non-acute positive ASQ screen mapped to the moderate tier, derived from the source ASQ QuestionnaireResponse. Crosswalk pending clinical sign-off."
Usage: #example
* status = #final
* category[+] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* category[+] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-06-05T14:20:00Z"
* derivedFrom = Reference(QuestionnaireResponse/asq-example)
* valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"
* interpretation[=].text = "Non-acute positive ASQ screen mapped to the moderate tier (wider — ASQ cannot resolve finer severity). Illustrative; pending clinical sign-off."
