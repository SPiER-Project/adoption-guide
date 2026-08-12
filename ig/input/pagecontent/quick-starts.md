# Quick Starts

Concrete RESTful patterns for reading SPiER data, one block per instrument — in the style of [US Core Quick Starts](https://hl7.org/fhir/us/core/). These are **illustrative search patterns** against a FHIR R4 server that holds SPiER-conformant data; SPiER does not yet define its own server API or required SearchParameters.

In every example, replace `[base]` with the server's FHIR base URL and `[id]` with the patient's logical id.

## The common thread: the harmonized risk concept

Every instrument produces a harmonized **suicide-risk concept** Observation on the generic LOINC code, tagged with the suicide-risk domain category. To read the instrument-agnostic risk tier for a patient regardless of which tool was used:

```
GET [base]/Observation?code=http://loinc.org|93374-7&category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
```

`Observation.derivedFrom` on each result links back to the source `QuestionnaireResponse` and any instrument-specific Observations.

## Retrieving the whole suicide-safer care record by domain

Every SPiER resource with a native `category` element carries the same domain coding — `http://spier.org/CodeSystem/spier-concept-domain#suicide-risk` — **in addition to** whatever clinical category it already had. This is the [Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/) pattern: one code, applied across resource types, so a consumer can assemble the record without knowing which instrument or workflow step produced any part of it.

```
GET [base]/Observation?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Condition?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/CarePlan?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/ServiceRequest?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Communication?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Procedure?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/DocumentReference?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Consent?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&patient=Patient/[id]
GET [base]/Flag?category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
```

`Appointment` carries the same coding, but R4 gives it no `category` element — its
slot is `serviceCategory`, so the parameter **name** differs while the value stays
identical:

```
GET [base]/Appointment?service-category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&patient=Patient/[id]
```

**It is a repeated query, not a single one — and that is a property of R4, not of SPiER.** FHIR has no cross-type search on a common parameter; `category` is defined per resource type. A server that supports system-level search with `_type` can collapse the list:

```
GET [base]?_type=Observation,Condition,CarePlan,ServiceRequest,Communication,Procedure,DocumentReference,Consent,Flag&category=http://spier.org/CodeSystem/spier-concept-domain|suicide-risk&patient=Patient/[id]
```

but `_type` is optional, so the per-type form above is the portable one. What the domain tag buys is that **the parameter value is identical across every type** — the consumer needs one code, not a per-resource-type mapping table.

### The three types with no `category` element

Three profiled resource types have no `category` in R4, so none of them can answer
the `category=` queries above. Each was settled on its own merits rather than given
the same answer — the R4 realities differ, and so do the fixes. Every search
parameter named here was checked against the R4 base definitions; an element
existing does **not** mean a search parameter exists.

| Resource | R4 reality | How the domain is reachable |
|---|---|---|
| `Appointment` | no `category`; `serviceCategory` is `0..*` with an **example** binding, and `service-category` is a real search parameter | **Tagged.** `GET [base]/Appointment?service-category=http://spier.org/CodeSystem/spier-concept-domain\|suicide-risk&patient=Patient/[id]` |
| `EpisodeOfCare` | no `category`; `type` is `1..*` here and searchable via R4's shared `clinical-type` parameter | **Already equivalent** — `SPiERSuicideRiskEpisode` requires `type` from the SPiER episode-type ValueSet: `GET [base]/EpisodeOfCare?type=http://spier.org/CodeSystem/spier-episode-type\|suicide-safer-care` |
| `Task` | no `category`; `Task.code` is load-bearing for the safety-task vocabulary. `code`, `encounter` and `based-on` are all real parameters | **Deliberately untagged** — already reachable by two standard paths: `GET [base]/Task?encounter=Encounter/[id]`, or `Task.basedOn` → the episode |

Why `Appointment` is the only one that gained a tag: it was the sole type where R4
offers a searchable slot SPiER was not already using. `EpisodeOfCare` would have
been double-tagged for no retrieval gain, and a domain code on `Task` would either
collide with the vocabulary `Task.code` carries or sit in an extension — and an
extension is not queryable without SPiER publishing a `SearchParameter` *and* the
server supporting it, which is coverage on paper only.

Note what the `Appointment` row costs: the parameter **name** is
`service-category`, so a consumer needs one exception in its mapping. The value is
unchanged. That is a smaller ask than a per-type value table, and it is why
`Appointment` is listed separately from the uniform list above rather than folded
into it.

`Procedure` is a partial case worth knowing about: R4 gives `Procedure.category` a maximum of 1 (it becomes `0..*` only in R5), so `SPiERLethalMeansCounseling` spends its single category slot on the domain code. The counselling act itself is identified by `Procedure.code`.

## Retrieving one episode's record

The domain category above answers "everything about suicide risk for this patient".
It does **not** answer "everything that happened in *this* episode" — a patient may
have several episodes over time, and the domain tag cannot tell them apart.

Episode membership is carried through `Encounter`. Each artifact references the
contact it was produced at, via the native `.encounter` element it already has, and
each `Encounter` references the episode:

```
artifact.encounter → Encounter.episodeOfCare → EpisodeOfCare
```

So assembling one episode's record is **two hops**, both using stock search
parameters:

```
GET [base]/Encounter?episode-of-care=EpisodeOfCare/[episode-id]
GET [base]/Observation?encounter=Encounter/[encounter-id]&subject=Patient/[id]
GET [base]/QuestionnaireResponse?encounter=Encounter/[encounter-id]
GET [base]/CarePlan?encounter=Encounter/[encounter-id]
GET [base]/ServiceRequest?encounter=Encounter/[encounter-id]
GET [base]/Procedure?encounter=Encounter/[encounter-id]
GET [base]/Communication?encounter=Encounter/[encounter-id]
GET [base]/DocumentReference?encounter=Encounter/[encounter-id]
GET [base]/Flag?encounter=Encounter/[encounter-id]
GET [base]/Task?encounter=Encounter/[encounter-id]
```

### Why not one query

R4 provides no universal "belongs to this episode" pointer, and most of the
plausible candidates cannot reference an `EpisodeOfCare` at all — checked against
the R4 base definitions:

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

Nine of the eleven resource types SPiER profiles carry a native `.encounter`, and
all nine are reachable by the **standard** `encounter` search parameter — including
`DocumentReference`, whose element is nested at `context.encounter` but is covered
by R4's shared `clinical-encounter` parameter. `Encounter?episode-of-care=` is
standard too. That is why the Encounter hop is the portable answer rather than a
SPiER-specific extension. An extension would need a published `SearchParameter` *and* server
support to be queryable at all — coverage on paper, not in practice.

### Do not assume `_revinclude`

A single-query form is tempting:

```
GET [base]/EpisodeOfCare/[id]?_revinclude=*
```

**Support for `_include` / `_revinclude` is optional in FHIR, and the `*` wildcard
is not something a client can assume.** Where a server does support a specific
reverse include, the narrow form is the safer bet — for example the registry query
in [Measurement](measurement.html) uses `_revinclude=Task:based-on`. Treat any
`_revinclude` in this IG as an optimisation to verify against your server, not a
guarantee; the per-type reads above are the portable path.

### The two exceptions, and the artifact that opened the episode

| Resource | How it joins the episode |
|---|---|
| `Appointment` | no `.encounter` in R4. The Encounter names it instead: `Encounter.appointment` → `Appointment`. This is still the only *episode-scoped* path; the `service-category` query above is patient-scoped and cannot tell one episode from another. |
| `Consent` | no `.encounter` and no indirect route. A sharing consent plausibly scopes to the patient and the receiving organisation rather than to one episode, so SPiER does not claim episode membership for it. |
| `Encounter` | has no `category` element either, so it is not reachable by the domain query above — only via `episode-of-care`. |

One artifact is deliberately reached in the opposite direction. An episode is opened
*because* a screen came back positive, so at screening time the episode does not yet
exist and the screen cannot reference it. The episode therefore points back at its
own trigger:

```
EpisodeOfCare.extension[episode-trigger].valueReference → Observation | QuestionnaireResponse
```

`SPiERSuicideRiskEpisode` carries a FHIRPath invariant requiring that reference
whenever `episode-entry-reason` is `positive-screen` — an episode cannot claim a
positive screen it cannot evidence. Entry reasons with no structured artifact
(`clinician-judgment`, `transition-discharge`, `manual-add`) carry no trigger, by
design.

## ASQ (Ask Suicide-Screening Questions)

- Questionnaire: `http://spier.org/Questionnaire/ASQ-Screening-Tool` (v1.1.0-pilot)
- Derived profile: `SPiERASQResult` (disposition on LOINC `93374-7`)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/ASQ-Screening-Tool&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## C-SSRS (Columbia-Suicide Severity Rating Scale)

- Questionnaires: `http://spier.org/Questionnaire/C-SSRS-Screener` (v1.0.0), `http://spier.org/Questionnaire/C-SSRS-Full-Lifetime-Recent` (v1.0.0)
- Derived profile: `SPiERCSSRSRiskLevel` (risk level on LOINC `93374-7`)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/C-SSRS-Screener&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## PHQ-9 (Patient Health Questionnaire-9)

- Questionnaire: `http://spier.org/Questionnaire/PHQ-9` (v1.0.0)
- Derived profiles: `SPiERPHQ9TotalScore` (LOINC `44261-6`), `SPiERPHQ9Item9` (LOINC `44260-8`, the suicide-relevant item)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/PHQ-9&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|44260-8&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|44261-6&subject=Patient/[id]
```

## SBQ-R (Suicide Behaviors Questionnaire-Revised)

- Questionnaire: `http://spier.org/Questionnaire/SBQ-R` (v1.0.0)
- Derived profile: `SPiERSBQRTotalScore` (total on SNOMED `225337009`; cutoffs ≥7 / ≥8)
  - No LOINC panel/item/total-score code exists for the SBQ-R (rechecked July 2026). SNOMED `225337009` ("Suicide risk assessment") is a generic concept used as a pragmatic choice for the total score, not an SBQ-R-specific code; re-checked each major release.

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/SBQ-R&subject=Patient/[id]
GET [base]/Observation?code=http://snomed.info/sct|225337009&subject=Patient/[id]
```

> Tip: to retrieve a patient's suicide-risk picture across *all* instruments in one query, use the harmonized-concept search at the top of this page — that's the payoff of the [two-layer model](how-to-read.html#two-layer-model).
