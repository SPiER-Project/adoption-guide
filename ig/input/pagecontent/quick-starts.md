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

## Reading one instrument

Each block below names the `Questionnaire.url` (with version) an implementer
searches by, the derived profile or profiles that instrument produces, and the
reads for both layers.

**One caution applies to nearly every block.** Every instrument whose derived
result is a risk tier or a disposition fixes `Observation.code` to LOINC
`93374-7` — the same generic code the harmonized concept carries. So
`code=http://loinc.org|93374-7` is a **layer** filter, not an instrument
filter: it returns the ASQ result, the C-SSRS risk level, the PSS-3 and PSS-Full
results, the BSSA and CAMS dispositions, the SAFE-T risk level *and* the
harmonized concept alike. The instrument-specific anchor is therefore the
`QuestionnaireResponse?questionnaire=` read; `Observation.derivedFrom` on each
derived resource points back to it. Where a producer stamps `meta.profile`
**and** the server indexes it, `_profile=` narrows to a single profile — but
`_profile` support is no more assumable than the `_revinclude` above, so it is
not the pattern these blocks use.

The instruments whose derived Observations carry an instrument-specific code
instead are the PHQ-9 (LOINC `44261-6`, `44260-8`), the SBQ-R (SNOMED
`225337009`) and the CAMS SSF vitals (the SPiER-local `cams-ssf` codes).

## ASQ (Ask Suicide-Screening Questions)

- Questionnaire: `http://spier.org/Questionnaire/ASQ-Screening-Tool` (v1.1.0-pilot)
- Derived profile: `SPiERASQResult` (disposition on LOINC `93374-7`)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/ASQ-Screening-Tool&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## C-SSRS (Columbia-Suicide Severity Rating Scale)

- Questionnaires: `http://spier.org/Questionnaire/C-SSRS-Screener` (v1.0.0), `http://spier.org/Questionnaire/C-SSRS-Full-Lifetime-Recent` (v1.0.0)
  - `http://spier.org/Questionnaire/C-SSRS-Since-Last-Contact` (v1.0.0) — the same six-item set scoped to the interval since the patient's prior contact
  - `http://spier.org/Questionnaire/C-SSRS-Pediatric` (v1.0.0) — the validated screener item set worded for pediatric/adolescent settings
- Derived profile: `SPiERCSSRSRiskLevel` (risk level on LOINC `93374-7`) — **all four** forms derive this one profile, so the Observation read is the same for each; only the `questionnaire=` value differs.

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/C-SSRS-Screener&subject=Patient/[id]
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/C-SSRS-Since-Last-Contact&subject=Patient/[id]
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/C-SSRS-Pediatric&subject=Patient/[id]
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

## PSS-3 (Patient Safety Screener 3)

- Questionnaire: `http://spier.org/Questionnaire/PSS-3` (v1.0.0)
- Derived profile: `SPiERPSS3Result` (binary negative / positive result on LOINC `93374-7`)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/PSS-3&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## PSS-Full (Patient Safety Screener / Suicide Risk Screener, full)

- Questionnaire: `http://spier.org/Questionnaire/PSS-Full` (v1.0.0)
- Derived profile: `SPiERPSSFullRiskLevel` (site-stratified risk level on LOINC `93374-7`)
- **No crosswalk.** `valueCodeableConcept` is bound directly to the shared SPiER Suicide Risk Tier ValueSet, so the combined screen lands on the concept layer without a per-instrument ConceptMap or StructureMap.

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/PSS-Full&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## BSSA (NIMH Brief Suicide Safety Assessment)

- Questionnaire: `http://spier.org/Questionnaire/BSSA` (v1.0.0)
- Derived profile: `SPiERBSSADispositionResult` (one of four dispositions — emergency psychiatric evaluation / further evaluation necessary / non-urgent follow-up / no intervention — on LOINC `93374-7`)

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/BSSA&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## SAFE-T (Suicide Assessment Five-Step Evaluation and Triage)

- Questionnaire: `http://spier.org/Questionnaire/SAFE-T` (v1.0.0)
- Derived profile: `SPiERSAFETRiskLevel` (clinician-determined risk tier on LOINC `93374-7`)
- **No crosswalk.** As with PSS-Full, `valueCodeableConcept` is bound directly to the shared SPiER Suicide Risk Tier ValueSet — the formulation lands on the concept layer with no per-instrument mapping artifact.

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/SAFE-T&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

## CAMS (Collaborative Assessment and Management of Suicidality)

CAMS is one catalogued tool with five published forms, and it is the only
instrument in this guide that produces four different resource types. Each form
has its own `Questionnaire.url`:

| Form | `Questionnaire.url` (all v1.0.0) | Produces |
|---|---|---|
| SSF-5 Section A — patient vitals | `.../CAMS-SSF5-SectionA` | six `SPiERCAMSSSFVital` Observations |
| SSF-5 Section B — clinician drivers | `.../CAMS-SSF5-SectionB` | up to three `SPiERCAMSSuicideDriver` Conditions |
| Therapeutic Worksheet | `.../CAMS-Therapeutic-Worksheet` | one `SPiERCAMSTherapeuticWorksheet` CarePlan |
| Stabilization Plan | `.../CAMS-Stabilization-Plan` | one `SPiERCAMSStabilizationPlan` CarePlan |
| SSF-5 Outcome / Disposition | `.../CAMS-SSF5-OutcomeDisposition` | SSF vitals plus one `SPiERCAMSOutcomeDisposition` Observation |

Section A is re-administered at every interim session, so the SSF vitals are a
longitudinal series rather than a single set.

- `SPiERCAMSSSFVital` takes its `code` from the SPiER-local `cams-ssf` CodeSystem — `psychological-pain`, `stress`, `agitation`, `hopelessness`, `self-hate`, `overall-risk` — and carries `valueInteger` 1–5. No LOINC concepts have been published for the CAMS-specific scale.
- `SPiERCAMSSuicideDriver` is a `Condition`, marked by the category `http://spier.org/CodeSystem/cams-driver-category#suicide-driver`. Its `code.text` is required and `code.coding` optional: a driver is idiographic, and no terminology carries concepts at that granularity.
- Both CAMS CarePlans identify their sections with `activity.detail.code` from the SPiER-local `cams-careplan-section` CodeSystem, which is searchable via R4's `activity-code` parameter.
- `SPiERCAMSOutcomeDisposition` follows the BSSA precedent — LOINC `93374-7` with a SPiER-local disposition value (continue-cams / resolved / refer-adjunctive / higher-level-care). It records a care decision, not a risk tier.

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/CAMS-SSF5-SectionA&subject=Patient/[id]
GET [base]/Observation?code=http://spier.org/CodeSystem/cams-ssf|overall-risk&subject=Patient/[id]
GET [base]/Observation?code=http://spier.org/CodeSystem/cams-ssf|psychological-pain,http://spier.org/CodeSystem/cams-ssf|stress,http://spier.org/CodeSystem/cams-ssf|agitation,http://spier.org/CodeSystem/cams-ssf|hopelessness,http://spier.org/CodeSystem/cams-ssf|self-hate,http://spier.org/CodeSystem/cams-ssf|overall-risk&subject=Patient/[id]
GET [base]/Condition?category=http://spier.org/CodeSystem/cams-driver-category|suicide-driver&subject=Patient/[id]
GET [base]/CarePlan?activity-code=http://spier.org/CodeSystem/cams-careplan-section|crisis-working-model&subject=Patient/[id]
GET [base]/CarePlan?activity-code=http://spier.org/CodeSystem/cams-careplan-section|treatment-adherence&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

The third line reads all six vitals in one request using a comma-separated
`code` list — an OR within one parameter, which is base R4 token-search
behaviour rather than an optional feature. The two `CarePlan` reads pick a
section code unique to one of the two plans (`crisis-working-model` belongs only
to the Therapeutic Worksheet, `treatment-adherence` only to the Stabilization
Plan), which is what distinguishes them: both plans carry the same
`category` codings.

## Stanley-Brown Safety Plan

The output is a `CarePlan`, not an Observation — a safety plan is a plan of
care, and it does not produce a risk tier.

- Questionnaire: `http://spier.org/Questionnaire/StanleyBrownSafetyPlan` (v1.1.0)
- Derived profile: `SPiERStanleyBrownSafetyPlan` (CarePlan; seven activities, one per safety-plan step, each identified by a code from the SPiER-local `safety-plan-section` CodeSystem)
- Categories: SNOMED `735324008` (treatment escalation plan), LOINC `87626-8` (suicide prevention note), and the suicide-risk domain tag
- The transformation is a published artifact: [StructureMap: Stanley-Brown QuestionnaireResponse → CarePlan](StructureMap-StanleyBrownQRToCarePlan.html), named in `PlanDefinition.action.transform` on the Document Safety Actions stage.

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/StanleyBrownSafetyPlan&subject=Patient/[id]
GET [base]/CarePlan?category=http://loinc.org|87626-8&subject=Patient/[id]
GET [base]/CarePlan?activity-code=http://spier.org/CodeSystem/safety-plan-section|lethal-means-safety&subject=Patient/[id]
```

## CRP (Crisis Response Plan)

Also a `CarePlan`, and it deliberately **shares** the Stanley-Brown section
CodeSystem and category codings — the two narrative safety plans are
alternatives to each other, so a consumer that reads one reads the other
unchanged.

- Questionnaire: `http://spier.org/Questionnaire/CrisisResponsePlan` (v1.0.0)
- Derived profile: `SPiERCrisisResponsePlan` (CarePlan; five activities from the same `safety-plan-section` CodeSystem)
- Its ActivityDefinition is `AuthorCrisisResponsePlan` rather than `Administer…`, since the plan is authored with the patient rather than administered to them.

```
GET [base]/QuestionnaireResponse?questionnaire=http://spier.org/Questionnaire/CrisisResponsePlan&subject=Patient/[id]
GET [base]/CarePlan?category=http://loinc.org|87626-8&subject=Patient/[id]
```

Because the two plans share both their `category` codings and their section
CodeSystem, the second read returns **both**. Telling them apart means reading
the section set — `lethal-means-safety` and `social-distraction` appear only in
a Stanley-Brown plan — or, where the producer stamps `meta.profile` and the
server indexes it, filtering on `_profile`.

> Tip: to retrieve a patient's suicide-risk picture across *all* instruments in one query, use the harmonized-concept search at the top of this page — that's the payoff of the [two-layer model](how-to-read.html#two-layer-model).
