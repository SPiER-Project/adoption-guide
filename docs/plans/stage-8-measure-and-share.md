# Stage 8 — Measure and Share the Data: FHIR design

Design for the four Stage-8 tools, per
[`ssc-stage-tiles-rollout.md`](ssc-stage-tiles-rollout.md) Wave 6. Wave 6 was
split the same way Stage 7 was: part 1 was the definitional layer (Measures,
MeasureReports, conformance, #201) and part 2 makes it live (the measure engine,
drift guard, and TL-043 dashboard). See *Implementation status* below.

Artifacts: [`ig/input/fsh/measure-and-share.fsh`](../../ig/input/fsh/measure-and-share.fsh),
[`ig/drafts/SPiERSuicideSaferCareMeasures.cql`](../../ig/drafts/SPiERSuicideSaferCareMeasures.cql),
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
| **TL-042** KPI / Measure Reporting | 7 `Measure` + `MeasureReport`s | The measures below |
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

### 6. Workflow resources match on profile; Observations match on code

SPiER's stage-5/6/7 workflow artifacts are distinguished by conformance claim and
extension values, not by codes — a follow-up Appointment and a routine
Appointment differ by profile, not by a SNOMED code. So those retrieves filter on
`meta.profile`, which is safe because every Stage-5/6/7 builder stamps it.

**Observations are the exception, and the implementation had to correct the
design here.** Nothing stamps `meta.profile` on a derived Observation — not this
app's mappers, and not most real EHRs — so a profile-only match scored zero.
Risk-concept Observations are therefore matched on **LOINC 93374-7**, which the
concept-layer profile *mandates*; matching the code can never be wrong and is
strictly more interoperable. See *Implementation status*.

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
  measure would have been uncomputable. The demo recorder has since been
  migrated in #202, so measure 7 computes against real demo data.
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

## Verification, and what the IG Publisher caught

`npx sushi` compiles clean (0/0) and `npm run verify` plus vitest are green. But
the first revision of this PR shipped **66 IG Publisher errors**, and the
lesson is worth recording because it changed the design.

**The CQL claim was wrong.** The first revision put the CQL under
`ig/input/cql/` and published a `Library` pointing at it, asserting that the IG
Publisher translates `input/cql` and attaches the ELM — and that
`ig-publish.yml` was therefore a CQL compile gate. It is not. The publisher log
never mentions CQL at all. The trigger bought a ~10 minute job that validated
nothing, and the visible symptom was 63 broken narrative links: the publisher
generates a link from every `criteria.expression` into the Library's rendered
CQL, and there was no rendered CQL to land on.

So the CQL moved to `ig/drafts/`, the slot this repo already uses for the draft
StructureMap `.fml` files, whose header states the rationale exactly: outside
`ig/input/`, so neither SUSHI nor the publisher touches it. The `Library` and
every `Measure.library` reference are gone — publishing a Library that declares
content it does not carry is worse than not publishing one. Promoting the CQL
back requires proving a translator in CI first, and `cqframework` publishes no
fat jar on Maven Central, so that means resolving a classpath with Maven or
Gradle.

**Four other error classes, all real:**

| Count | Cause | Fix |
|---|---|---|
| 63 | Broken narrative links from the content-less Library | Dropped the Library |
| 21 | `Measure.url` tail ≠ resource id | Renamed instances so id = url tail = `name` |
| 12 | Duplicate `population.id` — element ids must be unique per resource | Dropped population ids; `code` identifies the population |
| 8 | MeasureReport groups matched to Measure groups by `id`, not `code` | Added a `spier-measure-group` CodeSystem and `group.code` on both sides |
| 1 | `Consent` ppc-1 — needs `policy` or `policyRule` | **Pre-existing Wave 5 bug**, fixed here |
| 6 | Individual MeasureReport omitted `initial-population` and `denominator-exclusion` | A report must carry every population its Measure defines, or it cannot be checked against it |

The last row took a second publisher round to surface — it was masked by the
first round's larger failures. Errors went **66 → 6 → 0**, broken links
**39 → 0**. Worth noting as a process point: each round of this loop costs a
~10 minute publisher run, which is the practical argument for running `publish`
more often on smaller diffs rather than once per wave.

Two of those are worth dwelling on. The **group-code** one is a design
correction, not a typo: the validator is explicit that a report group is tied to
its definition by coded value, which is why Stage 8 ended up needing one small
SPiER-local vocabulary after all (the header comment originally boasted it
needed none). And the **Consent** error is not from this work — it shipped in
Wave 5, and no *PR-time* job could have caught it, because SUSHI does not
evaluate FHIRPath invariants.

### Correction: the CI gap is timing, not coverage

An earlier revision of this section claimed `publish` was "the only thing in the
repo that evaluates invariants and link integrity" and that Waves 1–5 therefore
"merged without it ever running". **Both halves were wrong, and the error is
worth correcting rather than quietly deleting**, because it would leave a
maintainer believing CI coverage is worse than it is.

`deploy.yml` carries an **identical** QA gate — the same `err = N` and
`Broken Links: N` parse, the same fail-on-nonzero — and it runs the full IG
Publisher on **every push to main**. It has been passing. So the Wave 1–5
merges *were* checked; a broken IG blocks the Pages deploy rather than shipping.
`main` was verified clean on 2026-07-29 (0 errors, 0 broken links) by both a
manual `ig-publish` dispatch and the deploy run.

The genuine problem is **when** the gate runs. Post-merge only means an
IG-breaking PR goes green, lands on `main`, and then fails the *deploy* —
surfacing as a silently stale Pages site instead of a failed check. That is what
happened with the Wave 5 `Consent` example. PR #207 addresses it directly by
adding a `pull_request` trigger on `ig/input/**`, so the follow-up this document
originally proposed is already in flight.

`ig/input/cql/**` is deliberately excluded from that trigger — the publisher does
not translate CQL, so including it would buy a heavy job that checks nothing.

## Implementation status

| Step | State |
|---|---|
| Measures + MeasureReport examples + conformance + IG page | ✅ merged (#201) |
| Measure engine, drift guard, TL-043 dashboard | ✅ this PR |

**`web/src/lib/measures.ts`** computes all 7 measures / 10 groups over a
`PatientSlice` and assembles MeasureReports, with 40 unit tests. Two structural
choices carried over from the design:

- **The measure wiring is read from the generated `Measure` JSON**, not
  hand-copied. Groups, populations, and criterion names all come from
  `data/fhir/Measure-*.json`, so adding a group in FSH automatically demands a
  criterion in TS. `npm run check:measures` gates both directions and was
  negative-tested (rename a criterion → 2 failures).
- **Window logic is reused, not reimplemented.** The 7-/30-day groups call
  `followUp.attendedWithinDays`, which Stage 6 wrote specifically so "the
  tracking view and the future MeasureReport agree on one definition".

### The correction the build forced: profile-matching was too strict

The design said retrieves should filter on SPiER profiles. That is right for the
workflow resources — the Stage-5/6/7 builders all stamp `meta.profile` — but
**wrong for Observations**: nothing in the app stamps a profile on a derived
Observation, so measures 1 and 2 scored zero against the app's own output, and
would score zero against any real EHR (most systems don't populate
`meta.profile`).

Fixed by matching the risk concept on **LOINC 93374-7**, which the profile
mandates, so code-matching can never be wrong and is strictly more
interoperable. Stage resolution likewise delegates to the app's existing
`stageForArtifact`, falling back through `derivedFrom` to the source
QuestionnaireResponse — rather than inventing a second definition of "which
stage is this".

### What the dashboard revealed: the measures audit our own capture

Verified end-to-end in the browser against an injected two-patient cohort — the
exclusion fires (denominator 2, excluded 1, score 1/1), a `noshow` correctly
fails the 7-day window while a later `fulfilled` visit clears 30-day, and every
MeasureReport renders. But **on a clean browser every group reads "no
denominator"**, because the seeded scenario data cannot exercise the measures:

| Gap | Effect | Fix |
|---|---|---|
| No seeded Stage-5/6/7 artifacts (no episodes, appointments, referrals, packets) | measures 2–7 have empty denominators | Seed a cohort |
| TL-008 has no recorder and there was no `Procedure` bucket | measure 4's numerator can never fire | Bucket added here; recorder still missing |
| TL-010 caring contacts use the generic recorder, so `caring-contact-opt-out` is never written | measure 6's exclusion can never fire from the UI | Recorder work |
| Seeded 93374-7 Observations carry no `interpretation` and use instrument-specific value systems | positivity is undecidable, so measure 1's denominator stays empty | Seed data is non-conformant to the concept-layer profile |

The last one is worth stating plainly rather than papering over: the
concept-layer profile requires `interpretation` 1..1 and a value from the tier
ValueSet. Without interpretation you genuinely cannot tell a positive screen
from a negative one, so counting those Observations anyway would put negatives
in a positive-screen denominator. **The measure is right and the data is
incomplete** — which is the useful thing a measure layer does: it audits capture
completeness rather than asserting numbers the data cannot support.

Seeding a realistic cohort is deliberately NOT in this PR: population scenario
data feeds Population View rows, pathway completion, and the journey timeline, so
it has blast radius well beyond the dashboard and deserves its own change.

## Scope

Definitional only: Measures, the CQL library, MeasureReport examples, the four
ADs promoted out of `pathway-tool-placeholders.fsh`, stage-PD outputs, the
CapabilityStatement additions, and the IG page.

With this, **all four Stage-8 placeholders are drained**. What remains in
`pathway-tool-placeholders.fsh` is TL-026 (generalized workflow trigger),
TL-028 (CARS-S — licensing NO-GO), and TL-029 (site-defined local tool) — none
of which is scheduled.

## Follow-ups

- ~~**Wave 6, part 2 — make it live.**~~ **Done in #208.** The measure engine
  (`web/src/lib/measures.ts`) computes MeasureReports over the real patient
  registry, the TL-043 dashboard renders them, and `npm run check:measures`
  ties the TS criterion implementations to the FSH `Measure` ids (19 ↔ 19),
  following the `check:catalog` / `check:crosswalk` pattern.
- **Prove a CQL translator in CI, then promote the draft CQL and publish a real
  `Library`.** Needs a Maven/Gradle classpath for `cqframework` (no fat jar on
  Maven Central), or a confirmed IG Publisher configuration — confirmed from a
  publisher log that actually mentions CQL, not assumed. **Now tracked as
  #212**, which also permits "prove it isn't feasible, then close" as an
  outcome.
- ~~Decide whether `publish` should run on all `ig/**` changes.~~ **Merged as
  #207** — see the correction above. The gate was never absent (`deploy.yml`
  runs it on every push to main); it ran too late.
- ~~**Migrate the TL-017 referral recorder from Communication to
  ServiceRequest.**~~ **Already done in #202 (Wave 5)** — this bullet was stale
  when written. `web/src/lib/handoffs.ts` maps TL-017 → `ServiceRequest` and
  `SafetyReferralView.tsx` records one. The residual gap is seed data: no
  scenario file contains a `ServiceRequest`, so `SPiERReferralCompletion` still
  cannot compute — folded into #209.

### The gap table above is now tracked

Each row of "What the dashboard revealed" has an issue, filed in the 2026-07-29
audit rather than left in this doc:

| Gap | Issue |
|---|---|
| No seeded Stage-5/6/7 artifacts (episodes, appointments, referrals, packets) | #209 |
| TL-008 has no `Procedure` recorder | #210 |
| TL-010 never writes `caring-contact-opt-out` | #211 |
| Seeded `93374-7` Observations non-conformant to the concept-layer profile | #77 (upstream; #180 is marked `blocked_by` it) |

The dependency chain is recorded on GitHub as real `blocked_by` links:
#93 + #92 → #77 → #180 → #181, with #209/#210/#211 also blocking #180.

Presentation of the all-empty state was #213, **done**. The dashboard now says
which artifact each empty measure is waiting on, and this table is the source of
that copy — `web/src/lib/measureGaps.ts` keys the same four gaps by `Measure.id`.
The explanations are derived from the tally rather than hard-coded, so a measure
stops explaining itself the moment it computes; when #209 seeds a cohort, the
notes for the measures it unblocks disappear on their own. `measureGaps.test.ts`
asserts the mapping covers `MEASURE_SPECS` in both directions, so a Measure added
in FSH fails the test rather than silently falling back to generic copy.
