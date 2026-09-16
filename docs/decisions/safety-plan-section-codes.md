# Safety-plan section codes are SPiER-local, and there are two section systems

**Decided:** 2026-08 (issue [#220](https://github.com/SPiER-Project/adoption-guide/issues/220),
PR [#224](https://github.com/SPiER-Project/adoption-guide/pull/224); published as
rationale by [#472](https://github.com/SPiER-Project/adoption-guide/pull/472)).
**Rule, as published:** Conformance § *Categories and codes every profile
carries*. **Artifacts:** `CodeSystem/safety-plan-section`,
`CodeSystem/cams-careplan-section`, both in [`ig/input/fsh/`](../../ig/input/fsh/).

## The decision

The [safety-plan section codes](../../ig/input/fsh/safety-plan-section.fsh)
identify which section of a narrative safety plan a CarePlan activity belongs
to — a warning sign, a coping strategy, a crisis contact. They are SPiER-local
because LOINC publishes nothing at that granularity. SPiER's default is a
published code; a local code is a cost imposed on every consumer, so the search
that came up empty is recorded here.

## The search

LOINC 2.82 was expanded per section against a terminology server for every
phrasing the sections use: warning sign, early warning, prodrome, crisis
trigger, coping strategy, self-management, distraction, social setting, crisis
contact, support person, crisis line, hotline, professional service, lethal
means, means safety, means restriction, access to means, firearm, secure
storage, reason for living, worth living, protective factor, safety planning,
crisis response plan.

The near-misses are worth naming, because each is the kind of code a reviewer
would reasonably propose:

- **`44943-9` "Self management"** and **`44941-3` "Barriers to self
  management"** are generic care-plan concepts. Neither is the Stanley-Brown
  *internal coping* construct — what a patient can do alone, without contacting
  anyone.
- **Every "reason for living" hit** — `61972-6`, `71025-1`, `91476-2`,
  `92083-5`, `68005-8` — is a *scaled survey item* measuring agreement over the
  past seven days. None is a slot for narrative content.
- **`56796-6` "Emergency contact information panel"** and its Name / Address /
  Phone / Relationship children are real, and would genuinely fit if SPiER
  modelled the crisis-support and professional-support steps as structured
  contacts rather than free text. That is a real future opportunity. It is not
  a section code.

Every use of these codes carries SPiER's coding-verification-status extension
as `no-standard-binding` — the terminal state meaning *no published code exists
for this concept*, as distinct from *not yet checked*.

Six earlier LOINC codes for these sections were fabricated or misused (#220):
six did not exist in LOINC, and `81344-4` resolved to healthcare-agent
disclosure authority rather than "reason for living" — a real code that
validated cleanly while meaning the wrong thing. That is the price the local
codes avoid.

## `87626-8` at document level

One real LOINC code does apply, at document rather than section level:
`87626-8` "Suicide prevention note". Both narrative safety-plan profiles carry
it in `CarePlan.category`, alongside the SNOMED treatment-escalation-plan code
and the SPiER domain code, for one reason: discoverability by
suicide-prevention consumers querying for the plan. It is a LOINC
**document-type** concept whose most precise home would be `Composition.type`
or `DocumentReference.type`; `CarePlan.category` is `example`-bound, so the
placement is legal, and the rule that a consumer must not read it as a claim
that the CarePlan is a document is what makes it defensible. It is required on
the two *narrative* plans only; the two CAMS plans share the underlying
structure but are not the same kind of artifact.

## Two section systems, kept separate

The [CAMS care-plan sections](../../ig/input/fsh/cams.fsh) overlap the
safety-plan set on four concepts — lethal-means reduction, coping strategies,
emergency contact, support network. They stay separate because the CAMS
sections are defined by the CAMS framework, which orders and scopes them
differently, while the safety-plan codes follow the Stanley-Brown and Crisis
Response Plan templates. Collapsing them would make one framework's structure
describe the other's document. A consumer that needs to relate the two should
expect a ConceptMap, which is how SPiER relates vocabularies elsewhere; none is
published because no consumer has needed one.

## What would reopen it

A LOINC release publishing section-level safety-plan concepts (the
`56796-6` panel is the closest thing today), or a consumer that needs the two
section systems related.
