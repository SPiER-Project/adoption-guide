# Open questions for the Zero Suicide Institute

> **Status: not yet raised.** These four questions gate calling the Zero Suicide
> ↔ SPiER mapping final. They lived on the published IG page
> [`ig/input/pagecontent/zero-suicide-mapping.md`](../../ig/input/pagecontent/zero-suicide-mapping.md)
> until 2026-08-20 and were moved here because correspondence with an external
> body is not a specification statement — a reader of the IG cannot act on them,
> and their presence on a spec page implies the Institute has been asked.
>
> **The IG page still carries the review-status caveat**, so nothing about the
> mapping's provisional standing is now unstated. What moved is the agenda, not
> the disclaimer.
>
> When one is answered, the answer belongs in the mapping page (it changes what
> the guide asserts), and the question is struck here.

The mapping itself — the seven-elements scope table and the stage decomposition
rationale — stays in the IG, because it is the reasoning behind the published
[`spier-pathway-stage`](../../ig/input/fsh/pathway-stages.fsh) CodeSystem: why
*Identify* becomes three stages is why that CodeSystem has eight codes.

## The four questions

1. Is the decomposition of *Identify* into Identify Possible Risk → Clarify Risk
   → Define the Risk Picture faithful to the framework's intent, or does it
   over-fragment what Zero Suicide treats as one workflow element?
2. Should SPiER's *Measure and Share the Data* stage explicitly reference the
   Zero Suicide outcome measures (e.g. attempts per 1000 patients,
   time-to-safety-plan), and if so, with what FHIR Measure profiles?
3. Are there Zero Suicide-published code systems (for assessment instruments,
   safety-plan elements, etc.) that SPiER should reference directly rather than
   defining locally?
4. Co-authorship attribution: how should the Zero Suicide Institute appear in
   this IG's `publisher` and `author` metadata?

## Why each one has a cost attached

Worth knowing before raising them, because two are not merely editorial:

- **Q1 is the only one that could change published artifacts.** A "yes, this
  over-fragments" answer would alter the `spier-pathway-stage` CodeSystem and
  every `PlanDefinition`, tool-catalog stage id and population fixture keyed to
  it. `npm run check:stages` and `npm run check:reassessment` are what would
  fail first.
- **Q2 overlaps work already done.** Stage 8 now publishes seven `Measure`
  resources and a CQL `Library`; the question is no longer "should there be
  measures" but whether the Zero Suicide outcome measures should join the
  existing set. `ig/input/pagecontent/measurement.md` states which two the SSC
  asked for and were deliberately not authored, and why.
- **Q4 interacts with [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).**
  Attribution metadata is adjacent to the licensing and org-namespace questions
  that epic gates; do not settle `publisher` here in isolation.
