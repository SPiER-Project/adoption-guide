# Mock EHR, step 1: the read API

Written 2026-08-18 against `main` at `ad3ffe0`. The executable spec for **panel
step 1** — `services/mock-ehr/` serving the reads `SmartDataSource` issues, so
the panel can be launched against a server holding SPiER's own patients.

This is the *next* piece: [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md)
§9 step 1. Its two blockers are gone — the `Patient` resources landed in #356,
and §8 was settled 2026-08-18.

**Read §4 and §8 of the panel plan first.** This document does not restate them;
it makes step 1 executable and records what measurement found that those sections
get slightly wrong.

## ✅ BUILT — and the spec was right about most of it

`services/mock-ehr/` implements this document. 33 tests, its own CI-gated
`verify`, and an integration test that drives the **real** `SmartDataSource`
through a **real** fhirclient against a loopback instance of the server.

⚠️ **This spec was derived by reading `SmartDataSource`, not by exercising it,
and that is exactly where it turned out to be wrong.** Building it found two
things no amount of re-reading the plan would have produced — both recorded in
"What building it found", below. Everything above the line held: the 14
searches, the two load-bearing ones, the Bundle shape, the `pageLimit: 0`
hazard, the `/metadata` contract, and the `responses`-bucket correction were all
confirmed against a running server.

## What is settled, and is not to be relitigated here

- **The mock serves FHIR** ([panel §8](embedded-panel-smart-launch.md), decided
  2026-08-18). Medplum rejected. Reason: scope of what the host must be — a
  patient list, a patient page, an encounter page.
- **Its own Worker, its own origin.** `spier-mock-ehr.*.workers.dev`. Cross-origin
  is a requirement, not a preference (panel §6).
- **The offline demo track is retired**, the `FhirDataSource` discipline is kept
  ([`surfaces-and-distribution.md`](surfaces-and-distribution.md) §8).
- **One copy of every fixture.** The mock serves the *same*
  `web/src/data/population/scenarios/patient-0NN.json` the app ships. No second
  copy of any patient, ever.

## ⚠️ Three corrections to what the plan says about this step

Found by reading the code rather than the plan. Each would cost real time.

### 1. `collectScenarioResources` does NOT cover QuestionnaireResponse

Panel §3 says it "already does the bucket-unwrapping walk the read path needs."
It does not. [`scripts/validate-fhir.mjs`](../../scripts/validate-fhir.mjs)'s
`SCENARIO_FHIR_BUCKETS` **deliberately omits `responses`**, and says so:

> *Deliberately absent: `responses` (StoredResponse wrappers — the QRs inside
> them are already covered by `npm run check:scenarios`)*

`QuestionnaireResponse` is one of the **two load-bearing searches** (below), so
the one bucket the reference walk skips is the one that cannot be skipped. The
`responses` bucket holds `StoredResponse` wrappers — `{ id, questionnaireName,
completedAt, resource }` — and the QR is `entry.resource`.

**Unwrap it explicitly. Do not assume the existing walk is a drop-in.**

### 2. It is 14 searches across 13 types, and only two are load-bearing

`SmartDataSource.getSlice` ([`smartDataSource.ts:236`](../../web/src/lib/dataSource/smartDataSource.ts))
runs these in one `Promise.all`. **Two have no `.catch` — a failure there fails
the whole chart.** The other twelve degrade to empty:

| # | Search | Fails the chart? |
|---|---|---|
| 1 | `QuestionnaireResponse?patient=` | **YES** |
| 2 | `Observation?patient=&category=survey` | **YES** |
| 3 | `Observation?patient=&category=procedure` | no |
| 4 | `CarePlan?patient=` | no |
| 5 | `Communication?patient=` | no |
| 6 | `EpisodeOfCare?patient=` | no |
| 7 | `Flag?patient=` | no |
| 8 | `Task?patient=` | no |
| 9 | `DocumentReference?patient=` | no |
| 10 | `ServiceRequest?patient=` | no |
| 11 | `Appointment?patient=` | no |
| 12 | `Consent?patient=` | no |
| 13 | `Procedure?patient=` | no |
| 14 | `Encounter?patient=` | no |

Plus `GET /Patient/{id}` — `smartPatient.ts` calls `client.patient.read()`.

**Ship 1, 2 and Patient first and the chart renders.** The rest are additive, and
a half-built mock degrades visibly rather than breaking. Note the consequence for
testing: a mock that returns 404 for, say, `Consent` will *look* fine, so
"the chart rendered" is not evidence the surface is complete.

### 3. `category=survey` vs `category=procedure` must actually filter

Searches 2 and 3 differ **only** by `category`, and they feed different parts of
the chart (instrument results vs Stage-4 means-safety actions). A mock that
ignores the `category` param and returns all Observations for both will put
procedure Observations into the survey bucket, and the chart will look subtly
wrong rather than broken.

The scenarios' Observations carry the real `category`, so filter on it.

## What the client expects back

`search()` calls `client.request(url, { pageLimit: 0, flat: true })`.

- **`flat: true`** means fhirclient unwraps `Bundle.entry[].resource` for the
  caller — so the mock must return a **searchset `Bundle`**, not a bare array.
- **`pageLimit: 0`** means "follow every `next` link". With no `link` entry there
  is nothing to follow, which is correct for a fixture-backed mock. **Do not
  emit a `next` link you cannot serve** — fhirclient will follow it forever.
- The caller then filters by `resourceType` defensively, so extra entries are
  tolerated but pointless.

Minimum viable response:

```json
{ "resourceType": "Bundle", "type": "searchset", "total": 2, "entry": [ { "resource": { } } ] }
```

## `/metadata` — small, and the most load-bearing thing here

`parseCapabilityStatement` ([`web/src/lib/writeback/capability.ts`](../../web/src/lib/writeback/capability.ts))
reads it to decide what the writeback ladder may create. Its contract, from the
code rather than from the spec:

- it scans **every** `rest` entry, not just `mode: 'server'`;
- a type is creatable when its `interaction[]` contains `{ code: 'create' }`;
- anything unreadable yields **no** capabilities, and the ladder degrades to its
  Tier-0 floor rather than assuming.

So the minimum that makes the ladder work is a `rest[0].resource[]` listing each
type with `read`, `search-type` and (for step 4) `create`.

⚠️ **Make it runtime-configurable from the mock's own UI** (panel §4). That
single switch is what turns the capability-degradation demo — panel §5 calls it
"the most persuasive thing in the whole proposal for an integration lead" — from
a slide into a live demonstration. It costs almost nothing *at this step* and is
awkward to retrofit.

## Not in this step

- **Auth.** No `/authorize`, no `/token`, no PKCE — that is step 2. Step 1 is an
  open read API, which is exactly why it can be built and tested first.
- **Writes.** Step 4. ⚠️ And when it comes: the guardrail's "reuse
  `check-scenario-resources.mjs`" is a **port, not reuse** — that script is Node
  reading StructureDefinitions off a filesystem, and a Worker has none. It needs
  the same Vite-bundling treatment `services/cds-hooks` already uses. Budget it
  then; do not let step 1's ease set the expectation.
- **Host chrome.** Step 5.

## The pattern to copy

`services/cds-hooks/` is the precedent and it already solves the hard part —
importing the app's fixtures into a Worker:

```ts
import { POPULATION_SCENARIOS } from '../../../web/src/data/population/scenarios'
```

That works because the Worker is **Vite-bundled** (`import.meta.glob` needs it),
which is why `wrangler.jsonc` points `main` at `./dist/index.js` rather than at
source. Copy that arrangement rather than reinventing it.

⚠️ **Give it its own CI-gated `verify` on day one.** `services/cds-hooks` has one
precisely because `web/`'s does not cover it. The mock needs it *more*, because
it reads scenario fixtures that `web/scripts/shift-scenario-dates.mjs`
periodically re-anchors — a break there is silent and shows up as an empty chart
in a demo. Mirror the existing script:

```
"verify": "npm --prefix ../../web run copy-fhir && npm run typecheck && npm run lint && npm run test"
```

and add a `mock-ehr` job to CI beside the `cds-hooks` one.

## Done means

1. ✅ `GET /fhir/Patient/patient-011` returns the `Patient` minted in #356.
2. ✅ …with one correction. All 14 searches return searchset Bundles, and the two
   load-bearing ones carry real data for **13 of the 14** patients. patient-002
   is the exception and must stay one — see finding 2.
3. ✅ `category=survey` and `category=procedure` return different sets — though
   `procedure` returns **empty for every patient**, which is finding 1.
4. ✅ `/fhir/metadata` is parsed by `parseCapabilityStatement` in the test itself
   (not by hand-reading fields), across all four runtime-switchable profiles.
5. ✅ Own `verify`, wired into `web-lint.yml` as a `mock-ehr` job.
6. ✅ **Proven, not assumed** — and it is what found both corrections.
   `src/smartDataSource.integration.test.ts` stands the app on a loopback HTTP
   server and drives the real `SmartDataSource` at it: patient-011's full slice
   comes back populated in all thirteen buckets, and the derived risk alerts are
   non-`none`. The failure direction is asserted too, in both directions: a 500
   on `QuestionnaireResponse` (no `.catch`) **rejects**, and a 500 on `Flag`
   (best-effort) degrades to an empty bucket while the rest of the chart
   survives.

   Still owed: the same run through a **browser**, against the deployed Worker,
   with a SMART launch in front of it. Node proves the contract; it does not
   prove CORS preflight or the launch sequence.

## What building it found

Two things the derived spec could not have known, both discovered by the first
real request rather than by re-reading.

### 1. Not one scenario QuestionnaireResponse has a `subject` — 0 of 20

Twelve of the thirteen FHIR buckets are **100%** patient-linked. `responses` is
**0%**. So `QuestionnaireResponse?patient=` — the search whose failure fails the
whole chart — returned nothing for every patient on the first run.

The gap is invisible to the existing gates *by construction*, which is why it
survived: `check-scenario-resources.mjs` check 3 ("every resource points at THIS
scenario's patient") walks the FHIR buckets and `responses` is deliberately not
one of them, while `check-scenario-responses.mjs` validates each QR against its
Questionnaire, which says nothing about `subject`. Neither gate is wrong. The
combination just leaves `QuestionnaireResponse.subject` unowned — and nothing
noticed, because the local data source never needs it: it keys artifacts by the
scenario file they came from.

The mock stamps the link on at load time and **exports the list of what it
stamped** (`NORMALIZED_LINKS`), pinned by a test to exactly those 20 QRs, so a
resource in any other bucket losing its link fails loudly instead of quietly
acquiring one. That is the narrow fix, chosen to keep the change inside this
service. **The durable fix is to add `subject` to the fixtures** and let the
existing gate own it — filed as **#364**, which also carries the step most
likely to be skipped: delete the stamping here and assert `NORMALIZED_LINKS` is
empty, so the workaround dies with the defect rather than outliving it.

### 2. `category=procedure` returns empty for all 14 patients, and two Observations are unreachable

Correction 3 above says the two category searches "feed different parts of the
chart (instrument results vs Stage-4 means-safety actions)". The first half is
right; the second is not. The scenarios contain **no Observation with category
`procedure`** — Stage-4 means-safety counseling is a `Procedure` resource
(3 of them, correctly returned by search 13). Search 3 is real, correctly
filtered, and empty. It is not dead code (a server could hold such an
Observation, and the filter is gated) but nothing in the demo exercises it.

The related finding is sharper. The scenarios hold two Observations with
category `exam` — patient-002's annual wellness visit and patient-014's room
re-sweep — and `getSlice` asks only for `survey` and `procedure`. **Those two
never reach the panel.** For patient-014 it costs one artifact. For patient-002,
the deliberately-never-screened patient, it is their *only* artifact, so through
the SMART path their chart is entirely empty while the local data source shows
the wellness visit. This is a divergence in `SmartDataSource`'s query set, not
in the mock; the mock holds and serves both. Left as-is and asserted in a test
so a second patient cannot join them silently.

### And one thing the spec did not mention at all

**CORS.** The panel is a browser app on a different origin by design, so without
`Access-Control-Allow-Origin` every read fails in the browser while every `curl`
succeeds — the most misleading way for this to break. Wide-open CORS is applied
to `/fhir` and `/fhir/*`, and asserted.

## Related

- [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) — §4 the
  endpoint surface, §8 the decision, §9 the build order.
- [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) — §6, whose
  objection this must keep honoring, and §8's phases 4–5 (the population lens
  bypasses `FhirDataSource`, so "the whole demo runs on the server" is not true
  until those land).
- [`surfaces-and-distribution.md`](surfaces-and-distribution.md) §5 — origins,
  and why the browser talks to FHIR directly.
