# Why the Stage-8 measures are computable: the Stage 5–7 design calls they depend on

**Decided:** 2026-07/08 (the Stage 5, 6, 7 and 8 plans, archived under
[`plans/archive/`](../plans/archive/); the gate discipline is
[`../internals/measures.md`](../internals/measures.md)).
**Rule, as published:** Measures § *The denominators*, § *Dashboards, exports
and sharing*.

Three modelling decisions from earlier stages exist specifically so that the
Stage-8 measures are computable. Stage 8 is where they pay off — or would have
failed.

## Referral loop closure needs `ServiceRequest`

`SPiERSafetyReferral` could have been a `Communication`, and an earlier draft
of the demo recorder made it one. But a Communication records only that a
referral was **sent**. Sent-versus-completed *is* the measure, and
`ServiceRequest.status` carries `draft → active → completed` natively. With the
Communication shape this measure would have been uncomputable.

## Follow-up timeliness needs `Appointment.status`, not a tracking resource

The 7- and 30-day groups require `status = fulfilled`, not `booked`. A
scheduled visit the patient never attended is not follow-up. This is exactly
the distinction the follow-up tracking activity exists to make — and it is why
Stage 6 deliberately added *no* appointment-tracking resource:
`Appointment.status` already carries `fulfilled` / `noshow` / `cancelled`, and
a parallel resource would only have created something to keep in sync.

## Caring-contact adherence needs the opt-out extension

A patient who has opted out of the caring-contacts series is a **denominator
exclusion**, not a numerator failure. Honoring an opt-out is correct behavior;
a measure that scored it as a miss would pressure sites to ignore the
patient's wish. This is the reason `caring-contact-opt-out` sits on the
contact resource.

## Patient copy of the safety plan needs one shared vocabulary

"Did the patient leave with a copy?" is answerable because
`SPiERSafetyHandoff` and `SPiERDischargeSafetyPacket` agreed on a single
content code list, so `safety-plan-copy` means the same thing on a handoff and
on a discharge packet.

## Lethal-means counseling needs an *exception*, not another exclusion

Two ways an open episode carries no counseling without anyone having failed:
the patient went to a higher level of care (`psy`, `hosp`, `long`, `rehab` —
the counseling belongs at the eventual discharge to the community and is owed
by the receiving facility), or left before disposition (`aadvice`). Both are
read from `Encounter.hospitalization.dischargeDisposition`, so nothing new had
to be recorded.

They are a **denominator exception** rather than a denominator exclusion, and
the difference is load-bearing: an exception is removed from the denominator
*only if the numerator is not met*. A patient who **was** counseled before
being transferred still counts as a pass instead of vanishing from the
measure — and a site cannot lift its score by transferring people. An
exclusion would do both of those things wrong. This is the only exception in
the set; everything else that leaves a denominator is an exclusion, because it
never belonged in the cohort at all.

## Population basis

Every measure is patient-based: each criterion answers "is this patient in
this population", the default and by far the most widely implemented basis.
Counting screens, episodes or referrals as the population unit would require a
non-Patient population basis — the CQFM `cqfm-populationBasis` extension and a
dependency on `hl7.fhir.us.cqfmeasures` — which is more machinery than these
draft measures justify. The cost: a patient with two positive screens or two
referrals in one period counts once, and where that matters the criterion
states its tie-break rule explicitly.

## Why the dashboard, the export and the sharing tool define no artifact

None of the three is a new kind of data.

- **The reporting dashboard** is a *rendering*. Measure tiles read summary
  MeasureReports; operational counts (screening volume, active episodes,
  overdue items) read the registry query the active-registry activity defines,
  `EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on`.
  The source spec's filter list maps onto search parameters over those two
  reads. `_revinclude` support is optional in FHIR; a server without it needs a
  second read of `Task?encounter=` or `Task?based-on=`.
- **Data export** is a *serialization*. The spec's real requirement is that an
  extract carry structured fields **and the timestamps needed for
  measurement** — which the profiles already guarantee, since every one
  mandates a discrete date (`Observation.effective`, `Procedure.performed`,
  `Communication.sent`, `Appointment.start`, `ServiceRequest.authoredOn`,
  `EpisodeOfCare.period`, `Task.authoredOn`). The conforming export is a Bulk
  Data `$export` of those types; CSV and warehouse extracts are flattenings of
  the same set.
- **Data sharing** is a *transport*. Every item on the spec's shareable list is
  already a SPiER profile. For a receiving system that does not know the
  originating instrument, the harmonized `SPiERSuicideRiskConcept` is the
  minimum viable payload. Sharing restrictions are enforced from the
  `SPiERInformationSharingConsent`: a deny provision naming a recipient
  withholds data from that recipient, and a deny provision naming a content
  category withholds one part of a payload from an otherwise permitted
  recipient. The discharge safety packet is the worked example — assembled
  *after* reading the consent, carrying only what the consent allows, and
  recording anything left out as a handoff-withheld-item extension with a
  basis. That claim covers what the artifact asserts at assembly time;
  enforcing consent on arbitrary reads of the record is a server
  responsibility SPiER does not profile.

What the three *do* require is that the workflow resources are readable,
searchable and movable — a conformance requirement rather than a profile,
which is why it lives in the CapabilityStatements, including the fourth role,
Quality Reporter, whose access pattern is population-wide rather than
per-patient.

## The two measures not authored

CARS-S completion, because the instrument is a licensing no-go for SPiER, and
SCS-R treatment-response monitoring, because SPiER has no SCS-R artifact to
measure over. Both are named on the Measures page rather than silently
omitted, so the gap is visible.

## What would reopen it

A site that needs a screen- or referral-based population unit (the CQFM basis
extension would then be worth its dependency); a Communication-shaped referral
from a partner system that the loop-closure measure must accept; or an SCS-R
or licensed CARS-S artifact.
