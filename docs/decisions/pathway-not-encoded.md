# What the Suicide Safer Care Pathway deliberately does not encode

**Decided:** 2026-09 (PR [#454](https://github.com/SPiER-Project/adoption-guide/pull/454),
which published the pathway as a PlanDefinition; the plan is
[`plans/suicide-safer-care-pathway.md`](../plans/suicide-safer-care-pathway.md)
and the source diagram is transcribed in
[`reference/suicide-safer-care-pathway-spec.md`](../reference/suicide-safer-care-pathway-spec.md)).
**Rule, as published:** Care Pathway § *What is deliberately not encoded*.

## The principle

A published protocol must not encode what is not settled. Three things the
source diagram states are absent from the artifact, each blocked on an open
clinical question; a fourth is published as prose and no interval.

## Step-down criteria

The diagram's de-escalation rule combines a "No"-answer streak, a
milestone-event window, a minimum time in tier and psychiatric-consultant
agreement — and the streak length is asymmetric (30 days at low and moderate,
90 at high) in a way nobody has confirmed is intentional. Publishing it would
tell a site to de-escalate risk on an unreviewed rule. The tier branch
therefore covers low, moderate and high only, with no step-down actions.

## Milestone events

The diagram's list is explicitly open-ended ("include, but are not limited
to"), so there is no closed vocabulary to publish. A partial code system would
read as a complete one, and a consumer would treat an event outside it as not
a milestone.

## A "historical" tier

`SPiERSuicideRiskTier` has no `historical` code. Verification against the
published C-SSRS found that the response pattern the diagram calls Historical —
behavior endorsed lifetime-only — is scored **Moderate** by the instrument
itself; the fourth tier is structure layered on top of the instrument. Whether
it belongs as an orthogonal history flag rather than an ordinal tier is open,
and until it is answered the tier set stays as the instruments define it.

## Frequency of patient contact

The diagram gives frequency of patient contact as a row separate from
reassessment cadence, with values that coincide at the higher tiers and
diverge at the lower ones. Whether that is one rule or two is an open
question, so the pathway publishes the obligation as prose on the clinician
guidance step and no interval.

## `imminent` and `no-risk`

The tier branch omits both for the reasons the reassessment schedule already
records: a patient at imminent risk is in active escalation rather than on a
routine protocol, and a no-risk patient is not on the pathway at all.

## Why the cadence is referenced and never restated

Each tier group reaches its reassessment interval by `definitionCanonical` to
`SPiERReassessmentSchedule`; there is no `timingDuration` and no numeric
interval anywhere in the pathway artifact. This is not tidiness. The per-tier
interval is already stated three times — in that PlanDefinition, in the app
that derives due dates from it, and in the measure CQL that scores against it —
and a drift gate holds those three in agreement (`check:reassessment`). A
fourth statement, in a document nothing compares against, is exactly the
failure that gate was built to prevent, so a second gate (`check:pathway`)
fails the build if one appears in the pathway. Both gates are described in
[`../internals/measures.md`](../internals/measures.md) and CLAUDE.md.

## What would reopen it

Clinical review confirming (or correcting) the step-down asymmetry; a closed
milestone vocabulary; a decision on whether "historical" is a flag or a tier;
or a ruling that contact frequency and reassessment cadence are one rule.
