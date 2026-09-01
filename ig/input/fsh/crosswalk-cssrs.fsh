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
// The native C-SSRS levels themselves are assigned by the published
// C-SSRS Screener with Triage Points, whose item→level ladder was
// verified against two published sources (CMS-hosted 2008 "Screen
// Version — Recent" and the Columbia Lighthouse Project's 2026 "Screen
// with Triage Points for Primary Care", which agree item-for-item):
//
//   items 1–2                        → low
//   item 3                           → moderate
//   items 4–5                        → high
//   item 6 behavior, past 3 months   → high
//   item 6 behavior, lifetime-only   → moderate
//
// Record: docs/reference/suicide-safer-care-pathway-spec.md
// §"Published-instrument verification (Phase 1b)". The per-element
// comments below restate that ladder; they described item 4 as moderate
// and item 6 as high-regardless-of-recency until the mapper alignment
// (docs/plans/suicide-safer-care-pathway.md Phase 1c) corrected both.
//
// !! CLINICAL REVIEW OWED !! The item→level ladder is verified against
// the published instrument, and clinical review of it is retrospective
// rather than blocking (decision recorded 2026-09-01; these tools are
// not in production). That is NOT sign-off on the rows below: every row
// here is a separate clinical-equivalence claim — native C-SSRS level to
// SPiER tier — and still needs SME review (epic #77). The high → high row
// is marked `relatedto` precisely because the high/imminent boundary is
// a clinical decision the C-SSRS tier alone cannot make.
// =============================================================

Instance: CSSRSRiskLevelToRiskTier
InstanceOf: ConceptMap
Title: "C-SSRS Risk Level → SPiER Suicide Risk Tier"
Description: "Maps the four C-SSRS derived risk levels (none/low/moderate/high) to the common SPiER suicide-risk tiers. Proposed crosswalk pending clinical sign-off (epic #77)."
Usage: #definition
* url = "http://thespierproject.org/fhir/ConceptMap/CSSRSRiskLevelToRiskTier"
* version = "0.1.0"
* name = "CSSRSRiskLevelToRiskTier"
* status = #draft
* experimental = true
* publisher = "SPiER"
* purpose = "Translate the SPiER-local C-SSRS risk-level vocabulary into the instrument-agnostic suicide-risk-tier ValueSet so partner systems can consume a C-SSRS result without understanding the C-SSRS."
* sourceCanonical = "http://thespierproject.org/fhir/ValueSet/cssrs-risk-level"
* targetCanonical = "http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs"

* group[0].source = "http://thespierproject.org/fhir/CodeSystem/cssrs-risk-level"
* group[0].target = "http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier"

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
* group[0].element[2].target[0].comment = "C-SSRS item 3 (active ideation with a method, no intent), or item 6 suicidal behavior that is lifetime-only — i.e. not within the past three months. Both sit in the published instrument's orange band; verified in docs/reference/suicide-safer-care-pathway-spec.md §Phase 1b. SME to confirm equivalence to the moderate tier."

* group[0].element[3].code = #high
* group[0].element[3].display = "High"
* group[0].element[3].target[0].code = #high
* group[0].element[3].target[0].display = "High risk"
* group[0].element[3].target[0].equivalence = #relatedto
* group[0].element[3].target[0].comment = "C-SSRS item 4 (some intent to act) or item 5 (specific plan with intent), and/or item 6 suicidal behavior within the past three months. Items 4, 5 and recent-6 are the published instrument's red band; lifetime-only behavior is NOT high (it maps to moderate above) — verified in docs/reference/suicide-safer-care-pathway-spec.md §Phase 1b. Mapped to high; `relatedto` rather than `equivalent` because cases with active intent + means may warrant escalation to the `imminent` tier — a clinical judgment the C-SSRS risk level does not itself encode. PENDING SME sign-off on the high/imminent boundary."
