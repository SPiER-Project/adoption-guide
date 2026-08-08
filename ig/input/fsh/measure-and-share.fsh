// =============================================================
// Stage 8 — Measure and Share the Data
// =============================================================
// The last stage, and the one that only works because the previous seven
// produced discrete, dated, coded resources. Every measure below is a query
// over artifacts SPiER already defines — nothing here asks a site to capture
// anything new. That is the whole claim of the stage: if you encoded stages
// 1–7, measurement is a read.
//
//   TL-042 KPI / Measure Reporting  → 7 Measure resources + MeasureReports
//                                     (+ the CQL library that computes them)
//   TL-043 Reporting Dashboard      → app-side; no new FHIR artifact
//   TL-044 Data Export / Analytics  → no new artifact; a CapabilityStatement
//                                     claim (see capabilitystatements.fsh)
//   TL-045 Data Sharing / Interop   → likewise — the shape being shared is
//                                     the profiles stages 1–7 already define
//
// ─── Where each measure's data comes from ────────────────────
//
//   Stage 1/2  SPiERSuicideRiskConcept   screen and assessment results,
//                                        separated by pathway-stage meta.tag
//   Stage 4    SPiERStanleyBrownSafetyPlan / SPiERCrisisResponsePlan
//              SPiERLethalMeansCounseling (Procedure)
//   Stage 5    SPiERSafetyHandoff / SPiERDischargeSafetyPacket  → the INDEX
//                                        EVENT for every post-transition measure
//              SPiERSafetyReferral (ServiceRequest)  → referral loop closure
//              SPiERFollowUpAppointment (Appointment) → 7-/30-day follow-up
//   Stage 6    SPiEROutreachAttempt (Communication)  → 24–48h outreach
//              SPiERCaringContact                    → contact adherence
//   Stage 7    SPiERSuicideRiskEpisode (EpisodeOfCare) → the DENOMINATOR
//
// ─── Three design decisions worth reviewing ──────────────────
//
// 1. THE EPISODE IS THE DENOMINATOR. Measures need a cohort with an index
//    date. Before Stage 7 there was no resource that said "this patient is
//    currently in suicide-safer care, starting on this date" — so any measure
//    would have had to invent its cohort from loose observations. The
//    EpisodeOfCare supplies it: `period.start` is the index for episode-wide
//    measures, and the episode is what a numerator resource must fall inside.
//
// 2. POST-DISCHARGE MEASURES INDEX ON THE DOCUMENTED TRANSITION, not on the
//    episode start. You cannot measure 7-day post-discharge follow-up without
//    a discharge. So their denominator is "episodes with a documented care
//    transition" (a SPiERSafetyHandoff or SPiERDischargeSafetyPacket), and the
//    index is that transition's date. The consequence is deliberate and worth
//    naming: a site that has not adopted TL-009 / TL-030 cannot compute the
//    follow-up measures at all. That is a true finding about their pathway,
//    not a gap in the measure.
//
// 3. EVERY MEASURE IS PATIENT-BASED. Each population criterion returns a
//    boolean "is this patient in it", which is the default and by far the most
//    widely implemented population basis. The alternative — counting screens,
//    episodes, or referrals as the population unit — needs a non-Patient
//    population basis, which in FHIR means the CQFM cqfm-populationBasis
//    extension and a dependency on hl7.fhir.us.cqfmeasures. That is more
//    machinery than these draft measures justify. The cost is that a patient
//    with two positive screens or two referrals in one period counts once;
//    where that matters, the criterion names the tie-break rule explicitly
//    ("the most recent in the period is the index").
//
// Terminology is almost entirely standard here — measure-scoring, measure-type,
// measure-population, and measure-improvement-notation are all HL7 CodeSystems.
// The single SPiER-local addition is the measure-group vocabulary below, which
// exists because a MeasureReport group is matched to its Measure group by code
// and no published vocabulary of suicide-safer-care measure groups exists.
//
// ─── On the CQL, and what is NOT verified ────────────────────
//
// `criteria.expression` names a CQL definition, and those definitions live in
// ig/input/cql/SPiERSuicideSaferCareMeasures.cql, published as
// Library/SPiERSuicideSaferCareMeasures and referenced from every
// `Measure.library` below. The IG Publisher compiles that file to ELM on every
// run, so a criterion naming a define that does not exist is a build error.
//
// It took two attempts to get here, and the failed one is worth recording.
// #201 put the CQL under ig/input/cql/ and published a Library pointing at it,
// then concluded from a publisher log that never mentioned CQL that the
// publisher cannot translate it — and moved the file to ig/drafts/. The
// symptom was 63 broken narrative links, because the publisher generates a link
// from each `criteria.expression` into the Library's rendered CQL and there was
// no rendered CQL to land on.
//
// The conclusion was wrong. The publisher bundles the full cqframework
// translator; what was missing was the `path-binary: input/cql` parameter in
// sushi-config.yaml, which the IG-parameters CodeSystem documents as the CQL
// loader's switch. With it set, the log says so out loud and the broken links
// resolve because the rendered CQL now exists. See #212, and the header of the
// .cql file for the captured log lines.
// =============================================================


// ─── Measure group vocabulary ────────────────────────────────
// A MeasureReport group is matched to its Measure group by `code`, NOT by
// element id — the FHIR validator is explicit about it ("Group should have a
// code that matches the group definition in the measure"), and an earlier
// revision of this file got it wrong by relying on `id` alone. Matching on a
// coded value rather than free text is what lets a consumer line a report up
// against the definition it was computed from.
//
// This is the one place Stage 8 needs SPiER-local terminology. There is no
// published vocabulary of suicide-safer-care measure groups to bind to.

CodeSystem: MeasureGroupCodes
Id: spier-measure-group
Title: "Suicide-Safer Care Measure Group Codes"
Description: "Identifies each population group inside a SPiER suicide-safer care Measure, so a MeasureReport group can be matched back to the Measure group it was computed from."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #screen-to-assessment "Positive screen followed by assessment"
* #risk-status-documented "Current risk level documented"
* #safety-plan-completed "Safety plan completed before discharge"
* #patient-copy-documented "Patient copy of the safety plan documented"
* #lethal-means-counseling "Lethal means counseling completed"
* #outreach-within-48-hours "Outreach within 48 hours of the transition"
* #follow-up-within-7-days "Follow-up visit attended within 7 days"
* #follow-up-within-30-days "Follow-up visit attended within 30 days"
* #caring-contact-within-30-days "Caring contact sent within 30 days"
* #referral-completion "Referral tracked through to completed"


ValueSet: MeasureGroup
Id: spier-measure-group-vs
Title: "Suicide-Safer Care Measure Group"
Description: "Population groups within the SPiER suicide-safer care measures."
* ^status = #draft
* ^experimental = true
* include codes from system MeasureGroupCodes


// ─── The measure logic library ───────────────────────────────
// `content.id = "ig-loader-<filename>"` is the IG Publisher's instruction to
// load that file out of the IG source and attach it here — it is not a real
// element id in the published output. Paired with `path-binary: input/cql` in
// sushi-config.yaml, it is what makes the publisher translate the CQL and
// attach both the source and the compiled ELM to this Library.
//
// The `-1.0.0` in the id is deliberate: the publisher resolves the loader
// against the file name, so the file, this id, and `name` must stay in step.

Instance: SPiERSuicideSaferCareMeasures
InstanceOf: Library
Title: "Library — SPiER Suicide-Safer Care Measure Logic"
Description: "The population criteria for all seven SPiER suicide-safer care measures, in CQL. Every `Measure.criteria.expression` in this file names a definition from this library."
Usage: #definition
* url = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* name = "SPiERSuicideSaferCareMeasures"
* version = "1.0.0"
* title = "SPiER Suicide-Safer Care Measure Logic"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* type = http://terminology.hl7.org/CodeSystem/library-type#logic-library "Logic Library"
* description = "CQL implementing every population criterion referenced by the seven SPiER suicide-safer care Measures. Retrieves filter on SPiER profiles rather than codes, because the stage-5/6/7 workflow artifacts are distinguished by conformance claim rather than by a code in a value set; the risk-concept Observations are the exception and match on LOINC 93374-7. Each definition returns a boolean, because every measure is patient-based."
* purpose = "Makes the measures portable. Without a published library a consumer can read what each population means but must reimplement it, and two sites that reimplement independently produce numbers that are not comparable — the exact failure quality measurement exists to prevent."
* content.id = "ig-loader-SPiERSuicideSaferCareMeasures.cql"


// ─── TL-042 Measure 1 — Positive screen → assessment ─────────
// The one measure anchored on the SCREEN rather than the episode: it asks
// whether a positive screen was clarified, which by definition happens before
// (or as the trigger for) episode entry.
//
// Screen and assessment are told apart by the pathway-stage meta.tag, not by
// instrument identity — an EHR that swaps ASQ for PSS-3 keeps measuring.

Instance: SPiERScreenToAssessment
InstanceOf: Measure
Title: "Measure — Positive Screen Followed by Suicide-Risk Assessment"
Description: "Proportion of patients with a positive suicide-risk screen who received a clarifying assessment within 24 hours."
Usage: #definition
* url = "http://spier.org/Measure/SPiERScreenToAssessment"
* name = "SPiERScreenToAssessment"
* version = "1.0.0"
* title = "Positive Screen Followed by Suicide-Risk Assessment"
* status = #draft
* experimental = true
* library = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* publisher = "SPiER (HTD Health)"
* description = "The proportion of patients with a positive suicide-risk screen who received a clarifying suicide-risk assessment within 24 hours. Both the screen and the assessment are SPiERSuicideRiskConcept Observations; they are distinguished by the SPiER pathway-stage tag (identify-possible-risk vs clarify-risk) rather than by instrument, so substituting one screening tool for another does not break the measure."
* purpose = "A positive screen with no follow-up assessment is the single most consequential gap in a suicide-safer care pathway — the patient has been identified and then dropped. This measures that gap directly."
* scoring = http://terminology.hl7.org/CodeSystem/measure-scoring#proportion "Proportion"
* type[+] = http://terminology.hl7.org/CodeSystem/measure-type#process "Process"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* subjectCodeableConcept = http://hl7.org/fhir/resource-types#Patient
* group[+]
  * id = "screen-to-assessment"
  * code = MeasureGroupCodes#screen-to-assessment "Positive screen followed by assessment"
  * description = "Patients whose positive screen was clarified within 24 hours."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a suicide-risk screen during the measurement period — a SPiERSuicideRiskConcept Observation tagged identify-possible-risk."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Suicide Risk Screen"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Patients whose screen was POSITIVE — interpretation POS, i.e. any tier above no-risk. Where a patient screened positive more than once, the measure indexes on the most recent positive screen in the period."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Positive Screen"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "Patients whose indexed positive screen was followed within 24 hours by a SPiERSuicideRiskConcept Observation tagged clarify-risk."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Positive Screen Assessed Within 24 Hours"


// ─── TL-042 Measure 2 — Current risk level documented ────────

Instance: SPiERRiskStatusDocumented
InstanceOf: Measure
Title: "Measure — Current Risk Level Documented"
Description: "Proportion of patients in a suicide-safer care episode carrying a documented current risk level."
Usage: #definition
* url = "http://spier.org/Measure/SPiERRiskStatusDocumented"
* name = "SPiERRiskStatusDocumented"
* version = "1.0.0"
* title = "Current Risk Level Documented"
* status = #draft
* experimental = true
* library = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* publisher = "SPiER (HTD Health)"
* description = "The proportion of patients in a suicide-safer care episode for whom a current suicide-risk level is documented as discrete, coded data. The numerator requires a SPiERSuicideRiskConcept Observation dated inside the episode — NOT merely the episode-current-risk-tier extension, which is a denormalized cache and could be stale or hand-set. Measuring the Observation measures the source of truth."
* purpose = "Risk level recorded only in narrative cannot drive a work queue, a CDS card, or a handoff. This measures whether it exists as data."
* scoring = http://terminology.hl7.org/CodeSystem/measure-scoring#proportion "Proportion"
* type[+] = http://terminology.hl7.org/CodeSystem/measure-type#process "Process"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* subjectCodeableConcept = http://hl7.org/fhir/resource-types#Patient
* group[+]
  * id = "risk-status-documented"
  * code = MeasureGroupCodes#risk-status-documented "Current risk level documented"
  * description = "Patients with a coded risk tier recorded during the episode."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a suicide-safer care episode overlapping the measurement period."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has An Active Suicide Safer Care Episode"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has An Active Suicide Safer Care Episode"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose episode was closed for administrative reasons — duplicate or entered-in-error records should not count against a site."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Episode Closed Administratively"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "Patients with at least one SPiERSuicideRiskConcept Observation dated inside the episode period."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Risk Tier Documented During Episode"


// ─── TL-042 Measure 3 — Safety plan before discharge ─────────
// Two groups, because the SSC scores the plan and the PATIENT'S COPY of the
// plan as separate measures — and they genuinely differ: a completed plan the
// patient walks out without is a known failure mode.
//
// Group 2 is the payoff of the shared handoff-content vocabulary: "did the
// patient get a copy" is answerable because TL-009 and TL-030 agreed on one
// code list, so `safety-plan-copy` means the same thing in both.

Instance: SPiERSafetyPlanBeforeDischarge
InstanceOf: Measure
Title: "Measure — Safety Plan Completed Before Discharge"
Description: "Proportion of patients whose care transition was preceded by a completed safety plan, and the proportion whose own copy is documented."
Usage: #definition
* url = "http://spier.org/Measure/SPiERSafetyPlanBeforeDischarge"
* name = "SPiERSafetyPlanBeforeDischarge"
* version = "1.0.0"
* title = "Safety Plan Completed Before Discharge"
* status = #draft
* experimental = true
* library = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* publisher = "SPiER (HTD Health)"
* description = "Two related proportions over the same denominator of patients with a documented care transition: (1) a safety plan — Stanley-Brown or Crisis Response Plan — existed and was active at or before the transition; (2) the patient's own copy is documented, evidenced by a discharge packet carrying the handoff-content item `safety-plan-copy`. They are separate groups because a completed plan the patient leaves without is a distinct and well-documented failure."
* purpose = "Safety planning is only protective if the plan exists before the patient leaves and travels with them. This measures both halves."
* scoring = http://terminology.hl7.org/CodeSystem/measure-scoring#proportion "Proportion"
* type[+] = http://terminology.hl7.org/CodeSystem/measure-type#process "Process"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* subjectCodeableConcept = http://hl7.org/fhir/resource-types#Patient
* group[+]
  * id = "safety-plan-completed"
  * code = MeasureGroupCodes#safety-plan-completed "Safety plan completed before discharge"
  * description = "Patients whose transition was preceded by an active safety plan."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a documented care transition (SPiERSafetyHandoff or SPiERDischargeSafetyPacket) during the measurement period. Where there is more than one, the most recent in the period is the index."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose episode was closed for administrative reasons."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Episode Closed Administratively"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "A safety-plan CarePlan (Stanley-Brown or Crisis Response Plan) with status active, dated on or before the transition."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Safety Plan In Place Before Transition"
* group[+]
  * id = "patient-copy-documented"
  * code = MeasureGroupCodes#patient-copy-documented "Patient copy of the safety plan documented"
  * description = "Patients whose own copy of the safety plan is documented."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a documented care transition during the measurement period; the most recent in the period is the index."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose episode was closed for administrative reasons."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Episode Closed Administratively"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "A discharge packet for the transition carrying the handoff-content item `safety-plan-copy`."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Patient Copy Of Safety Plan Documented"


// ─── TL-042 Measure 4 — Lethal means counseling ──────────────

Instance: SPiERLethalMeansCounselingCompleted
InstanceOf: Measure
Title: "Measure — Lethal Means Counseling Completed"
Description: "Proportion of patients in a suicide-safer care episode who received lethal-means safety counseling."
Usage: #definition
* url = "http://spier.org/Measure/SPiERLethalMeansCounselingCompleted"
* name = "SPiERLethalMeansCounselingCompleted"
* version = "1.0.0"
* title = "Lethal Means Counseling Completed"
* status = #draft
* experimental = true
* library = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* publisher = "SPiER (HTD Health)"
* description = "The proportion of patients in a suicide-safer care episode for whom a SPiERLethalMeansCounseling Procedure was completed during the episode. Counts the counseling Procedure, not the per-method SPiERMeansSafetyAction Observations: whether counseling happened is the process measure, while which methods were addressed and secured is richer detail a site can report on separately."
* purpose = "Means-safety counseling has among the strongest evidence bases of any suicide-prevention intervention and is among the least reliably delivered. Measuring it is the point of coding it."
* scoring = http://terminology.hl7.org/CodeSystem/measure-scoring#proportion "Proportion"
* type[+] = http://terminology.hl7.org/CodeSystem/measure-type#process "Process"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* subjectCodeableConcept = http://hl7.org/fhir/resource-types#Patient
* group[+]
  * id = "lethal-means-counseling"
  * code = MeasureGroupCodes#lethal-means-counseling "Lethal means counseling completed"
  * description = "Patients with completed means-safety counseling during the episode."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a suicide-safer care episode overlapping the measurement period."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has An Active Suicide Safer Care Episode"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has An Active Suicide Safer Care Episode"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose episode was closed for administrative reasons."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Episode Closed Administratively"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "A SPiERLethalMeansCounseling Procedure with status completed, performed during the episode."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Lethal Means Counseling During Episode"


// ─── TL-042 Measure 5 — Follow-up timeliness ─────────────────
// THE measure the SSC cares most about, and the clearest demonstration that
// stages 5–7 were worth encoding. Three groups over one denominator, because
// the SSC asks for three windows and they share an index event.
//
// Note what each window reads:
//   24–48h  → SPiEROutreachAttempt.sent          (Stage 6, Communication)
//   7-day   → SPiERFollowUpAppointment           (Stage 5, Appointment)
//   30-day  → the same Appointment, wider window
//
// The appointment groups require status = fulfilled, not merely booked. This
// is deliberate and it is exactly the distinction TL-034 exists to make: a
// booked appointment the patient never attended is not follow-up. It is only
// answerable because Appointment.status carries noshow/fulfilled natively —
// which is why Stage 6 added no resource for appointment tracking.

Instance: SPiERFollowUpTimeliness
InstanceOf: Measure
Title: "Measure — Follow-Up Timeliness After a Care Transition"
Description: "Proportion of patients with outreach within 48 hours, and an attended follow-up within 7 and 30 days, after a documented care transition."
Usage: #definition
* url = "http://spier.org/Measure/SPiERFollowUpTimeliness"
* name = "SPiERFollowUpTimeliness"
* version = "1.0.0"
* title = "Follow-Up Timeliness After a Care Transition"
* status = #draft
* experimental = true
* library = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* publisher = "SPiER (HTD Health)"
* description = "Three timeliness proportions over one denominator of patients with a documented care transition: outreach attempted within 48 hours, and a follow-up visit COMPLETED within 7 days and within 30 days. The appointment groups require Appointment.status = fulfilled rather than booked — a scheduled visit the patient did not attend is not follow-up, and distinguishing the two is precisely what TL-034 (Follow-Up Appointment Tracking) exists to do. The 48-hour group counts an attempt rather than a successful contact, because the attempt is what the care team controls; a stricter reached-only variant is a one-line change to the CQL and is described on the measurement page."
* purpose = "The days immediately after discharge carry the highest suicide risk of any period in the pathway. These three windows are the standard Zero Suicide follow-up expectations."
* scoring = http://terminology.hl7.org/CodeSystem/measure-scoring#proportion "Proportion"
* type[+] = http://terminology.hl7.org/CodeSystem/measure-type#process "Process"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* subjectCodeableConcept = http://hl7.org/fhir/resource-types#Patient
* group[+]
  * id = "outreach-within-48-hours"
  * code = MeasureGroupCodes#outreach-within-48-hours "Outreach within 48 hours of the transition"
  * description = "Patients contacted, or attempted, within 48 hours of the transition."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a documented care transition during the measurement period; the most recent in the period is the index."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose episode closed as deceased before the window elapsed, plus administratively closed episodes."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Excluded From Follow Up Measurement"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "A SPiEROutreachAttempt sent within 48 hours of the transition."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Outreach Within 48 Hours Of Transition"
* group[+]
  * id = "follow-up-within-7-days"
  * code = MeasureGroupCodes#follow-up-within-7-days "Follow-up visit attended within 7 days"
  * description = "Patients who attended a follow-up visit within 7 days of the transition."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a documented care transition during the measurement period; the most recent in the period is the index."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose episode closed as deceased before the window elapsed, plus administratively closed episodes."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Excluded From Follow Up Measurement"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "A SPiERFollowUpAppointment with status fulfilled starting within 7 days of the transition."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Follow Up Visit Within 7 Days"
* group[+]
  * id = "follow-up-within-30-days"
  * code = MeasureGroupCodes#follow-up-within-30-days "Follow-up visit attended within 30 days"
  * description = "Patients who attended a follow-up visit within 30 days of the transition."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a documented care transition during the measurement period; the most recent in the period is the index."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose episode closed as deceased before the window elapsed, plus administratively closed episodes."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Excluded From Follow Up Measurement"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "A SPiERFollowUpAppointment with status fulfilled starting within 30 days of the transition."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Follow Up Visit Within 30 Days"


// ─── TL-042 Measure 6 — Caring contact adherence ─────────────
// The measure that justifies the caring-contact opt-out extension. Without it
// a site that correctly honors a patient's wish to stop receiving contacts
// would be scored as having failed to send them.

Instance: SPiERCaringContactAdherence
InstanceOf: Measure
Title: "Measure — Caring Contact Adherence"
Description: "Proportion of patients sent a caring contact within 30 days of a care transition, excluding those who opted out."
Usage: #definition
* url = "http://spier.org/Measure/SPiERCaringContactAdherence"
* name = "SPiERCaringContactAdherence"
* version = "1.0.0"
* title = "Caring Contact Adherence"
* status = #draft
* experimental = true
* library = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* publisher = "SPiER (HTD Health)"
* description = "The proportion of patients with a documented care transition who were sent at least one SPiERCaringContact within 30 days. Patients who have opted out of the caring-contacts series are a DENOMINATOR EXCLUSION rather than a numerator failure — honoring an opt-out is correct behavior, and a measure that punished it would push sites to ignore the patient's wish. This is the reason the caring-contact-opt-out extension exists on the contact resource."
* purpose = "Caring contacts are one of the few interventions with direct randomized evidence for reducing repeat suicide attempts, and adherence to the sending schedule is the whole intervention."
* scoring = http://terminology.hl7.org/CodeSystem/measure-scoring#proportion "Proportion"
* type[+] = http://terminology.hl7.org/CodeSystem/measure-type#process "Process"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* subjectCodeableConcept = http://hl7.org/fhir/resource-types#Patient
* group[+]
  * id = "caring-contact-within-30-days"
  * code = MeasureGroupCodes#caring-contact-within-30-days "Caring contact sent within 30 days"
  * description = "Patients sent a caring contact within 30 days of the transition."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a documented care transition during the measurement period; the most recent in the period is the index."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Documented Care Transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients who opted out of the caring-contacts series, plus the standard deceased / administrative exclusions."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Excluded From Caring Contact Measurement"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "At least one SPiERCaringContact sent within 30 days of the transition."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Caring Contact Within 30 Days"


// ─── TL-042 Measure 7 — Referral loop closure ────────────────
// This measure is the single clearest vindication of a Stage-5 design call.
// TL-017 was modelled as a ServiceRequest specifically because a Communication
// can only record that something was SENT. Sent-vs-completed is the entire
// measure; with the Communication shape it would have been uncomputable.

Instance: SPiERReferralCompletion
InstanceOf: Measure
Title: "Measure — Suicide-Safety Referral Loop Closure"
Description: "Proportion of patients whose suicide-safety referrals were tracked through to completion rather than left at sent."
Usage: #definition
* url = "http://spier.org/Measure/SPiERReferralCompletion"
* name = "SPiERReferralCompletion"
* version = "1.0.0"
* title = "Suicide-Safety Referral Loop Closure"
* status = #draft
* experimental = true
* library = "http://spier.org/Library/SPiERSuicideSaferCareMeasures"
* publisher = "SPiER (HTD Health)"
* description = "The proportion of patients with a SPiERSafetyReferral authored during the measurement period whose referrals all reached status completed. This measure is only computable because TL-017 is modelled as a ServiceRequest: ServiceRequest.status carries draft → active → completed natively, whereas a Communication records only that a referral was sent. Referrals marked entered-in-error are excluded; revoked referrals are NOT excluded, because a referral withdrawn without an alternative being arranged is a genuine loop failure."
* purpose = "A sent referral is not a received one. Loop closure is where suicide-safety handoffs most often fail silently."
* scoring = http://terminology.hl7.org/CodeSystem/measure-scoring#proportion "Proportion"
* type[+] = http://terminology.hl7.org/CodeSystem/measure-type#process "Process"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* subjectCodeableConcept = http://hl7.org/fhir/resource-types#Patient
* group[+]
  * id = "referral-completion"
  * code = MeasureGroupCodes#referral-completion "Referral tracked through to completed"
  * description = "Patients whose referrals were all tracked through to completed."
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * description = "Patients with a SPiERSafetyReferral ServiceRequest authored during the measurement period."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Suicide Safety Referral"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * description = "Same as the initial population."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Has A Suicide Safety Referral"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * description = "Patients whose only referrals in the period are marked entered-in-error."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "Referral Entered In Error"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * description = "Patients with no referral left incomplete — every non-erroneous referral authored in the period reached status completed."
    * criteria.language = #text/cql-identifier
    * criteria.expression = "All Referrals Completed"


// ─── ActivityDefinitions ─────────────────────────────────────
// Promoted out of pathway-tool-placeholders.fsh; ids and canonical URLs
// unchanged so the TL-042…TL-045 catalog mappings and the measure-and-share
// stage PlanDefinition actions stay stable.
//
// Note the asymmetry, the same one Stage 7 had with TL-037: only TL-042
// produces a resource. TL-043 is a rendering, TL-044 is a serialization, and
// TL-045 is a transport — all three are CAPABILITIES over artifacts that
// already exist, which is why they declare no output profile and are
// expressed as CapabilityStatement claims instead.

Instance: ReportSuicideSaferCareMeasures
InstanceOf: ActivityDefinition
Title: "Report Suicide-Safer Care KPIs / Measures"
Description: "Calculate the SPiER suicide-safer care measures and emit MeasureReports."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ReportSuicideSaferCareMeasures"
* name = "ReportSuicideSaferCareMeasures"
* version = "1.0.0"
* title = "Report Suicide-Safer Care KPIs / Measures"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Calculate the seven SPiER suicide-safer care Measures — screen-to-assessment, risk status documented, safety plan before discharge (plus patient copy), lethal means counseling, follow-up timeliness at 48 hours / 7 days / 30 days, caring-contact adherence, and referral loop closure — and emit MeasureReports. Every numerator and denominator reads resources stages 1–7 already produce; the activity captures nothing new. Summary reports answer 'how is the program doing', individual reports answer 'why is this patient in or out of the numerator' and carry evaluatedResource links back to the underlying artifacts."
* purpose = "Turn pathway activity into numerators and denominators that quality improvement can act on. Belongs to the Measure and Share the Data stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: ProvideReportingDashboard
InstanceOf: ActivityDefinition
Title: "Provide Reporting Dashboard / Aggregate View"
Description: "Render the suicide-safer care measures and pathway activity as a filterable aggregate view. Produces no FHIR resource — it is a rendering of MeasureReports and the registry query."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ProvideReportingDashboard"
* name = "ProvideReportingDashboard"
* version = "1.0.0"
* title = "Provide Reporting Dashboard / Aggregate View"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Present suicide-safer care activity as an aggregate view for clinicians, supervisors, care managers, QI teams, and administrators. This activity stores nothing: the measure tiles read summary MeasureReports produced by ReportSuicideSaferCareMeasures, and the operational counts (screening volume, positive screens, active episodes, overdue items) read the same registry query TL-037 defines — `EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on`. The SSC's filter list (date range, site, setting, provider/team, tool, risk level, completion status) maps onto search parameters over those two reads rather than onto a stored report definition."
* purpose = "Give clinicians, supervisors, and QI teams a routinely refreshed aggregate view of pathway performance. Belongs to the Measure and Share the Data stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: ExportSuicideSaferCareData
InstanceOf: ActivityDefinition
Title: "Export Data / Analytics Extract"
Description: "Export the suicide-safer care artifacts as structured, timestamped data for analysis. A serialization of existing resources, not a new artifact."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ExportSuicideSaferCareData"
* name = "ExportSuicideSaferCareData"
* version = "1.0.0"
* title = "Export Data / Analytics Extract"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Export suicide-safer care data for analytics. SPiER defines no export-specific artifact deliberately: the SSC's requirement is that the extract carry STRUCTURED FIELDS AND TIMESTAMPS rather than narrative, and every SPiER profile already mandates a discrete date — Observation.effective, Procedure.performed, Communication.sent, Appointment.start, ServiceRequest.authoredOn, EpisodeOfCare.period, Task.authoredOn and restriction.period.end. The conforming export is therefore the FHIR Bulk Data `$export` of those resource types, and CSV or warehouse extracts are flattenings of the same set. The expected capability is declared on the SPiERQualityReporter CapabilityStatement."
* purpose = "Make the structured pathway data available to analytics and evaluation without manual chart abstraction. Belongs to the Measure and Share the Data stage."
* kind = #Task
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


Instance: ShareSuicideSaferCareData
InstanceOf: ActivityDefinition
Title: "Share Data / Interoperability Output"
Description: "Share suicide-safer care data outside the EHR with structure, provenance, and consent restrictions preserved."
Usage: #definition
* url = "http://spier.org/ActivityDefinition/ShareSuicideSaferCareData"
* name = "ShareSuicideSaferCareData"
* version = "1.0.0"
* title = "Share Data / Interoperability Output"
* status = #draft
* experimental = true
* publisher = "SPiER (HTD Health)"
* description = "Share suicide-safer care data outside the EHR — current risk status, assessment summary, safety-plan status and document, lethal-means status, the handoff bundle, follow-up plan and completion, and measure results. Every item on the SSC's shareable list is already a SPiER profile, so sharing needs no new shape: the harmonized SPiERSuicideRiskConcept is the minimum viable payload for a receiving system that does not know the originating instrument, and the role CapabilityStatements define what each actor must support. Consent restrictions are enforced from the SPiERInformationSharingConsent recorded at TL-032 — a deny provision naming a recipient is what withholds data from that recipient."
* purpose = "Let a patient's suicide-risk signal follow them across facilities and platforms, within consent. Belongs to the Measure and Share the Data stage."
* kind = #CommunicationRequest
* topic[+] = http://snomed.info/sct#225337009 "Suicide risk assessment (procedure)"
// Licensing (#127) — see ig/input/fsh/instrument-licensing.fsh
* insert LicensingSpiERAuthored


// ─── Examples ────────────────────────────────────────────────
// The individual report below is the end-to-end proof for the whole IG: its
// evaluatedResource list points at real instances, so you can follow one
// patient from the episode that put them in the denominator, through the
// handoff that set the index date, to the artifacts that put them in each
// numerator.
//
// Two of those artifacts are minted HERE rather than reused from stages 5/6,
// and the reason is worth stating because it is itself a finding. The Stage-5
// example appointment is `booked` and the Stage-6 example outreach is sent
// seven days after the handoff — so neither satisfies the numerator it would
// be cited for. Those examples are correct for their own stages (a booked
// appointment IS the point of TL-031), which is precisely why a measure needs
// instances positioned relative to an index event. Citing them anyway would
// have produced an example whose arithmetic did not hold.

Instance: ExampleMeasuredOutreachAttempt
InstanceOf: SPiEROutreachAttempt
Title: "Example — Post-discharge outreach inside the 48-hour window"
Description: "An outreach attempt 19 hours after the transition documented by ExampleSafetyHandoff — the artifact that satisfies the 48-hour numerator."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-follow-up
* status = #completed
* category[+].text = "Post-discharge follow-up outreach"
* subject = Reference(Patient/example)
* sent = "2026-07-21T10:00:00Z"
* medium[+] = http://terminology.hl7.org/CodeSystem/v3-ParticipationMode#PHONE "Telephone"
* extension[outcome].valueCodeableConcept = OutreachOutcomeCodes#patient-reached "Patient reached"
* extension[prompt].valueCodeableConcept = OutreachPromptCodes#post-discharge "Post-discharge follow-up"
* extension[safetyConcern].valueBoolean = false


Instance: ExampleMeasuredFollowUpAppointment
InstanceOf: SPiERFollowUpAppointment
Title: "Example — Follow-up visit attended inside the 7-day window"
Description: "The follow-up appointment ATTENDED four days after the transition. Status fulfilled rather than booked is what puts it in the numerator — the distinction TL-034 exists to make."
Usage: #example
* meta.tag[+] = SPiERPathwayStage#track-follow-up
* status = #fulfilled
* description = "Post-discharge behavioral health follow-up (attended)"
* start = "2026-07-24T14:00:00Z"
* end = "2026-07-24T14:45:00Z"
* participant[+].actor = Reference(Patient/example)
* participant[=].status = #accepted
* participant[+].actor.display = "Riverside Behavioral Health"
* participant[=].status = #accepted


Instance: ExampleFollowUpTimelinessReportIndividual
InstanceOf: MeasureReport
Title: "Example — Follow-up timeliness, individual report"
Description: "One patient's follow-up timeliness, with evaluatedResource pointing at the exact artifacts that placed them in each numerator. Every population the Measure defines is reported — including initial-population and a zero denominator-exclusion — because a MeasureReport that omits one cannot be checked against its Measure. Index event: the handoff on 2026-07-20T15:00Z. Outreach at +19h clears the 48-hour window; the attended visit at +4d clears both the 7- and 30-day windows."
Usage: #example
* status = #complete
* type = #individual
* measure = "http://spier.org/Measure/SPiERFollowUpTimeliness"
* subject = Reference(Patient/example)
* date = "2026-08-01T00:00:00Z"
* period.start = "2026-07-01"
* period.end = "2026-07-31"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* group[+]
  * id = "outreach-within-48-hours"
  * code = MeasureGroupCodes#outreach-within-48-hours "Outreach within 48 hours of the transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * count = 1
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * count = 1
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * count = 0
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * count = 1
  * measureScore.value = 1
* group[+]
  * id = "follow-up-within-7-days"
  * code = MeasureGroupCodes#follow-up-within-7-days "Follow-up visit attended within 7 days"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * count = 1
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * count = 1
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * count = 0
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * count = 1
  * measureScore.value = 1
* group[+]
  * id = "follow-up-within-30-days"
  * code = MeasureGroupCodes#follow-up-within-30-days "Follow-up visit attended within 30 days"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * count = 1
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * count = 1
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * count = 0
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * count = 1
  * measureScore.value = 1
// The artifacts the calculation read, in pathway order: the episode that
// created the denominator, the handoff that set the index date, then one
// numerator artifact per window.
* evaluatedResource[+] = Reference(ExampleActiveSuicideRiskEpisode)
* evaluatedResource[+] = Reference(ExampleSafetyHandoff)
* evaluatedResource[+] = Reference(ExampleMeasuredOutreachAttempt)
* evaluatedResource[+] = Reference(ExampleMeasuredFollowUpAppointment)


Instance: ExampleFollowUpTimelinessReportSummary
InstanceOf: MeasureReport
Title: "Example — Follow-up timeliness, summary report"
Description: "A program-level summary across a cohort of transitions, showing the characteristic shape of these measures: outreach is strong, 7-day completion is the weak link, and 30-day recovers."
Usage: #example
* status = #complete
* type = #summary
* measure = "http://spier.org/Measure/SPiERFollowUpTimeliness"
* date = "2026-08-01T00:00:00Z"
* reporter.display = "Riverside Health — Behavioral Health Service Line"
* period.start = "2026-07-01"
* period.end = "2026-07-31"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* group[+]
  * id = "outreach-within-48-hours"
  * code = MeasureGroupCodes#outreach-within-48-hours "Outreach within 48 hours of the transition"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * count = 2
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * count = 55
  * measureScore.value = 0.887
* group[+]
  * id = "follow-up-within-7-days"
  * code = MeasureGroupCodes#follow-up-within-7-days "Follow-up visit attended within 7 days"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * count = 2
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * count = 38
  * measureScore.value = 0.613
* group[+]
  * id = "follow-up-within-30-days"
  * code = MeasureGroupCodes#follow-up-within-30-days "Follow-up visit attended within 30 days"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * count = 2
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * count = 51
  * measureScore.value = 0.823


Instance: ExampleCaringContactAdherenceReportSummary
InstanceOf: MeasureReport
Title: "Example — Caring contact adherence, summary report"
Description: "Shows the opt-out exclusion doing its job. 9 of the 64 patients in the denominator opted out of the caring-contacts series, so the score is computed over the remaining 55 (49/55 = 0.891) and the site is not penalised for honoring them. Note the denominator is reported PRE-exclusion, per the proportion-scoring convention: measureScore = numerator / (denominator − denominator-exclusion)."
Usage: #example
* status = #complete
* type = #summary
* measure = "http://spier.org/Measure/SPiERCaringContactAdherence"
* date = "2026-08-01T00:00:00Z"
* reporter.display = "Riverside Health — Behavioral Health Service Line"
* period.start = "2026-07-01"
* period.end = "2026-07-31"
* improvementNotation = http://terminology.hl7.org/CodeSystem/measure-improvement-notation#increase "Increased score indicates improvement"
* group[+]
  * id = "caring-contact-within-30-days"
  * code = MeasureGroupCodes#caring-contact-within-30-days "Caring contact sent within 30 days"
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#initial-population "Initial Population"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator "Denominator"
    * count = 64
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#denominator-exclusion "Denominator Exclusion"
    * count = 9
  * population[+]
    * code = http://terminology.hl7.org/CodeSystem/measure-population#numerator "Numerator"
    * count = 49
  * measureScore.value = 0.891
