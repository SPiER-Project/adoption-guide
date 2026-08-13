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
| **2 — monorepo with declared workspace packages** | **PROPOSED.** Boundaries drawn along seams the code already shows. §4 |
| **3 — split the adoption guide from the clinical demo into two apps** | **REJECTED.** #316 deliberately unified them; the cross-lens links are the product. §5 |
| **4 — a patient-facing app as its own `apps/` entry** | **PROPOSED, and the trigger for #2.** §5 |

| Phase | State |
|---|---|
| 0 — declare `packages/core`, convert the Worker's nine deep imports | **Not started.** Contained; worth doing on its own. §6 |
| 1 — move the SUSHI build out of the web app's devDependencies | **Not started.** §6 |
| 2 — `packages/ui`, gates move with it | **Not started.** §6 |
| 3 — `apps/patient` | **Not started.** Blocked on a decision to build it at all. |

⚠️ Phases 1–3 are **triggered, not scheduled.** If the patient app never happens,
phase 0 is still worth having and the rest buys little. Do not do this
speculatively — §7 is the honest cost.

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

## 6. Phases

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

## Related

- [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) — the question that
  prompted this. A mock FHIR server would be `core`'s third consumer, and its
  Bundle export is the artifact that makes the population portable.
- [`docs/plans/episode-correlation-key.md`](episode-correlation-key.md) — why
  `lib/encounters.ts` and `lib/episodeRecord.ts` belong in `core`.
- [`docs/smart-sandbox-testing.md`](../smart-sandbox-testing.md) — the SMART
  client's current limits, including the Population view being local-only under
  SMART (`PopulationView.tsx:73` imports `localDataSource` directly, bypassing the
  `FhirDataSource` abstraction).
- #126 — decompose `PatientChart.tsx` and split `PatientContext` concerns.
  Independent of this, but the same area; doing it first would make `apps/` cleaner.
