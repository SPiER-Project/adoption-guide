// =============================================================
// Crosswalk — SPiER suicide-risk tier → LOINC "Suicide risk level"
// =============================================================
// ConceptMap from the instrument-agnostic SPiER suicide-risk tier
// (concept-layer.fsh: no-risk/low/moderate/high/imminent) INTO the
// normative LOINC answer list for 93374-7 "Suicide risk level"
// (LL465-6: Low / Moderate / High).
//
// WHY THIS EXISTS: LOINC 93374-7 carries a coded answer list, and the
// HL7 US Behavioral Health Profiles IG populates that code with these
// LOINC answers. SPiER's tier set is finer-grained (it adds `no-risk`
// at the bottom and `imminent` at the top), so a consumer that only
// understands the LOINC list needs this map to interpret a SPiER tier.
//
// SHAPE OF THE MAPPING (3 LOINC values vs. 5 SPiER tiers):
//  - low / moderate / high       -> equivalent (names + meaning align)
//  - imminent                    -> High (`wider`: LOINC High subsumes
//                                    the imminent case; LOINC has no
//                                    distinct "imminent" answer)
//  - no-risk                     -> NO LOINC TARGET. The LOINC list
//                                    begins at Low; there is no "none"
//                                    answer, so `no-risk` is intentionally
//                                    omitted rather than forced onto Low.
//
// !! PENDING CLINICAL SIGN-OFF !! The imminent -> High collapse is a
// clinical-equivalence claim (the high/imminent boundary is the same one
// flagged in crosswalk-cssrs.fsh) and must be reviewed by an SME (epic #77).
// =============================================================

Instance: SPiERRiskTierToLOINC
InstanceOf: ConceptMap
Title: "SPiER Suicide Risk Tier → LOINC Suicide Risk Level"
Description: "Maps the instrument-agnostic SPiER suicide-risk tiers (no-risk/low/moderate/high/imminent) onto the normative LOINC answer list LL465-6 (Low/Moderate/High) for LOINC 93374-7 'Suicide risk level', so consumers expecting the LOINC-coded value — e.g. the HL7 US Behavioral Health Profiles IG — can interpret a SPiER harmonized concept. `no-risk` has no LOINC equivalent and is omitted; `imminent` maps to the wider LOINC High. Proposed crosswalk pending clinical sign-off (epic #77)."
Usage: #definition
* url = "http://spier.org/ConceptMap/SPiERRiskTierToLOINC"
* version = "0.1.0"
* name = "SPiERRiskTierToLOINC"
* status = #draft
* experimental = true
* publisher = "SPiER"
* purpose = "Translate the instrument-agnostic SPiER suicide-risk tier into the LOINC 93374-7 answer list so HL7-aligned partner systems can consume the harmonized concept value natively."
* sourceCanonical = "http://spier.org/ValueSet/spier-suicide-risk-tier-vs"
* targetCanonical = "http://loinc.org/vs/LL465-6"

* group[0].source = "http://spier.org/CodeSystem/spier-suicide-risk-tier"
* group[0].target = "http://loinc.org"

* group[0].element[0].code = #low
* group[0].element[0].display = "Low risk"
* group[0].element[0].target[0].code = #LA9194-7
* group[0].element[0].target[0].display = "Low"
* group[0].element[0].target[0].equivalence = #equivalent

* group[0].element[1].code = #moderate
* group[0].element[1].display = "Moderate risk"
* group[0].element[1].target[0].code = #LA6751-7
* group[0].element[1].target[0].display = "Moderate"
* group[0].element[1].target[0].equivalence = #equivalent

* group[0].element[2].code = #high
* group[0].element[2].display = "High risk"
* group[0].element[2].target[0].code = #LA9193-9
* group[0].element[2].target[0].display = "High"
* group[0].element[2].target[0].equivalence = #equivalent

* group[0].element[3].code = #imminent
* group[0].element[3].display = "Imminent risk"
* group[0].element[3].target[0].code = #LA9193-9
* group[0].element[3].target[0].display = "High"
* group[0].element[3].target[0].equivalence = #wider
* group[0].element[3].target[0].comment = "LOINC has no distinct 'imminent' answer; mapped to the wider LOINC High, which subsumes the imminent case. The imminent/high boundary is a clinical judgment — PENDING SME sign-off (epic #77)."

// `no-risk` is intentionally NOT mapped: the LOINC LL465-6 answer list has
// no "none"/"no risk" value (it begins at Low). Forcing it onto Low would
// fabricate a positive screen, so it is omitted from this group.
