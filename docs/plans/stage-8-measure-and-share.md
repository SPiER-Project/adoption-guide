# Stage 8 — Measure and Share the Data: FHIR design

Design for the four Stage-8 tools, per
[`ssc-stage-tiles-rollout.md`](ssc-stage-tiles-rollout.md) Wave 6. Wave 6 is
split the same way Stage 7 was: this PR is the definitional layer (Measures,
CQL, MeasureReports, conformance), and a follow-up PR makes it live in the app.

Artifacts: [`ig/input/fsh/measure-and-share.fsh`](../../ig/input/fsh/measure-and-share.fsh),
[`ig/input/cql/SPiERSuicideSaferCareMeasures.cql`](../../ig/input/cql/SPiERSuicideSaferCareMeasures.cql),
[`ig/input/pagecontent/measurement.md`](../../ig/input/pagecontent/measurement.md).
Requirements source: [`docs/reference/ssc-stage-tiles-question-set.md`](../reference/ssc-stage-tiles-question-set.md),
Stage Tile 8.

---

## The core insight

Stage 8 is the shortest stage in the guide, and that is the finding rather than
a shortcut. **Every measure is a query over artifacts stages 1–7 already
produce.** Nothing in this stage asks a site to capture anything new.

That only became true when Stage 7 landed. Measures need a cohort with an index
date, and before `SPiERSuicideRiskEpisode` there was no resource asserting
*"this patient is in suicide-safer care, starting on this date"*. Any measure
written before Stage 7 would have had to invent its own cohort out of loose
observations — and two sites would have invented different ones, making the
numbers incomparable, which is the failure mode quality measurement exists to
avoid.

| Tool | Artifact | How |
|---|---|---|
| **TL-042** KPI / Measure Reporting | 7 `Measure` + 1 `Library` + `MeasureReport`s | The measures below |
| **TL-043** Reporting Dashboard | *(none — a rendering)* | Summary MeasureReports + the TL-037 registry query |
| **TL-044** Data Export | *(none — a serialization)* | Bulk Data `$export` of the existing profiles |
| **TL-045** Data Sharing | *(none — a transport)* | The existing profiles, gated by TL-032 consent |

Three of the four tools produce nothing. That is the same asymmetry Stage 7 had
with TL-037 (the registry is a query, not a resource), and it is handled the
same way: the ActivityDefinitions are kept because the tools are catalogued and
the stage PlanDefinition references them, but they declare no output profile.
What they actually require — that the workflow resources be readable,
searchable, and movable — is a **conformance** statement, so it lives in the
CapabilityStatements.

## The measures

| # | Measure | Groups | Denominator |
|---|---|---|---|
| 1 | Positive Screen → Assessment | 1 | Patients with a positive screen |
| 2 | Current Risk Level Documented | 1 | Patients in an episode |
| 3 | Safety Plan Before Discharge | 2 (plan; patient copy) | Patients with a documented transition |
| 4 | Lethal Means Counseling | 1 | Patients in an episode |
| 5 | Follow-Up Timeliness | 3 (48h; 7d; 30d) | Patients with a documented transition |
| 6 | Caring Contact Adherence | 1 | Patients with a documented transition |
| 7 | Referral Loop Closure | 1 | Patients with a referral |

Seven measures, ten groups, covering ten of the twelve items on the SSC's
measure multiselect (Stage Tile 8, tool 1, question 2).

---

## Design decisions worth reviewing

### 1. Post-discharge measures index on the transition, not the episode

You cannot measure 7-day post-discharge follow-up without a discharge. So
measures 3, 5, and 6 narrow the denominator to patients with a **documented
care transition** (`SPiERSafetyHandoff` or `SPiERDischargeSafetyPacket`) and use
that artifact's date as the index. Most recent wins where there are several.

**Consequence, stated plainly:** a site that has not adopted TL-009 or TL-030
cannot compute the follow-up measures at all. That is deliberate. A follow-up
rate computed against an undefined discharge is not a number anyone should act
on, and reporting one anyway would be worse than reporting nothing. This is the
main thing to sanity-check in review — the alternative is to fall back to
`episode.period.start` as the index, which always exists but measures something
subtly different ("follow-up after entering the registry", not "after
discharge").

### 2. Every measure is patient-based

Each criterion returns a boolean. The alternative — counting screens, episodes,
or referrals as the population unit — needs a non-Patient population basis,
which in FHIR means the CQFM `cqfm-populationBasis` extension and a dependency
on `hl7.fhir.us.cqfmeasures`. That is more machinery than these draft measures
justify.

The cost is real and worth knowing: a patient with two positive screens or two
referrals in one period counts once. Where that matters the criterion states
its tie-break rule ("the most recent in the period is the index"), and the rule
is repeated in the Measure's population description so it is visible without
reading CQL.

### 3. Measure 2 reads the Observation, not the cached tier

`SPiERSuicideRiskEpisode` carries an `episode-current-risk-tier` extension — a
denormalized cache so the registry can sort by tier without joining the
observation history. Measure 2 deliberately does **not** read it. The extension
can be stale or hand-set; measuring it would measure the cache rather than the
care. The numerator requires a `SPiERSuicideRiskConcept` Observation dated
inside the episode.

### 4. The 48-hour group counts an attempt, not a contact

The care team controls whether an outreach attempt is made; it does not control
whether the patient answers. So the numerator is "an attempt was sent within 48
hours". A site preferring the stricter reading adds a filter on the
`outreach-outcome` extension — a one-line CQL change, documented on the
measurement page rather than buried.

Reasonable people will disagree with this one. It is called out as a choice
rather than presented as settled.

### 5. `revoked` referrals are not excluded

Only `entered-in-error` is excluded from measure 7. A referral withdrawn
without an alternative arranged is a genuine loop failure. Sites that revoke
for legitimate clinical reasons may want this different; also flagged on the
measurement page.

### 6. Retrieves filter on profile, not on code

SPiER's stage-5/6/7 artifacts are distinguished by conformance claim and
extension values, not by codes — a follow-up Appointment and a routine
Appointment differ by profile, not by a SNOMED code. So the CQL retrieves the
base resource type and filters with a `ConformsTo` helper. This also keeps the
library computable against a plain FHIR server with no SPiER-specific search
parameters.

### 7. Two SSC measures are deliberately not authored

CARS-S completion (the instrument is a licensing no-go for SPiER) and SCS-R
treatment-response monitoring (no SPiER artifact exists to measure over). Both
are named on the measurement page rather than silently dropped, so the gap is
legible to an adopter comparing SPiER against the SSC list.

---

## What Stage 8 proved about stages 5–7

Worth recording, because it is the strongest available evidence that the
earlier modelling calls were right rather than merely defensible:

- **TL-017 as `ServiceRequest`** — referral loop closure is `sent` vs
  `completed`. With the `Communication` shape the earlier draft used, this
  measure would have been uncomputable. The demo recorder is still on
  Communication; that gap is tracked in
  [the Stage 5 doc](stage-5-coordinate-handoffs.md) and now has a measure
  depending on it.
- **TL-034 producing no resource** — the 7-/30-day groups need
  `Appointment.status = fulfilled`. Stage 6 declined to mint an
  "appointment tracking" resource on the grounds that `Appointment.status`
  already carried it. The measures read exactly that field, so the parallel
  resource would have been pure sync burden.
- **The caring-contact opt-out extension** — exists so opt-outs can be a
  denominator *exclusion*. Without it, a site correctly honoring a patient's
  wish would be scored as having failed to send contacts.
- **One shared handoff-content vocabulary** — "did the patient leave with a
  copy of the safety plan" is answerable only because TL-009 and TL-030 share
  one code list.

## Example instances

The individual MeasureReport is the end-to-end artifact: its `evaluatedResource`
list walks one patient from the episode that created the denominator, through
the handoff that set the index date, to each numerator artifact.

Two of those artifacts are minted in `measure-and-share.fsh` rather than reused
from stages 5/6, and the reason is itself a finding. The Stage-5 example
appointment is `booked` and the Stage-6 example outreach is sent seven days
after the handoff — **neither satisfies the numerator it would be cited for**.
Those examples are correct for their own stages (a booked appointment *is* the
point of TL-031), which is precisely why measure examples need instances
positioned relative to an index event. Citing them anyway would have produced
an example whose arithmetic did not hold.

## Verification

`npx sushi` compiles clean. Note what that does **not** cover: SUSHI does not
translate CQL, so a syntax or reference error in the measure logic will not be
caught by `npm run verify` or the light `ig.yml` CI job. The gate is the IG
Publisher workflow, which runs `cql-to-elm`; `ig-publish.yml` now includes
`ig/input/cql/**` in its pull-request path filter for that reason. A standalone
translator would have been lighter, but `cqframework` publishes no
fat jar on Maven Central, so a standalone job would have needed Maven or Gradle
to resolve a classpath — more moving parts than reusing the publisher.

## Scope

Definitional only: Measures, the CQL library, MeasureReport examples, the four
ADs promoted out of `pathway-tool-placeholders.fsh`, stage-PD outputs, the
CapabilityStatement additions, and the IG page.

With this, **all four Stage-8 placeholders are drained**. What remains in
`pathway-tool-placeholders.fsh` is TL-026 (generalized workflow trigger),
TL-028 (CARS-S — licensing NO-GO), and TL-029 (site-defined local tool) — none
of which is scheduled.

## Follow-ups

- **Wave 6, part 2 — make it live.** A measure engine in `web/src/lib/` that
  computes MeasureReports over the real patient registry, plus the TL-043
  dashboard that renders them. The TypeScript becomes the executable reference
  implementation of the same named definitions, and a drift guard should tie
  the TS measure ids to the FSH `Measure` ids (the pattern
  `check:catalog` / `check:crosswalk` already establishes).
- **Bind `Measure.library` to a published Library with content.** Currently the
  Library declares `contentType` but no `data`; the IG Publisher injects the
  translated CQL at render time. If SPiER ever needs the Library to be
  self-contained outside a publisher run, that inlining has to be automated,
  not hand-pasted.
- **Migrate the TL-017 referral recorder from Communication to ServiceRequest**
  — now blocking measure 7 from computing against demo data, not just an
  IG/app inconsistency.
