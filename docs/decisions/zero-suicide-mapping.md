# How the eight SPiER stages map onto Zero Suicide's seven elements

**Decided:** 2026-07 (the stage-tiles restructure; source spec transcribed in
[`reference/ssc-stage-tiles-question-set.md`](../reference/ssc-stage-tiles-question-set.md)).
**Rule, as published:** Zero Suicide ↔ SPiER mapping (the two tables). Status:
draft for Zero Suicide Institute review, not yet reviewed.

## Why a mapping page exists at all

Zero Suicide is organized around seven elements; SPiER encodes eight stages.
Neither list is a renaming of the other, and an adopter who knows the framework
will ask where each element went. The mapping makes the scope split explicit:
which elements SPiER models, and which are organizational concerns the
framework addresses but SPiER does not — and should not — try to encode in
FHIR.

## Lead and Train are out of scope

Both are essential to a Zero Suicide implementation and live above the EHR
layer: organizational commitment, leadership buy-in, staff training, competency
assessment. SPiER assumes they are in place and does not model them as FHIR
resources. Nothing in the artifacts asserts anything about them.

## Identify decomposes into three stages

The framework treats *Identify* as a single element. SPiER separates the
*signal* (Identify Possible Risk), the *structured assessment* (Clarify Risk)
and the *clinical disposition* (Define the Risk Picture) because each produces
distinct FHIR resources with distinct workflow triggers between them: a
positive screen triggers an assessment; a completed assessment yields a tier;
the tier gates the obligations.

## Transition decomposes into two

Coordination is the act of handing off; tracking is the act of confirming the
receiving side picked up. They are temporally distinct and produce different
FHIR resources (`ServiceRequest` / `Task` / `DocumentReference` for
coordination; `Communication` / `Appointment` / `Procedure` for follow-up
tracking) — and the Stage-8 follow-up measures are computable only because
the two are kept apart.

## Treat maps to a single stage

SPiER's scope for *Treat* is the *pathway view* of treatment: tracking that
someone is in an active suicide-focused care episode (for example CAMS),
updating that episode with new sessions and SSF measures, escalating when
overdue. Specific therapeutic modalities are Zero Suicide's *Treat* element in
full but are out of SPiER's EHR-pathway scope.

## Improve is intentionally light

*Measure and Share the Data* surfaces pathway-completion measures and
population-level views. Full QI methodology — PDSA cycles, board reporting
cadence — is Zero Suicide's territory, not SPiER's.

## Placeholders

All eight stages have a published PlanDefinition; how far each stage's actions
are modelled varies. Three actions are code-less placeholder
ActivityDefinitions ([`placeholder-activitydefinitions.md`](placeholder-activitydefinitions.md)),
and per-tool build status is tracked in GitHub milestones rather than on the
IG page, so the page never states a build claim that can go stale.

## What would reopen it

Zero Suicide Institute review of the mapping; a change to the framework's
element list; or a decision to model any part of *Lead* or *Train* (for
example a training-attestation resource), which would be a new stage rather
than a reinterpretation of an existing one.
