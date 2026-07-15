// =============================================================
// Crosswalk — PSS-3 result → common suicide-risk tier
// =============================================================
// The declarative half of the PSS-3 harmonization: a ConceptMap
// from the SPiER-local PSS-3 result codes (pss3-result) INTO the
// common, instrument-agnostic suicide-risk-tier vocabulary defined
// in concept-layer.fsh. Modeled on crosswalk-asq.fsh.
//
// !! PENDING CLINICAL SIGN-OFF !!
// Every row below is a clinical-equivalence claim. The PSS-3 is a
// screen that does not stratify severity (its own tip sheet calls
// for a secondary stratification tool after a positive screen), so
// the positive tier is mapped conservatively (`relatedto`) to the
// widest defensible tier and must be reviewed by a clinical SME
// before this map is treated as authoritative.
// =============================================================

Instance: PSS3ResultToRiskTier
InstanceOf: ConceptMap
Title: "PSS-3 Result → SPiER Suicide Risk Tier"
Description: "Maps the two PSS-3 results (negative / positive) to the common SPiER suicide-risk tiers. Proposed crosswalk pending clinical sign-off."
Usage: #definition
* url = "http://spier.org/ConceptMap/PSS3ResultToRiskTier"
* version = "1.0.0"
* name = "PSS3ResultToRiskTier"
* status = #draft
* experimental = true
* publisher = "SPiER"
* purpose = "Translate the SPiER-local PSS-3 result vocabulary into the instrument-agnostic suicide-risk-tier ValueSet so partner systems can consume a PSS-3 result without understanding the PSS-3."
* sourceCanonical = "http://spier.org/ValueSet/pss3-result-vs"
* targetCanonical = "http://spier.org/ValueSet/spier-suicide-risk-tier-vs"

* group[0].source = "http://spier.org/CodeSystem/pss3-result"
* group[0].target = "http://spier.org/CodeSystem/spier-suicide-risk-tier"

* group[0].element[0].code = #negative
* group[0].element[0].display = "Negative Screen"
* group[0].element[0].target[0].code = #no-risk
* group[0].element[0].target[0].display = "No risk identified"
* group[0].element[0].target[0].equivalence = #equivalent
* group[0].element[0].target[0].comment = "No active ideation and no recent attempt; no screening signal. Maps cleanly to no-risk."

* group[0].element[1].code = #positive
* group[0].element[1].display = "Positive Screen"
* group[0].element[1].target[0].code = #moderate
* group[0].element[1].target[0].display = "Moderate risk"
* group[0].element[1].target[0].equivalence = #relatedto
* group[0].element[1].target[0].comment = "Active ideation in the past two weeks or a suicide attempt within ~6 months. Mapped to moderate; relatedto (wider) because the PSS-3 does not resolve low vs. moderate vs. high — a secondary stratifier is required. PENDING SME sign-off."
