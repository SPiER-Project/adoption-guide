# The measure layer

A measure criterion lives in four places, and what ties each pair together —
plus why an exclusion and an exception are not interchangeable.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

⚠️ **A measure change lands in FOUR places, and `check:measures` only ties two
of them together.** A population criterion lives in `ig/input/fsh/measure-and-share.fsh`
(the published definition), `ig/input/cql/SPiERSuicideSaferCareMeasures.cql` (the
portable statement, compiled by the IG Publisher) and `packages/core/src/lib/measures.ts`
(the executable reference implementation the app runs) — and if it changes
scoring, in `MeasureDashboard.tsx` too. `check:measures` asserts the FSH
criterion names and the TS implementations agree in both directions; the
publisher asserts the CQL compiles; and `tests/measuresCqlParity.test.ts`
asserts the CQL and the TypeScript compute the same answer.

⚠️ **Before that test, nothing compared what the two COMPUTE, and a planted
7→8-day change to the follow-up window in `measures.ts` passed every gate and
every test.** The test translates the CQL in-process with `@cqframework/cql` —
the same translator the IG Publisher bundles — executes it with `cql-execution`
over the 14 demo patients and a set of synthetic patients sitting on every
window edge (`tests/cql/boundaryPatients.ts`: day 7/8, 24h/25h, 48h/49h, each
cadence ±1 day), and compares every population of every Measure group per
patient. What it cannot see:

- **a disagreement no patient reaches.** It compares answers, not logic. A new
  criterion or window needs a boundary patient, and each boundary patient states
  what the TypeScript is designed to answer so a fixture that misses its edge
  fails as a fixture rather than agreeing on both engines.
- **a divergence in `KNOWN_DIVERGENCES`.** That ledger holds the real
  disagreements found when the test was written — eight root causes, from a
  safety plan dated by `created` (which the CQL ignores) to whole days versus
  elapsed time on the reassessment cadence. Each line is a patient the published
  measure and the dashboard score differently. It is exact both ways: a new
  divergence fails, and so does a line that has stopped diverging. Do not add a
  line without deciding which engine is wrong.
- **scoring.** It compares population membership; how exclusions and exceptions
  combine into a score lives only in `evaluateMeasure` (below).

It needs the IG's `fhir.cqf.common` package in `~/.fhir/packages` (FHIRHelpers
and the FHIR model info), which SUSHI downloads — run `npm run copy-fhir` first.
A missing package fails the test; it never skips.

⚠️ **`denominator-exclusion` and `denominator-exception` are not
interchangeable, and the engine treats them differently on purpose (#324).** An
exclusion is removed outright — the case never belonged in the cohort. An
exception is removed **only if the numerator is not met**, so a patient who met
the criterion *and* the numerator stays in and counts as a pass. Consequences
worth knowing before adding either:

- the exception's count is `removedByException`, **not** the raw population
  flag. Tallying the flag would subtract a case that is still being scored, and
  the score can then exceed 100%.
- the numerator has to be resolved before the denominator can be, which is why
  `evaluateMeasure` computes it first.
- lethal-means counseling is the only exception in the set today: transfer to a
  higher level of care (not yet due) or departure before disposition (no
  opportunity), read off `Encounter.hospitalization.dischargeDisposition`.

⚠️ **The demo's narration and the demo's measures can disagree, and only one
test looks.** Patient-011's walkthrough said "Lethal-means counseling delivered
and documented" while her scenario carried no Procedure, so the dashboard scored
her a *miss* on a step her own chart calls completed — for as long as the ED
scenario had existed. `measures.narration.test.ts` gates it from both ends: a
narrated-completed step must reach the numerator it claims, and **any** measure
miss for a patient who has a `walkthrough` must be written down in
`EXPLAINED_MISSES` with a reason. That allowlist is empty today, which is the
finding — every remaining miss among the ED patients is a pass, an exclusion or
an exception. It does NOT assert that a step materializes every resource type it
names: 21 completed steps name a SPiER-profiled type with no artifact behind it,
which is filed separately.

