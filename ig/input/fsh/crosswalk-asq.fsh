// =============================================================
// Crosswalk — ASQ disposition → common suicide-risk tier
// =============================================================
// The declarative half of the ASQ harmonization (epic #77): a
// ConceptMap from the SPiER-local ASQ disposition codes
// (asq-screening-result) INTO the common, instrument-agnostic
// suicide-risk-tier vocabulary defined in concept-layer.fsh.
//
// This is the genuinely portable, balloteable "translation layer"
// between code sets. The resource-shaping half (QuestionnaireResponse
// / disposition Observation -> harmonized SPiERSuicideRiskConcept
// Observation) lives in the StructureMap draft at
// ig/drafts/ASQResultToSuicideRiskConcept.fml and applies THIS map.
//
// !! PENDING CLINICAL SIGN-OFF !!
// Every row below is a clinical-equivalence claim. The tier
// assignments are proposed from the ASQ's validated disposition
// definitions (see asq.fsh / FHIR-Resources/ASQ/README.md) but must
// be reviewed by a clinical SME before this map is treated as
// authoritative. Equivalence is marked conservatively (`relatedto`)
// for the positive tiers because a single ASQ disposition does not
// resolve finer severity.
// =============================================================

Instance: ASQDispositionToRiskTier
InstanceOf: ConceptMap
Title: "ASQ Disposition → SPiER Suicide Risk Tier"
Description: "Maps the three ASQ screening dispositions (negative / non-acute-positive / acute-positive) to the common SPiER suicide-risk tiers. Proposed crosswalk pending clinical sign-off (epic #77)."
Usage: #definition
* url = "http://spier.org/ConceptMap/ASQDispositionToRiskTier"
* version = "0.1.0"
* name = "ASQDispositionToRiskTier"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* purpose = "Translate the SPiER-local ASQ disposition vocabulary into the instrument-agnostic suicide-risk-tier ValueSet so partner systems can consume an ASQ result without understanding the ASQ."
* sourceCanonical = "http://spier.org/ValueSet/asq-result"
* targetCanonical = "http://spier.org/ValueSet/spier-suicide-risk-tier-vs"

* group[0].source = "http://spier.org/CodeSystem/asq-screening-result"
* group[0].target = "http://spier.org/CodeSystem/spier-suicide-risk-tier"

* group[0].element[0].code = #negative
* group[0].element[0].display = "Negative"
* group[0].element[0].target[0].code = #no-risk
* group[0].element[0].target[0].display = "No risk identified"
* group[0].element[0].target[0].equivalence = #equivalent
* group[0].element[0].target[0].comment = "All ASQ items 1–4 'no'; no screening signal. Maps cleanly to no-risk."

* group[0].element[1].code = #non-acute-positive
* group[0].element[1].display = "Non-Acute Positive"
* group[0].element[1].target[0].code = #moderate
* group[0].element[1].target[0].display = "Moderate risk"
* group[0].element[1].target[0].equivalence = #relatedto
* group[0].element[1].target[0].comment = "Any of items 1–4 'yes' AND item 5 'no' — ideation/history without acute features; brief safety assessment indicated. Mapped to moderate; relatedto rather than equivalent because the single ASQ disposition cannot distinguish low vs. moderate vs. high. PENDING SME sign-off."

* group[0].element[2].code = #acute-positive
* group[0].element[2].display = "Acute Positive"
* group[0].element[2].target[0].code = #imminent
* group[0].element[2].target[0].display = "Imminent risk"
* group[0].element[2].target[0].equivalence = #relatedto
* group[0].element[2].target[0].comment = "Item 5 'yes' — active suicidal ideation right now; do-not-leave-alone / emergency safety procedures. Mapped to imminent; SME to confirm whether some acute-positive cases belong in high rather than imminent. PENDING SME sign-off."
