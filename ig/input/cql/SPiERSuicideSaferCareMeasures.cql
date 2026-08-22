/*
 * SPiER Suicide-Safer Care measure logic
 * =============================================================
 * Every population criterion referenced by the Measures in
 * ig/input/fsh/measure-and-share.fsh. One named define per criterion; the
 * Measure references it by name via `criteria.language = text/cql-identifier`.
 *
 * Two things to know before reading:
 *
 *  1. RETRIEVES FILTER ON SPiER PROFILES, not on codes. SPiER's stage-5/6/7
 *     artifacts are distinguished by profile and by extension values rather
 *     than by a code in a value set — a follow-up Appointment and a routine
 *     Appointment differ by conformance claim, not by a SNOMED code. So the
 *     library retrieves the base resource type and filters with the
 *     `ConformsTo` helper below. That also keeps the library computable
 *     against a plain FHIR server with no SPiER-specific search parameters.
 *
 *  2. EVERY DEFINE IS BOOLEAN. These are patient-based measures (see the
 *     population-basis note in measure-and-share.fsh), so each criterion
 *     answers "is this patient in this population", not "which resources
 *     qualify". Where a patient could have several qualifying index events in
 *     one period, the define picks the most recent — stated in the Measure's
 *     population description too, so the rule is visible without reading CQL.
 *
 * ─── THIS FILE IS COMPILED. Do not treat it as prose. ───────
 *
 * The IG Publisher translates it to ELM on every run and attaches the result to
 * Library/SPiERSuicideSaferCareMeasures, which all seven Measures reference via
 * `Measure.library`. A translation error is a publisher error, and
 * `ig-publish.yml` fails the build on it.
 *
 * What makes that happen is ONE line in sushi-config.yaml:
 *
 *     parameters:
 *       path-binary:
 *         - input/cql
 *
 * `path-binary` is the CQL loader's activation switch — the IG-parameters
 * CodeSystem defines it as "files ... only used in the context of the CQL
 * loader". Without it the publisher walks straight past input/cql and says
 * nothing at all, which is exactly what happened in #201: that revision
 * published a Library with no `path-binary`, concluded from the silent log that
 * the publisher cannot translate CQL, and moved this file to ig/drafts/. The
 * conclusion was wrong — the capability was there, the switch was not. Issue
 * #212 re-tested it and captured the log lines that prove it:
 *
 *     Translating CQL source in folder .../ig/input/cql
 *     Translating CQL source in file .../SPiERSuicideSaferCareMeasures.cql
 *     Translation failed with (5) errors; see the error log for more information.
 *
 * Those five errors were real defects in this file, invisible for as long as
 * nothing compiled it. See the `Interval` helpers below.
 *
 * The TypeScript engine in web/src/lib/measures.ts remains the *executable
 * reference implementation* — it is what the app runs and what `npm test`
 * covers. This library is the portable, normative statement of the same
 * criteria, so a consumer can evaluate the measures without reimplementing
 * them. `npm run check:measures` ties the Measure criterion names to the TS
 * implementations; the publisher ties them to this file.
 */

library SPiERSuicideSaferCareMeasures version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers

// ─── Terminology ─────────────────────────────────────────────

codesystem "LOINC": 'http://loinc.org'
codesystem "ObservationInterpretation": 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
codesystem "SPiER Pathway Stage": 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage'
codesystem "SPiER Handoff Content": 'http://thespierproject.org/fhir/CodeSystem/spier-handoff-content'
codesystem "SPiER Episode Closure Reason": 'http://thespierproject.org/fhir/CodeSystem/spier-episode-closure-reason'

code "Suicide risk level": '93374-7' from "LOINC" display 'Suicide risk level'
code "Positive": 'POS' from "ObservationInterpretation" display 'Positive'
code "Identify possible risk": 'identify-possible-risk' from "SPiER Pathway Stage"
code "Clarify risk": 'clarify-risk' from "SPiER Pathway Stage"
code "Safety plan copy": 'safety-plan-copy' from "SPiER Handoff Content"
code "Deceased": 'deceased' from "SPiER Episode Closure Reason"
code "Administrative closure": 'administrative' from "SPiER Episode Closure Reason"

parameter "Measurement Period" Interval<DateTime>

context Patient

// ─── Profile canonicals ──────────────────────────────────────
// Named rather than inlined so a reader can see at a glance exactly which
// stage-1..7 artifacts this stage measures over — and so a typo is a
// one-place fix.

define "Risk Concept Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-concept'
define "Stanley Brown Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan'
define "Crisis Response Plan Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-crisis-response-plan'
define "Lethal Means Counseling Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-lethal-means-counseling'
define "Safety Handoff Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-safety-handoff'
define "Discharge Packet Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-discharge-safety-packet'
define "Safety Referral Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-safety-referral'
define "Follow Up Appointment Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-follow-up-appointment'
define "Outreach Attempt Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-outreach-attempt'
define "Caring Contact Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-caring-contact'
define "Suicide Risk Episode Profile": 'http://thespierproject.org/fhir/StructureDefinition/spier-suicide-risk-episode'

define "Pathway Stage System": 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage'
define "Risk Tier System": 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier'
define "Closure Reason Extension": 'http://thespierproject.org/fhir/StructureDefinition/episode-closure-reason'
define "Handoff Content Extension": 'http://thespierproject.org/fhir/StructureDefinition/handoff-content-item'
define "Caring Contact Opt Out Extension": 'http://thespierproject.org/fhir/StructureDefinition/caring-contact-opt-out'

// ─── Helpers ─────────────────────────────────────────────────

/* Turning a FHIR choice-typed date into an Interval<DateTime>.
 *
 * These two functions are the whole of what the first compile of this file
 * caught (#212, 5 errors). Every site below used the fluent `.toInterval()`,
 * which reads well and does not exist for these signatures:
 *
 *   Could not resolve call to operator toInterval with signature
 *     (choice<FHIR.dateTime,FHIR.Period,FHIR.Timing,FHIR.instant>)   <- Observation.effective[x]
 *     (choice<FHIR.dateTime,FHIR.Period,FHIR.string,FHIR.Age,FHIR.Range>)  <- Procedure.performed[x]
 *
 * FHIRHelpers.ToInterval covers Period and the QICore-style narrowed choices,
 * not the full R4 choice for either element. So each branch is spelled out.
 *
 * A point in time becomes a degenerate interval [t, t] so that `during` behaves
 * the same whether a producer wrote effectiveDateTime or effectivePeriod —
 * which matters, because SPiER's own mappers write the former and other EHRs
 * write the latter. The branches that cannot yield an interval (Timing, string,
 * Age, Range) return null, and a null interval fails `during`, so those
 * resources drop out of the population rather than being silently counted.
 * That is the conservative direction for a quality measure. */
define function "Effective Interval"(
  value Choice<FHIR.dateTime, FHIR.Period, FHIR.Timing, FHIR.instant>
):
  case
    when value is FHIR.dateTime then
      Interval[FHIRHelpers.ToDateTime(value as FHIR.dateTime), FHIRHelpers.ToDateTime(value as FHIR.dateTime)]
    when value is FHIR.instant then
      Interval[FHIRHelpers.ToDateTime(value as FHIR.instant), FHIRHelpers.ToDateTime(value as FHIR.instant)]
    when value is FHIR.Period then
      FHIRHelpers.ToInterval(value as FHIR.Period)
    else null
  end

define function "Performed Interval"(
  value Choice<FHIR.dateTime, FHIR.Period, FHIR.string, FHIR.Age, FHIR.Range>
):
  case
    when value is FHIR.dateTime then
      Interval[FHIRHelpers.ToDateTime(value as FHIR.dateTime), FHIRHelpers.ToDateTime(value as FHIR.dateTime)]
    when value is FHIR.Period then
      FHIRHelpers.ToInterval(value as FHIR.Period)
    else null
  end

define function ConformsTo(resource DomainResource, profileUrl String):
  exists (
    resource.meta.profile P
      where P.value = profileUrl
  )

define function TaggedStage(resource DomainResource, stageCode String):
  exists (
    resource.meta.tag T
      where T.system.value = "Pathway Stage System"
        and T.code.value = stageCode
  )

/* The coded value of a CodeableConcept-valued extension, or null. */
define function ExtensionCode(resource DomainResource, extensionUrl String):
  singleton from (
    (resource.extension E where E.url = extensionUrl) X
      return (X.value as FHIR.CodeableConcept).coding[0].code.value
  )

define function BooleanExtension(resource DomainResource, extensionUrl String):
  singleton from (
    (resource.extension E where E.url = extensionUrl) X
      return (X.value as FHIR.boolean).value
  )

// ─── Shared cohort: the suicide-safer care episode ───────────
// Stage 7 is what gives every other measure a population. Without an episode
// there is no cohort and no index date, only loose observations.

define "Suicide Safer Care Episodes":
  [EpisodeOfCare] E
    where ConformsTo(E, "Suicide Risk Episode Profile")
      and E.period overlaps "Measurement Period"

define "Has An Active Suicide Safer Care Episode":
  exists "Suicide Safer Care Episodes"

define "Most Recent Episode":
  Last(
    "Suicide Safer Care Episodes" E
      sort by start of period
  )

define "Episode Closure Reason":
  ExtensionCode("Most Recent Episode", "Closure Reason Extension")

define "Episode Closed Administratively":
  "Episode Closure Reason" = "Administrative closure".code

define "Episode Closed As Deceased":
  "Episode Closure Reason" = "Deceased".code

// ─── Measure 1 — Positive screen → assessment ────────────────
// Screen and assessment are told apart by the pathway-stage tag, so the
// measure survives a site swapping one screening instrument for another.

define "Risk Concept Observations":
  [Observation: "Suicide risk level"] O
    where ConformsTo(O, "Risk Concept Profile")
      and O.status = 'final'

define "Screens In Period":
  "Risk Concept Observations" O
    where TaggedStage(O, "Identify possible risk".code)
      and "Effective Interval"(O.effective) during "Measurement Period"

define "Has A Suicide Risk Screen":
  exists "Screens In Period"

define "Positive Screens In Period":
  "Screens In Period" O
    where exists (O.interpretation I where I.coding.code contains "Positive".code)

define "Has A Positive Screen":
  exists "Positive Screens In Period"

/* Tie-break: where a patient screened positive more than once in the period,
   the most recent positive screen is the index. Stated on the Measure too. */
define "Index Positive Screen":
  Last(
    "Positive Screens In Period" O
      sort by start of "Effective Interval"(effective)
  )

define "Assessments In Period":
  "Risk Concept Observations" O
    where TaggedStage(O, "Clarify risk".code)

define "Positive Screen Assessed Within 24 Hours":
  "Has A Positive Screen"
    and exists (
      "Assessments In Period" A
        where start of "Effective Interval"(A.effective)
          during Interval[
            start of "Effective Interval"("Index Positive Screen".effective),
            start of "Effective Interval"("Index Positive Screen".effective) + 24 hours
          ]
    )

// ─── Measure 2 — Current risk level documented ───────────────
// Deliberately reads the Observation, not the episode-current-risk-tier
// extension: that extension is a denormalized cache for work-queue sorting
// and may be stale, so measuring it would measure the cache, not the care.

define "Risk Tier Documented During Episode":
  exists (
    "Risk Concept Observations" O
      where "Effective Interval"(O.effective) during "Most Recent Episode".period
  )

// ─── Shared index event: the documented care transition ──────
// You cannot measure post-discharge follow-up without a discharge. Sites that
// have not adopted TL-009 / TL-030 therefore cannot compute the follow-up
// measures at all — a true finding about their pathway, not a measure gap.

define "Safety Handoffs In Period":
  [Communication] C
    where ConformsTo(C, "Safety Handoff Profile")
      and C.sent during "Measurement Period"
    return C.sent

define "Discharge Packets In Period":
  [DocumentReference] D
    where ConformsTo(D, "Discharge Packet Profile")
      and D.date during "Measurement Period"
    return D.date

define "Care Transition Dates":
  "Safety Handoffs In Period" union "Discharge Packets In Period"

define "Has A Documented Care Transition":
  exists "Care Transition Dates"

/* The most recent transition in the period is the index for every
   post-transition window below. */
define "Index Transition Date":
  Max("Care Transition Dates" D return D.value)

// ─── Measure 3 — Safety plan before discharge ────────────────

define "Safety Plans":
  [CarePlan] P
    where (ConformsTo(P, "Stanley Brown Profile") or ConformsTo(P, "Crisis Response Plan Profile"))
      and P.status in { 'active', 'completed' }

define "Safety Plan In Place Before Transition":
  "Has A Documented Care Transition"
    and exists (
      "Safety Plans" P
        where start of P.period <= "Index Transition Date"
    )

/* Answerable only because TL-009 and TL-030 agreed on one content vocabulary:
   `safety-plan-copy` means the same thing on a handoff and on a packet. */
define "Patient Copy Of Safety Plan Documented":
  "Has A Documented Care Transition"
    and exists (
      [DocumentReference] D
        where ConformsTo(D, "Discharge Packet Profile")
          and D.date during "Measurement Period"
          and exists (
            D.extension E
              where E.url = "Handoff Content Extension"
                and (E.value as FHIR.CodeableConcept).coding[0].code.value = "Safety plan copy".code
          )
    )

// ─── Measure 4 — Lethal means counseling ─────────────────────

define "Lethal Means Counseling During Episode":
  exists (
    [Procedure] P
      where ConformsTo(P, "Lethal Means Counseling Profile")
        and P.status = 'completed'
        and "Performed Interval"(P.performed) during "Most Recent Episode".period
  )

/* ── The exception, and why it is an exception rather than an exclusion ──

   Two ways an open episode can carry no means counseling without the ED
   having failed at anything (issue #324):

     psy / hosp / long / rehab  the patient was admitted or transferred to a
                                higher level of care. Means counseling belongs
                                at discharge to the community, so it is NOT YET
                                DUE — and when it comes due it is owed by the
                                receiving facility.
     aadvice                    the patient left before disposition. Terrence
                                Whitfield (patient-014) eloped at 02:35 while on
                                1:1 precautions: there was NO OPPORTUNITY.

   `denominator-exception` is the population FHIR defines for exactly this —
   removed from the denominator ONLY IF the numerator is not met. That
   conditionality is the whole reason not to use an exclusion here: a patient
   who WAS counseled before being transferred still counts as a pass rather
   than disappearing from the measure. An exclusion would forgive the transfer
   case unconditionally, which is also the shape a site could game.

   Read off Encounter.hospitalization.dischargeDisposition because that is
   where the signal already lives; nothing new had to be recorded to answer
   this. */
define "Deferring Discharge Dispositions": { 'psy', 'hosp', 'long', 'rehab', 'aadvice' }

define "Episode Encounters":
  [Encounter] E
    where E.period overlaps "Most Recent Episode".period

define "Transferred Or Left Before Means Counseling":
  exists (
    "Episode Encounters" E
      where exists (
        E.hospitalization.dischargeDisposition.coding C
          where C.code.value in "Deferring Discharge Dispositions"
      )
  )

// ─── Measure 5 — Follow-up timeliness ────────────────────────
// The appointment windows require status = fulfilled, not booked. A scheduled
// visit the patient never attended is not follow-up, and telling the two apart
// is exactly what TL-034 exists to do — which is why Stage 6 added no
// appointment-tracking resource: Appointment.status already carries it.

define "Excluded From Follow Up Measurement":
  "Episode Closed Administratively" or "Episode Closed As Deceased"

define "Outreach Attempts":
  [Communication] C
    where ConformsTo(C, "Outreach Attempt Profile")

/* Counts an ATTEMPT, not a successful contact: the attempt is what the care
   team controls. For a stricter reached-only variant, add a filter on the
   outreach-outcome extension — see the measurement page. */
define "Outreach Within 48 Hours Of Transition":
  "Has A Documented Care Transition"
    and exists (
      "Outreach Attempts" C
        where C.sent during Interval["Index Transition Date", "Index Transition Date" + 48 hours]
    )

define "Attended Follow Up Appointments":
  [Appointment] A
    where ConformsTo(A, "Follow Up Appointment Profile")
      and A.status = 'fulfilled'

define "Follow Up Visit Within 7 Days":
  "Has A Documented Care Transition"
    and exists (
      "Attended Follow Up Appointments" A
        where A.start during Interval["Index Transition Date", "Index Transition Date" + 7 days]
    )

define "Follow Up Visit Within 30 Days":
  "Has A Documented Care Transition"
    and exists (
      "Attended Follow Up Appointments" A
        where A.start during Interval["Index Transition Date", "Index Transition Date" + 30 days]
    )

// ─── Measure 6 — Caring contact adherence ────────────────────
// Opting out is correct behavior on the patient's part and correct behavior
// for the site to honor. Excluding rather than failing those patients is why
// the caring-contact-opt-out extension exists.

define "Caring Contacts":
  [Communication] C
    where ConformsTo(C, "Caring Contact Profile")

define "Opted Out Of Caring Contacts":
  exists (
    "Caring Contacts" C
      where BooleanExtension(C, "Caring Contact Opt Out Extension") is true
  )

define "Excluded From Caring Contact Measurement":
  "Opted Out Of Caring Contacts" or "Excluded From Follow Up Measurement"

define "Caring Contact Within 30 Days":
  "Has A Documented Care Transition"
    and exists (
      "Caring Contacts" C
        where C.sent during Interval["Index Transition Date", "Index Transition Date" + 30 days]
    )

// ─── Measure 7 — Referral loop closure ───────────────────────
// Computable only because TL-017 is a ServiceRequest. A Communication records
// that a referral was SENT; sent-vs-completed is the entire measure.

define "Safety Referrals In Period":
  [ServiceRequest] R
    where ConformsTo(R, "Safety Referral Profile")
      and R.authoredOn during "Measurement Period"

define "Valid Safety Referrals":
  "Safety Referrals In Period" R
    where R.status != 'entered-in-error'

define "Has A Suicide Safety Referral":
  exists "Safety Referrals In Period"

define "Referral Entered In Error":
  "Has A Suicide Safety Referral" and not exists "Valid Safety Referrals"

/* A referral withdrawn without an alternative arranged is a genuine loop
   failure, so `revoked` is NOT treated as success here. */
define "All Referrals Completed":
  exists "Valid Safety Referrals"
    and not exists (
      "Valid Safety Referrals" R
        where R.status != 'completed'
    )

// ─── Measure 8 — Reassessment on time ────────────────────────
//
// The only measure here whose window is DATA rather than a constant: the
// interval comes from PlanDefinition/SPiERReassessmentSchedule.
//
// ⚠️ This library does NOT read that PlanDefinition, and cannot usefully. The
// library is `context Patient`, so every retrieve is patient-scoped clinical
// data; a definitional resource is not reachable that way. #296 assumed
// otherwise. So the intervals are restated in ReassessmentIntervalDays below,
// and `npm run check:reassessment` asserts that this function, the TypeScript
// engine and the PlanDefinition all agree — three representations, one gate. If
// you change a number here, change it in the FSH too, and watch that gate go red
// first if you want to know it works.

/* The published per-tier cadence. Restated, not derived — see above.
 * A tier with no cadence returns null, and a null interval makes the numerator
 * unaskable, which is why those patients are a denominator EXCLUSION rather than
 * a miss. */
define function ReassessmentIntervalDays(tier String):
  case tier
    when 'high' then 7
    when 'moderate' then 14
    when 'low' then 30
    else null
  end

/* The risk tier recorded on a risk-concept Observation, as a plain code. */
define function RecordedTier(observation Observation):
  singleton from (
    ((observation.value as FHIR.CodeableConcept).coding) C
      where C.system.value = "Risk Tier System"
      return C.code.value
  )

/* Risk-concept Observations dated inside the period, oldest first, so the last
 * two are the most recent completed interval. */
define "Risk Assessments In Period":
  "Risk Concept Observations" O
    where "Effective Interval"(O.effective) during "Measurement Period"

/* Sorted in a second define rather than inline: a `sort by` clause needs a
   query source it can alias, and a parenthesised query is not one. */
define "Dated Assessments":
  "Risk Assessments In Period" A
    sort by start of "Effective Interval"(effective)

/* A patient needs TWO assessments before an interval exists. One assessment is
 * not a late reassessment; it is a patient who has not been reassessed yet, and
 * whether they are currently OVERDUE is a question for the work queue rather
 * than for a measure, which scores what happened. */
define "Has A Reassessment Interval":
  Count("Dated Assessments") >= 2

define "Latest Assessment":
  Last("Dated Assessments")

/* The assessment the clock started from — the latest one strictly before the
 * most recent. Ties (two assessments at the same instant) drop out rather than
 * producing an arbitrary winner. */
define "Preceding Assessment":
  Last(
    "Dated Assessments" A
      where start of "Effective Interval"(A.effective)
        < start of "Effective Interval"("Latest Assessment".effective)
  )

/* Read off the EARLIER assessment: the interval a site owed is the one that
 * applied when the clock started, not the patient's tier today. */
define "Applicable Interval Days":
  ReassessmentIntervalDays(RecordedTier("Preceding Assessment"))

/* Excluded, not failed: imminent risk is escalated rather than scheduled, and a
 * no-risk patient is off the pathway. Neither has a cadence to be late against,
 * and scoring them as misses would penalise correct escalation. */
define "Reassessment Not On A Published Cadence":
  "Has A Reassessment Interval"
    and ("Applicable Interval Days" is null or "Episode Closed Administratively")

define "Days Between Last Two Assessments":
  days between start of "Effective Interval"("Preceding Assessment".effective)
    and start of "Effective Interval"("Latest Assessment".effective)

define "Most Recent Reassessment Was On Time":
  "Has A Reassessment Interval"
    and "Applicable Interval Days" is not null
    and "Days Between Last Two Assessments" <= "Applicable Interval Days"
