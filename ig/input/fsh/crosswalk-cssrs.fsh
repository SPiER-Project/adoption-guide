// =============================================================
// Crosswalk — C-SSRS risk level → common suicide-risk tier
// =============================================================
// ConceptMap from the SPiER-local C-SSRS risk-level codes
// (cssrs-risk-level: none/low/moderate/high) INTO the common,
// instrument-agnostic suicide-risk-tier vocabulary (concept-layer.fsh).
// Shared by both the C-SSRS Screener and the full C-SSRS assessment,
// which both derive the same SPiERCSSRSRiskLevel Observation.
//
// C-SSRS is higher-fidelity than the ASQ, and its native tiers align
// closely with the common tiers by name and meaning — so most rows are
// `equivalent`. Note the common set has a fifth tier, `imminent`, that
// the C-SSRS risk level does NOT itself produce: C-SSRS tops out at
// `high` (plan + intent, and/or behavior). Escalation to `imminent`
// (active intent + means right now) is a clinical judgment not encoded
// in the C-SSRS risk tier, so no source code maps to `imminent` here.
//
// !! PENDING CLINICAL SIGN-OFF !! Every row is a clinical-equivalence
// claim and must be reviewed by an SME (epic #77). The high → high row
// is marked `relatedto` precisely because the high/imminent boundary is
// a clinical decision the C-SSRS tier alone cannot make.
// =============================================================

Instance: CSSRSRiskLevelToRiskTier
InstanceOf: ConceptMap
Title: "C-SSRS Risk Level → SPiER Suicide Risk Tier"
Description: "Maps the four C-SSRS derived risk levels (none/low/moderate/high) to the common SPiER suicide-risk tiers. Proposed crosswalk pending clinical sign-off (epic #77)."
Usage: #definition
* url = "http://spier.org/ConceptMap/CSSRSRiskLevelToRiskTier"
* version = "0.1.0"
* name = "CSSRSRiskLevelToRiskTier"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* purpose = "Translate the SPiER-local C-SSRS risk-level vocabulary into the instrument-agnostic suicide-risk-tier ValueSet so partner systems can consume a C-SSRS result without understanding the C-SSRS."
* sourceCanonical = "http://spier.org/ValueSet/cssrs-risk-level"
* targetCanonical = "http://spier.org/ValueSet/spier-suicide-risk-tier-vs"

* group[0].source = "http://spier.org/CodeSystem/cssrs-risk-level"
* group[0].target = "http://spier.org/CodeSystem/spier-suicide-risk-tier"

* group[0].element[0].code = #none
* group[0].element[0].display = "None"
* group[0].element[0].target[0].code = #no-risk
* group[0].element[0].target[0].display = "No risk identified"
* group[0].element[0].target[0].equivalence = #equivalent
* group[0].element[0].target[0].comment = "No C-SSRS items endorsed."

* group[0].element[1].code = #low
* group[0].element[1].display = "Low"
* group[0].element[1].target[0].code = #low
* group[0].element[1].target[0].display = "Low risk"
* group[0].element[1].target[0].equivalence = #equivalent
* group[0].element[1].target[0].comment = "C-SSRS items 1–2 (wish to be dead / non-specific active ideation) without method, intent, plan, or behavior — matches the low tier definition."

* group[0].element[2].code = #moderate
* group[0].element[2].display = "Moderate"
* group[0].element[2].target[0].code = #moderate
* group[0].element[2].target[0].display = "Moderate risk"
* group[0].element[2].target[0].equivalence = #equivalent
* group[0].element[2].target[0].comment = "C-SSRS items 3–4 (active ideation with methods or some intent). SME to confirm equivalence to the moderate tier."

* group[0].element[3].code = #high
* group[0].element[3].display = "High"
* group[0].element[3].target[0].code = #high
* group[0].element[3].target[0].display = "High risk"
* group[0].element[3].target[0].equivalence = #relatedto
* group[0].element[3].target[0].comment = "C-SSRS item 5 (specific plan with intent) and/or item 6 (any behavior). Mapped to high; `relatedto` rather than `equivalent` because cases with active intent + means may warrant escalation to the `imminent` tier — a clinical judgment the C-SSRS risk level does not itself encode. PENDING SME sign-off on the high/imminent boundary."
