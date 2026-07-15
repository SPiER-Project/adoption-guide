// =============================================================
// Crosswalk — BSSA disposition → common suicide-risk tier
// =============================================================
// The declarative half of the BSSA harmonization: a ConceptMap
// from the SPiER-local BSSA disposition codes (bssa-disposition)
// INTO the common, instrument-agnostic suicide-risk-tier
// vocabulary defined in concept-layer.fsh. Modeled on
// crosswalk-asq.fsh.
//
// This is the genuinely portable, balloteable "translation layer"
// between code sets: a partner system can act on a BSSA disposition
// without understanding the BSSA.
//
// !! PENDING CLINICAL SIGN-OFF !!
// Every row below is a clinical-equivalence claim. The tier
// assignments are proposed from the BSSA's disposition definitions
// (see bssa.fsh / FHIR-Resources/BSSA/README.md) but must be
// reviewed by a clinical SME before this map is treated as
// authoritative. The positive tiers are marked conservatively
// (`relatedto`) because a single BSSA disposition does not resolve
// finer severity.
// =============================================================

Instance: BSSADispositionToRiskTier
InstanceOf: ConceptMap
Title: "BSSA Disposition → SPiER Suicide Risk Tier"
Description: "Maps the four BSSA dispositions (emergency psychiatric evaluation / further evaluation necessary / non-urgent follow-up / no intervention) to the common SPiER suicide-risk tiers. Proposed crosswalk pending clinical sign-off."
Usage: #definition
* url = "http://spier.org/ConceptMap/BSSADispositionToRiskTier"
* version = "1.0.0"
* name = "BSSADispositionToRiskTier"
* status = #draft
* experimental = true
* publisher = "SPiER"
* purpose = "Translate the SPiER-local BSSA disposition vocabulary into the instrument-agnostic suicide-risk-tier ValueSet so partner systems can consume a BSSA disposition without understanding the BSSA."
* sourceCanonical = "http://spier.org/ValueSet/bssa-disposition-vs"
* targetCanonical = "http://spier.org/ValueSet/spier-suicide-risk-tier-vs"

* group[0].source = "http://spier.org/CodeSystem/bssa-disposition"
* group[0].target = "http://spier.org/CodeSystem/spier-suicide-risk-tier"

* group[0].element[0].code = #emergency-psychiatric-evaluation
* group[0].element[0].display = "Emergency psychiatric evaluation"
* group[0].element[0].target[0].code = #imminent
* group[0].element[0].target[0].display = "Imminent risk"
* group[0].element[0].target[0].equivalence = #relatedto
* group[0].element[0].target[0].comment = "Imminent risk (current suicidal thoughts); send to ED, do not leave alone. Mapped to imminent; SME to confirm whether some cases belong in high rather than imminent. PENDING SME sign-off."

* group[0].element[1].code = #further-evaluation-necessary
* group[0].element[1].display = "Further evaluation of risk is necessary"
* group[0].element[1].target[0].code = #high
* group[0].element[1].target[0].display = "High risk"
* group[0].element[1].target[0].equivalence = #relatedto
* group[0].element[1].target[0].comment = "Elevated but not imminent; safety plan + mental health referral within ~72 hours. Mapped to high; relatedto because the single disposition cannot distinguish high from moderate. PENDING SME sign-off."

* group[0].element[2].code = #non-urgent-followup
* group[0].element[2].display = "Non-urgent mental health follow-up"
* group[0].element[2].target[0].code = #moderate
* group[0].element[2].target[0].display = "Moderate risk"
* group[0].element[2].target[0].equivalence = #relatedto
* group[0].element[2].target[0].comment = "May benefit from non-urgent follow-up; safety plan + referral. Mapped to moderate; SME to confirm whether some cases are low rather than moderate. PENDING SME sign-off."

* group[0].element[3].code = #no-intervention
* group[0].element[3].display = "No further intervention necessary at this time"
* group[0].element[3].target[0].code = #no-risk
* group[0].element[3].target[0].display = "No risk identified"
* group[0].element[3].target[0].equivalence = #equivalent
* group[0].element[3].target[0].comment = "No ongoing concern warranting further intervention. Maps cleanly to no-risk."
