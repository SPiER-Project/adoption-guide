# The domain category slice is `1..1`, not `0..1`

**Decided:** 2026-08 (PRs [#271](https://github.com/SPiER-Project/adoption-guide/pull/271),
[#311](https://github.com/SPiER-Project/adoption-guide/pull/311),
[#325](https://github.com/SPiER-Project/adoption-guide/pull/325)).
**Rule, as published:** Conformance § *Categories and codes every profile
carries*; the queries it enables are on Quick Starts.

## The decision

Every SPiER resource with a native `category` element carries
`http://thespierproject.org/fhir/CodeSystem/spier-concept-domain#suicide-risk`
in addition to its own clinical category, so that one query per resource type
assembles the whole suicide-safer care record without knowing which instrument
or workflow step produced any part of it — the Gravity Project pattern. The
slice is **required**.

## Why required and not optional

An optional domain tag would answer *"some of the record, sometimes"*, which is
not a queryable guarantee: a consumer could not distinguish a resource that was
never tagged from a patient who has no such resource. A query is only worth
issuing if a negative result means something, and that requires the tag to be
mandatory wherever the profile applies.

Two further properties of the rule, both deliberate:

- It is **additive**. No profile loses a category it already had. Standard
  categories such as `survey`, `procedure` and `problem-list-item` sit alongside
  the domain code rather than competing with it, and the slicing is open, so a
  resource may carry additional categories SPiER has not named.
- The domain axis and the pathway-stage axis are **orthogonal**. The domain says
  what a resource is about; the stage says where in the pathway it arose.
  Neither is derivable from the other.

Naming `survey` as a slice on the instrument Observations has a second
consequence: it is the element `us-core-observation-screening-assessment`
requires, and it is therefore what makes a SPiER instrument Observation
conformant to the profile the HL7/ASTP US Behavioral Health Profiles crosswalk
names for its *Suicide Risk Assessment* element.

## The defect that shaped the slicing

The standard categories were originally written as whole-value
`* category[+] = <coding>` rules, and SUSHI resolved the domain slice onto
index 0 — so 23 of 25 example Instances silently **lost** their `survey` /
`procedure` / `problem-list-item` / SNOMED category, and no gate saw it, because
a missing optional category is not a validation error. The profiles now declare
their standard category as a **named slice**, which fixed the loss and made the
instrument Observations conformant to the US Core screening-assessment profile.
[`docs/internals/ig-build.md`](../internals/ig-build.md) has the gate that
keeps it fixed.

## The three types with no `category`

`Appointment`, `EpisodeOfCare` and `Task` have no `category` in R4, and each
was settled on its own merits: `Appointment` is tagged through
`serviceCategory` (a real search parameter SPiER was not already using);
`EpisodeOfCare` is already equivalent through its required `type`; `Task` is
deliberately untagged because `Task.code` carries the safety-task vocabulary and
the resource is reachable by `encounter` and `basedOn`. Quick Starts states the
consequence for queries.
