# Aligning with the HL7 US Behavioral Health Profiles IG without depending on it

**Decided:** 2026-08 (the investigation is
[`research/2026-08-us-behavioral-health-profiles-ig.md`](../research/2026-08-us-behavioral-health-profiles-ig.md)).
**Rule, as published:** Relationship to Other IGs.

## The decision

SPiER uses the same LOINC codes as the US Behavioral Health Profiles IG
wherever both describe the same datum, and declares **no** FHIR package
dependency on it.

## Why align

The BH Profiles guide is the USCDI+ Behavioral Health data-element layer, and a
system conforming to both should never see two codings for one concept. The
alignment is exercised, not just asserted: that guide's published PHQ-9 and
C-SSRS QuestionnaireResponses are checked into SPiER as test fixtures, and
SPiER's code-based dispatch fallback reads both — recovering the same PHQ-9
total (12) and the same C-SSRS risk level the guide's own examples state.
Worth knowing if you produce that shape: those examples carry their LOINC code
**only in `linkId`** (as `/44250-9`), because R4 `QuestionnaireResponse.item`
has no `code` element, and the C-SSRS one points `questionnaire` at a PDF
rather than a `Questionnaire` canonical.

The "Suicide Risk Assessment" row of the two guides' comparison is the
sharpest illustration of why SPiER exists beside it: that guide's worked story
has an ED nurse administer a C-SSRS and the psychiatrist read a low risk off it
— and then nothing consumes the result: no derived concept, no safety plan, no
follow-up, no measure. The slot is declared and unfilled, which is precisely
the Translate/Act layer SPiER supplies.

## Why not depend

That guide is an early CI build (v0.1.0, pre-ballot) whose artifacts change
frequently; binding SPiER's conformance to unstable artifacts would be
premature. The build supported the judgement when inspected on 2026-08-12: its
three profiles derive from **US Core 7.0.0** while its examples still pin
`us-core-questionnaireresponse|6.1.0`; the change log documents a "0.2.0"
while the package is `0.1.0`; six data elements that change log says were
**removed** are still live rows in the crosswalk table (so the crosswalk is not
a safe element list); the `ImplementationGuide` declares
`hl7.org/fhir/us/bhp/…` while every artifact uses `fhir.org/guides/astp/bhp/…`;
and the narrative disagrees with its own examples about the patient's
coverage. None of this is unusual for a pre-ballot CI build — it is simply why
the dependency waits. Read the US Core version off each artifact rather than
off the guide.

## What would reopen it

A stable ballot release of the BH Profiles guide, at which point a formal
dependency and a declared conformance relationship become worth their cost.
