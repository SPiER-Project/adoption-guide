# Mock patients on a SMART launch: a Bundle first, a server maybe

Written 2026-08-13, from the question "should we have a mock-patient SMART on FHIR
app?" The answer turns on a fact that reframes it: **SPiER already *is* a SMART on
FHIR app.** What it lacks is anything worth launching against.

This document scopes the smallest artifact that fixes that, argues against
building our own FHIR server, and states what a mock server would and would not
prove.

## Status

| Decision | State |
|---|---|
| **1 — build a second "mock patient" SMART app** | **REJECTED.** SPiER is already a complete SMART client; a second app of ours proves nothing we control both ends of. §2 |
| **2 — mint real `Patient` resources and emit each mock patient as a FHIR Bundle** | **PROPOSED, and worth doing regardless of everything below.** §4 |
| **3 — stand up a real FHIR server (Medplum / HAPI) and load the Bundles** | **PROPOSED as the target.** §5 |
| **4 — write our own mock FHIR + SMART auth endpoints on the existing Worker** | **NOT RECOMMENDED.** A lenient mock attacks the one claim the SMART path exists to make. §6 |
| **5 — a patient-facing SMART app** | **OUT OF SCOPE here.** A product direction, not a demo gap. See [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §5. |

| Phase | State |
|---|---|
| 1 — `Patient` / `Practitioner` / `Organization` for the 14, gated | **Not started.** §7 |
| 2 — per-patient transaction Bundle export + a validator gate | **Not started.** §7 |
| 3 — load into a real server; re-run the SMART walkthrough against it | **Not started.** §7 |
| 4 — population-capable `SmartDataSource` (un-hardcode two pages) | **Not started.** §8 — the scope people forget |
| 5 — extend mapper dispatch past PHQ-9 (#230) | **Open issue, unscheduled.** §8 |

---

## 1. What already exists

The client side is not the gap. It is substantially built:

| Piece | Where | What it does |
|---|---|---|
| Launch + redirect legs | [`SmartLaunch.tsx`](../../web/src/components/SmartLaunch.tsx), [`SmartRedirect.tsx`](../../web/src/components/SmartRedirect.tsx), `main.tsx` | Full EHR launch, PKCE public client, both legs bootstrapped around `HashRouter` |
| Session | [`SmartProvider.tsx`](../../web/src/context/SmartProvider.tsx) | `sessionStorage`, rehydrated on reload |
| Live read/write | [`smartDataSource.ts`](../../web/src/lib/dataSource/smartDataSource.ts) | 384 lines behind the `FhirDataSource` interface; QR written first, then derived Observations with `derivedFrom` pointing at the server-assigned id |
| Patient context | [`smartPatient.ts`](../../web/src/lib/smartPatient.ts) | Reads the launch `Patient` and reduces it to the banner summary |
| A documented walkthrough | [`docs/smart-sandbox-testing.md`](../smart-sandbox-testing.md) | Exact launcher config, a scripted zero-click launch, and an honest limitations section |

`SmartDataSource.getSlice` issues **14 patient-scoped searches across 13 resource
types** — `QuestionnaireResponse`, `Observation` (twice: `category=survey` and
`category=procedure`), `CarePlan`, `Communication`, `EpisodeOfCare`, `Flag`,
`Task`, `DocumentReference`, `ServiceRequest`, `Appointment`, `Consent`,
`Procedure`, `Encounter`. Two are load-bearing (QR and survey Observations surface
errors); the other twelve are best-effort and degrade to empty.

That list is also, precisely, the server surface any mock host has to implement.
It is not small.

## 2. The gap, stated sharply

**The demo has two halves that never meet.**

| | Runs on | Shows |
|---|---|---|
| The clinical story | localStorage / static scenarios | 14 patients, ~150 gated FHIR resources, 4 ED walkthroughs, episode correlation, the Stage-8 measure engine |
| The interop story | the SMART Health IT sandbox | Synthea patients with **zero** suicide-risk data |

Launch SPiER for real and you prove the plumbing on an empty chart. Show the rich
pathway and you are showing localStorage. Nobody who matters gets to see both at
once, which is a shame, because both are good.

This is why "a mock patient SMART app" is the wrong instinct: the missing piece is
not another *app*, it is a *server with our patients on it*.

### Three concrete deficits

1. **The 14 mock patients have no `Patient` resource.**
   [`patients.json`](../../web/src/data/population/patients.json) is app-shaped —
   `id`, `displayName`, `dob`, `mrn`, `gender`, `recommendedNextStep`. Every
   `subject: Patient/patient-001` across the scenarios points at an id with
   nothing behind it. The only real `Patient` in the tree is `DEMO_PATIENT` in
   [`demoPatient.ts`](../../web/src/data/demoPatient.ts), a single hand-written
   resource for the no-patient-selected mode. There are no `Practitioner` or
   `Organization` resources either, though artifacts reference performers.

   **This is a conformance hole in its own right, independent of any server.**

2. **SMART mode cannot reach the Population or Dashboard lenses at all.**
   [`PopulationView.tsx:73`](../../web/src/pages/PopulationView.tsx:73) and
   `MeasureDashboard.tsx` import `localDataSource` **directly**, bypassing the
   `FhirDataSource` abstraction that exists to prevent exactly this. So the two
   lenses that mock patients would be *for* are the two that a connected server
   cannot feed. §8.

3. **Foreign data mostly does not derive.** Mapper dispatch is canonical-bound
   (`http://spier.org/Questionnaire/*`); the code-based fallback covers **PHQ-9
   only**. Anything else lands in the collapsed "Other activity" bucket with no
   risk alert and no derived Observations. That is #230.

## 3. Decision 1: a second SMART app — REJECTED

The reading of the original question as "build a mock partner app that consumes
SPiER data" fails on a simple point: we would control both ends, so
interoperability would be asserted rather than demonstrated. The claim is already
carried better by three things that exist — the published IG, the live
`/cds-services` endpoint that a third-party sandbox can invoke, and the FHIRcast
context sync.

If we ever want that proof, the way to get it is a **third party's** app or
sandbox reading our Bundle — which is §4, not a new app.

## 4. Decision 2: the Bundle — PROPOSED, and do it regardless

**Mint real `Patient` (plus `Practitioner` / `Organization`) resources for the 14,
and emit each patient's full artifact set as a conformant FHIR transaction
Bundle.**

This is chunk zero and it stands entirely alone. It is worth doing even if no
server is ever stood up, because it is the artifact that unlocks every other
path:

- load it into Medplum, HAPI, the public SMART sandbox, or **a prospect's own
  sandbox**;
- hand it to a vendor as the test corpus for the HIE portability pilot (#60);
- feed it to Inferno or any other conformance harness;
- attach it to the HL7 working-group ED scenario, whose 37 steps currently
  reference walkthrough narration rather than loadable data.

It also closes deficit 1 above — dangling `subject` references become real — which
is a defect worth fixing on its own terms.

### Not to be confused with #128

Issue #128 ("Export a configured pathway as a FHIR Bundle") is about the
**definitional** artifacts: a preset `PlanDefinition` selecting a subset of the
canonical stage actions, plus the referenced ActivityDefinitions, Questionnaires
and ConceptMaps. This proposal is about **patient clinical data**. Different
Bundle, different `type`, different audience — a configured *pathway* versus a
populated *chart*. They compose (a partner would want both) but neither is a step
toward the other. Do not let them merge in triage.

### Two pieces of the machinery already exist

- **`collectScenarioResources` in
  [`scripts/validate-fhir.mjs`](../../scripts/validate-fhir.mjs)** already unwraps
  the scenario buckets into a temp directory, dropping `_savedAt`. Bundle assembly
  is that walk plus an envelope and reference rewriting.
- **[`runtimeFhir.emit.test.ts`](../../web/src/lib/runtimeFhir.emit.test.ts)** is
  the precedent for the gate: a test that asserts the builders' output *and* writes
  it to a gitignored directory for the Java validator to check, because there is no
  TS runtime in the package other than vitest. A Bundle export gate should reuse
  that pattern rather than inventing a second one.

## 5. Decision 3: point it at a real server — PROPOSED as the target

Medplum has SMART launch built in; HAPI in Docker needs auth work in front of it.
Either way what we get is the thing that matters: **real search semantics, real
`_include`, real pagination, and real conformance rejection.**

The last of those is the point. `docs/smart-sandbox-testing.md` already makes
"errors surface, no silent fallback" an explicit thing to verify — a rejected
write must produce the red *EHR data error* banner and write nothing to
localStorage. That behaviour is only meaningful against a server that actually
rejects.

## 6. Decision 4: writing our own mock server — NOT RECOMMENDED

Technically it is the shortest path to a live URL. The Worker exists, `run_worker_first`
already routes every request, and `/fhir/r4/*` plus a stub
`.well-known/smart-configuration` / `authorize` / `token` is a weekend.

**The argument against is not effort — it is that a mock we write will be lenient,
and leniency here attacks SPiER's strongest claim.**

A hand-rolled mock accepts writes a real EHR rejects: wrong `patientRefField` for
the type, a missing required slice, a `Coding.display` that does not match the
CodeSystem. The demo would look *better* while proving *less*, and the failure
would be invisible from inside the demo. That is the same shape as every silent
pass this repo has catalogued — #201's publisher walking past `input/cql` in
silence, the HL7 validator reporting a warning and zero errors when it cannot
resolve a Questionnaire, #280's `var(--made-up)` linting clean. A green demo you
have never seen reject anything is not evidence of anything.

Note the specific irony: `smartDataSource.ts`'s own comment on `patientRefField`
says writing `subject` onto `EpisodeOfCare` "would produce invalid FHIR that a
strict server rejects (**and a lenient one silently drops, losing the patient link
entirely**)." The code already knows why a lenient server is the wrong test
harness.

**If it is built anyway**, the mitigation is to make it strict on purpose — run the
same profile checks `check-scenario-resources.mjs` does before accepting a write,
and treat "accepted something the HL7 validator rejects" as a bug. That is most of
the cost of a real server with none of the credibility, which is the argument for
§5.

## 7. Phases

**Phase 1 — real subject resources.** `Patient` × 14, plus the `Practitioner` and
`Organization` resources the scenarios' performers reference. Where they live is a
real decision: `ig/` as example Instances (gated by sushi + the validator + the
publisher, consistent with the other 134 Instances) versus alongside the scenarios
(closer to their consumers). **Recommend `ig/`**, with `patients.json` keeping only
the app-display fields and gaining a reference — the same split
`tool-ui-metadata.ts` has from the ActivityDefinitions, for the same reason.
Extend `check:scenarios:resources` so a `subject` reference with no resolvable
subject fails.

**Phase 2 — Bundle export + gate.** One transaction Bundle per patient, references
rewritten to `urn:uuid:` or left relative per FHIR transaction rules. Emit to a
gitignored directory, validate with `validate-fhir.mjs`, wire into `ig.yml`'s
`validate` job beside the runtime-FHIR emit. **Prove it can fail** — plant a
dangling reference and a wrong `Coding.display` and watch both go red.

**Phase 3 — load into a real server.** Re-run the `docs/smart-sandbox-testing.md`
walkthrough against it, including the write and round-trip steps, and update that
doc's *Known limitations* section with what changed.

**Phase 4 and 5 — see §8.** These are what make the mock patients actually
*visible*, and they are not optional if the goal is a demo rather than a
conformance artifact.

## 8. The scope people forget

**A server full of our patients is only compelling if the Population and Dashboard
lenses can read it — and today they structurally cannot.**
`PopulationView.tsx:73` and `MeasureDashboard.tsx` reach past the
`FhirDataSource` abstraction to `localDataSource` directly. So:

- **Phase 4** — un-hardcode those two pages and give `SmartDataSource` a
  population read. That means a cross-patient query surface the interface does not
  currently have (`getSlice` is per-patient), and a decision about how a registry
  scopes itself on a real server, where "the caseload" is not a static list of 14.
  This is genuine design work, not a refactor.
- **Phase 5** — #230, so a foreign C-SSRS or ASQ payload derives rather than
  landing in "Other activity."

Stated plainly: **the honest scope of "mock patients on a SMART server" is five
phases, not one.** Phases 1–2 are a self-contained artifact with standalone value.
Phase 3 is cheap once 1–2 exist. Phases 4–5 are where the effort actually is, and
they should be entered deliberately rather than discovered halfway through a demo
prep.

## 9. Recommendation

Do **phases 1 and 2** on their own merits — real subject resources and a validated
Bundle per patient. That fixes a live conformance hole, makes the population
portable to anyone else's sandbox, and commits us to nothing.

Then decide phase 3 against a real server, not one of ours.

Treat phases 4–5 as a separate decision with its own justification, because they
are most of the work and none of the artifact.

## Related

- [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) — a mock
  server would be `packages/core`'s third consumer, which is part of the case for
  declaring that boundary. The patient-app question lives there too.
- [`docs/smart-sandbox-testing.md`](../smart-sandbox-testing.md) — the current
  walkthrough and its three stated limitations, all three of which this plan
  touches.
- #128 — the *definitional* pathway Bundle. Adjacent, deliberately not merged (§4).
- #60 — HIE pilot, ASQ cross-EHR portability. The likeliest first consumer of a
  patient Bundle.
- #230 — extend mapper dispatch past PHQ-9. Phase 5.
- `docs/use-cases/ed-scenario-11.json` — 37 HL7 working-group steps tied to
  `patient-011`…`patient-014`, currently linked to walkthrough narration rather
  than loadable data.
