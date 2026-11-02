RESTful patterns for reading SPiER data from a FHIR R4 server that holds
SPiER-conformant resources, in the style of
[US Core Quick Starts](https://hl7.org/fhir/us/core/). They are illustrative:
SPiER defines no server API and no SearchParameters of its own, and every
parameter below is a standard R4 one. Replace `[base]` with the server's FHIR
base URL and `[id]` with the patient's logical id.

### By instrument

Each block names the Questionnaire a form filler loads, the profile the
derived result lands in, and the two reads: the response, and the result.
Each Questionnaire's current version is on its own page.

> **⚠️ A `93374-7` query returns every instrument's result, not only the one
> you name.** The ASQ, BSSA, C-SSRS, CAMS Outcome/Disposition, PSS-3, PSS-Full
> and SAFE-T results are all coded LOINC `93374-7` with the same categories, and
> so is the harmonized tier. The `code=` reads below therefore return results
> from every one of those instruments together, and the harmonized tier with
> them. Tell an instrument's result apart by its value's code system (each
> profile binds its own value set) or by `_profile` where your server supports
> it; [the risk tier section](#risk-tier)
> has the query for the tier itself. SPiER has not yet published a
> distinguishing code — see
> [Known limitations](conformance.html#known-limitations).

#### ASQ (Ask Suicide-Screening Questions)

- Questionnaire: [ASQ Screening Tool](Questionnaire-ASQ-Screening-Tool.html) — `http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool`
- Result: [SPiER ASQ Result](StructureDefinition-spier-asq-result.html), a disposition on LOINC `93374-7`

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

#### BSSA (NIMH Brief Suicide Safety Assessment)

- Questionnaire: [BSSA](Questionnaire-BSSA.html) — `http://thespierproject.org/fhir/Questionnaire/BSSA`
- Result: [SPiER BSSA Disposition Result](StructureDefinition-spier-bssa-disposition-result.html), a disposition on LOINC `93374-7`; a post-positive-screen clinician interview, used after ASQ

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/BSSA&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

#### C-SSRS (Columbia-Suicide Severity Rating Scale)

- Questionnaires: [Screener](Questionnaire-C-SSRS-Screener.html) (`…/Questionnaire/C-SSRS-Screener`), [Full Lifetime/Recent](Questionnaire-C-SSRS-Full-Lifetime-Recent.html) (`…/Questionnaire/C-SSRS-Full-Lifetime-Recent`), [Since Last Contact](Questionnaire-C-SSRS-Since-Last-Contact.html) (`…/Questionnaire/C-SSRS-Since-Last-Contact`), [Pediatric](Questionnaire-C-SSRS-Pediatric.html) (`…/Questionnaire/C-SSRS-Pediatric`)
- Result: [SPiER C-SSRS Risk Level](StructureDefinition-spier-cssrs-risk-level.html), a risk level on LOINC `93374-7`, shared by all four forms

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

#### CAMS (Collaborative Assessment and Management of Suicidality)

One tool spanning several capture steps; the three below produce the derived
resources most consumers need.

- **Section A** (patient self-rated Suicide Status Form) — [CAMS SSF-5 Section A](Questionnaire-CAMS-SSF5-SectionA.html) (`…/Questionnaire/CAMS-SSF5-SectionA`). Result: [SPiER CAMS SSF Vital](StructureDefinition-spier-cams-ssf-vital.html), one Observation per SSF rating; the risk-relevant rating is `overall-risk`:

  ```
  GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionA&subject=Patient/[id]
  GET [base]/Observation?code=http://thespierproject.org/fhir/CodeSystem/cams-ssf|overall-risk&subject=Patient/[id]
  ```

- **Section B** (clinician-identified drivers) — [CAMS SSF-5 Section B](Questionnaire-CAMS-SSF5-SectionB.html) (`…/Questionnaire/CAMS-SSF5-SectionB`). Result: [SPiER CAMS Suicide Driver](StructureDefinition-spier-cams-suicide-driver.html), a **Condition** on the problem list with a fixed category:

  ```
  GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-SectionB&subject=Patient/[id]
  GET [base]/Condition?category=http://thespierproject.org/fhir/CodeSystem/cams-driver-category|suicide-driver&subject=Patient/[id]
  ```

- **Outcome/Disposition** (final-session decision) — [CAMS SSF-5 Outcome/Disposition](Questionnaire-CAMS-SSF5-OutcomeDisposition.html) (`…/Questionnaire/CAMS-SSF5-OutcomeDisposition`). Result: [SPiER CAMS Outcome Disposition](StructureDefinition-spier-cams-outcome-disposition.html) on LOINC `93374-7` with a SPiER-local disposition value:

  ```
  GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/CAMS-SSF5-OutcomeDisposition&subject=Patient/[id]
  GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
  ```

The [Therapeutic Worksheet](Questionnaire-CAMS-Therapeutic-Worksheet.html) and
[Stabilization Plan](Questionnaire-CAMS-Stabilization-Plan.html) are
session-continuation CarePlans rather than a distinct risk signal.

#### CRP (Crisis Response Plan)

- Questionnaire: [Crisis Response Plan](Questionnaire-CrisisResponsePlan.html) — `http://thespierproject.org/fhir/Questionnaire/CrisisResponsePlan`
- Result: [SPiER Crisis Response Plan](StructureDefinition-spier-crisis-response-plan.html), a **CarePlan** with one activity per section. An alternative to Stanley-Brown sharing its section vocabulary, so distinguish the two by `_profile`, not `code`

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/CrisisResponsePlan&subject=Patient/[id]
GET [base]/CarePlan?_profile=http://thespierproject.org/fhir/StructureDefinition/spier-crisis-response-plan&subject=Patient/[id]
```

#### PHQ-9 (Patient Health Questionnaire-9)

- Questionnaire: [PHQ-9](Questionnaire-PHQ-9.html) — `http://thespierproject.org/fhir/Questionnaire/PHQ-9`
- Results: [SPiER PHQ-9 Total Score](StructureDefinition-spier-phq9-total-score.html) (LOINC `44261-6`) and [SPiER PHQ-9 Item 9](StructureDefinition-spier-phq9-item9.html) (LOINC `44260-8`, the suicide-relevant item)

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/PHQ-9&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|44260-8&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|44261-6&subject=Patient/[id]
```

#### PSS-3 (Patient Safety Screener, 3-item)

- Questionnaire: [PSS-3](Questionnaire-PSS-3.html) — `http://thespierproject.org/fhir/Questionnaire/PSS-3`
- Result: [SPiER PSS-3 Result](StructureDefinition-spier-pss3-result.html), a binary result on LOINC `93374-7`; ED-SAFE's universal acute-care screen

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/PSS-3&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

#### PSS-Full (Patient Safety Screener, full)

- Questionnaire: [PSS-Full](Questionnaire-PSS-Full.html) — `http://thespierproject.org/fhir/Questionnaire/PSS-Full`
- Result: [SPiER PSS-Full Risk Level](StructureDefinition-spier-pss-full-risk-level.html) on LOINC `93374-7`; the PSS-3 plus a site-defined stratification step that lands **directly** on the shared tier, with no per-instrument crosswalk

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/PSS-Full&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

#### SAFE-T (Suicide Assessment Five-Step Evaluation and Triage)

- Questionnaire: [SAFE-T](Questionnaire-SAFE-T.html) — `http://thespierproject.org/fhir/Questionnaire/SAFE-T`
- Result: [SPiER SAFE-T Risk Level](StructureDefinition-spier-safet-risk-level.html) on LOINC `93374-7`; a five-step clinician formulation that lands **directly** on the shared tier, like PSS-Full

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/SAFE-T&subject=Patient/[id]
GET [base]/Observation?code=http://loinc.org|93374-7&subject=Patient/[id]
```

#### SBQ-R (Suicide Behaviors Questionnaire-Revised)

- Questionnaire: [SBQ-R](Questionnaire-SBQ-R.html) — `http://thespierproject.org/fhir/Questionnaire/SBQ-R`
- Result: [SPiER SBQ-R Total Score](StructureDefinition-spier-sbqr-total-score.html) on SNOMED `225337009` (cutoffs ≥7 / ≥8) — a generic "Suicide risk assessment" concept used because LOINC publishes no SBQ-R code (rechecked July 2026)

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/SBQ-R&subject=Patient/[id]
GET [base]/Observation?code=http://snomed.info/sct|225337009&subject=Patient/[id]
```

#### Stanley-Brown Safety Plan

- Questionnaire: [Stanley-Brown Safety Plan](Questionnaire-StanleyBrownSafetyPlan.html) — `http://thespierproject.org/fhir/Questionnaire/StanleyBrownSafetyPlan`
- Result: [SPiER Stanley-Brown Safety Plan](StructureDefinition-spier-stanley-brown-safety-plan.html), a **CarePlan** with one activity per step; distinguish it from the CRP by `_profile`

```
GET [base]/QuestionnaireResponse?questionnaire=http://thespierproject.org/fhir/Questionnaire/StanleyBrownSafetyPlan&subject=Patient/[id]
GET [base]/CarePlan?_profile=http://thespierproject.org/fhir/StructureDefinition/spier-stanley-brown-safety-plan&subject=Patient/[id]
```

### The risk tier, whichever instrument produced it {#risk-tier}

Every instrument produces a harmonized **suicide-risk concept** Observation on
the generic LOINC code, tagged with the suicide-risk domain category. Code and
category alone do **not** isolate it: seven instrument results carry the same
code and categories (see the warning under *By instrument*). Filter on the
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
