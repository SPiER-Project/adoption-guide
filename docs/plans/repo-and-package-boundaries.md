# Repo and package boundaries: one repo, declared packages

Written 2026-08-13, from a question that started as "should the guide, the
registry, the charts, the IG and a possible patient app be separate repos?" —
and turned out to be a different question, because a second app is **already**
consuming a shared core that nothing declares.

This document settles the repo-vs-packages question, records the measurements it
rests on, and scopes the migration. It does **not** propose splitting the demo
app in two; §5 argues against that specifically.

## Status

| Decision | State |
|---|---|
| **1 — separate repos per surface** | **REJECTED.** The cross-tree drift gates are the repo's strongest discipline and cannot survive version skew. §3 |
| **2 — monorepo with declared workspace packages** | **PROPOSED, and the condition in §8 is now MET.** §9 |
| **3 — split the adoption guide from the clinical demo into two apps** | **REJECTED, and independently re-derived since.** #316 unified them; the panel plan's chrome-mode decision reached the same answer from the other direction, and it is now proven in a browser. §5, §9.4 |
| **4 — a patient-facing app as its own `apps/` entry** | ~~the trigger for #2~~ — **superseded as the trigger.** Still unbuilt and still legitimate, but a different consumer arrived first. §9.2 |
| **5 — the demo fixtures get their own package** | **NEW, PROPOSED 2026-08-20.** They have no home in §4's table, which is exactly why "where should the patient data live" was hard to answer. §9.3 |

| Phase | State |
|---|---|
| 0 — declare `packages/core`, convert the Workers' deep imports | **Not started. Now 21 imports across TWO Workers, not nine across one.** §9.1 |
| 1 — move the SUSHI build out of the web app's devDependencies | **Not started.** §6 |
| 2 — `packages/ui`, gates move with it | **Not started.** §6 |
| 3 — `apps/patient` | **Not started.** Blocked on a decision to build it at all. |

⚠️ Phases 1–3 are **triggered, not scheduled.** If the patient app never happens,
phase 0 is still worth having and the rest buys little. Do not do this
speculatively — §7 is the honest cost.

⚠️ **The trigger fired on 2026-08-20, and it was not the one this document
expected.** §5 named the patient app; what arrived instead was a mock EHR — a
consumer §5 mentions only in passing — plus a decision to move the population view
into it. §9 records the new measurements and what they change. **Read it before
acting on §6, whose phase 0 is now larger than it says.**

---

## 1. What the surfaces actually are

Five things get called "the app" in conversation. They are not five peers:

| Surface | Where | What it is |
|---|---|---|
| Instructions / tool overview | 8 pages in `web/src/pages/` | Content + catalog rendering. No clinical runtime. |
| Patient registry (Population, Dashboard) | 3 pages | Clinical runtime over the scenario store |
| Individual patient charts | `PatientChart.tsx` + `PatientContext` | Clinical runtime, the only SMART-connected surface |
| The Java-built IG | `ig/` | **Not an app.** The canonical, machine-readable source everything else derives from |
| CDS Hooks service | `services/cds-hooks/` | **Already a second app**, in production, on Workers |
| A patient-facing app | — | Doesn't exist. §5 |

The IG is not a sibling of the others; it is upstream of all of them. Any framing
that treats it as a fifth app gets the dependency direction wrong.

## 2. Three measurements, taken on `c9e7c9f`

Everything below rests on these. They were measured, not recalled.

### 2.1 A second app already deep-imports the first one's source

`services/cds-hooks/src/service.ts` reaches across the package boundary **seven**
times with `../../../`:

```
'../../../web/src/lib/cdsHooks'                    (buildCdsCards)
'../../../web/src/lib/cdsHooks/types'              (Card, CdsServiceResponse)
'../../../web/src/lib/patientPathway'
'../../../web/src/lib/observationMappers'          (mapResponseToObservations, RiskAlert)
'../../../web/src/data/population/scenarios'       (POPULATION_SCENARIOS)
'../../../web/src/data/population/patients.json'
'../../../web/src/types/fhir'
```

Plus two more in `app.test.ts` and `auth.test.ts` — **nine in all** — and its
`package.json` orchestrates the *other* package's build:

```
"build":   "npm run build:web && npm run stage:assets && npm run build:worker"
"build:web":   "npm --prefix ../../web run build"
"pretest":     "npm --prefix ../../web run copy-fhir"
```

So a shared core exists and is load-bearing in production. It is simply
undeclared. Nothing prevents the Worker from importing a React component or a
browser-only module tomorrow; its typecheck is a separate `tsc --noEmit` that
would not object until the bundle broke at runtime.

**This is the finding that reframes the question.** It is not "should we split" —
it is "an existing seam is unenforced."

### 2.2 `lib/` is already framework-free

96 files, ~22k LOC (16.4k in the four subdirectories, 5.7k in 23 loose modules),
and **zero `from 'react'` imports**. The extractable core is already clean; that
is unusual and worth not squandering.

### 2.3 The pages fall into two clusters that barely cross

Measured by walking each page's `../<dir>/` imports:

| Cluster | Pages | Imports |
|---|---|---|
| **Guide / reference** | Overview, AdoptionGuide, PatientJourney, DataDictionary, Roadmap, AdoptionReadiness, EhrAdoptionRubric, CdsServiceGuide | `data/catalog`, content modules, `PageHeader`, `FhirJsonViewer` |
| **Clinical** | PatientChart, PopulationView, MeasureDashboard, ToolConfiguration | `lib/dataSource`, `lib/registry`, `lib/measures`, `lib/observationMappers`, `PatientContext`, `types/fhir` |

One crossing: `CdsServiceGuide` imports `lib/cdsHooks`, which `PatientChart` also
uses. Shared spine: `data/catalog` (imported by 26 files), `types/fhir`,
`PageHeader`, `FhirJsonViewer`, and the design tokens.

Total `web/src`: **30,859 LOC** of `.ts`/`.tsx`. This is not a codebase that is
hard to build in, which matters for §5.

### 2.4 The dependency graph today

```
ig/input/fsh  ──fsh-sushi──▶  ig/fsh-generated  ──copy-fhir.mjs──▶  web/src/data/fhir/
                                                                          │
                                     web/src/{lib,data,types}  ◀──────────┘
                                          │            │
                                          │            └──▶ web/dist ──stage:assets──▶ services/cds-hooks/web-dist
                                          └────────── ../../../ ──────▶ services/cds-hooks/src
```

Two inversions are visible in it:

- **`fsh-sushi` is a devDependency of the React app.** The FHIR compiler is
  installed as a dependency of a browser UI.
- **`copy-fhir.mjs` writes generated FHIR *into* `web/src/data/fhir/`.** The IG's
  output terminates inside one app's source tree, so a second consumer has no
  honest path to it — it must either import through `web/src` or keep its own
  copy.

Both are consequences of there having been exactly one app when the pipeline was
written. Neither is a defect today; both become one at the second consumer.

## 3. Decision 1: separate repos — REJECTED

The single best property of this repository is that **the canonical FHIR
artifacts and the code that consumes them are gated in the same commit.**

`web`'s `npm run verify` is 16 steps, and six of them are *cross-tree consistency
checks* that read `ig/fsh-generated/` and `web/src/` together:

| Gate | Reads from `ig/` | Reads from `web/src/` |
|---|---|---|
| `check:catalog` | ActivityDefinitions, ValueSets, licensing extension | `data/catalog/tools.ts`, `tool-ui-metadata.ts` |
| `check:stages` | `pathway-stages.fsh` canonical stage list | `data/population/patients.json` |
| `check:scenarios:resources` | generated StructureDefinitions (`min`, fixed values, bindings) | `data/population/scenarios/*.json` |
| `check:crosswalk` | ConceptMaps | crosswalk tables |
| `check:extract` | Observation profiles | `lib/observationMappers/` |
| `check:measures` | Stage-8 `Measure` criteria | `lib/measures.ts` |

Split the repo and every one of those becomes a version-skew problem: publish the
IG as a package, pin a version, and drift is caught *after a release* instead of
*before a merge*.

The counter-evidence is already on the record. CLAUDE.md documents #271 — making
`category:suicideRisk` required on 28 profiles updated the fixtures but not the
runtime, and "the app emitted non-conformant resources for weeks." That happened
**inside one repository, in one commit's blast radius.** Across a package
boundary with a pinned version, the same class of mistake gets a release cycle to
hide in, not less.

Three supporting reasons:

1. **14 hand-authored scenario patients are validated against generated
   StructureDefinitions.** Cross-repo, that validation runs against whatever
   version is pinned, which is by definition not the one being edited.
2. **`deploy.yml` structurally couples the IG and the SPA.** Pages replaces the
   whole site with one artifact, so the SPA cannot ship without a rendered IG
   under `dist/ig`. The two cannot be decoupled by moving files.
3. **Team size and workflow.** Multi-repo coordination cost is paid per change;
   monorepo setup cost is paid once. With heavy AI-agent involvement, one tree
   that an agent can read end-to-end is worth a great deal — every gate in
   CLAUDE.md's five-gate table exists because someone could see both sides at
   once.

**The IG stays in this repo.** The only thing worth changing about it is that its
output should stop being written into an app's source tree (§6, phase 1).

## 4. Decision 2: monorepo with declared packages — PROPOSED

Draw the boundaries where §2 shows the code already sits. Sketch, not a final
manifest:

| Package | Contents | Why here |
|---|---|---|
| `packages/fhir-artifacts` | the SUSHI build; `copy-fhir` becomes its output step | Kills both inversions in §2.4. `fsh-sushi` leaves the React app's devDependencies; generated resources become a package other things import rather than a directory written into `web/src`. |
| `packages/core` | `types/fhir`, `data/catalog`, `observationMappers`, `carePlanMappers`, `dataSource`, `registry`, `measures`, `patientPathway`, `cdsHooks`, `encounters`, `conceptDomain`, `deriveFromResponse` | Exactly what the Worker imports today (§2.1). Already React-free (§2.2), so the constraint is *enforceable* — a lint rule can forbid React and DOM globals here. The drift gates that read `lib/` move with it. |
| `packages/ui` | `PageHeader`, `FhirJsonViewer`, the token definitions, the page template | `check:tokens` and `check:template` are gates *about* this package and should live in it. |
| `packages/core` (root, not `src/`) | **`fhir-resource-rules.mjs`** + its hand-written `.d.mts` | §9.2's open question, answered by #396. The single opinion on whether a FHIR resource is valid, imported by a Node CLI gate (`check-scenario-resources.mjs`) **and** by the mock EHR's write endpoint at runtime. It sits at the package root rather than under `src/` because it is plain ESM outside the TypeScript tree and must stay importable from a bare `node scripts/…` with nothing compiled. |
| `packages/demo-population` | the 14 patients, their scenario slices, and their `Patient` resources | §9.3. Shipped as #394; the `Patient`s joined it in #399 (E2a). |
| `packages/fhir-artifacts` | the SUSHI **output** (`generated/`, gitignored) | §6 phase 1. The output location shipped as #395 (E1); ⚠️ **the build itself has not moved** — E2b, blocked on #387. |
| `apps/adoption-guide` | all 12 pages, the EHR shell, routing | §5 — one app, not two |
| `apps/cds-hooks` | the Worker | The `../../../` imports become `@spier/core` |
| `apps/patient` | — | §5, phase 3 |

The point of the exercise is not tidiness. It is that **`packages/core` gets a
declared, lintable boundary**, so the Worker's dependency on it is a contract
instead of a path convention, and so a third consumer (a patient app, a mock FHIR
server) has somewhere honest to import from.

## 5. Decision 3 & 4: which surfaces are separate *apps*

### Do not split the guide from the clinical demo

The product's rhetorical move is "here is the tool, and here it is working on a
real patient." That depends on the two lenses being one artifact:

- **#316 deliberately unified all four lenses into one page template**, with
  `check:template` gating it in both directions. Splitting deployments undoes
  that on purpose.
- The cross-lens links are load-bearing — the chart subtitle links to
  `/guide/cds-service`, the deep-link scroll hook works across lenses, patient
  context is carried between them.
- Two deployments means two URLs, a nav seam, and a duplicated shell.
- At 31k LOC (§2.3), "easier to build in" is not the constraint. The friction in
  this repo is gate surface and FHIR conformance, neither of which a second
  Vite app reduces.

### The patient app is the genuine exception

A patient-facing SMART app differs where it counts:

- **Different launch type** — patient standalone launch, not EHR launch. Different
  scopes, different token, and `SmartProvider`'s current flow assumes the
  provider path.
- **Different audience and content** — a patient has no use for an EHR shell, a
  caseload table, or an adoption rubric.
- **Different consent surface**, which is a real design problem and not one to
  solve by inheriting a clinician app's assumptions.

That earns its own `apps/` entry sharing `packages/core` — and it is the reason to
do the extraction, because the alternative is a third set of `../../../web/src`
imports.

### Sequencing consequence

**The patient app is the trigger; the extraction precedes it.** A mock FHIR server
(see [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md)) would be a
third consumer of `core` plus the scenarios, pointing the same direction.

### Do not split the IG, the app and the mock EHR into separate repositories

Asked again on 2026-08-23, in the sharpest form yet — three repos (the IG plus the
data dictionary; the adoption guide / SMART app; the mock EHR and its FHIR data),
*"and the SMART app should pull from the IG for its tools so that we always have a
source of truth."*

**That last clause is the answer to itself.** The source-of-truth property already
exists, in a stronger form than a split can provide, and the split is what would
put it at risk:

- `copy-fhir.mjs` compiles `ig/input/fsh/` with SUSHI into
  `packages/fhir-artifacts/generated/`, and `prebuild` runs it with `--force`. The
  app **cannot** be built against a stale IG, because the IG is compiled from the
  same commit.
- `check:catalog` then enforces the correspondence in *both* directions: a tool
  reaching the app with no ActivityDefinition fails, and a Questionnaire in
  `FHIR-Resources/` that no ActivityDefinition administers fails.

Across a repository boundary, "pull from the IG" becomes a dependency on
`thespierproject.fhir@x.y.z` — a version number. Drift stops being *impossible*
and becomes the ordinary state: the app sits on last month's IG until somebody
bumps it, and the two-directional check above cannot run at all.

#### The decisive cost is the gate net, and it is countable

⚠️ **Fifteen gates read both sides of the proposed boundary.** Counted rather than
estimated — twelve of the gate scripts under `web/scripts/`:

```
check-careplan-readers      check-catalog-integrity     check-fallback-signatures
check-mapper-readers        check-measures              check-observation-extract
check-population-patients   check-reassessment          check-scenario-resources
check-scenario-responses    check-stage-ids             check-ucum-stub
```

plus three at the repo root — `validate-fhir.mjs` (which needs `ig/`,
`FHIR-Resources/` **and** `packages/demo-population/`, i.e. all three proposed
repos at once), `check-fml.mjs`, and `build-use-case-workbook.mjs` (whose
tool-status claims are read off `tool-ui-metadata.ts` and `App.tsx`).

`check-codings.mjs` is **not** in that list and looks like it should be: it
deliberately excludes `ig/` and `FHIR-Resources/`, because those are resources and
`validate-fhir.mjs --tx` owns them. Worth stating, because it is the one that
makes the count a count rather than a grep.

Every one of those gates exists because a value is hand-duplicated across the
trees and either drifted or could. **Splitting the repos does not remove the
duplication — it removes each gate's ability to see both sides in one commit.**
Each then becomes either a late check against a published version, or nothing.

Concretely, the one that matters most: `check:readers` is what closed #327, where
the whole C-SSRS family read `answer.valueBoolean` while **no Questionnaire in
this repo declares a boolean item** — so a patient endorsing *specific plan and
intent* through SPiER's own form derived `tier: none`, "No risk identified". That
gate parses mapper source and Questionnaire JSON *together*. Across a repo
boundary it cannot exist.

The mock EHR is the same shape from the other side. It shares
`web/scripts/lib/fhir-resource-rules.mjs` with `check-scenario-resources.mjs`, and
[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §1 *requires*
that it do so "rather than inventing a second, laxer opinion" — a lenient mock
accepts writes a real EHR rejects, so the demo looks better while proving less.
Its own repository makes that module a published package or a copy, and a copy is
precisely the forbidden thing.

#### What is real in the instinct, and where each part belongs

The question keeps returning because three genuine problems sit behind it, and
none of them is solved by moving files between repositories:

1. **The repository is named `adoption-guide` and contains an IG, two Workers and
   three packages.** The name stopped describing the contents, which is most of
   what prompts the question. Renaming it is the **correct** fix and does not
   touch a single gate.
   ⚠️ **This line said "cheap" when it was written, hours earlier the same day,
   and that was wrong — checked against the gates and generalised from there.**
   Scoped properly, `adoption-guide` appears 325 times and splits three ways:
   246 `SPiER-Project/adoption-guide` repo links (GitHub redirects these, so they
   are stale rather than broken), 25 `spier-adoption-guide` Worker references
   that **must not** change (that string is the live public origin), and a small
   set of `spier-project.github.io/adoption-guide/` URLs that genuinely break —
   GitHub redirects a renamed repo's web URL but **not** its Pages path. Two of
   those matter:
   - `VITE_BASE: /adoption-guide/` in `deploy.yml`. Miss it and the Pages build
     *succeeds* while every asset 404s.
   - `APP_BASE_URL` in `packages/core/src/lib/cdsHooks/cards.ts` — the target of
     every card link the live `/cds-services` endpoint emits, i.e. a URL handed
     to **external** clients.

   ⚠️ **That second one is a standing fragility, not a rename cost.** The
   published IG's five companion-app links and the live CDS cards both send
   people to a `spier-project.github.io/adoption-guide/` path. Pointing *those*
   at the Worker origin is worth doing on its own merit and would shrink a rename
   further.

   ⚠️⚠️ **But this paragraph said "Cloudflare is the primary public host and Pages
   is the 'also deployed' legacy one", and that is only true of the SPA.**
   [`surfaces-and-distribution.md` §4](surfaces-and-distribution.md) — §4, not the
   §7 this cited — has the hosting table, and its IG row reads *"Rendered IG |
   **GitHub Pages** | the Worker only redirects"*. Verified live 2026-08-23:
   `spier-adoption-guide.bbthorson.workers.dev/ig/` returns **302** to
   `spier-project.github.io/adoption-guide/ig/`, which returns 200. So **Pages is
   the sole host of the rendered IG and the Worker depends on it** — load-bearing,
   not legacy. The summary picked the SPA row's conclusion and applied it to the
   whole host.

   Two things follow, and both cut against the rename rather than for it:

   - **Renaming does not merely stale a link; it takes the IG down.** The Pages
     path is the only copy of the render, and
     `CANONICAL_IG_BASE` in `services/cds-hooks/src/index.ts` hardcodes it — so
     the rename orphans a redirect target inside the Worker as well.
   - **"Point the Pages URLs at the Worker" cannot apply to `/ig/` itself.** The
     Worker has no IG to serve: `deploy.yml` runs the Java IG Publisher and nests
     the render into the Pages artifact, while the Cloudflare build only runs
     `npm run build` in `services/cds-hooks`. Making Cloudflare genuinely primary
     for the IG is real work, and §4 **recommends against it** — free hosting,
     254 MB per deploy, and a Pages artifact that couples the SPA and IG so they
     cannot be decoupled. It also names the one thing nobody has measured: Static
     Assets caps **file count**, not bytes, and `find ig/output -type f | wc -l`
     has never been run.

   The rename itself was asked 2026-08-23 and **deferred** — the name costs
   comprehension, not correctness, so there is no hurry.
2. **Implementers should be able to consume the IG as a standalone artifact.**
   That is a *publishing* concern, not a layout one — a monorepo publishes an IG
   perfectly well, and most published IGs live in a larger tree. It is #412's
   expensive half (`thespierproject.fhir` on `packages.fhir.org`).
   ⚠️ **Explicitly not scheduled** — confirmed 2026-08-23, "we're not ready to
   publish the IG yet." Recorded here as the right mechanism *when* that need is
   real, not as a next step.
3. **A client deployment must not receive the demo.** That is
   `VITE_SURFACE=clinical | demo` in
   [`surfaces-and-distribution.md`](surfaces-and-distribution.md) §3, whose whole
   argument is that §5's "one app" conclusion was right and its unstated premise
   "therefore one build" was not.

And the split that *is* planned already delivers the clear boundaries: the `apps/`
extraction in this section and §6 — `apps/web`, `apps/patient`, sharing
`packages/core`. **Separate applications, one repository.** The gates survive
because every tree stays in one commit.

## 6. Phases

> ⚠️ **Historical.** This was the original phasing, and §9.5 supersedes it — the
> real sequencing turned out to be 0 → A/B → C → D → E1 → E2, with **E1 having to
> precede B** for a dependency reason this section did not anticipate. Everything
> here except phase 1's second half (the SUSHI build, E2b) has shipped. Kept
> because the reasoning is still the reasoning; read §9.5 and §9.6 for what
> happened.


**Phase 0 — declare `packages/core`; convert the Worker's deep imports.**
The smallest useful step, and the only one worth doing regardless of what else
happens. Turn the nine `../../../web/src/...` specifiers in
`services/cds-hooks/src/` into `@spier/core` imports behind a workspace
reference, and add the lint constraint that `core` may not import React or touch
`window`. Nothing moves on disk except a `package.json` and a `tsconfig`
reference — which is the point: it is reversible, and it converts an undeclared
dependency into an enforced one.

**Phase 1 — move the SUSHI build out of the web app.**
`fsh-generated` becomes a package output rather than a write into
`web/src/data/fhir/`. This is where the path churn starts (§7) and should not be
started without budget for the re-prove pass.

**Phase 2 — `packages/ui`; `check:tokens` and `check:template` move with it.**

**Phase 3 — `apps/patient`.** Blocked on the decision to build it.

## 7. The honest cost

**13 of `web/scripts/`'s 15 `.mjs` files hardcode paths** into `web/src/...`
and/or `../../ig/fsh-generated`, as do 3 of the 5 in the repo-root `scripts/`.
Moving files breaks all of them at once, and **the failure mode is not red — it is
green because the script is now looking at nothing.**

That is not a hypothetical. It is the single most frequent failure mode in this
repo's history, and CLAUDE.md catalogs five instances:

| # | The silent pass |
|---|---|
| #232 | `check:codings` floor sat at 5 while the real count doubled to 20 |
| #261 | a whole-path floor stayed green while ~28 codings left the scan |
| #280 | `color: var(--made-up)` linted clean and shipped as a dropped value |
| #300 | a merged gate was reverted by a rewrite from a stale base |
| #201 | the publisher walked past `input/cql` **in silence**, reading exactly like a pass |
| — | the HL7 validator reports a *warning* and zero errors when it cannot resolve a Questionnaire |

So the migration rule follows from the repo's own standing rule — *prove a gate
can fail before trusting it*:

- **One deliberate pass per phase, not incremental drift.** A half-migrated tree
  is where a gate quietly starts reading an empty directory.
- **After each phase, plant the defect each moved gate targets and watch it go
  red.** All 16 verify steps, plus the Worker's own verify, plus `validate-fhir`
  and `check-sushi-output` at the root. A gate that has been moved and not seen
  red is not evidence of anything.
- **`copy-fhir`'s skip logic is a specific trap.** It compares oldest-output to
  newest-input mtimes; a path change that makes `destDir` empty is already
  handled (`destFiles.length === 0` → build), but a path change that points it at
  a *stale populated* directory is not.

Also in the blast radius, all of which encode current paths: the Vite base path
(`/adoption-guide/` on Pages, `/` on Workers), `HashRouter`'s launch bootstrap in
`main.tsx`, the Worker's `web-dist` staging, and `deploy.yml`'s IG-render cache
key (`ig-render-<hash of ig/input + sushi-config + ig.ini>`).

## 8. The case for doing nothing

Stated fairly, because it is legitimate:

- The `../../../` imports **work**. Vite bundles them; the Worker deploys.
- Adding mock-FHIR-server routes to the existing Worker costs nearly zero today.
- If `apps/patient` never happens, phases 1–3 buy tidiness against a real risk of
  a silently-blinded gate.

The asymmetry that decides it: **phase 0 is cheap and reversible; phases 1–3 are
neither.** Do phase 0 on its merits. Do the rest when a third consumer makes the
undeclared boundary a liability rather than a smell.

## 9. Re-measured 2026-08-20 — the third consumer arrived

This document was written on 2026-08-13, when there was one Worker. There are now
three packages with three `verify` pipelines, and §8's decision rule — *"do the
rest when a third consumer makes the undeclared boundary a liability rather than a
smell"* — has had its condition satisfied by events rather than by argument.

Prompted by a direct question: *"we have an interesting repo set up, the ehr and
the web app are in different folders. is that normal? … i see there being maybe 4
apps."* §9.4 answers the four-app framing. The measurements come first, because
they are what changed.

### 9.1 The deep imports more than doubled: 9 → 21 — and are now 0

✅ **Resolved by step B (#396): the count is zero.** The measurement below is kept
because it is *why* the reshape happened, not because it describes today. The
module names in it have all moved to `packages/core` and are imported as
`@spier/core/<path>`; `data/population/patients.json` is
`@spier/demo-population/patients.json`.


| Package | `../../../web/src` imports |
|---|---|
| `services/cds-hooks` | **9** (the nine §2.1 measured) |
| `services/mock-ehr` | **12** |

What the second Worker reaches for, beyond the scenarios and `types/fhir`:
`lib/dataSource/smartDataSource`, `lib/dataSource/types`,
`lib/dataSource/lifecycleTypes`, `lib/writeback/capability`,
`lib/deriveFromResponse`, `lib/observationMappers`, `lib/fhircast`,
`data/population/patients.json`.

⚠️ **`lib/dataSource/smartDataSource` is the one that should raise an eyebrow.** A
mock *server* imports the app's FHIR **client** — legitimately, in the integration
test that drives the real client against the real server, which is the best test
in the repo. But it means the seam §2.1 called "undeclared" is now load-bearing in
both directions, and nothing states which direction is allowed.

### 9.2 A crossing this document has no row for

`services/mock-ehr/src/validate.ts` imports
**`packages/core/fhir-resource-rules.mjs`** (it was `web/scripts/lib/` until step B
moved it) — a Worker taking a runtime dependency on what began as a *gate's*
internals.

That was deliberate and is still right: the embedded-panel plan's §1 guardrail 1
requires the mock to validate writes *"reusing the profile checks in
`check-scenario-resources.mjs` rather than inventing a second, laxer opinion"*, and
sharing the module is the only way to have one opinion instead of two. The rules
were moved out of the gate unchanged and both callers now use them.

✅ **§4's package table now has a row for it (resolved by #396).** The open
question was where shared *validation rules* live, given that "the scripts folder
of an app" is not an answer once a deployable imports them at runtime. They live at
`packages/core`'s root — not under `src/`, because the module is plain ESM outside
the TypeScript tree and has to stay importable from a bare `node scripts/…` with
nothing compiled.

The observation that prompted it stands: §7 counts `web/scripts/` as *things that
break when files move* — 13 of 15 files hardcoding paths — and it was **also** a
thing imported by a deployable. Both callers still use the one module, which is the
guardrail §1 of the panel plan requires.

### 9.3 The fixtures have no home, and that is a real gap

✅ **Resolved by step A (#394): they live in `packages/demo-population`**, and the
14 `Patient` resources joined them in E2a (#399). §4 now has a row for it. What
follows is the reasoning, kept because the re-count is the useful part.

§4's `packages/core` row lists `data/catalog`. It does **not** list
`data/population` — so the 14 demo patients and their scenario slices are
unaddressed by this document, and they are consumed by all three packages plus
repo-root tooling.

That omission had a cost this week: asked *"we don't really need to keep any of the
patient data files in the adoption guide, those all really fit in the mock ehr
application, right?"*, the first answer given was a defence of the status quo built
on a consumer count that **padded tests and gates as if they were arguments** —
they move with the data, so they were never arguments. The honest re-count:

| Consumer | Survives moving the patient views out of the guide? |
|---|---|
| `PatientProvider`, `localDataSource`, `useActivePatientId`, `usePatientOpenBroadcast` | **No — they go with the chart** |
| `PopulationView.tsx` | **No — it goes with the chart-side data** (see the correction below; it is *not* being deprecated) |
| `MeasureDashboard.tsx` | The only guide-side maybe |
| `services/cds-hooks`, `services/mock-ehr` | Yes, and both already import it |
| `scripts/validate-fhir.mjs`, `scripts/build-use-case-workbook.mjs` | Yes — **repo-root tooling, not "the guide"**; both take paths |

And the fact that decides it: **`measures.ts` imports no data at all.** It is pure
and takes a slice as an argument, so the measure *engine* is portable and
`MeasureDashboard.tsx` is only wiring — wired to `localDataSource` directly, the
same way `PopulationView.tsx` is (already flagged in this document's Related
section). One refactor, not three problems.

⚠️ **Correction, 2026-08-21: that table said `PopulationView.tsx` was "being
deprecated", and it is not.** Nothing else in this doc set says so, and
[`suicide-care-dashboard.md`](suicide-care-dashboard.md) treats it as the primary
surface to **redesign** — it is the first file that plan names — and explicitly
recommends the page *stay a single page* as it absorbs five more panels. It is
slated for redesign under #277, not removal.

The claim mattered rather than being cosmetic: it sat in a table used to justify
moving the fixtures, and "being deprecated" is a reason not to invest in
something. Step D (#398) left the page alone on the strength of the dashboard
plan; a reader of the table alone would have had no way to know that. Filed and
fixed as #402.

**So: nothing in the adoption guide has a durable claim on the fixtures.**
`packages/demo-population` is the honest home — not `services/mock-ehr`, because
while the guide still has a chart it would make the product import from the demo
host, which is worse than today's direction.

✅ **DONE 2026-08-21 (#392): the 14 `Patient` resources left the IG**, and the
measurement that settled it is worth keeping — **not one example instance in the
IG referenced them.** The only mentions in FSH outside their own file were
comments. So the IG was publishing 14 examples that illustrated none of its own
profiles. They are now hand-authored FHIR in
`packages/demo-population/src/patients/`, still validated by `validate-fhir.mjs`
(which had to be told about them explicitly — moving them dropped the target count
from 428 to 414 before that was noticed).

The original argument, kept because it is the reasoning:

⚠️ **And the 14 `Patient` resources should probably leave the IG.** They live in
`ig/input/fsh/population-patients.fsh` because #356 minted them there to stop 116
scenario `subject` references dangling — a **validation** need, not a
specification need. An IG's examples should illustrate its profiles, not populate a
demo host's roster. The current shape means **the mock EHR's patient roster depends
on a SUSHI compile**, which is a strange dependency for a fake EHR and is a direct
consequence of the §2.4 inversion this document already identified.

### 9.4 The four-app framing, answered

The proposal was: IG documentation, adoption guide, mock EHR, and a CDS/SMART app
"where we house the actual interaction, like the thing we license to other
groups."

**The underlying instinct is right and is this document's own thesis** — the
licensable engine and the material that explains it are different products, and
the engine currently lives inside one of its consumers. Three corrections:

1. **The IG is not an app.** §1 already says this and the reason has not changed:
   no runtime, no users, and it is *upstream* of everything else. Any framing that
   makes it a peer gets the dependency direction wrong. The associated instinct —
   *"our embedded app should be pulling directly from these resources"* — is
   phase 1, and it is **already half-true**: profiles, ValueSets, CodeSystems and
   ActivityDefinitions arrive via `copy-fhir`, but the **18 Questionnaires are
   hand-authored in `FHIR-Resources/`, outside the IG**, and imported straight by
   `App.tsx`.

   ⚠️ **Measured, because the sharp version is sharper than the summary: the IG
   contains ZERO `Questionnaire` resources and 11 example
   `QuestionnaireResponse`s — responses to forms it does not define.** Their
   `questionnaire` canonicals (`http://thespierproject.org/fhir/Questionnaire/ASQ-Screening-Tool`
   and friends) resolve only inside `FHIR-Resources/`. So the IG publishes answers
   to a questionnaire set that lives outside it, and the app treats that outside
   set as the spec. That is the substantive version of "pull directly from the IG",
   and it is a conformance story rather than a folder-layout one.
2. **The licensed app and the guide should not be separate deployables.** §5
   rejected it; the panel plan re-derived the same answer independently and now has
   browser evidence. One route table, two chrome modes — and the tool routes are
   needed by *both* (the panel launches them, the guide documents them), so two
   packages would duplicate or re-import them immediately. The audience boundary is
   real; a package boundary is the wrong instrument for it.
3. **`scripts/` is not homeless.** It is cross-package by nature —
   `validate-fhir.mjs` reads `ig/`, `FHIR-Resources/` **and** the population
   scenarios in one run. Root-level tooling in a monorepo is correct. Same caution
   on folding `docs/` into the guide: `docs/use-cases/` and `docs/outreach/` are
   **build inputs with their own CI gates**, not prose.

⚠️ **The cost the four-app framing does not count is pipelines.** There are
already three `verify`s and CLAUDE.md warns that `web`'s covers one of them; #368
found **eight gates that only ever ran on developer machines** because a CI job
hand-listed its steps. Every package multiplies that surface. Split for
*enforcement*, not for tidiness — which is the same reason §4 wants `core`
declared rather than merely tidy.

### 9.5 Revised sequencing

Deployables stay at **three**. What changes is that shared code stops living
inside a consumer.

⚠️ **Two corrections, measured 2026-08-20 while scoping step A for #388.** Both
were found by counting rather than by argument, and the second reverses this
table's own order advice.

**1. There is no workspace mechanism, and steps A and B both presuppose one.**
There is no root `package.json`, no `workspaces` key anywhere, no `packages/`
directory, and **three separate lockfiles**. §6 phase 0 says to convert the
Worker's imports *"behind a workspace reference"* and that *"nothing moves on disk
except a `package.json` and a `tsconfig` reference"* — both sentences assume a
root that does not exist. Establishing one is **step 0** (#387), and it carries a
real fork: npm workspaces (strongest boundary, but collapses three lockfiles and
touches 8 `npm ci` invocations across 4 workflows plus `deploy.yml`'s
`cache-dependency-path`) versus tsconfig `paths` + bundler aliases (no CI change
at all, still declared and still lintable, weaker than a package name).

**2. Step A is not the smallest step, and B is the better first move.** "Smallest,
no behaviour change" was wrong: A moves **17 files** and updates **29 referencing
files across 7 trees** — 14 in `web/src`, 5 `web/scripts` gates, 2 repo-root
scripts, 4 in `services/mock-ehr`, 1 in `services/cds-hooks`,
`ig/input/fsh/population-patients.fsh`, and 2 workflows whose **path filters name
the old location**, so a stale filter silently stops triggering them. That is
precisely the churn §7 calls the dangerous part. **B moves nothing on disk**, which
is what §8's "cheap and reversible" asymmetry was actually about. The only
argument for A first is that it settles a live question — and #387 settles that
question's mechanism regardless.

**3. Step D's row conflated "the guide" the LENS with the adoption-guide APP, and
the literal reading contradicted §5.** It used to read *"move the population view;
retire the guide's `/population` and `/patient/chart`"* — but neither is a guide
route. Both are top-level EHR-side lenses in `App.tsx`; there was nothing under
`/guide` to retire. And moving those views out of the *app* is refused twice in
this very document: **§5 ("Do not split the guide from the clinical demo" — one
artifact, `check:template` gating it in both directions, cross-lens links
load-bearing)** and **§9.4's correction 2** ("the licensed app and the guide should
not be separate deployables").

Read as a lens — the only reading consistent with §5 — D was an **intra-app IA
change**, and that is what shipped in #398: `/guide/measures` →
`/population/measures`, because the measure dashboard was the one guide section
that read patient data. "The guide" is genuinely overloaded in this repo — a lens,
an app, and a deployable historically named `adoption-guide` — so **say which one
is meant** anywhere it appears in a decision. Filed and fixed as #402.

| Step | Why this order | Unblocks |
|---|---|---|
| **0 — a workspace mechanism** (#387) | Neither A nor B can start without one. Shipped as declared **aliases**, workspaces deferred | Everything below; a third consumer having anywhere honest to import from |
| **A — `packages/demo-population`** | Settles a question that is live now. ⚠️ **Not** the smallest — see correction 2 | Done (#394) |
| **B — `packages/core`** (§6 phase 0, now 21 imports) | Cheap and reversible per §8; the lint constraint is the point | Done (#396) — deep imports **21 → 0**, and the `validate.ts` crossing in §9.2 got a home |
| **C — `PopulationView` + `MeasureDashboard` onto the `FhirDataSource` seam** | The gate on everything after it | Done (#397) — closed blocker 1 of §6.3. Blocker 2 (user-scoped launch + cohort read) is **#401**, still open |
| **D — the measure dashboard to the EHR side** | Only safe once C removes the `localDataSource` coupling | Done (#398). The guide holds no patient data, gated by `check:guide-boundary`. ⚠️ **This row used to say something else — see correction 3** |
| **E1 — the generated FHIR out of `web/src`** | Had to precede B — see correction 1 above | Done (#395) |
| **E2a — the 14 Patients out of the IG** | Nothing in the IG referenced them | Done (#392). The mock EHR's roster no longer needs a SUSHI compile |
| **E2b — the SUSHI build itself** | ⚠️ **Blocked on step 0 (#387)** — see below | The last §2.4 inversion |

### 9.6 Tracked, as of 2026-08-21

This plan was agreed and then tracked nowhere for a week — the same class as the
stale plan docs #349 and #355 kept finding, and the reason a doc with no gate
quietly stops being the plan. It has issues now, so the sequencing goes stale
**visibly**:

| Step | Issue | State |
|---|---|---|
| Epic | [#386](https://github.com/SPiER-Project/adoption-guide/issues/386) | open |
| 0 — workspace mechanism | [#387](https://github.com/SPiER-Project/adoption-guide/issues/387) | **reopened** — E2b's blocker |
| A — `packages/demo-population` | [#388](https://github.com/SPiER-Project/adoption-guide/issues/388) | closed (#394) |
| B — `packages/core` | [#389](https://github.com/SPiER-Project/adoption-guide/issues/389) | closed (#396) |
| C — the `FhirDataSource` seam | [#390](https://github.com/SPiER-Project/adoption-guide/issues/390) | closed (#397) |
| D — measures to the EHR side | [#391](https://github.com/SPiER-Project/adoption-guide/issues/391) | closed (#398) |
| E1 + E2a | [#392](https://github.com/SPiER-Project/adoption-guide/issues/392) | open **for E2b only** (#395, #399 landed) |

Two things that came out of the reshape and are tracked outside it:

| | |
|---|---|
| [#401](https://github.com/SPiER-Project/adoption-guide/issues/401) | blocker 2 of §6.3 — the embedded dashboard is a labelled iframe, not a SMART panel. Needs a user-scoped launch, **scope enforcement** (the stub has none), and a cohort read |
| [#402](https://github.com/SPiER-Project/adoption-guide/issues/402) | the corrections in this document, including the two above |

### 9.7 What is left of step E, and why it is blocked

**E2b — `fsh-sushi` leaving the React app's devDependencies — is blocked on
step 0 (#387), and that is a real block rather than a deferral of taste.**

§6 phase 1's stated content was *"`fsh-generated` becomes a package output rather
than a write into `web/src/data/fhir/`"* — **E1 delivered exactly that.** What
remains is §4's other half: the dependency itself. And a dependency needs an
install location, of which there are only three options:

| Option | Cost |
|---|---|
| a 4th `package.json` + lockfile in `packages/fhir-artifacts` | precisely the lockfile/CI churn #387 chose to defer, and the eventual workspaces migration would consolidate it away again |
| npm workspaces now | #387's deferred decision, reopened |
| drop the dependency and pin via `npx -y fsh-sushi@<version>` | no new install location, and it would fix a real inconsistency (five workflows `npm install -g fsh-sushi` **unpinned** today) — but the compile gains a registry dependency on a cold npm cache, weakening `verify`'s offline reproducibility, which this repo values highly |

Decided 2026-08-21: **defer to the workspaces migration.** The third option was
the tempting one and was rejected on the offline-reproducibility cost; if that
judgement changes, the `VALIDATOR_VERSION` constant in
`scripts/lib/validator-jar.mjs` is the pattern to copy, sed-scrape and all.

⚠️ **§7's migration rule applies unchanged and is the most important paragraph in
this document.** One deliberate pass per step; after each, plant the defect each
moved gate targets and watch it go red. A half-migrated tree is where a gate
quietly starts reading an empty directory — and this repo has six catalogued
instances of exactly that.

**Open question, not decided here:** does `MeasureDashboard` stay in the adoption
guide? If it does *and* it still needs patient-level data, step D leaves the guide
importing fixtures from somewhere. If measures move to the EHR side — where they
would live in a real deployment, computed over real data — the guide keeps no
patient data and D is clean. This is a product decision and it changes step D's
shape.

## Related

- [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) — the question that
  prompted this. A mock FHIR server would be `core`'s third consumer, and its
  Bundle export is the artifact that makes the population portable.
- [`docs/plans/episode-correlation-key.md`](episode-correlation-key.md) — why
  `lib/encounters.ts` and `lib/episodeRecord.ts` belong in `core`.
- [`docs/smart-sandbox-testing.md`](../smart-sandbox-testing.md) — the SMART
  client's current limits, including the Population view being local-only under
  SMART (`PopulationView.tsx` imports `localDataSource` directly, bypassing the
  `FhirDataSource` abstraction). ⚠️ **That line turned out to be the gate on the
  whole reshape** — see §9.5 step C. `MeasureDashboard.tsx` does the same thing.
- [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) — the six
  merged panel steps that produced the second Worker, and §6.3 there for why the
  embedded population dashboard is labelled rather than claimed. Its decision 1
  (one shell, two chrome modes) independently re-derives §5.
- #126 — decompose `PatientChart.tsx` and split `PatientContext` concerns.
  Independent of this, but the same area; doing it first would make `apps/` cleaner.
