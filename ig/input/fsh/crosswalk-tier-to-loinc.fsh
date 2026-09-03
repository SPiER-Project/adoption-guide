// Crosswalk — SPiER suicide-risk tier → LOINC "Suicide risk level"
//
// Egress map: the instrument-agnostic SPiER tier (concept-layer.fsh) INTO the
// normative LOINC answer list LL465-6 for 93374-7.
//
// The rationale a reader needs is PUBLISHED, not here — Description and
// ^purpose below, and conformance.md's "Egress: harmonized tier → LOINC",
// which states both lossy steps and what a consumer should do about them.
//
// ⚠️ The imminent → High collapse is a clinical-equivalence claim, not a
// terminology fact, and no SME has signed it off. Same boundary as
// crosswalk-cssrs.fsh. Do not promote either past #draft without that review.

Instance: SPiERRiskTierToLOINC
InstanceOf: ConceptMap
Title: "SPiER Suicide Risk Tier → LOINC Suicide Risk Level"
Description: "Maps the instrument-agnostic SPiER suicide-risk tiers (no-risk/low/moderate/high/imminent) onto the normative LOINC answer list LL465-6 (Low/Moderate/High) for LOINC 93374-7 'Suicide risk level', so consumers expecting the LOINC-coded value — e.g. the HL7 US Behavioral Health Profiles IG — can interpret a SPiER harmonized concept. `no-risk` has no LOINC equivalent and is omitted; `imminent` maps to the wider LOINC High. Proposed crosswalk pending clinical sign-off (epic #77)."
Usage: #definition
* url = "http://thespierproject.org/fhir/ConceptMap/SPiERRiskTierToLOINC"
* version = "0.1.0"
* name = "SPiERRiskTierToLOINC"
* status = #draft
* experimental = true
* publisher = "SPiER"
* purpose = "Translate the instrument-agnostic SPiER suicide-risk tier into the LOINC 93374-7 answer list so HL7-aligned partner systems can consume the harmonized concept value natively. Two tiers do not survive the trip, and both are deliberate rather than incomplete: `imminent` maps to the wider LOINC `High`, which subsumes it, because LL465-6 publishes no distinct imminent answer; and `no-risk` is omitted entirely, because the list begins at `Low` and forcing a negative screen onto `Low` would fabricate a positive one. A consumer that needs either distinction should read the SPiER-local tier alongside the LOINC value."
* sourceCanonical = "http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs"
* targetCanonical = "http://loinc.org/vs/LL465-6"

* group[0].source = "http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier"
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

// `no-risk` is intentionally NOT mapped — see ^purpose above for why. A future
// editor adding a target here is undoing a decision, not filling a gap.
