// =============================================================
// Crosswalk — CAMS SSF Overall Risk → common suicide-risk tier
// =============================================================
// ConceptMap from the SPiER-local coded CAMS SSF Overall Risk rating
// (cams-ssf-overall-risk: 1–5) INTO the common, instrument-agnostic
// suicide-risk-tier vocabulary (concept-layer.fsh). The source is the
// patient's self-rated "Overall Risk of Suicide" (SSF rating 6), which
// CAMS Section A stores as a plain integer; the coded representation and
// this map mirror how crosswalk-cssrs.fsh sources its risk level.
//
// Unlike the C-SSRS and ASQ, CAMS is a COLLABORATIVE THERAPEUTIC PROCESS,
// not a predictive screener, and there is NO published psychometric
// stratification of the SSF Overall Risk rating (verified July 2026 —
// docs/research/2026-07-terminology-crosswalk-research.md). This map is
// therefore DECISION-SUPPORT GUIDANCE that a clinician can override, not
// an authoritative severity assignment. Every row is a `wider` (lossy)
// equivalence: a single self-rated 1–5 number is coarser than, and maps
// UP INTO, a broader tier band —
//   1–2 → low, 3 → moderate, 4–5 → high.
// No CAMS rating maps to `imminent`: escalation to the imminent tier
// (active intent + means right now, do-not-leave-alone) is a separate
// clinical triage decision the self-rated SSF number cannot make.
//
// !! PENDING CLINICAL SIGN-OFF !! Every row is a clinical-equivalence
// claim and must be reviewed by an SME (#93). The bands are proposed
// from the SSF Overall Risk anchors and align with the existing CAMS
// Section A runtime interpretation (≥4 high / 3 moderate / ≤2 low), but
// are not authoritative until sign-off.
// =============================================================

Instance: CAMSOverallRiskToRiskTier
InstanceOf: ConceptMap
Title: "CAMS SSF Overall Risk → SPiER Suicide Risk Tier"
Description: "Maps the CAMS SSF self-rated Overall Risk of Suicide rating (1–5) to the common SPiER suicide-risk tiers (1–2 → low, 3 → moderate, 4–5 → high). Decision-support guidance intended to be clinician-overridable: CAMS is a collaborative therapeutic process, not a predictive screener, and no published psychometric stratification of the SSF Overall Risk rating exists (verified July 2026). No rating maps to `imminent` — escalation to imminent risk requires separate clinical triage. Proposed crosswalk pending clinical sign-off (#93)."
Usage: #definition
* url = "http://spier.org/ConceptMap/CAMSOverallRiskToRiskTier"
* version = "0.1.0"
* name = "CAMSOverallRiskToRiskTier"
* status = #draft
* experimental = true
* publisher = "SPiER"
* purpose = "Translate the SPiER-local CAMS SSF Overall Risk rating into the instrument-agnostic suicide-risk-tier ValueSet so partner systems can consume a CAMS SSF self-rating without understanding CAMS — while preserving that the assignment is clinician-overridable decision support, not a predictive score."
* sourceCanonical = "http://spier.org/ValueSet/cams-ssf-overall-risk"
* targetCanonical = "http://spier.org/ValueSet/spier-suicide-risk-tier-vs"

* group[0].source = "http://spier.org/CodeSystem/cams-ssf-overall-risk"
* group[0].target = "http://spier.org/CodeSystem/spier-suicide-risk-tier"

* group[0].element[0].code = #1
* group[0].element[0].display = "1 — Extremely low risk"
* group[0].element[0].target[0].code = #low
* group[0].element[0].target[0].display = "Low risk"
* group[0].element[0].target[0].equivalence = #wider
* group[0].element[0].target[0].comment = "Lowest self-rated overall risk (extremely low; will not kill self). Mapped to the low tier; `wider` because a single 1–5 self-rating is coarser than the tier band and cannot resolve no-risk vs. low. PENDING SME sign-off; clinician-overridable."

* group[0].element[1].code = #2
* group[0].element[1].display = "2 — Low risk"
* group[0].element[1].target[0].code = #low
* group[0].element[1].target[0].display = "Low risk"
* group[0].element[1].target[0].equivalence = #wider
* group[0].element[1].target[0].comment = "Low self-rated overall risk. Mapped to the low tier; `wider` (lossy) because the self-rating cannot distinguish low from moderate features a clinician might elicit. PENDING SME sign-off; clinician-overridable."

* group[0].element[2].code = #3
* group[0].element[2].display = "3 — Moderate risk"
* group[0].element[2].target[0].code = #moderate
* group[0].element[2].target[0].display = "Moderate risk"
* group[0].element[2].target[0].equivalence = #wider
* group[0].element[2].target[0].comment = "Mid-scale self-rated overall risk. Mapped to the moderate tier; `wider` because the single self-rating is coarser than the tier band. Brief suicide safety assessment indicated. PENDING SME sign-off; clinician-overridable."

* group[0].element[3].code = #4
* group[0].element[3].display = "4 — High risk"
* group[0].element[3].target[0].code = #high
* group[0].element[3].target[0].display = "High risk"
* group[0].element[3].target[0].equivalence = #wider
* group[0].element[3].target[0].comment = "Elevated self-rated overall risk. Mapped to the high tier; `wider` (lossy). Deliberately NOT mapped to `imminent`: escalation requires separate clinical triage (active intent + means right now), which a self-rating alone cannot establish. PENDING SME sign-off; clinician-overridable."

* group[0].element[4].code = #5
* group[0].element[4].display = "5 — Extremely high risk"
* group[0].element[4].target[0].code = #high
* group[0].element[4].target[0].display = "High risk"
* group[0].element[4].target[0].equivalence = #wider
* group[0].element[4].target[0].comment = "Highest self-rated overall risk (extremely high; will kill self). Mapped to the high tier; `wider` (lossy). Deliberately NOT mapped to `imminent` — the highest SSF self-rating still routes escalation through a separate clinical triage decision, never automatically. PENDING SME sign-off; clinician-overridable."
