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

1. `GET /fhir/Patient/patient-011` returns the `Patient` minted in #356.
2. All **14** searches return searchset Bundles; the two load-bearing ones carry
   real data for every one of the 14 scenario patients.
3. `category=survey` and `category=procedure` return **different** sets.
4. `GET /fhir/metadata` returns a CapabilityStatement that
   `parseCapabilityStatement` reads, and the advertised set is runtime-switchable.
5. `services/mock-ehr/` has its own `verify`, wired into CI.
6. **Proven, not assumed:** point a real `SmartDataSource` at it — the SMART
   sandbox walkthrough in [`../smart-sandbox-testing.md`](../smart-sandbox-testing.md)
   is the closest existing procedure — and confirm the chart renders
   patient-011's artifacts. Per the standing rule, also confirm it can **fail**:
   take one load-bearing search offline and watch the chart's error state appear.

## Related

- [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) — §4 the
  endpoint surface, §8 the decision, §9 the build order.
- [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) — §6, whose
  objection this must keep honoring, and §8's phases 4–5 (the population lens
  bypasses `FhirDataSource`, so "the whole demo runs on the server" is not true
  until those land).
- [`surfaces-and-distribution.md`](surfaces-and-distribution.md) §5 — origins,
  and why the browser talks to FHIR directly.
