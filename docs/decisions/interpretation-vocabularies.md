# `Observation.interpretation`: two vocabularies, not yet one

**Status:** an open inconsistency, recorded rather than resolved (published as
such by [#472](https://github.com/SPiER-Project/adoption-guide/pull/472)).
**Rule, as published:** Conformance § *`Observation.interpretation` differs by
layer*.

## What the artifacts do

The harmonized concept Observation requires exactly one `interpretation`,
extensibly bound to the standard FHIR observation-interpretation value set.
That set contains both of the pairs below, so the profile does not choose
between them:

- **The concept layer uses `POS` / `NEG`.** This is the Gravity Project and
  SDOH-aligned choice, and it is what a screening-level signal actually means:
  positive or negative for follow-up, not high or low on a scale.
- **The instrument layer uses `A`, `H` and `L`** — abnormal, high, low. These
  read a native instrument result against that instrument's own thresholds,
  which is a different kind of statement.

SPiER's own examples follow that split consistently. Nothing enforces it, and
harmonizing the two has not been done.

## Why it is recorded as open

A consumer reading `interpretation` across both layers will meet both
vocabularies, so the guide states the consequence (do not assume one
vocabulary; read `derivedFrom` to know the layer) rather than pretend the
question is settled. The candidates for settling it are a fixed `POS`/`NEG` on
the concept profile alone, or a per-layer required binding; either needs the
clinical sign-off the crosswalks are also waiting on.
