# EpisodeOfCare as the correlation key for all eight stages

Design proposal for issue #263. The issue itself says the ordering question "is
the real design work here and should be settled before any FSH is written", so
this document settles it — and corrects the issue's proposal table, which does not
survive contact with R4.

## Status

| Decision | State |
|---|---|
| **2 — mechanism** | **ACCEPTED 2026-08-11: Option B, the Encounter path.** |
| **1 — ordering** | **Still open.** Not required for phase 1; needed before phase 3. |

| Phase | State |
|---|---|
| 1 — profile + fixtures | **Done.** `SPiEREncounter`, 24 scenario Encounters, both gates extended. |
| 2 — stamp `.encounter` on artifacts | Next. Target 49 of 49 linkable resources. |
| 3–6 | Blocked on Decision 1 (phase 3 onward). |

Two facts found while implementing phase 1 change what is written below, and are
corrected in place: **`Encounter` has no `category` element** (so it cannot carry
the #262 domain tag either), and **`Encounter.appointment` is a native
`Reference(Appointment)`** — a better answer for Appointment than the chain
originally proposed in §3. `Consent` remains the one type with no path.

---

## 1. The problem, restated

`risk-episode.fsh` makes `EpisodeOfCare` the anchor for Stage 7 and hangs Stage-7
`Task`s off it via `Task.basedOn`. Stages 1–6 have no such link, so there is no
way to ask "show me everything that happened in this patient's risk episode", and
two episodes six months apart are indistinguishable to any consumer.

The cost is visible in `web/src/lib/patientPathway.ts`, whose `stageForArtifact`
falls back through four mechanisms, the last being a CarePlan **id regex**
(`/stanley-brown/i`, `/cams-stabilization/i`, …). That heuristic resolves *stage*
and never *which episode*.

Measured on `main` (c6904b9), across the six scenarios that have an episode:

| resourceType | count | references an episode |
|---|---|---|
| Observation | 18 | 2 |
| Communication | 12 | 0 |
| CarePlan | 7 | 2 |
| EpisodeOfCare | 6 | — |
| ServiceRequest | 6 | 0 |
| Appointment | 5 | 0 |
| DocumentReference | 4 | 0 |
| Procedure | 2 | 0 |
| Consent | 1 | 0 |
| **total** | **61** | **4** |

There are **zero `Task` resources in the demo data** — `Task.basedOn` is done in
the *profile*, not exercised by any scenario. And there are zero real FHIR
`Encounter` resources anywhere in the repo; the scenarios' `encounters` bucket is
`ScenarioEncounter` walkthrough narration, which correlates artifacts by
`relatedResponseNames` and `relatedCarePlanIdSubstrings` — string matching of the
same class as the CarePlan id regex.

## 2. The issue's proposal table is mostly invalid in R4

#263 proposes a native element per resource type. Checked against
`hl7.fhir.r4.core#4.0.1` snapshots, most of those elements cannot reference an
`EpisodeOfCare` at all:

| Proposed | Verdict | Actual R4 `targetProfile` |
|---|---|---|
| `Observation.partOf` | **invalid** | MedicationAdministration, MedicationDispense, MedicationStatement, Procedure, Immunization, ImagingStudy |
| `CarePlan.addresses` | **invalid** | Condition only (R5 widened this; R4 did not) |
| `ServiceRequest.basedOn` | **invalid** | CarePlan, ServiceRequest, MedicationRequest |
| `Appointment.basedOn` | **invalid** | ServiceRequest only |
| `Procedure.partOf` | **invalid** | Procedure, Observation, MedicationAdministration |
| `QuestionnaireResponse.encounter` | encounter-only | Encounter (the issue already anticipated an extension here) |
| `Communication.partOf` | **valid** | `Reference(Any)` |
| `Task.basedOn` | **valid** (already done) | `Reference(Any)` |

Two of eight work. Three further slots exist that the issue did not mention:

- **`DocumentReference.context.encounter` → `Encounter | EpisodeOfCare`** — the one
  purpose-built episode slot in R4.
- `CarePlan.supportingInfo` → `Reference(Any)` — mechanically valid, but
  semantically "other info informing the plan", not membership. Using it as a
  membership pointer would be a lie of the same kind this epic keeps deleting.
- `Communication.basedOn`, `Task.focus` → `Reference(Any)`.

### What R4 is actually telling us

The reason so few resources can point at an episode is that **R4's intended path
is through `Encounter`**, and `Encounter.episodeOfCare` → `Reference(EpisodeOfCare)`.
Encounter is the hinge; the episode is reached in two hops.

Which of SPiER's types have a native `.encounter`, verified against the same
snapshots:

| has `.encounter` | no `.encounter` |
|---|---|
| Observation, QuestionnaireResponse, CarePlan, ServiceRequest, Procedure, Communication, Task, Flag | **Appointment**, **Consent**, EpisodeOfCare |
| `DocumentReference.context.encounter` — and it accepts `EpisodeOfCare` directly | |

So the Encounter path covers 9 of 11, not all. `Appointment` and `Consent` need a
separate answer, and pretending otherwise would repeat the issue's own error:

- **`Appointment`** — **superseded during phase 1.** `Encounter.appointment` is a
  native `Reference(Appointment)`, so an Encounter names its Appointment directly.
  That is one hop from the Encounter and needs no chain. The original suggestion
  here (`Appointment.basedOn → ServiceRequest → encounter`) worked only when a
  referral ServiceRequest preceded the appointment; prefer `Encounter.appointment`.
- **`Consent`** — no `.encounter`, no usable `basedOn`. Worth asking whether a
  consent to share information is episode-scoped at all: it plausibly scopes to
  the patient and the receiving organisation, and outlives any one episode. The
  honest options are the extension, or deliberately declaring it out of scope with
  the reason written down.

Any design that ignores this is fighting the spec, which is the trap #272 already
documented for the category tag.

## 3. Options

### Option A — one `spier-episode-reference` extension everywhere

Define one extension, apply it to all eight profiles (the issue's fallback plan).

- **For:** uniform; one shape to learn; no new resource types; smallest change to
  the demo's runtime.
- **Against:** **not queryable.** An extension needs a published `SearchParameter`
  *and* server support to be searchable. The "one query returns everything" goal
  is not achievable this way on a stock server — the exact overstatement #271
  removed from the IG for the category tag. It also puts SPiER-specific plumbing
  on eight profiles where R4 already has an answer.

### Option B — FHIR-native: mint real Encounters, correlate through them

Create real `Encounter` resources for each contact, set `.encounter` on every
artifact (all native), and `Encounter.episodeOfCare` on each Encounter.

- **For:** no extensions for 9 of 11 types; entirely standard; **searchable with
  stock parameters** (`Observation?encounter=…`, `Encounter?episode-of-care=…`);
  matches what an EHR already does, so a partner's data lands in this shape
  without SPiER asking for anything special. It also gives the walkthrough
  narration a real FHIR backing, retiring the `relatedResponseNames` string
  matching.
- **Against:** the largest change. Introduces a resource type SPiER has never
  emitted, needs an `Encounter` profile, scenario fixtures for ~20 encounters,
  and a runtime story for when an Encounter opens. Retrieval is two hops, not one.

### Option C — hybrid: native slot where R4 provides one, extension elsewhere

`Communication.partOf`, `Task.basedOn`, `DocumentReference.context.encounter`
natively; the extension on Observation, QuestionnaireResponse, CarePlan,
ServiceRequest, Appointment, Procedure.

- **For:** uses each type's best available slot; smaller than B.
- **Against:** **the worst of both for a consumer.** Six types need one query
  shape and three need another, so a client must special-case per type — while
  still not being searchable for the six on the extension. Inconsistency without
  the payoff.

## 4. Searchability, stated honestly

The issue claims the whole journey becomes one query:

```
GET /EpisodeOfCare/{id}?_revinclude=*
```

Two problems, and they should not be repeated in the IG:

1. Support for `_include` / `_revinclude` is **optional** in FHIR, and the `*`
   wildcard is not something a client can assume. Before the IG promises this
   query, someone should test it against the servers SPiER actually cares about —
   this document does not claim to know how any specific server behaves.
2. Reverse-including a *custom extension* search parameter requires the server to
   have registered that SearchParameter. Under Option A, `_revinclude` cannot find
   anything through the extension on a server that has not.

Under Option B the equivalent is two standard queries, both widely supported:

```
GET /Encounter?episode-of-care={id}
GET /Observation?encounter={csv-of-encounter-ids}    # and per other type
```

Less elegant on the page, actually works in the field. Whatever is chosen, the IG
should state the real retrieval path, as `quick-starts.md` now does for the
category gap.

## 5. **DECISION 1** — the ordering question

The issue notes the episode must exist before Stage 1 completes if every artifact
is to reference it, and flags this as the crux. It is, and the naive reading is
wrong.

A suicide-safer-care episode is *opened because* a screen was positive — which is
Stage 1's **output**. So:

- **Opening an episode at screening time is clinically false.** Stage 1 screens
  everyone; most screen negative. An open `EpisodeOfCare` with
  `type = suicide-safer-care` asserts the patient is in suicide-safer care. Minting
  one per screen would assert that about every negative screen in the system —
  the same class of unbacked claim as a fabricated code.
- **Back-stamping the triggering artifacts after the fact** means mutating records
  that have already been filed, and in a real EHR they may be immutable.

**Recommendation: the episode opens on the first positive screen, and points
back at its own trigger.** Artifacts created *after* the open carry the episode
forward; the one or two artifacts that *caused* it are reached from the episode,
not the reverse. `SPiERSuicideRiskEpisode` already carries an
`episode-entry-reason` extension, so the natural move is a reference alongside it
(entry reason says *why*; the new reference says *which artifact*).

Consequences, stated plainly:

- Stage-1 artifacts for **negative** screens have no episode, correctly — there is
  no episode to belong to.
- Stage-1 artifacts for a **positive** screen are reachable in one hop from the
  episode, not by a category/extension search.
- `stageForArtifact` keeps working unchanged for stage resolution; only *episode
  membership* is new. The CarePlan id regex can be deleted once membership is
  explicit, which is the win the issue actually wants.

## 6. **DECISION 2** — which option — **ACCEPTED: Option B**

**Accepted 2026-08-11: Option B, the Encounter path.** Option A is rejected rather
than deferred; Option C is rejected outright.

Original recommendation, kept for the record:

**Recommendation: Option B, phased**, with Option A explicitly rejected rather
than deferred.

The deciding argument is not elegance, it is the same one that settled #272: a
mechanism that only works when a server has installed SPiER's custom
SearchParameter provides *the appearance* of correlation, not correlation.
`Encounter` is the slot R4 built for this, every relevant type already has a
native pointer to it, and the resulting queries work on servers SPiER does not
control.

The honest cost: this is the biggest single change in the epic, and it is not a
one-PR job.

### Phasing

1. **Profile + fixtures.** `SPiEREncounter` profile; one `Encounter` per
   `ScenarioEncounter` step in the six episode-bearing scenarios;
   `Encounter.episodeOfCare` set. No runtime change. Gated by
   `check:scenarios` + `validate-fhir.mjs`.

   **Naming collision — SETTLED.** The narration bucket was renamed
   `encounters` → `walkthrough`, and `encounters` now holds real `Encounter`
   resources. The cost estimate below was wrong and is corrected for the record:

   > it touches all 11 scenario files plus the UI that renders the walkthrough

   It touched **one** scenario file — only `patient-011` has narration. The
   alternative (`fhirEncounters` beside the misleading `encounters`) was rejected.
   Deciding evidence: the roadmap issue that introduced `ScenarioEncounter` already
   named the successor — *"Promote to FHIR. Model real `Encounter` resources
   alongside scenarios and derive the timeline from them"* — so the narration key
   was always temporary.

   Registries updated: `PatientSlice` in `web/src/types/fhir.ts`, `FHIR_BUCKETS` /
   `NON_FHIR_BUCKETS` / `PATIENT_ELEMENT` / `BASE_REQUIRED` / `STATUS_CODES` in
   `web/scripts/check-scenario-resources.mjs`, and the bucket map in
   `scripts/validate-fhir.mjs`. Both gates fail loudly on an unknown bucket
   (`check-scenario-resources.mjs` lists the known set), so a forgotten registry is
   caught rather than silently skipped.
2. **Stamp `.encounter` on the artifacts** in those fixtures. Measurable, with an
   honest target: of the 61 scenario resources, 6 are the `EpisodeOfCare`s
   themselves and 6 are `Appointment` (5) + `Consent` (1) awaiting the separate
   decision above — so the target is **49 of 49 linkable resources**, not 61.
   Any check added here must count the exclusions explicitly rather than quietly
   passing on a smaller denominator.
3. **Episode → trigger reference** (Decision 1) on `SPiERSuicideRiskEpisode`.
4. **Runtime.** The recorder stamps the active encounter; the episode opens on
   first positive screen.
5. **Retire the heuristics.** Delete the CarePlan id regex from
   `patientPathway.ts`; migrate `ScenarioEncounter.relatedResponseNames` /
   `relatedCarePlanIdSubstrings` to real references.
6. **Document the real retrieval path** in the IG, with the two-query shape and no
   `_revinclude=*` promise.

Phases 1–3 are FSH and fixtures and can land independently. Phase 4 is where the
demo's behaviour changes and deserves its own review.

## 7. What #272 inherits

#272's Option 3 was "leave all three to the episode, and make #263 the retrieval
story" — appealing but dependent on this landing. Under Option B it splits:

- **`Task`** has a native `.encounter` *and* the existing `Task.basedOn` → episode,
  so it is reachable by a standard path either way. This is the strongest case yet
  for not tagging Task with a domain category, which #272 already leaned toward.
- **`Appointment`** has no `.encounter`, so it is reachable only via
  `basedOn → ServiceRequest → encounter`. That weakens Option 3 for Appointment
  specifically — it may still want `serviceCategory`.
- **`EpisodeOfCare`** stays findable by `type`, unchanged.

So #272 should be re-read *after* Decision 2, and its three rows may not get the
same answer.

## 8. Open questions

- Does SPiER want `Encounter` in the catalog and data dictionary as a first-class
  resource type? #260 opened `FhirResourceType`, so it can be documented — but
  someone should decide whether an Encounter is a SPiER artifact or ambient EHR
  context that SPiER merely references.
- The six scenarios have exactly one episode each. Nothing in the demo exercises
  the two-episodes-six-months-apart case the issue is motivated by. A seventh
  scenario with two sequential episodes would be the proof, and does not exist.
- `patient-008` and `patient-010` have `finished` episodes. Confirm whether
  artifacts should still resolve to a closed episode (they should) and that
  `findOpenEpisode` is not used where "the episode this belongs to" is meant.
