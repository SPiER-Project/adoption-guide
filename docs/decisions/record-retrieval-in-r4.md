# Assembling the record in R4: per-type domain queries and an Encounter hop

**Decided:** 2026-08 (PRs [#271](https://github.com/SPiER-Project/adoption-guide/pull/271),
[#299](https://github.com/SPiER-Project/adoption-guide/pull/299),
[#311](https://github.com/SPiER-Project/adoption-guide/pull/311)).
**Rule, as published:** Quick Starts § *The whole suicide-safer care record, by
domain* and § *One episode's record*. The `1..1` domain slice those queries
depend on is [`domain-category-required.md`](domain-category-required.md).

## Why it is a repeated query, not one

FHIR R4 has no cross-type search on a common parameter; `category` is defined
per resource type. A server that supports system-level search with `_type` can
collapse the list:

```
GET [base]?_type=Observation,Condition,CarePlan,ServiceRequest,Communication,Procedure,DocumentReference,Consent,Flag&category=…|suicide-risk&patient=Patient/[id]
```

but `_type` is optional, so the per-type form is the portable one. What the
domain tag buys is that **the parameter value is identical across every type**
— the consumer needs one code, not a per-resource-type mapping table.

## The three types with no `category`

Three profiled resource types have no `category` in R4, so none can answer the
`category=` queries. Each was settled on its own merits rather than given the
same answer — the R4 realities differ, and so do the fixes. Every search
parameter named here was checked against the R4 base definitions; an element
existing does **not** mean a search parameter exists.

| Resource | R4 reality | How the domain is reachable |
|---|---|---|
| `Appointment` | no `category`; `serviceCategory` is `0..*` with an **example** binding, and `service-category` is a real search parameter | **Tagged.** `service-category=…|suicide-risk` |
| `EpisodeOfCare` | no `category`; `type` is `1..*` in the SPiER profile and searchable via R4's shared `clinical-type` parameter | **Already equivalent** — `type=…/spier-episode-type|suicide-safer-care` |
| `Task` | no `category`; `Task.code` is load-bearing for the safety-task vocabulary. `code`, `encounter` and `based-on` are all real parameters | **Deliberately untagged** — reachable by `encounter=` or `Task.basedOn` → the episode |

Why `Appointment` is the only one that gained a tag: it was the sole type where
R4 offers a searchable slot SPiER was not already using. `EpisodeOfCare` would
have been double-tagged for no retrieval gain, and a domain code on `Task`
would either collide with the vocabulary `Task.code` carries or sit in an
extension — and an extension is not queryable without SPiER publishing a
`SearchParameter` *and* the server supporting it, which is coverage on paper
only. The cost of the `Appointment` row is one exception in a consumer's
parameter-name mapping; the value is unchanged, which is a smaller ask than a
per-type value table.

`Procedure` is a partial case: R4 gives `Procedure.category` a maximum of 1
(it becomes `0..*` only in R5), so `SPiERLethalMeansCounseling` spends its
single category slot on the domain code. The counselling act itself is
identified by `Procedure.code`.

## Why the episode hop goes through Encounter

R4 provides no universal "belongs to this episode" pointer, and most of the
plausible candidates cannot reference an `EpisodeOfCare` at all — checked
against the R4 base definitions:

| Element | Can it point at an EpisodeOfCare? |
|---|---|
| `Observation.partOf` | no — Medication\*, `Procedure`, `Immunization`, `ImagingStudy` only |
| `CarePlan.addresses` | no — `Condition` only in R4 (widened in R5) |
| `ServiceRequest.basedOn` | no — `CarePlan`, `ServiceRequest`, `MedicationRequest` |
| `Procedure.partOf` | no — `Procedure`, `Observation`, `MedicationAdministration` |
| `Appointment.basedOn` | no — `ServiceRequest` only |
| `Communication.partOf`, `Task.basedOn` | yes — both are `Reference(Any)` |
| `DocumentReference.context.encounter` | yes — accepts `Encounter` **or** `EpisodeOfCare` |
| `Encounter.episodeOfCare` | yes — this is the element R4 built for it |

Nine of the eleven resource types SPiER profiles carry a native `.encounter`,
and all nine are reachable by the **standard** `encounter` search parameter —
including `DocumentReference`, whose element is nested at `context.encounter`
but is covered by R4's shared `clinical-encounter` parameter.
`Encounter?episode-of-care=` is standard too. That is why the Encounter hop is
the portable answer rather than a SPiER-specific extension, which would need a
published `SearchParameter` *and* server support to be queryable at all.

## The two exceptions, and the artifact that opened the episode

| Resource | How it joins the episode |
|---|---|
| `Appointment` | no `.encounter` in R4. The Encounter names it instead: `Encounter.appointment` → `Appointment`. This is still the only *episode-scoped* path; the `service-category` query is patient-scoped and cannot tell one episode from another. |
| `Consent` | no `.encounter` and no indirect route. A sharing consent plausibly scopes to the patient and the receiving organisation rather than to one episode, so SPiER does not claim episode membership for it. |
| `Encounter` | has no `category` element either, so it is not reachable by the domain query — only via `episode-of-care`. |

An episode is opened *because* a screen came back positive, so at screening
time the episode does not yet exist and the screen cannot reference it. The
episode therefore points back at its own trigger:
`EpisodeOfCare.extension[episode-trigger].valueReference → Observation | QuestionnaireResponse`.
`SPiERSuicideRiskEpisode` carries a FHIRPath invariant requiring that reference
whenever `episode-entry-reason` is `positive-screen` — an episode cannot claim a
positive screen it cannot evidence. Entry reasons with no structured artifact
(`clinician-judgment`, `transition-discharge`, `manual-add`) carry no trigger,
by design.

## What would reopen it

A move to R5, where `CarePlan.addresses` widens and `Procedure.category`
repeats; a server population where `_type` search can be assumed; or a
consumer that needs `Task` in the domain query badly enough to justify a
published `SearchParameter`.
