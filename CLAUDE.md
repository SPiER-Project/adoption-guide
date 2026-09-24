# CLAUDE.md

Guidance for AI agents changing this repo (SPiER — FHIR artifacts + adoption-guide demo app).

This file holds the layout, the commands, and the conventions **as rules**, one
or two lines each. The **reasoning** — why each rule exists, the defect it was
written against, and what its gate cannot see — lives in
[`docs/internals/`](docs/internals/README.md), one file per area, linked from
every section below. Read the one for the area you are changing **before** you
change it: every ⚠️ in those files is a defect that shipped, and most of them
are a gate that passed while checking nothing.

## Repo layout

Rationale, moves and the things not to put back: [`docs/internals/repo-layout.md`](docs/internals/repo-layout.md).

- `ig/` — the FHIR Implementation Guide. FSH in `ig/input/fsh/` is compiled by SUSHI to `ig/fsh-generated/resources/` (gitignored): the **canonical** source for profiles, ValueSets, CodeSystems, ActivityDefinitions, PlanDefinitions and examples.
- `ig/input/resources/questionnaires/` — the hand-authored Questionnaire JSON (plus two CarePlan templates and one ValueSet), one folder per instrument, published through one recursive `path-resource` entry. **Resource JSON only**; every resource `id` equals its canonical's last segment. Reference material lives in `docs/instruments/<Tool>/`. Rules: [`ig-build.md`](docs/internals/ig-build.md) § *The hand-authored Questionnaires*.
- `packages/core/` — the React-free domain layer, consumed as `@spier/core/<path>`; tests live beside their subject. `packages/ui/` — the design system (eight primitives, `cx`, `foundation.css`), as `@spier/ui/<name>`. `packages/tool-views/` — the 18 fillers and 11 recorders, defined ONCE, plus the contexts they read, as `@spier/tool-views/<path>`; **no `IS_DEMO` in here, ever**. `packages/app-shell/` — the runtime both apps mount (SMART plumbing, providers, data seam), as `@spier/app-shell/<path>`. `packages/worker-http/` — what the two asset-serving Workers share. `packages/worker-tooling/` — the one Worker toolchain (eslint body, tsconfig base, vite/vitest body + alias list); nothing in it imports a dependency. `packages/demo-population/` — the 14 demo patients. `packages/fhir-artifacts/generated/` — SUSHI's output, gitignored.
- `apps/guide/` — the Adoption Guide, served by `services/guide`; **carries no patient data and no data source**. `apps/clinical/` — the two SMART apps, served by `services/clinical` and framed by the mock EHR; no guide route, no `/ig/`. Two route tables; `IS_DEMO` is gone.
- **The repo root is the tooling host**: `package.json`, the only `node_modules` (no npm workspaces, #387), every config and `tsconfig`, `public/`, `tests/`, `shims/` and one `scripts/` tree. There is **no root `src/`**, deliberately. `docs/` — project and reference docs; `docs/internals/` — the reasoning behind this file.

## Verification commands

Run these before considering a change done.

### At the repo root — the `npm` gates

The one-shot entry point is **`npm run verify`** — copy-fhir (forced), typecheck,
both linters, every `check:*` gate below, and the unit tests, in sequence. **CI
runs `npm run verify` itself**; do not re-expand the CI job into individual
steps. If you add a gate, add it to this list — **deliberately not a count**.
What each gate's load-bearing rule is and what it cannot see:
[`docs/internals/web-gates.md`](docs/internals/web-gates.md).

```
npm run copy-fhir               # compile the IG via SUSHI + copy resources into the generated tree — FIRST
npx tsc -b                      # typecheck (project references; needs the generated files present)
npm run lint                    # eslint, TYPE-AWARE (`project:` globs, not projectService) and --max-warnings 0
npm run lint:css                # stylelint: design-token enforcement
npm run check:tokens            # every var(--token) resolves; reads BOTH style roots (scripts/lib/style-roots.mjs)
npm run check:favicons          # the tab icons still match the brand tokens (they are generated copies)
npm run check:css-dead          # every class selector is referenced by a component (or the formbox theme)
npm run check:template          # one header implementation, one owner of the page inset, one owner of the width, density only through tokens
npm run check:prose             # --measure-prose is a character count, every cap declared, prose at one of three sizes
npm run check:jargon            # no repo vocabulary in reader copy (the guide's strings AND the FSH's documentation displays), and no WIRE vocabulary in the clinician's (apps/clinical + packages/tool-views)
npm run check:fhir-render       # the clinician sees no raw FHIR — in JSON (useInspect) or in a recorder's words
npm run check:ucum              # the UCUM shim is still safe: no quantities, and it still covers its callers
npm run check:fhir-r5           # the R5-model shim is still safe: every fhirVersion is "r4"
npm run check:crosswalk         # concept-crosswalk validation
npm run check:extract           # the SDC observationExtract contract, and EVERY mapper's Questionnaire classified
npm run check:core-boundary     # packages/core stays React-free and DOM-free
npm run check:dupes             # no function is defined twice: same name + same body across files fails, and so does a renamed copy of 5+ lines
npm run check:guide-boundary    # the Adoption Guide holds no patient data (walks guide pages transitively)
npm run check:catalog           # tool-catalog wiring; every launch path, landing route and <Navigate> target resolves
npm run check:tool-view-routes  # the 29 tool views are ONE definition and EVERY app's route table agrees, both ways
npm run check:eager-forms       # the 18 Questionnaires stay OUT of the entry chunk (walks STATIC imports)
npm run check:surface-links     # every in-app link on EACH app resolves on THAT app's route table (both apps walked; shared views hold no route literal)
npm run check:origins           # every hosted origin comes from deploy-origins.json; no literal in TypeScript
npm run check:deploy-jobs       # every services/*/wrangler.jsonc is deployed from main by deploy.yml
npm run check:stages            # stage ids in population data vs the canonical FSH stage list
npm run check:pathway           # the pathway PlanDefinition's codes and definitionCanonicals resolve
npm run check:outputs           # every PlanDefinition.action.output profile is stamped by an EMITTED resource (after npm test)
npm run check:published-profiles # every published profile is claimed by something the app emits, or exempted (after npm test)
npm run check:readers           # every observation mapper's reads vs the Questionnaire's declared item types
npm run check:careplan-readers  # the same rule for carePlanMappers
npm run check:patients          # the 14 demo patients' demographics agree across all three sites
npm run check:scenarios         # scenario QRs vs their Questionnaire, plus every other resource bucket
npm run check:dates             # scenario clinical dates coherent to their anchor (--apply re-dates)
npm run check:measures          # Stage-8 Measure criteria vs the measures.ts engine
npm run check:reassessment      # the per-tier reassessment cadence agrees across PlanDefinition, app and CQL
npm test                        # vitest
```

⚠️ **A green `check:*` is not proof of coverage.** Each gate has a rule it
cannot see, and several shipped in a form that passed a planted defect.
**Prove a gate can fail before trusting it** — plant a defect, watch it go red,
remove it ([`docs/internals/README.md`](docs/internals/README.md)).

### External terminology (weekly + terminology PRs, not in `verify`)

```
npm run check:codings           # every LOINC / SNOMED / THO code+display literal in TypeScript, against tx.fhir.org
bash scripts/loinc-audit/loinc-audit.sh .   # every LOINC coding in every Questionnaire, against fhir.loinc.org
```

`tx.fhir.org` is not the authority — Regenstrief is; the audit needs a personal
account and is not a gate. Before adding a coding, touching `PENDING_TX`, or
reading a red run: [`docs/internals/terminology.md`](docs/internals/terminology.md)
and [`docs/scheduled-checks-triage.md`](docs/scheduled-checks-triage.md).

### In `ig/`

```
npx fsh-sushi .                 # compile FSH → fsh-generated/resources/  (the package is fsh-sushi; `npx sushi .` fetches the wrong thing)
```

**A clean SUSHI run is not a quiet one, and `sushi` does not validate everything.**
Five gates cover five classes of problem; what each catches, why the publisher's
CQL compile hangs on one config line, and the two traps in running the publisher
locally: [`docs/internals/ig-build.md`](docs/internals/ig-build.md).

### At the repo root — the standalone `node` scripts

No `npm run` wrapper: they gate the IG, the validator and the docs rather than
the app, and several need Java or the network.

```
node scripts/check-sushi-output.mjs          # gate the warning SHAPE of a SUSHI compile against a reasoned allowlist
node scripts/check-ig-menu.mjs               # every menu: target is a real page; menu: and pages: agree both ways
node scripts/check-ig-narrative.mjs          # what the IG's prose may say, and whether what it points at exists
node scripts/build-ig-groups.mjs [--check]   # the Artifacts page's groups: block, derived from the FSH tree
node scripts/check-canonical-uniqueness.mjs  # one canonical URL, one definition, across the FSH tree AND the JSON tree
node scripts/check-md-links.mjs              # every relative link in a tracked .md resolves
node scripts/check-md-paths.mjs              # every backticked repo-rooted path in prose exists, or is allowed with a reason
node scripts/check-plan-status.mjs           # a plan whose status says it shipped is in docs/plans/archive/, with a banner
node scripts/check-worker-csp.mjs            # ONE frame-ancestors policy across every asset-serving Worker
node scripts/check-service-toolchain.mjs     # ONE Worker toolchain: identical devDependencies, every config consumes worker-tooling
node scripts/check-deploy-origins.mjs        # every wrangler/workflow copy of a hosted origin matches deploy-origins.json
node scripts/validate-fhir.mjs               # HL7 validator_cli over the generated tree, the Questionnaires and the scenarios (Java 17+)
node scripts/check-fml.mjs --tx https://tx.fhir.org   # FHIR Mapping Language gate (Java + network)
node scripts/build-use-case-workbook.mjs [--check]    # docs/use-cases/<id>.json → dist/*.xlsx + *.csv + <id>.md
```

- The IG and docs gates, and the traps behind them: [`ig-build.md`](docs/internals/ig-build.md), [`docs-gates.md`](docs/internals/docs-gates.md).
- **A validator warning can mean "nothing was checked"**; read [`fhir-conformance.md`](docs/internals/fhir-conformance.md) before editing a scenario fixture, a mapper or an `.fml` map.
- **Edit `docs/use-cases/ed-scenario-11.json`, never `docs/use-cases/dist/` and never `ed-scenario-11.md`** — all three are outputs, and a gap claim in that workbook is a statement to the HL7 working group ([`docs-gates.md`](docs/internals/docs-gates.md)).

### The four Workers — easy to forget, and CI gates all four

The root's `npm run verify` covers **none** of them, and two import the web
catalog, so a catalog or scenario change can break them with the root green.

```
cd services/guide     && npm install && npm run verify   # the Adoption Guide SPA + the rendered IG; OFFLINE (imports @spier/worker-http and nothing else)
cd services/cds       && npm install && npm run verify   # the CDS Hooks service; needs copy-fhir and a root install
cd services/clinical  && npm install && npm run verify   # the two SMART apps; offline, serves dist-clinical as bytes
cd services/mock-ehr  && npm install && npm run verify   # + check:host-css; builds the pages' client modules before its tests
```

The rules, each with its history in [`docs/internals/workers.md`](docs/internals/workers.md):

- **Three offerings, four deployables.** The IG, the Adoption Guide and the clinical demo are the offerings; the CDS Hooks service is the fourth deployable and belongs to the standard, on its own Worker (`services/cds`) since 2026-09-20.
- **`SMART_LAUNCH_URL` is required by the CDS Worker** and it 500s without it; **`CDS_JWT_ENFORCE` is `require`**, and the mock EHR is the registered client.
- **`services/clinical` hosts no `/cds-services` and no `/ig/`**, and its tests assert both as negatives. The mock EHR frames this Worker.
- **The `frame-ancestors` policy lives in `packages/worker-http`, once**; `check-worker-csp.mjs` holds five rules over it.
- **The rendered IG at `/ig/` is put there by CI only**; a local deploy is refused. Cloudflare's Workers Builds integration stays disconnected. `index.ts` must not regain an `/ig` route.
- **All four deploy from `main`**, by a job each in `.github/workflows/deploy.yml`, gated by `check:deploy-jobs`; the mock EHR joined them 2026-09-21 and `npm run deploy` refuses outside CI everywhere. **The rendered IG is the CI-only part**, not the deploy.
- **All four build under `packages/worker-tooling`**, and `check:toolchain` in each verify keeps it one. Add an option, alias or devDependency there, never to one service.
- **Hosted origins come from `deploy-origins.json`** at the repo root; wrangler copies are gated by `check:origins`. GitHub Pages is a dependency (IG downloads over the size cap redirect to it), not a spare copy.
- **The mock EHR is deliberately NOT styled like SPiER**, favicon included. **An embedded activity gets a VIEWPORT** — never size a guest frame to its content. **A framed launch is minted at RUNTIME**, never baked into the markup. **Its `app.ts` composes six route modules and its pages ship no inline script**: the behaviour is `services/mock-ehr/src/client/*.ts`, built by `npm run build:client`; do not add a `script:` string back to `page()`.

### Measures

A measure criterion lives in **four** places and `check:measures` ties only two
of them together; nothing asserts the CQL and the TypeScript compute the same
answer. `denominator-exclusion` and `denominator-exception` are **not**
interchangeable. Before changing a criterion, a population, or the scoring, read
[`docs/internals/measures.md`](docs/internals/measures.md).

## Conventions

Each is a rule; its history and the limits of its gate are in the file linked.

- **Design tokens only** ([`css-and-page-template.md`](docs/internals/css-and-page-template.md)). Vanilla CSS with custom properties; stylelint rejects raw hex and enforces `var(--…)` for colour, type, shadow and **every spacing property**. Raw values live only in `packages/ui/src/foundation.css`, whose own `stylelint-disable` banner is the exemption. Class selectors are kebab-case BEM. Type has three families (`--font-display`, `--font-body`, `--font-mono`); brand colour is role-named and there is no `--brand-accent`; spacing is the 10-step `--space-0-5` … `--space-8` scale (a derived alignment is a `calc()` over tokens); tracking has two tokens; breakpoints are the three literals 640 / 768 / 1024 with `max-width` as the complement. stylelint checks that a token is *used*, never that it *exists* — `check:tokens` closes that half.
- **One page template.** Every route renders into `.app-shell__body`, the sole owner of the page inset; `PageHeader` is the only page-title typography, so section headings start at `<h3>`. **Nine components own the surfaces** below it (eight in `packages/ui`, `WorkflowForm` in `packages/tool-views`); a page passes `className` for layout or a domain colour only, never a radius, padding, border or background. **Width has one owner per route** — whoever owns the header — and the vocabulary is `--page-width-prose` or `--page-width-wide`; a guide section picks its width on `GuideSection`, `prose` when unsure. **`--measure-prose` is not a third width**: it caps a text run, in `em`, and prose has three sizes and no others. `check:prose` cannot see a run with no cap — measure a wide page's prose by hand.
- **A reader of the guide has no checkout, and every page has a word budget** ([`web-gates.md`](docs/internals/web-gates.md)). No script name, gate name, function name, package path, file name, issue number or rename date in reader copy — `check:jargon` reads the guide's strings from the AST and the FSH's `documentation` displays, which are published. Length is a budget per page in `apps/guide/src/pages/pageLength.test.tsx`, measured as the words a reader meets ON ARRIVAL: a closed `<details>` costs its summary only, so demoting a caveat into a drawer is the cheap fix and deleting it is not required. Raising a cap to go green is the one edit that makes that file decorative.
- **A recorder is bespoke because of what it writes, and it describes the ACT** ([`tool-views.md`](docs/internals/tool-views.md)). "It is only a Communication" is not grounds to merge one. A recorder's `lede`, labels and help name no resource type, profile, extension or element path and hold no `<code>`; the wire format goes in `WorkflowForm`'s `fhirNote`. A view cannot be derived from its ActivityDefinition.
- **A filler submits, then the clinician saves** ([`tool-views.md`](docs/internals/tool-views.md) §6). Submit shows the results and the pathway's recommendation; **Save to the chart** runs the writeback, whose ladder and tier order are untouched. An item the clinician is not asked to answer is hidden in the **published Questionnaire** (`questionnaire-hidden`), never filtered in React — and hidden is not absent, so a `calculatedExpression` still lands in the response. `tests/questionnaireComputedItems.test.ts` holds the rule over the whole class, both ways.
- **The clinician-facing app shows no raw FHIR; the guide does** ([`surfaces-and-routing.md`](docs/internals/surfaces-and-routing.md)). `InspectContext` defaults to false and only the `/guide` layout and the guide's tool pages (`/guide/tools/TL-0NN`) turn it on; serialize a resource or render a `<pre>` and you must have asked `useInspect()` in the same file. **It does not NAME the wire format either**: a resource type, an element path, a code, a canonical URL, an issue number or a tier number *as a word* is `check:jargon`'s clinical scan, over every string in `apps/clinical` and `packages/tool-views`. Every clinical page also has a word budget on arrival, measured in panel chrome (`apps/clinical/src/pages/pageLength.test.tsx`). **The 18 fillers and 11 recorders are ONE element definition** (`packages/tool-views/src/data/toolViews.tsx`), rendered by both route families; a tool page is a sibling of the guide layout, not a child, and it owns the header above the form it hosts (`PageHeaderOwnerContext`, default `view`).
- **The guide explains and hosts; the mock EHR holds and launches** ([`surfaces-and-routing.md`](docs/internals/surfaces-and-routing.md)). `/patient/chart` and `/population` redirect to the guide's explainers; the apps answer on `/patient/record` and `/population/caseload`. The guide does not configure — Tool Configuration is `/settings` in the SMART app. The guide's sidebar has four groups (`GUIDE_GROUPS`) and `GUIDE_SECTIONS` stays grouped-contiguous; a `/guide` page not in that file is checked by nothing, so a non-sidebar page is a `subsections` entry with its FULL sub-path. Renaming an app route needs its redirects too.
- **Two build surfaces, two route tables — no flag folds either way.** `VITE_SURFACE` is a build target read only by `vite.config.ts`; a demo-only page is simply absent from the clinical table. **Neither build carries the demo population**; `check:surface` reads both bundles. **Routing is `HashRouter`**; the Vite base is env-driven — never hardcode an absolute asset path.
- **`ehr-` names the EHR, not the app's chrome.** The standalone chrome is `AppShell` / `.app-shell__*`; `.ehr-rubric`, `context-ehr-patient` and the `ehr` strings under `services/mock-ehr/` keep the prefix because they really are about EHRs.
- **Never hand-edit generated output** — `packages/fhir-artifacts/generated/`, `ig/fsh-generated/`, `docs/use-cases/dist/`, `.runtime-fhir/`, `services/mock-ehr/src/client/dist/`, and `public/favicon.*` + `public/apple-touch-icon.png`. To change FHIR shapes, edit FSH in `ig/input/fsh/`; to change a Questionnaire, edit the JSON in `ig/input/resources/questionnaires/`.

## Gotchas

One line each; the mechanism and the incident behind it are in
[`docs/internals/build-gotchas.md`](docs/internals/build-gotchas.md) unless another file is named.

- **Fresh worktrees need `npm install`** at the repo root before any npm script runs, and each service needs its own.
- **`copy-fhir` is incremental on a CONTENT fingerprint**, not mtimes; `verify` alone passes `--force`. CI's cache key comes from the same fingerprint (`--print-input-fingerprint`) — never restate the input set as `hashFiles(...)`. The SUSHI compile is retried 3× for the Cloudflare deploy's sake (`COPY_FHIR_SUSHI_ATTEMPTS=1` turns it off); `check-sushi-output.mjs` is not retried.
- **Generated files must exist before `tsc -b`** — run `npm run copy-fhir` first on a clean checkout.
- **One canonical URL, one definition**, across the FSH tree and the JSON tree; **no CodeSystems live in the JSON tree**. `check-canonical-uniqueness.mjs` is the gate; SUSHI catches only half of this.
- **Hand-duplicated values drift**: stage ids, LOINC codes and ASQ disposition codes are typed in `ig/input/fsh/`, the mappers and the demo population — grep the whole repo when you change one. Stage-id **constants** in TypeScript are typed against the generated `StageId` union (`satisfies StageId`), so a renamed stage is a compile error there; the JSON side stays gated by `check:stages`.
- **Hand-duplicated helpers drift too, and `check:dupes` fails the copy.** A recorder's stage tag is `stageTag(STAGE_ID)` from `packages/core/src/lib/stageTag.ts`, its option lookup is `displayFor` from `codedOption.ts`, an Observation's date is `observationEffective`. Every FHIR builder — `lethalMeans.ts` included since 2026-09-20 — lives in `packages/core/src/lib`; `packages/tool-views` holds views and their contexts, never a resource builder.
- **The Stanley-Brown CarePlan transformation exists twice on purpose** (`.fml` + `carePlanMappers/stanleyBrown.ts`), compared against one golden file; change both.
- **Tool licensing lives in the FSH, and only there**; `Tool.licensing` is derived. A new tool with unsettled terms gets `#unknown`. No status has been verified against the rights holder's current terms — [`docs/best-practices/licensing-verification-backlog.md`](docs/best-practices/licensing-verification-backlog.md).
- **Tool ids live in the FSH too** (`ActivityDefinition.identifier`); `tools.ts` derives the pairing and `check:catalog` fails a hand map. `TL-0NN` is not an AD id; the mapping is many-to-one.
- **SMART registrations live in `packages/app-shell/src/config/smart-registrations.json`**, a checked-in file and not an env var; a `client_id` is not a secret.
- **Hosted origins live in `deploy-origins.json`** ([`workers.md`](docs/internals/workers.md)); append your own path, never a URL into the file.
- **A huge `git status` in the ROOT checkout usually means the ref moved, not the files.** Diagnose from the reflogs before touching anything; `git reset --hard` and `git worktree remove` both destroy the evidence.
- **Two of `@formbox/renderer`'s dependencies are aliased to shims** (`fhirpath/fhir-context/r5`, `@lhncbc/ucum-lhc`); `check:fhir-r5` and `check:ucum` guard them, and the alias reader throws on a form it cannot parse.

## Skills (`.claude/skills/`)

- **`assessment-to-ig`** — author the *full* FHIR artifact set for a new instrument (Questionnaire JSON + FSH ActivityDefinition/CodeSystems/ValueSets/example QuestionnaireResponse/Observation profiles + IG page + catalog wiring). Use when adding/FHIR-ifying an instrument.
- **`fhir-questionnaire-quality`** — review/improve a *single* FHIR R4 Questionnaire (or its QuestionnaireResponse/Observation contract) for interoperability. Use for scoped review of one form.
- **`concept-harmonization`** — the cross-instrument concept layer: shared risk-tier CodeSystems/ValueSets, ConceptMaps/StructureMaps, and derived Observations that let disparate tools map into one actionable representation. Use for translation/crosswalk work spanning instruments.
