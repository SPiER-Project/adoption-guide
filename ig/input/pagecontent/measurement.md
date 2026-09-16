Stage 8 of the SPiER pathway makes pathway activity usable for reporting,
quality improvement, accountability and information sharing. Every measure
below is a **query over artifacts the previous seven stages already produce**;
nothing asks a site to capture anything new. If you encoded stages 1–7,
measurement is a read.

### The seven measures

| Measure | Reads | Denominator |
|---|---|---|
| [Positive Screen Followed by Assessment](Measure-SPiERScreenToAssessment.html) | Risk-concept Observations, split by pathway-stage tag | Patients with a positive screen |
| [Current Risk Level Documented](Measure-SPiERRiskStatusDocumented.html) | Risk-concept Observations inside the episode | Patients in an episode |
| [Safety Plan Before Discharge](Measure-SPiERSafetyPlanBeforeDischarge.html) | Safety-plan CarePlans; discharge packet content items | Patients with a documented transition |
| [Lethal Means Counseling Completed](Measure-SPiERLethalMeansCounselingCompleted.html) | The counseling Procedure; the encounter's discharge disposition | Patients in an episode, less transfers and departures (see below) |
| [Follow-Up Timeliness](Measure-SPiERFollowUpTimeliness.html) | Outreach attempts; follow-up Appointments | Patients with a documented transition |
| [Caring Contact Adherence](Measure-SPiERCaringContactAdherence.html) | Caring contacts; the opt-out extension | Patients with a documented transition |
| [Referral Loop Closure](Measure-SPiERReferralCompletion.html) | Referral ServiceRequest status | Patients with a referral |

Each `Measure.group.population.criteria` names one definition, and every
`Measure.library` points at
[Library/SPiERSuicideSaferCareMeasures](Library-SPiERSuicideSaferCareMeasures.html),
which carries the CQL and the ELM compiled from it — so the measures can be
evaluated without reimplementing the criteria. See *What is and isn't
verified* for what that does and does not prove.

### The denominators

**The episode is the cohort.** Measures need a cohort with an index date, and
before Stage 7 no resource said *"this patient is in suicide-safer care,
starting on this date"*.
[SPiERSuicideRiskEpisode](StructureDefinition-spier-suicide-risk-episode.html)
supplies it: `period.start` is the index for episode-wide measures, and a
numerator artifact has to fall inside the episode to count.

**Post-discharge measures index on the transition.** You cannot measure 7-day
follow-up without a discharge, so the follow-up, caring-contact and
safety-plan measures use a narrower denominator: patients with a documented
care transition — a
[SPiERSafetyHandoff](StructureDefinition-spier-safety-handoff.html) or a
[SPiERDischargeSafetyPacket](StructureDefinition-spier-discharge-safety-packet.html)
— with that artifact's date as the index (the most recent, where there are
several). The consequence is deliberate: **a site that has not documented a
handoff or a discharge packet cannot compute the follow-up measures at all.**
That is a true finding about the site's pathway, not a gap in the measure.

**Lethal-means counseling carries an exception, not an exclusion.** A patient
who went to a higher level of care (`psy`, `hosp`, `long`, `rehab`) or left
before disposition (`aadvice`) — read from
`Encounter.hospitalization.dischargeDisposition` — is a *denominator
exception*: removed only if the numerator is not met, so a patient counseled
before transfer still counts as a pass and a site cannot lift its score by
transferring people. It is the only exception in the set; everything else
that leaves a denominator is an exclusion, because it never belonged in the
cohort.

**Every measure is patient-based.** A patient with two positive screens or
two referrals in one period counts once; where that matters, the criterion
states its tie-break rule. Counting screens, episodes or referrals as the unit
would need a non-Patient population basis and a dependency on the CQF Measures
IG, which is more machinery than these draft measures justify.

### Choices you may want to make differently

Two criteria are judgment calls rather than settled standards, and both are
one-line changes to the CQL:

- **The 48-hour group counts an outreach *attempt*, not a successful contact.**
  The attempt is what the care team controls. A stricter reading adds a filter
  on the `outreach-outcome` extension for `patient-reached` (or also
  `reached-support-person`).
- **`revoked` referrals are not excluded.** A referral withdrawn without an
  alternative arranged is a genuine loop failure; a site that revokes referrals
  for legitimate clinical reasons may want them excluded instead.

Two measures on the source list are **not** authored and are named here so the
gap is visible: CARS-S completion (the instrument is a licensing no-go for
SPiER) and SCS-R treatment-response monitoring (SPiER has no SCS-R artifact).

### Dashboards, exports and sharing

The remaining three Stage-8 tools define no artifact of their own, because
none is a new kind of data:

- **[The reporting dashboard](ActivityDefinition-ProvideReportingDashboard.html)**
  is a *rendering*: measure tiles read summary MeasureReports, and operational
  counts read the registry query the
  [active-registry activity](ActivityDefinition-MaintainRiskRegistry.html)
  defines (`EpisodeOfCare?type=suicide-safer-care&status=active`, plus the
  open Tasks — see *Do not assume `_revinclude`* on
  [Quick Starts](quick-starts.html)).
- **[Data export](ActivityDefinition-ExportSuicideSaferCareData.html)** is a
  *serialization*: a Bulk Data `$export` of the profiled types, every one of
  which already mandates the discrete date measurement needs.
- **[Data sharing](ActivityDefinition-ShareSuicideSaferCareData.html)** is a
  *transport*: every item on the shareable list is already a SPiER profile, the
  harmonized
  [SPiERSuicideRiskConcept](StructureDefinition-spier-suicide-risk-concept.html)
  is the minimum viable payload, and restrictions are enforced from the
  [SPiERInformationSharingConsent](StructureDefinition-spier-information-sharing-consent.html)
  at assembly time — the
  [discharge safety packet](StructureDefinition-spier-discharge-safety-packet.html)
  is the worked example, recording anything withheld and its basis.

What these three require is that the workflow resources are readable,
searchable and movable — a conformance requirement, stated by the
[Quality Reporter](CapabilityStatement-quality-reporter.html)
CapabilityStatement, whose access pattern is population-wide.

### What is and isn't verified

The `Measure` resources are validated, and the **CQL is compiled** — the
publisher translates it to ELM on every build and fails on a translation
error. Translation proves the logic is well-formed and its definitions
resolve; it does not execute the CQL against data. A reference implementation
of the same measures exists in the companion app, covered by its own test
suite and tied to these `Measure` resources by name. That the CQL and the
reference implementation compute equivalent answers is asserted, not yet
tested.
