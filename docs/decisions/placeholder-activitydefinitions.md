# Placeholder ActivityDefinitions carry no codes on purpose

**Decided:** 2026-07, with the stage-tiles restructure; published as rationale
by [#472](https://github.com/SPiER-Project/adoption-guide/pull/472).
**Rule, as published:** Conformance § *Categories and codes every profile
carries*. **Artifacts:** the three Instances in
[`pathway-tool-placeholders.fsh`](../../ig/input/fsh/pathway-tool-placeholders.fsh).

## The decision

A few pathway steps are published as minimal ActivityDefinitions carrying only
structural metadata: url, name, version, title, status, description, purpose
and kind. They deliberately carry **no** LOINC or SNOMED codes, **no**
questionnaire binding, and **no** derived-Observation profile.

## Why the gaps are not filled

Each of those would require verified terminology and an authored questionnaire,
and inventing them is how a guide comes to assert things nothing verified. The
placeholder says what SPiER can say today: that the pathway has this step, what
it is for, and what kind of activity it is. One of the three (CARS-S) is a
licensing no-go and will stay a placeholder; the others await an authored
instrument.

## What a consumer should take from it

A code-less ActivityDefinition is a catalogue entry, not a modelled instrument.
Its stage membership is still real — it is referenced by exactly one stage
PlanDefinition action, like every other activity — so it appears in the
pathway and the app's tool catalogue shows it as such.
