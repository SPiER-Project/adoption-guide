# Licensing status is a coded extension, and it is allowed to say `unknown`

**Decided:** 2026-08 (issue [#127](https://github.com/SPiER-Project/adoption-guide/issues/127)).
**Rule, as published:** Conformance § *Categories and codes every profile
carries*. **Artifacts:** `instrument-licensing-status` extension and its
CodeSystem in [`instrument-licensing.fsh`](../../ig/input/fsh/instrument-licensing.fsh);
the evidence behind each status is the per-tool memo at
`ig/input/resources/questionnaires/<tool>/licensing/MEMO.md`, and what is still owed is
[`best-practices/licensing-verification-backlog.md`](../best-practices/licensing-verification-backlog.md).

## The decision

Every ActivityDefinition carries two licensing facts: a `copyright` notice in
prose, and a coded status carrying the same fact in one filterable value. The
app derives its licensing display from the code; nothing hand-types it.

## Why an extension and not `copyrightLabel`

`ActivityDefinition.copyrightLabel` is an R5 element, and this guide is R4, so
it does not exist here. A short free-text label would in any case be weaker
than a bound code, since the point of the field is that an adopter can filter
on it. If SPiER moves to R5, the right migration is to populate
`copyrightLabel` from the code's display and keep the coded extension as the
machine-readable half.

## Why `unknown` is a real value

`unknown` is a positive statement that SPiER's licensing audit has not
established the answer — not a synonym for unrestricted, and not a permissive
guess. Each `copyright` notice names where its claim comes from: a filed
licensing memo, a notice recorded on the corresponding questionnaire and not
verified at source, or an explicit statement that the status is unknown. A new
tool with unsettled terms gets `unknown`.

## The limit of every status

Every status traces to something recorded, but **none has been checked against
what the rights holder publishes today**, and four instruments — PHQ-9, SBQ-R,
CAMS and Stanley-Brown — have no audit memo at all. That is why the published
rule is an adopter-side SHALL: verify against the rights holder's current terms
before deploying an instrument, and do not read a status here as clearance.
