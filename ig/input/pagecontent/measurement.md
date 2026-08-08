Stage 8 of the SPiER pathway makes pathway activity usable for reporting,
quality improvement, accountability, and information sharing.

It is the shortest stage in the guide, and that is the point. Every measure
below is a **query over artifacts the previous seven stages already produce**.
Nothing here asks a site to capture anything new. If you encoded stages 1–7,
measurement is a read.

### The seven measures

| Measure | Reads | Denominator |
|---|---|---|
| [Positive Screen Followed by Assessment](Measure-SPiERScreenToAssessment.html) | Risk-concept Observations, split by pathway-stage tag | Patients with a positive screen |
| [Current Risk Level Documented](Measure-SPiERRiskStatusDocumented.html) | Risk-concept Observations inside the episode | Patients in an episode |
| [Safety Plan Before Discharge](Measure-SPiERSafetyPlanBeforeDischarge.html) | Safety-plan CarePlans; discharge packet content items | Patients with a documented transition |
| [Lethal Means Counseling Completed](Measure-SPiERLethalMeansCounselingCompleted.html) | The counseling Procedure | Patients in an episode |
| [Follow-Up Timeliness](Measure-SPiERFollowUpTimeliness.html) | Outreach attempts; follow-up Appointments | Patients with a documented transition |
| [Caring Contact Adherence](Measure-SPiERCaringContactAdherence.html) | Caring contacts; the opt-out extension | Patients with a documented transition |
| [Referral Loop Closure](Measure-SPiERReferralCompletion.html) | Referral ServiceRequest status | Patients with a referral |

Each `Measure.group.population.criteria` names one definition, and every
`Measure.library` points at
[Library/SPiERSuicideSaferCareMeasures](Library-SPiERSuicideSaferCareMeasures.html),
which carries the CQL and the ELM the IG Publisher compiles from it. So the
measures are portable: you can evaluate them without reimplementing the
criteria. See *What is and isn't verified* at the end of this page for what that
does and does not prove.

### Why the episode is the denominator

Measures need a cohort with an index date. Before Stage 7 there was no
resource that said *"this patient is currently in suicide-safer care, starting
on this date"* — so a measure would have had to invent its cohort out of loose
observations, and two sites would have invented different ones.

`SPiERSuicideRiskEpisode` supplies it. `period.start` is the index for
episode-wide measures, and a numerator artifact has to fall inside the episode
to count. This is the main reason Stage 7 was worth encoding before Stage 8.

### Post-discharge measures index on the transition, not the episode

You cannot measure 7-day post-discharge follow-up without a discharge. So the
follow-up, caring-contact, and safety-plan measures use a narrower denominator:
patients with a **documented care transition** — a
[SPiERSafetyHandoff](StructureDefinition-spier-safety-handoff.html) or a
[SPiERDischargeSafetyPacket](StructureDefinition-spier-discharge-safety-packet.html)
— with that artifact's date as the index. Where a patient has more than one
transition in the period, the most recent is the index.

The consequence is deliberate and worth naming plainly: **a site that has not
adopted TL-009 or TL-030 cannot compute the follow-up measures at all.** That is
a true finding about that site's pathway, not a gap in the measure. A follow-up
rate computed against an undefined discharge is not a number anyone should act
on.

### Measurement is where the Stage 5–7 design calls get tested

Three modelling decisions from earlier stages exist specifically so that these
measures are computable. Stage 8 is where they pay off — or would have failed.

**Referral loop closure needs `ServiceRequest`.** TL-017 could have been a
`Communication`, and an earlier draft of the demo recorder made it one. But a
Communication records only that a referral was **sent**. Sent-versus-completed
*is* the measure, and `ServiceRequest.status` carries `draft → active →
completed` natively. With the Communication shape this measure would have been
uncomputable.

**Follow-up timeliness needs `Appointment.status`, not a tracking resource.**
The 7- and 30-day groups require `status = fulfilled`, not `booked`. A
scheduled visit the patient never attended is not follow-up. This is exactly
the distinction TL-034 exists to make — and it is why Stage 6 deliberately
added *no* appointment-tracking resource: `Appointment.status` already carries
`fulfilled` / `noshow` / `cancelled`, and a parallel resource would only have
created something to keep in sync.

**Caring-contact adherence needs the opt-out extension.** A patient who has
opted out of the caring-contacts series is a **denominator exclusion**, not a
numerator failure. Honoring an opt-out is correct behavior; a measure that
scored it as a miss would pressure sites to ignore the patient's wish. This is
the reason `caring-contact-opt-out` sits on the contact resource.

**Patient copy of the safety plan needs one shared vocabulary.** "Did the
patient leave with a copy?" is answerable because TL-009 and TL-030 agreed on a
single content code list, so `safety-plan-copy` means the same thing on a
handoff and on a discharge packet.

### Choices you may want to make differently

Two criteria are judgment calls rather than settled standards, and both are
one-line changes to the CQL:

- **The 48-hour group counts an outreach *attempt*, not a successful contact.**
  The attempt is what the care team controls; whether the patient picks up is
  not. A site that wants the stricter reading should add a filter on the
  `outreach-outcome` extension for `patient-reached` (or also
  `reached-support-person`).
- **`revoked` referrals are not excluded.** A referral withdrawn without an
  alternative arranged is a genuine loop failure. A site that revokes referrals
  for legitimate clinical reasons may want them excluded instead.

Two measures on the SSC's list are **not** authored: CARS-S completion, because
the instrument is a licensing no-go for SPiER, and SCS-R treatment-response
monitoring, because SPiER has no SCS-R artifact to measure over. Both are
listed here rather than silently omitted, so the gap is visible.

### Population basis

Every measure is **patient-based**: each criterion answers "is this patient in
this population", which is the default and by far the most widely implemented
basis. Counting screens, episodes, or referrals as the population unit would
require a non-Patient population basis — the CQFM `cqfm-populationBasis`
extension and a dependency on `hl7.fhir.us.cqfmeasures` — which is more
machinery than these draft measures justify.

The cost: a patient with two positive screens or two referrals in one period
counts once. Where that matters, the criterion states its tie-break rule
explicitly.

### Dashboards, exports, and sharing

The remaining three Stage-8 tools define no artifact of their own, because none
of them is a new kind of data:

- **TL-043 Reporting Dashboard** is a *rendering*. Measure tiles read summary
  MeasureReports; operational counts (screening volume, active episodes,
  overdue items) read the same registry query TL-037 defines,
  `EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on`.
  The SSC's filter list maps onto search parameters over those two reads.
- **TL-044 Data Export** is a *serialization*. The SSC's real requirement is
  that an extract carry structured fields **and the timestamps needed for
  measurement** — which the profiles already guarantee, since every one
  mandates a discrete date (`Observation.effective`, `Procedure.performed`,
  `Communication.sent`, `Appointment.start`, `ServiceRequest.authoredOn`,
  `EpisodeOfCare.period`, `Task.authoredOn`). The conforming export is a Bulk
  Data `$export` of those types; CSV and warehouse extracts are flattenings of
  the same set.
- **TL-045 Data Sharing** is a *transport*. Every item on the SSC's shareable
  list is already a SPiER profile. For a receiving system that does not know
  the originating instrument, the harmonized
  [SPiERSuicideRiskConcept](StructureDefinition-spier-suicide-risk-concept.html)
  is the minimum viable payload. Sharing restrictions are enforced from the
  [SPiERInformationSharingConsent](StructureDefinition-spier-information-sharing-consent.html)
  recorded at TL-032 — a deny provision naming a recipient is what withholds
  data from that recipient.

What these three *do* require is that the workflow resources are readable,
searchable, and movable. That is a conformance requirement rather than a
profile, so it lives in the
[CapabilityStatements](conformance.html) — including a fourth role,
**SPiER Quality Reporter**, whose access pattern is population-wide rather than
per-patient.

### What is and isn't verified

The `Measure` resources are validated by SUSHI and by the IG Publisher's QA
run, and the **CQL is compiled** — the publisher translates it to ELM on every
build and fails on a translation error.

That is a recent correction, and the earlier state of this page was wrong in a
way worth recording. It said the publisher does not translate `input/cql`,
citing a publisher log that never mentioned CQL. The log was accurate; the
inference was not. The publisher bundles the full cqframework translator, and
what was missing was the CQL loader's activation parameter — `path-binary:
input/cql` in `sushi-config.yaml`. Without it the publisher walks past the
folder silently, which is indistinguishable from not supporting CQL at all. With
it set, the log says:

```
Translating CQL source in folder .../ig/input/cql
Translating CQL source in file .../SPiERSuicideSaferCareMeasures.cql
Translation failed with (5) errors; see the error log for more information.
```

Those five errors were real. Every criterion that dated a resource used the
fluent `.toInterval()` on `Observation.effective[x]` and
`Procedure.performed[x]`, which has no overload for the full R4 choice types —
so the library, had anyone tried to run it, would not have compiled. That is the
argument for compiling artifacts rather than publishing them as prose, made at
SPiER's own expense.

What this still does **not** prove is that the CQL computes the right answer.
Translation checks that the logic is well-formed and that its definitions
resolve; it does not execute it against data. The executable reference
implementation remains the TypeScript engine in `web/src/lib/measures.ts`, which
vitest covers and which `npm run check:measures` ties to these `Measure`
resources name by name. Two measures being equivalent — the CQL and the TS — is
asserted, not yet tested. A cross-engine parity test, on the model of the
Stanley-Brown FML/TypeScript golden-file comparison, is the honest next step.
