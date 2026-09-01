// =============================================================
// The Suicide Safer Care Pathway, as a published clinical protocol
// =============================================================
// Phase 2 of docs/plans/suicide-safer-care-pathway.md. The requirements source
// is the one-page *Suicide Safer Care Pathway* diagram, transcribed verbatim in
// docs/reference/suicide-safer-care-pathway-spec.md; every claim below traces
// to a section of that transcription.
//
// ─── What this artifact is, and what the stage PDs are ───────
//
// pathway-stages.fsh publishes eight PlanDefinitions, one per SPiER pathway
// stage, each a `#workflow-definition` cataloguing *what a stage can contain*.
// They are a menu. This one is a `#clinical-protocol`: a single ordered course
// of care — screen, gate, assess, branch by tier, act — that an organization
// adopts. The two are complementary, and the stage codes on the groups below
// are what ties this protocol back to that catalogue.
//
// ─── Transportability: coded by what it accomplishes ─────────
//
// Decision 4 of the plan. Each clinical step is named by what it accomplishes
// and gated on the harmonized concept layer (LOINC 93374-7 +
// SPiERSuicideRiskTier, concept-layer.fsh), not on an instrument. PHQ-9 and the
// C-SSRS Screener appear as `definitionCanonical` — the *demonstrated
// realization*, the pair this repo actually ships end to end — so a site that
// licenses a different instrument satisfies the same step by feeding the same
// concept. That rule is written onto each step as `action.documentation` rather
// than left to this comment, because a partner reads the artifact, not the FSH.
//
// ─── The cadence is REFERENCED, never restated ───────────────
//
// ⚠️ There is deliberately NO `timingDuration`, and no numeric interval of any
// kind, anywhere in this file. The reassessment cadence has exactly one home:
// PlanDefinition/SPiERReassessmentSchedule (risk-episode.fsh). It is already
// stated three times — the PlanDefinition, packages/core/src/lib/reassessment.ts,
// and the CQL's ReassessmentIntervalDays — and `npm run check:reassessment`
// exists to tie those three together. A fourth statement here is precisely the
// defect that gate is built against, so each tier group reaches the cadence by
// `definitionCanonical` instead. `npm run check:pathway` makes that mechanical.
//
// The same restraint applies to the diagram's *frequency of patient contact*
// row: the diagram states it separately from reassessment cadence, with values
// that coincide at Moderate and High but differ at Low and Historical (see the
// spec doc, "Frequency of patient contact"). Until the clinical team says
// whether that is one rule or two, encoding numbers here would either duplicate
// the reassessment cadence or invent a second one. The action below records the
// obligation and points at the spec; it publishes no interval.
//
// ─── Deliberately NOT encoded (open clinical questions) ──────
//
// The workbook's status-claim discipline (docs/use-cases/README.md) applied to
// a published protocol: this artifact must not encode what is not settled.
// Three things from the diagram are therefore absent, each blocked on an open
// question in docs/plans/suicide-safer-care-pathway.md:
//
//   1. STEP-DOWN CRITERIA (plan question 3). The diagram's Low/Moderate/High
//      reduction rules combine a "No"-streak, a milestone-event window, a
//      minimum time-in-tier and psychiatric-consultant agreement, and the
//      streak length is asymmetric (30 days at Low/Moderate, 90 at High) in a
//      way nobody has confirmed is intentional. Publishing it would tell a site
//      to de-escalate risk on an unreviewed rule.
//   2. MILESTONE EVENTS (same question). The diagram's list is explicitly
//      open-ended — "include, but are not limited to" — so there is no closed
//      vocabulary to publish, and a partial CodeSystem would read as complete.
//   3. THE HISTORICAL TIER / FLAG (plan question 2, shared with
//      docs/plans/suicide-care-dashboard.md Gap 3). SPiERSuicideRiskTier has no
//      `historical` code, and the Phase 1b verification found the published
//      C-SSRS scores that response pattern as *Moderate* — the diagram's fourth
//      tier is diagram-level structure the instrument does not assert. Whether
//      it is an orthogonal history flag rather than an ordinal tier is the open
//      question; the tier branch below therefore covers low / moderate / high
//      only, and `imminent` and `no-risk` stay out for the same reasons
//      risk-episode.fsh records for the reassessment schedule.
//
// The Care Pathway IG page (ig/input/pagecontent/care-pathway.md) states all
// three as pending, from page copy — not from this artifact.
// =============================================================


Instance: SPiERSuicideSaferCarePathway
InstanceOf: PlanDefinition
Title: "SPiER Suicide Safer Care Pathway"
Description: "The SPiER suicide-safer care clinical protocol: universal depression screening with a suicidality item, a positive-screen gate, a clarifying suicide-risk assessment, and the obligations that follow from the resulting risk tier."
Usage: #definition
* url = "http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway"
* name = "SPiERSuicideSaferCarePathway"
* version = "0.1.0"
* title = "SPiER Suicide Safer Care Pathway"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "One ordered course of suicide-safer care: screen every patient with an instrument carrying a suicidality item, proceed on a positive result, clarify the risk with a suicide-risk assessment, and then apply the obligations that the resulting harmonized risk tier carries — crisis resources at every tier, collaborative safety planning at moderate and high, and reassessment on the published per-tier cadence. Steps are coded by what they accomplish and gated on the instrument-agnostic concept layer, so a site using different instruments satisfies the same protocol; the PHQ-9 and C-SSRS Screener referenced here are the demonstrated realization, not the requirement."
* purpose = "Make an organization's suicide-safer care protocol machine-readable, so that the step a patient is owed can be derived from their record rather than remembered — and so that the same protocol can be rendered, evaluated by a CDS engine, and measured against the same published definition."
// A protocol, not a menu of stage capabilities — see the header. The stage PDs
// in pathway-stages.fsh are #workflow-definition; this one is the course of care
// that draws on them.
* type = http://terminology.hl7.org/CodeSystem/plan-definition-type#clinical-protocol
// No `useContext` focus: unlike the eight stage PlanDefinitions, this protocol
// spans stages. Which stage a step belongs to is carried per action group as an
// `action.code` on SPiERPathwayStage, and `npm run check:pathway` asserts every
// one of those resolves to the canonical stage list.

// ─── The diagram's KPIs, as published Measures ───────────────
//
// The spec doc's "Key Performance Indicators" section states exactly three. Two
// have a modeled Stage-8 Measure that answers the same question, and one is
// answered only in part — measure-and-share.fsh is the authority, and no
// Measure is invented here to make the list look complete. The IG page names
// the unmatched half explicitly rather than leaving it to be rediscovered.
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].label = "KPI 1"
* relatedArtifact[=].display = "Percentage of patients with a positive screen who receive a clarifying suicide-risk assessment. The diagram states this as PHQ-9 Q9 positive followed by the C-SSRS Screener; the Measure generalizes it to the pathway-stage tags, so substituting an instrument does not break the measurement."
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Measure/SPiERScreenToAssessment"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].label = "KPI 2 (in part)"
* relatedArtifact[=].display = "Percentage of patients with a positive assessment whose risk status is documented as discrete data. This Measure covers the risk-status half of the diagram's KPI 2; the problem-list half is not measured, because SPiER never writes a Condition from a screen and so has no numerator it can compute — see the Care Pathway page."
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Measure/SPiERRiskStatusDocumented"
* relatedArtifact[+].type = #depends-on
* relatedArtifact[=].label = "KPI 3 (in part)"
* relatedArtifact[=].display = "Percentage of patients whose safety plan is in place, and whose own copy is documented, at a care transition. The diagram's KPI 3 asks the question per risk tier and includes crisis resources; this Measure is transition-anchored and not tier-stratified, so it answers part of it — see the Care Pathway page."
* relatedArtifact[=].resource = "http://thespierproject.org/fhir/Measure/SPiERSafetyPlanBeforeDischarge"
// The Emotional Fire Safety Plan is a NowMattersNow patient-education artifact,
// not a SPiER tool. Plan question 5 is still open on whether SPiER keeps it,
// substitutes, or drops it; until then it is a documentation URL on the
// crisis-resources step below rather than an invented ActivityDefinition for an
// instrument this repo does not carry.


// ─── Step 1 — Screen (Identify Possible Risk) ────────────────

* action[+]
  * id = "screen"
  * title = "Screen for suicide risk"
  * description = "Administer a universal screen that carries a suicidality item, as part of ongoing depression screening."
  * code[+] = SPiERPathwayStage#identify-possible-risk "Identify Possible Risk"
  // The transportability rule, stated on the artifact rather than only in the
  // guide, because a partner reads the artifact.
  * documentation[+].type = #documentation
  * documentation[=].label = "Transportability"
  * documentation[=].display = "This step is satisfied by ANY instrument that feeds the SPiER concept layer — a suicide-risk result on LOINC 93374-7 valued from SPiERSuicideRiskTier, or a screen whose result crosswalks into it (ASQ, PSS-3, SBQ-R, the C-SSRS screener itself). The PHQ-9 named below is the realization SPiER demonstrates end to end, not the requirement."
  * documentation[=].resource = "http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs"
  // The diagram shows three parallel entry points feeding one gate. Only the
  // universal screen is a machine-detectable event, so the other two are
  // recorded here as documentation rather than dressed up as `trigger`s that no
  // engine could fire.
  * documentation[+].type = #documentation
  * documentation[=].label = "Entry events"
  * documentation[=].display = "The source diagram depicts three parallel entry points into this pathway: universal depression screening (this step); suicidal thoughts or behavior identified at ANY point in care; and initial contact with the patient. The latter two are clinician-initiated and carry no structured triggering event, so they are recorded as protocol rather than encoded as triggers — a clinician entering the pathway on either of them proceeds directly to the assessment step."
  * action[+]
    * id = "administer-phq9"
    * title = "Administer PHQ-9 (demonstrated realization)"
    * description = "Capture a PHQ-9 depression screen and derive its total-score and item-9 Observations. Item 9 is the suicidality item this pathway gates on."
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerPHQ9"


// ─── Step 2 — Positive-screen gate, then Assess (Clarify Risk) ───
//
// The gate and the assessment are ONE action rather than two: "if the screen is
// positive, assess" is a single conditional step, and splitting it would leave
// a gate action with nothing to do and an assess action with no condition.
//
// The FHIRPath is deliberately the exact shape SPiERClarifyRiskStage already
// publishes for the same question (pathway-stages.fsh, `on-phq9-item9-positive`)
// — a `%variable` bound by the action's own trigger, an `.exists()` guard, and a
// literal comparison. That expression compiles cleanly through the IG Publisher
// today, which is the only static analyser SPiER has for FHIRPath (#92), so
// reusing its shape is a deliberate risk reduction rather than a copy.
//
// Q9 ≥ 1 rather than > 0 spelled with a threshold: the spec doc's Notes record
// the diagram's own definition — "Negative response to PHQ-9, Q9 is defined as a
// score of 0. Positive is defined as score of 1-3."

* action[+]
  * id = "assess-risk"
  * title = "Assess suicide risk after a positive screen"
  * description = "When the screen is positive, administer a suicide-risk assessment that yields a harmonized risk tier."
  * code[+] = SPiERPathwayStage#clarify-risk "Clarify Risk"
  * trigger[+]
    * type = #data-added
    * name = "phq9Item9Observation"
    * data[+]
      * type = #Observation
      * profile[+] = "http://thespierproject.org/fhir/StructureDefinition/spier-phq9-item9"
      * codeFilter[+]
        * path = "code"
        * code = http://loinc.org#44260-8
  * condition[+]
    * kind = #applicability
    * expression.language = #text/fhirpath
    * expression.expression = "%phq9Item9Observation.value.exists() and %phq9Item9Observation.value >= 1"
  * documentation[+].type = #documentation
  * documentation[=].label = "Transportability"
  * documentation[=].display = "The gate is on a POSITIVE SCREEN, not on the PHQ-9. A site screening with a different instrument satisfies this step when that instrument's result crosswalks to a SPiERSuicideRiskTier above no-risk; the PHQ-9 item-9 condition below is the demonstrated realization of that gate."
  * documentation[+].type = #documentation
  * documentation[=].label = "Negative screen"
  * documentation[=].display = "A PHQ-9 item-9 score of 0 is a negative screen and the patient does not proceed. Clinical judgment always overrides a negative screen — the diagram's gate reads \"or with clinical judgement\", and either of the two unencoded entry events reaches this step without a screen at all."
  * documentation[+].type = #documentation
  * documentation[=].label = "Negative assessment exits the pathway"
  * documentation[=].display = "A C-SSRS Screener answered NO to every question is a negative assessment: the patient DOES NOT ENTER the suicide-safer care pathway, and none of the tier obligations below apply. No episode is opened."
  * action[+]
    * id = "administer-cssrs-screener"
    * title = "Administer the C-SSRS Screener with Triage Points (demonstrated realization)"
    * description = "Capture the 6-item Columbia Suicide Severity Rating Scale Screener with Triage Points — the variant whose published triage colouring assigns each item to a risk level — and derive the harmonized suicide-risk tier from it."
    * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerCSSRSScreener"
    // Naming the variant explicitly is not pedantry: the C-SSRS ships in several
    // forms and only the Screener WITH TRIAGE POINTS publishes the item→tier
    // assignment this pathway's tiers depend on. The verification of that
    // assignment against the published instrument (CMS 2008 + Columbia 2026) is
    // in docs/reference/suicide-safer-care-pathway-spec.md, "Published-instrument
    // verification (Phase 1b)".
    * documentation[+].type = #documentation
    * documentation[=].label = "Instrument variant"
    * documentation[=].display = "C-SSRS Screener with Triage Points. The triage points are the published item-to-risk-level assignment; a C-SSRS variant without them does not by itself yield the tier this pathway branches on."


// ─── Step 3 — The tier branch (Define the Risk Picture) ──────
//
// One group per tier, each gated the way SPiERReassessmentSchedule gates its
// cadences: on the episode's `currentRiskTier` extension, which is the
// denormalized cache of the latest LOINC 93374-7 concept Observation. Same
// expression shape, same system, so a CDS engine that can evaluate one can
// evaluate the other.
//
// low / moderate / high ONLY. `imminent` and `no-risk` are out for the reasons
// risk-episode.fsh records; `historical` does not exist as a tier at all. See
// the header.

* action[+]
  * id = "tier-branch"
  * title = "Apply the obligations for the patient's current risk tier"
  * description = "The harmonized risk tier determines what the patient is owed. Each tier group below is gated on the episode's current tier; the obligations inside it are the diagram's per-tier rows."
  * code[+] = SPiERPathwayStage#define-risk-picture "Define the Risk Picture"
  * documentation[+].type = #documentation
  * documentation[=].label = "Instrument-agnostic branch"
  * documentation[=].display = "The branch reads the harmonized tier, never an instrument's native result. Any instrument with a published crosswalk into SPiERSuicideRiskTier lands the patient in the same group and therefore owes the same obligations."
  * documentation[=].resource = "http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs"

  // ── Low ──
  * action[+]
    * id = "tier-low"
    * title = "Low risk"
    * description = "Obligations for a patient whose current suicide-risk tier is low."
    * code[+] = SPiERSuicideRiskTier#low "Low risk"
    * condition[+]
      * kind = #applicability
      * expression.language = #text/fhirpath
      * expression.expression = "%episode.extension('http://thespierproject.org/fhir/StructureDefinition/episode-current-risk-tier').value.coding.where(system = 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier').code = 'low'"
    * action[+]
      * id = "low-share-crisis-resources"
      * title = "Share patient-facing crisis resources"
      * description = "Provide the patient with crisis resources and record what was shared."
      * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
      * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources"
      * documentation[+].type = #documentation
      * documentation[=].label = "Every tier"
      * documentation[=].display = "Crisis resources are owed at EVERY tier — the diagram states this as one row spanning all of them. Kept a standalone, composable step so a future non-suicide care path can include the same segment unchanged."
      * documentation[+].type = #documentation
      * documentation[=].label = "Emotional Fire Safety Plan"
      * documentation[=].url = "https://www.nowmattersnow.org/wp-content/uploads/2018/10/0.-NowMattersNow.org-Safety-Plan-Website-Version.pdf"
      * documentation[=].display = "The diagram names the NowMattersNow Emotional Fire Safety Plan at every tier. It is third-party patient-education material, not a SPiER instrument, so it is referenced here as documentation rather than modeled as an activity."
    * action[+]
      * id = "low-reassessment"
      * title = "Reassess on the published cadence for this tier"
      * description = "The next reassessment is due on the interval the SPiER Reassessment Schedule publishes for this tier. This pathway references that schedule; it does not restate the interval."
      * code[+] = SPiERPathwayStage#track-risk-over-time "Track Risk Over Time"
      * definitionCanonical = "http://thespierproject.org/fhir/PlanDefinition/SPiERReassessmentSchedule"
      * documentation[+].type = #documentation
      * documentation[=].label = "One home for the cadence"
      * documentation[=].display = "The per-tier interval lives in PlanDefinition/SPiERReassessmentSchedule and nowhere else. Restating it here would create a fourth copy of a rule that already has three, which is what npm run check:reassessment exists to prevent. Reassess more frequently when clinical judgment dictates."

  // ── Moderate ──
  * action[+]
    * id = "tier-moderate"
    * title = "Moderate risk"
    * description = "Obligations for a patient whose current suicide-risk tier is moderate. Adds collaborative safety planning to the low-tier obligations."
    * code[+] = SPiERSuicideRiskTier#moderate "Moderate risk"
    * condition[+]
      * kind = #applicability
      * expression.language = #text/fhirpath
      * expression.expression = "%episode.extension('http://thespierproject.org/fhir/StructureDefinition/episode-current-risk-tier').value.coding.where(system = 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier').code = 'moderate'"
    * action[+]
      * id = "moderate-share-crisis-resources"
      * title = "Share patient-facing crisis resources"
      * description = "Provide the patient with crisis resources and record what was shared."
      * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
      * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources"
      * documentation[+].type = #documentation
      * documentation[=].label = "Every tier"
      * documentation[=].display = "Crisis resources are owed at EVERY tier — the diagram states this as one row spanning all of them."
      * documentation[+].type = #documentation
      * documentation[=].label = "Emotional Fire Safety Plan"
      * documentation[=].url = "https://www.nowmattersnow.org/wp-content/uploads/2018/10/0.-NowMattersNow.org-Safety-Plan-Website-Version.pdf"
      * documentation[=].display = "The diagram names the NowMattersNow Emotional Fire Safety Plan at every tier, alongside the Stanley-Brown plan from this tier upward."
    * action[+]
      * id = "moderate-safety-plan"
      * title = "Complete a collaborative safety plan"
      * description = "Complete a Stanley-Brown Safety Plan with the patient; the completed response becomes the safety-plan CarePlan."
      * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
      * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown"
      * documentation[+].type = #documentation
      * documentation[=].label = "Review at each contact"
      * documentation[=].display = "The plan is not a one-time artifact: review it at EACH contact and modify as needed. The diagram attaches this instruction to the moderate and high tiers together."
    * action[+]
      * id = "moderate-reassessment"
      * title = "Reassess on the published cadence for this tier"
      * description = "The next reassessment is due on the interval the SPiER Reassessment Schedule publishes for this tier. This pathway references that schedule; it does not restate the interval."
      * code[+] = SPiERPathwayStage#track-risk-over-time "Track Risk Over Time"
      * definitionCanonical = "http://thespierproject.org/fhir/PlanDefinition/SPiERReassessmentSchedule"
      * documentation[+].type = #documentation
      * documentation[=].label = "One home for the cadence"
      * documentation[=].display = "The per-tier interval lives in PlanDefinition/SPiERReassessmentSchedule and nowhere else. Reassess more frequently when clinical judgment dictates."

  // ── High ──
  * action[+]
    * id = "tier-high"
    * title = "High risk"
    * description = "Obligations for a patient whose current suicide-risk tier is high. Adds the diagram's high-risk-only protocol to the moderate-tier obligations."
    * code[+] = SPiERSuicideRiskTier#high "High risk"
    * condition[+]
      * kind = #applicability
      * expression.language = #text/fhirpath
      * expression.expression = "%episode.extension('http://thespierproject.org/fhir/StructureDefinition/episode-current-risk-tier').value.coding.where(system = 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier').code = 'high'"
    * action[+]
      * id = "high-share-crisis-resources"
      * title = "Share patient-facing crisis resources"
      * description = "Provide the patient with crisis resources and record what was shared."
      * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
      * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources"
      * documentation[+].type = #documentation
      * documentation[=].label = "Every tier"
      * documentation[=].display = "Crisis resources are owed at EVERY tier — the diagram states this as one row spanning all of them."
      * documentation[+].type = #documentation
      * documentation[=].label = "Emotional Fire Safety Plan"
      * documentation[=].url = "https://www.nowmattersnow.org/wp-content/uploads/2018/10/0.-NowMattersNow.org-Safety-Plan-Website-Version.pdf"
      * documentation[=].display = "The diagram names the NowMattersNow Emotional Fire Safety Plan at every tier, alongside the Stanley-Brown plan from the moderate tier upward."
    * action[+]
      * id = "high-safety-plan"
      * title = "Complete a collaborative safety plan"
      * description = "Complete a Stanley-Brown Safety Plan with the patient; the completed response becomes the safety-plan CarePlan."
      * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
      * definitionCanonical = "http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown"
      * documentation[+].type = #documentation
      * documentation[=].label = "Review at each contact"
      * documentation[=].display = "The plan is not a one-time artifact: review it at EACH contact and modify as needed. The diagram attaches this instruction to the moderate and high tiers together."
    * action[+]
      * id = "high-reassessment"
      * title = "Reassess on the published cadence for this tier"
      * description = "The next reassessment is due on the interval the SPiER Reassessment Schedule publishes for this tier. This pathway references that schedule; it does not restate the interval."
      * code[+] = SPiERPathwayStage#track-risk-over-time "Track Risk Over Time"
      * definitionCanonical = "http://thespierproject.org/fhir/PlanDefinition/SPiERReassessmentSchedule"
      * documentation[+].type = #documentation
      * documentation[=].label = "One home for the cadence"
      * documentation[=].display = "The per-tier interval lives in PlanDefinition/SPiERReassessmentSchedule and nowhere else. Reassess more frequently when clinical judgment dictates."
    // ── High-risk-only protocol ──
    // Three items the diagram prints only in the High column. They are
    // documentation actions with no `definition[x]`: this is the FHIR shape for
    // "the clinician does this and SPiER prompts", and none of the three has an
    // ActivityDefinition behind it today. Wording follows the spec doc's
    // "High-risk extras" section.
    * action[+]
      * id = "high-every-contact-question"
      * title = "Ask the direct question at every contact"
      * description = "At EVERY CONTACT, ask: \"Are you having thoughts of killing yourself right now?\""
      * code[+] = SPiERPathwayStage#track-follow-up "Track Follow-Up"
      * documentation[+].type = #documentation
      * documentation[=].label = "High risk only"
      * documentation[=].display = "The source diagram prints this obligation in the high-risk column only. It is asked at every contact regardless of where the reassessment cadence currently sits."
    * action[+]
      * id = "high-stat-safety-evaluation"
      * title = "STAT safety evaluation"
      * description = "Conduct a STAT safety evaluation: counsel the patient on lethal means reduction; assess for immediate supports and engage them if possible; and alert the primary care provider and/or the psychiatric provider responsible for the patient's care."
      * code[+] = SPiERPathwayStage#document-safety-actions "Document Safety Actions"
      * documentation[+].type = #documentation
      * documentation[=].label = "High risk only"
      * documentation[=].display = "The lethal-means half of this evaluation has a modeled activity of its own (ActivityDefinition/ProvideMeansSafetyCounseling) and a Stage-8 Measure; the supports assessment and the provider alert do not, so the step is published as protocol rather than as a definition that would only cover a third of it."
    * action[+]
      * id = "high-missed-appointment-outreach"
      * title = "Missed-appointment outreach protocol"
      * description = "If the patient misses or no-shows a scheduled appointment: call immediately at the time of contact; consider outreach to emergency and safety-plan contacts within the hour; and consult with a supervisor if possible, considering a wellness check."
      * code[+] = SPiERPathwayStage#track-follow-up "Track Follow-Up"
      * documentation[+].type = #documentation
      * documentation[=].label = "High risk only"
      * documentation[=].display = "The source diagram prints this protocol in the high-risk column only. Its \"within the hour\" and \"immediately\" language is the diagram's own urgency wording for an outreach attempt, not a reassessment cadence."


// ─── Step 4 — Clinician guidance (documentation only) ────────
//
// No `definition[x]` on either action below, deliberately. Decision 5 of the
// plan: SPiER NEVER writes a diagnosis code. suicide-related-conditions.fsh
// states the same rule from the terminology side — a screen never becomes a
// Condition, because a problem-list entry is a clinician's assertion and a
// screen is a signal that one may be warranted. So the pathway prompts; the
// clinician decides and records.

* action[+]
  * id = "clinician-guidance"
  * title = "Clinician guidance"
  * description = "Steps the pathway prompts and a clinician performs. SPiER records nothing on the patient's behalf here."
  * code[+] = SPiERPathwayStage#define-risk-picture "Define the Risk Picture"
  * action[+]
    * id = "problem-list-entry"
    * title = "Consider a suicide-related problem-list entry"
    * description = "Where clinically warranted, add a suicide-related finding to the patient's problem list. SPiER surfaces the verified coding; the assertion is the clinician's."
    * documentation[+].type = #documentation
    * documentation[=].label = "SNOMED CT is primary"
    * documentation[=].display = "US problem lists store SNOMED CT, so the primary coding comes from the SPiER Suicide-Related Problem value set — every member of which was verified against the publishing authority (see the header of suicide-related-conditions.fsh). For a patient on this pathway the usual entries are \"Suicidal thoughts\" (SNOMED CT 6471006) or \"At increased risk for suicide\" (SNOMED CT 225444004)."
    * documentation[=].resource = "http://thespierproject.org/fhir/ValueSet/spier-suicide-related-problem-vs"
    // ⚠️ ICD-10-CM literals. NO GATE CHECKS THESE — the nightly terminology
    // check covers LOINC, SNOMED and terminology.hl7.org only — so the
    // verification record IS the control. Both codes below are verified in
    // docs/reference/suicide-safer-care-pathway-spec.md, "ICD-10 correction
    // (Phase 1d)", which cites the slide-13 verification table in
    // docs/reference/suicide-care-dashboard-spec.md.
    //
    // The source diagram states Z91.82 for the historical row. Z91.82 is NOT
    // suicide-related — it is *personal history of military deployment*, the
    // #220 failure mode in ICD-10 — and the same error appears on slide 13 of
    // the Suicide Care Dashboard deck, which is how both documents were shown
    // to share one upstream source. NO SPiER ARTIFACT, PAGE OR CARD MAY EVER
    // SHOW Z91.82. The corrected pair is Z91.51 / Z91.52; bare Z91.5 is a valid
    // category but not billable at that specificity.
    * documentation[+].type = #documentation
    * documentation[=].label = "ICD-10-CM crosswalk (billing)"
    * documentation[=].display = "Where a billable ICD-10-CM code is also required: R45.851 (Suicidal ideations) for current ideation, and Z91.51 (Personal history of suicidal behavior) — with Z91.52 (Personal history of nonsuicidal self-harm) as its sibling — for history. These codes are verified; see the pathway spec's ICD-10 correction section. SPiER surfaces them as guidance and never writes them."
  * action[+]
    * id = "contact-frequency"
    * title = "Maintain the tier's frequency of patient contact"
    * description = "The pathway obliges a minimum frequency of patient contact that varies by risk tier, stated by the source diagram separately from the reassessment cadence."
    * code[+] = SPiERPathwayStage#track-follow-up "Track Follow-Up"
    // Prose, and deliberately no numbers — see the header. The diagram's contact
    // frequencies coincide with the reassessment cadence at moderate and high
    // but not at low, so they are either the same rule stated twice or two
    // rules that happen to agree. Publishing them here would settle that by
    // accident and put a fourth copy of an interval into the repo.
    * documentation[+].type = #documentation
    * documentation[=].label = "Not yet encoded as an interval"
    * documentation[=].display = "The source diagram states a per-tier contact frequency as a row of its own, distinct from the reassessment cadence, with values that coincide at the higher tiers and diverge at the lower ones. Whether that is one rule or two is an open clinical question, so this pathway publishes the obligation without an interval: the per-tier values as drawn are transcribed in docs/reference/suicide-safer-care-pathway-spec.md. The one cadence SPiER does publish is PlanDefinition/SPiERReassessmentSchedule, and it is referenced by each tier group above rather than restated."
