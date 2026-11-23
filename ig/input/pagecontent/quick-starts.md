RESTful patterns for reading and writing SPiER data on a FHIR R4 server, in
the style of [US Core Quick Starts](https://hl7.org/fhir/us/core/). They are
illustrative: SPiER defines no server API and no SearchParameters of its own,
and every parameter below is a standard R4 one. Replace `[base]` with the
server's FHIR base URL and `[id]` with the patient's logical id.

### By instrument

Two reads per instrument: the completed form, and the result derived from it.
[Instruments](instruments.html) lists every form with its Questionnaire,
result profile and a worked response; every Questionnaire canonical is
`http://thespierproject.org/fhir/Questionnaire/` followed by the id shown below.

#### The completed form

One pattern for every form:

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/[questionnaire-id]&subject=Patient/[id]
```

| Instrument | `[questionnaire-id]` |
|---|---|
| ASQ | `ASQ-Screening-Tool` |
| BSSA | `BSSA` |
| C-SSRS | `C-SSRS-Screener`, `C-SSRS-Full-Lifetime-Recent`, `C-SSRS-Since-Last-Contact`, `C-SSRS-Pediatric` |
| CAMS | `CAMS-SSF5-SectionA`, `CAMS-SSF5-SectionB`, `CAMS-SSF5-OutcomeDisposition`, `CAMS-Therapeutic-Worksheet`, `CAMS-Stabilization-Plan` |
| CRP | `CrisisResponsePlan` |
| PHQ-9 | `PHQ-9` |
| PSS-3 | `PSS-3` |
| PSS-Full | `PSS-Full` |
| SAFE-T | `SAFE-T` |
| SBQ-R | `SBQ-R` |
| Stanley-Brown | `StanleyBrownSafetyPlan` |

#### The result

How a result is found depends on what it is coded with.

**Results with a code of their own.** Search on the code:

```
GET [base]/Observation?code=[system]|[code]&subject=Patient/[id]
```

| Result | `[system]` | `[code]` |
|---|---|---|
| [PHQ-9 item 9](StructureDefinition-spier-phq9-item9.html), the suicide-relevant item | `http://loinc.org` | `44260-8` |
| [PHQ-9 total score](StructureDefinition-spier-phq9-total-score.html) | `http://loinc.org` | `44261-6` |
| [SBQ-R total score](StructureDefinition-spier-sbqr-total-score.html) (cutoffs ≥7 / ≥8) | `http://snomed.info/sct` | `225337009` |
| [CAMS SSF rating](StructureDefinition-spier-cams-ssf-vital.html), one Observation per rating | `http://thespierproject.org/fhir/CodeSystem/cams-ssf` | `overall-risk`, the risk-relevant rating |

The SBQ-R code is a generic SNOMED CT "Suicide risk assessment" concept, used
because LOINC publishes no SBQ-R code (rechecked July 2026).

**Results that share LOINC `93374-7`.** Seven instrument results and the
harmonized tier are all coded `93374-7` with the same categories, so a search
on the code alone returns every one of them together. Five have a value code
system of their own; add it as `value-concept`, where a token of `system|` with
no code matches any code in that system:

```
GET [base]/Observation?code=http://loinc.org|93374-7&value-concept=http://thespierproject.org/fhir/CodeSystem/[value-system]|&subject=Patient/[id]
```

| Result | `[value-system]` |
|---|---|
| [ASQ result](StructureDefinition-spier-asq-result.html) | `asq-screening-result` |
| [BSSA disposition](StructureDefinition-spier-bssa-disposition-result.html) | `bssa-disposition` |
| [C-SSRS risk level](StructureDefinition-spier-cssrs-risk-level.html), shared by all four forms | `cssrs-risk-level` |
| [CAMS outcome/disposition](StructureDefinition-spier-cams-outcome-disposition.html) | `cams-disposition` |
| [PSS-3 result](StructureDefinition-spier-pss3-result.html) | `pss3-result` |

The [PSS-Full](StructureDefinition-spier-pss-full-risk-level.html) and
[SAFE-T](StructureDefinition-spier-safet-risk-level.html) risk levels are
valued on the shared tier directly, so their value system is the harmonized
tier's. Only the profile tells them apart, where the server supports
`_profile`:

```
GET [base]/Observation?_profile=http://thespierproject.org/fhir/StructureDefinition/spier-pss-full-risk-level&subject=Patient/[id]
GET [base]/Observation?_profile=http://thespierproject.org/fhir/StructureDefinition/spier-safet-risk-level&subject=Patient/[id]
```

SPiER has not yet published a distinguishing code; see
[Known limitations](conformance.html#known-limitations).

**Results that are not Observations.**

- A [CAMS suicide driver](StructureDefinition-spier-cams-suicide-driver.html)
  is a **Condition** on the problem list with a fixed category.
- A [Stanley-Brown Safety Plan](StructureDefinition-spier-stanley-brown-safety-plan.html)
  and a [Crisis Response Plan](StructureDefinition-spier-crisis-response-plan.html)
  are each a **CarePlan** with one activity per step or section.

```
GET [base]/Condition?category=http://thespierproject.org/fhir/CodeSystem/cams-driver-category|suicide-driver&subject=Patient/[id]
GET [base]/CarePlan?_profile=http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan&subject=Patient/[id]
GET [base]/CarePlan?_profile=http://thespierproject.org/fhir/StructureDefinition/spier-crisis-response-plan&subject=Patient/[id]
```

The two safety plans share a section vocabulary, so they are distinguished by
`_profile`, not by code. The CAMS
[Therapeutic Worksheet](StructureDefinition-spier-cams-therapeutic-worksheet.html)
and [Stabilization Plan](StructureDefinition-spier-cams-stabilization-plan.html)
are session-continuation CarePlans, found the same way.

### The risk tier, whichever instrument produced it {#risk-tier}

Every instrument produces a harmonized **suicide-risk concept** Observation on
the generic LOINC code, tagged with the suicide-risk domain category. Code and
category alone do **not** isolate it: seven instrument results carry the same
code and categories (see *Results that share LOINC `93374-7`* above). Filter on the
value's code system instead — the tier is always valued from
[SPiERSuicideRiskTier](CodeSystem-spier-suicide-risk-tier.html), and a token
search on `system|` with no code matches any code in that system:

```
GET [base]/Observation?code=http://loinc.org|93374-7&value-concept=http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier|&subject=Patient/[id]
```

This still returns the PSS-Full and SAFE-T results, which are valued on the
tier directly, so a patient assessed with either can have two Observations
carrying the same tier for one assessment. Do **not** read "the most recent
`93374-7` Observation" as the patient's tier without this filter: it may be an
ASQ disposition or a C-SSRS risk level in that instrument's own vocabulary.

`Observation.derivedFrom` on each result links back to the source
`QuestionnaireResponse` and any instrument-specific Observations. This is the
payoff of the [two-layer model](how-to-read.html#two-layer-model).

### The whole suicide-safer care record, by domain

Every SPiER resource with a native `category` carries the same domain coding in
addition to its clinical category (the
[Gravity Project](https://hl7.org/fhir/us/sdoh-clinicalcare/) pattern), so one
code assembles the record without knowing which instrument or step produced
any part of it. R4 has no cross-type search on a common parameter, so it is one
read per type; the value is identical in every one:

```
GET [base]/Observation?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Condition?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/CarePlan?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/ServiceRequest?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Communication?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Procedure?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/DocumentReference?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
GET [base]/Consent?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&patient=Patient/[id]
GET [base]/Flag?category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&subject=Patient/[id]
```

Three exceptions, because R4 gives these types no `category`:

- `Appointment` carries the same coding in `serviceCategory`, so only the
  parameter **name** changes:
  `GET [base]/Appointment?service-category=http://thespierproject.org/fhir/CodeSystem/spier-concept-domain|suicide-risk&patient=Patient/[id]`
- `EpisodeOfCare` is reached by its required type:
  `GET [base]/EpisodeOfCare?type=http://thespierproject.org/fhir/CodeSystem/spier-episode-type|suicide-safer-care&patient=Patient/[id]`
- `Task` is deliberately untagged and reached by `encounter` or `based-on`
  (below).

A server that supports system-level search with `_type` can collapse the list
into one call, but `_type` is optional, so the per-type form is the portable
one.

### One episode's record

The domain queries answer "everything about suicide risk for this patient",
not "everything in *this* episode". Episode membership runs through
`Encounter`: each artifact names its encounter in its native `.encounter`
element, and each encounter names the episode, so one episode's record is two
hops on stock search parameters:

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

`Appointment` has no `.encounter`; the encounter names it instead
(`Encounter.appointment`). `Consent` scopes to the patient and the receiving
organization, not to an episode, so SPiER claims no episode membership for it.
And the screen that *opened* an episode predates it, so the episode points at
its trigger rather than the reverse:
`EpisodeOfCare.extension[episode-trigger] → Observation | QuestionnaireResponse`,
required by invariant whenever the entry reason is `positive-screen`.

**Do not assume `_revinclude`.** `GET [base]/EpisodeOfCare/[id]?_revinclude=*`
is tempting, but `_include` / `_revinclude` support is optional in FHIR and the
`*` wildcard is not something a client can rely on. Where a server supports a
specific reverse include the narrow form is safer (the registry query on
[Measures](measurement.html) uses `_revinclude=Task:based-on`); treat any
`_revinclude` in this guide as an optimisation to verify against your server,
and the per-type reads above as the portable path.

### Writing as a source {#writing}

A [Screening-Source EHR](CapabilityStatement-screening-source-ehr.html) writes
with standard creates; SPiER adds no operation.
[Implementing a Screening-Source EHR](implement-screening-source-ehr.html)
says what each resource must contain.

```
POST [base]/QuestionnaireResponse
POST [base]/Observation
```

- **Order matters.** Write the response first, then the instrument result,
  then the risk concept, so each `derivedFrom` points at a resource that
  exists. A transaction Bundle writes all three atomically.
- **Claim the profile.** Put the profile's canonical in `meta.profile` on
  every resource. The `_profile` searches above return nothing without it.
- **Name the encounter.** Set `.encounter` on each resource; one episode's
  record is assembled through it.
- **Validate before you write.** [Getting Started](getting-started.html) has
  the validator command.
