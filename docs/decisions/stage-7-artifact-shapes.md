# Why one Task profile serves three Stage-7 tools, and why the Encounter is the hinge

**Decided:** 2026-08 (Stage 7, [`plans/stage-7-track-risk-over-time.md`](../plans/stage-7-track-risk-over-time.md)).
**Artifacts:** `SPiERSafetyTask`, `SPiEREncounter`, both in
[`risk-episode.fsh`](../../ig/input/fsh/risk-episode.fsh).

## One Task profile, three tools

`SPiERSafetyTask` is one piece of open suicide-safety work with an owner and a
due date. One profile serves the Reassessment / Risk Review Schedule, Open
Safety Actions / Care Gap Tracking, and the Risk Escalation / Overdue Workflow,
differentiated by `Task.code`: `reassessment-due`, the care-gap codes, and the
escalation code plus the `escalation-trigger` extension. Three profiles would
have been three copies of the same constraints with one code each.

## "Overdue" is a query, not a state

`Task.restriction.period.end` carries the due date, so overdue is computed —
`restriction.period.end < now AND status != completed` — rather than stored as
a status that can go stale. A stored "overdue" flag is wrong the moment
someone completes the task without flipping it, and correct only while
something keeps re-deriving it; the query is correct by construction.

## The Encounter is the correlation hinge

`SPiEREncounter` is a contact during which suicide-safer care happened.
Artifacts reference their Encounter through the native `.encounter` element
they already have, and the Encounter references the episode, so a consumer
can assemble one episode's record with standard search parameters rather
than a SPiER-specific extension — the full reasoning, with the R4 elements
that cannot point at an EpisodeOfCare, is
[`record-retrieval-in-r4.md`](record-retrieval-in-r4.md). Instances SHOULD
carry `meta.tag = SPiERPathwayStage#<stage>` where the contact maps to a single
pathway stage, so a stage-scoped query needs no join.

## What would reopen it

A fourth Stage-7 tool whose Task needs constraints the shared profile cannot
express; or a server population where `Task.status` cannot be trusted and a
stored overdue flag becomes the lesser evil.
