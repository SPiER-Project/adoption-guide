# CLAUDE.md

Guidance for AI agents changing this repo (SPiER — FHIR artifacts + adoption-guide demo app).

## Repo layout

- `ig/` — FHIR Implementation Guide. FSH sources in `ig/input/fsh/` are compiled by SUSHI to `ig/fsh-generated/resources/` (gitignored). This is the **canonical, machine-readable** source for Profiles, ValueSets, CodeSystems, ActivityDefinitions, PlanDefinitions, and example Instances.
- `FHIR-Resources/` — hand-authored FHIR Questionnaire JSON (plus a few CarePlan templates), one folder per instrument (ASQ, PHQ-9, C-SSRS, SBQ-R, CAMS, Stanley-Brown). Imported **directly** by `web/src/App.tsx` at runtime.
- `web/` — React 19 + TypeScript (strict) + Vite app. Consumes generated FHIR JSON copied into `web/src/data/fhir/` by `web/scripts/copy-fhir.mjs`, and Questionnaires imported from `FHIR-Resources/`.
- `docs/` — project/reference docs. `scripts/` — repo-level helper scripts.

## Verification commands

Run these before considering a change done.

In `web/`, the one-shot entry point is **`npm run verify`** — it runs copy-fhir (forced), typecheck, both linters, all seven drift checks, and the unit tests in sequence. The individual pieces:
```
npm run copy-fhir      # compile IG via SUSHI + copy resources into src/data/fhir/ (do this FIRST)
npx tsc -b             # typecheck (project references; needs generated files present)
npm run lint           # eslint
npm run lint:css       # stylelint (design-token enforcement)
npm run check:crosswalk  # concept-crosswalk validation
npm run check:extract    # observation-extract validation
npm run check:catalog    # tool-catalog wiring (stubs / UI metadata / ActivityDefinitions / questionnaire URLs)
npm run check:stages     # stage ids in population data vs canonical FSH stage list
npm run check:fallback   # fallback-dispatch LOINC item codes vs Questionnaire JSON
npm run check:scenarios  # BOTH halves of the population-scenario gate:
                         #  check-scenario-responses.mjs — QuestionnaireResponses vs their
                         #    Questionnaire (linkIds, nesting, answer options, ranges)
                         #  check-scenario-resources.mjs — every OTHER bucket (Observation,
                         #    CarePlan, Communication, EpisodeOfCare, Appointment,
                         #    ServiceRequest, Procedure, DocumentReference, Consent, Flag,
                         #    Task) — see the scenario-gate note below for what it does NOT do
npm run check:measures   # Stage-8 Measure criteria vs the measures.ts engine
npm test                 # vitest
```

Deliberately **not** in `verify`, because it needs a terminology server and so
cannot be offline-reproducible — it runs nightly instead:
```
npm run check:codings    # every LOINC / SNOMED / terminology.hl7.org code+display
                         # literal in web/src, services/ and
                         # docs/terminology-manifest.json, checked against tx.fhir.org
```

Its floors are per source **and** per vocabulary family, and the guard loop reads
the declared floors rather than the family list — see the comment on `SCAN`. If
you add a vocabulary to `EXTERNAL_FAMILIES`, add its floor to every `SCAN` entry
too, or the new family is scanned with nothing asserting it stayed alive.

In `ig/` — the package is `fsh-sushi`, so a bare `npx sushi .` fetches the wrong
thing and fails in a fresh worktree:
```
npx fsh-sushi .        # compile FSH → fsh-generated/resources/
```

At the repo root, resource-level FHIR conformance (needs Java 17+; downloads and
caches the ~190MB HL7 validator jar into `.fhir-validator/` on first run):
```
node scripts/validate-fhir.mjs   # HL7 validator_cli over ig/fsh-generated/, FHIR-Resources/
                                 # and web/src/data/population/scenarios/ (unwrapped)
```

In `services/cds-hooks/` — **easy to forget, and CI gates it:**
```
npm install && npm run verify   # typecheck + eslint + vitest for the Worker
```
`web/`'s `npm run verify` does NOT cover this package, but the `cds-hooks` CI job
does. It imports the web catalog, so a change to `tool-ui-metadata.ts` (launch
actions especially) or to the population scenarios can break its tests without
anything in `web/` failing.

⚠️ **`sushi` does not validate everything.** Four separate gates cover four
different classes of problem, and a clean SUSHI run implies none of the others:

| Gate | Catches | Where |
|---|---|---|
| `npx fsh-sushi .` | FSH syntax, unresolved FSH references | `ig.yml` |
| `node scripts/validate-fhir.mjs` | resource-level conformance: cardinality, extension context, required items, `display` vs CodeSystem, QR structure against its Questionnaire | `ig.yml` (`validate` job) |
| IG Publisher | FHIRPath invariants, narrative link integrity | `ig-publish.yml`, and the same gate in `deploy.yml` on every push to main |
| `check:codings` + `validate-fhir --tx` | **external** terminology: LOINC, SNOMED and terminology.hl7.org codes that don't exist, and displays that don't match the publishing authority — including codings written in TypeScript, which no other gate reads | `terminology-nightly.yml` (nightly + `workflow_dispatch`) |

That fourth row exists because of issue #220: seven LOINC codes SPiER emitted for
safety-plan sections were fabricated or misused, and no gate could see them. Six
did not exist in LOINC; `81344-4` resolved to healthcare-agent disclosure
authority rather than "reason for living", so it validated cleanly while meaning
the wrong thing. The blind spot had two halves — `validate-fhir.mjs` runs `-tx n/a`
in CI so external codes go unchecked, and **nothing at all** validated the
code+display literals in `web/src/lib/*Mappers/`, even though those land in
`Observation.code.coding` on every generated resource at runtime.

The validator job is the only thing that checks `FHIR-Resources/` at all — the IG
Publisher is triggered by `ig/**` alone. After a substantial `ig/` change you can
still dispatch the publisher directly: `gh workflow run ig-publish.yml`. Nothing
in the repo compiles the measure CQL at `ig/drafts/` — see
`docs/plans/stage-8-measure-and-share.md`.

⚠️ **The population scenarios are hand-authored FHIR, and are gated by two
things that cover different amounts.** `web/src/data/population/scenarios/patient-*.json`
holds Observations, CarePlans, Communications, EpisodeOfCares, Appointments,
ServiceRequests, Procedures and DocumentReferences that the Stage-8 measure
engine reads directly, so a malformed one produces a *wrong* measure score
rather than an empty one (issue #226). Be precise about which gate sees what:

| | `npm run check:scenarios` (offline, in `verify`) | `node scripts/validate-fhir.mjs` (Java, `ig.yml`) |
|---|---|---|
| Runs | every `web/` verify | PR + push touching `ig/`, `FHIR-Resources/`, or the scenarios |
| QuestionnaireResponses | linkIds, nesting, answerOption, ranges, value[x] type | full conformance against the Questionnaire |
| Other buckets | unknown-bucket typos, `resourceType`, unique ids, patient linkage, base-R4 required elements + status/intent codes, profile canonicals resolving, profile `min`/fixed/required-binding from the generated StructureDefinitions, SPiER extension bindings, date parsing | everything: real cardinality, **slicing**, invariants, extension context, reference targets, unknown elements |
| Misses | cardinality *counts*, slices, invariants, unknown elements, external codes | nothing structural — but runs `-tx n/a`, so LOINC/SNOMED displays wait for the nightly |

The offline half's base-R4 required-element and status-code tables are
hand-maintained (`BASE_REQUIRED` / `STATUS_CODES` in
`check-scenario-resources.mjs`) because the base R4 StructureDefinitions are not
vendored here. An omission there costs offline coverage only — the validator
still catches the underlying defect. Everything profile-derived is read from
`web/src/data/fhir/StructureDefinition-*.json`, so changing FSH changes the
check.

`validate-fhir.mjs` unwraps the scenario buckets into a temp directory first
(`collectScenarioResources`), dropping only `_savedAt` — SPiER's client-side
persistence stamp, which `smartDataSource` also strips before writing to a real
server. `riskAlerts` and `encounters` are deliberately not fed to the validator:
neither is FHIR (`encounters` is `ScenarioEncounter` walkthrough narration, not
a FHIR Encounter), and the offline half checks both against their TypeScript
shapes instead.

⚠️ **A validator warning can mean "nothing was checked".** If the HL7 validator
cannot resolve a QuestionnaireResponse's Questionnaire (or a claimed profile), it
says so as a *warning* and then reports zero errors — a context-loading mistake
degrades to a PASS. Two traps caused this in practice, both now guarded in
`validate-fhir.mjs`: `-ig <folder>` does **not** recurse, so `-ig FHIR-Resources`
loads 0 resources (every file is one level down); and `-output` emits a bare
`OperationOutcome` rather than a `Bundle` when given exactly one source. The
script now treats those warnings as errors and understands both output shapes.
When you touch it, re-run it against a deliberately broken input and confirm it
*fails* — a green gate you have never seen go red is not evidence of anything.

The validator runs without a terminology server (`-tx n/a`) so the gate stays
fast and offline-reproducible. Consequence: codes from **external** systems
(LOINC, SNOMED) are not verified there — the IG Publisher covers those. Codes
from SPiER-local CodeSystems *are* fully checked, including that every
`Coding.display` matches the CodeSystem's display or one of its designations.
Pass `--tx https://tx.fhir.org` to check external terminology locally.

## Conventions

- **Design tokens only.** Vanilla CSS with custom properties. stylelint (`.stylelintrc.json`) rejects raw hex (`color-no-hex`) and enforces `var(--…)` for `color`, `background-color`, `border-color`, `fill`, `font-size`, `box-shadow`. Raw values are allowed only in `src/index.css` (token definitions). Class selectors must be kebab-case BEM.
- **Routing:** `HashRouter` (see `web/src/main.tsx`) — GitHub Pages compatible.
- **Vite base path:** `/adoption-guide/` (see `web/vite.config.ts`). Don't hardcode absolute asset paths.
- **Never hand-edit `web/src/data/fhir/`** — it's a gitignored build artifact regenerated by `copy-fhir.mjs`. To change FHIR shapes, edit FSH in `ig/input/fsh/`; to change a Questionnaire, edit the JSON in `FHIR-Resources/`.

## Gotchas

- **Fresh worktrees need `npm install` in `web/`** before any npm script runs.
- **`copy-fhir` is incremental:** it skips the ~30s SUSHI compile when `web/src/data/fhir/` is newer than every FSH input. `predev` runs it plain; `prebuild` runs it with `--force`. If FHIR data looks stale, run `npm run copy-fhir -- --force`.
- **Generated files must exist before `tsc -b`.** `web/src/data/fhir/*.json` and `web/src/data/catalog/care-plan-profiles.generated.ts` (both gitignored) are produced by `copy-fhir`. On a clean checkout, run `npm run copy-fhir` first or the typecheck/build fails on missing imports.
- **One canonical URL, one definition.** `ig/` is canonical for CodeSystems and
  ValueSets; `FHIR-Resources/` holds Questionnaires (plus a couple of CarePlan
  templates) and the few local CodeSystems that have no FSH counterpart. Never
  define the same canonical URL in both trees — three ASQ CodeSystems did, and
  the `FHIR-Resources` copies silently shadowed the IG's with drifted `display`
  values until `validate-fhir.mjs` caught it. `node scripts/validate-fhir.mjs`
  loads both trees, so a fresh collision shows up as a display or binding error.
- **Drift-prone hand-duplicated values.** Stage IDs, LOINC codes, and ASQ disposition codes are duplicated by hand across `ig/input/fsh/` (canonical, e.g. `pathway-stages.fsh`), `web/src/lib/observationMappers/` (e.g. `phq9.ts`, `asq.ts`), and `web/src/data/population/` (e.g. `patients.json`). LOINC **per-item** codes additionally live in `web/src/lib/observationMappers/fallbackDispatch.ts` (`INSTRUMENT_SIGNATURES`, used to recognize foreign QRs) — guarded against the Questionnaire JSON by `npm run check:fallback`. When you change any such code, **grep the whole repo** for the old value and update every site.

## Skills (`.claude/skills/`)

- **`assessment-to-ig`** — author the *full* FHIR artifact set for a new instrument (Questionnaire JSON + FSH ActivityDefinition/CodeSystems/ValueSets/example QuestionnaireResponse/Observation profiles + IG page + catalog wiring). Use when adding/FHIR-ifying an instrument.
- **`fhir-questionnaire-quality`** — review/improve a *single* FHIR R4 Questionnaire (or its QuestionnaireResponse/Observation contract) for interoperability. Use for scoped review of one form.
- **`concept-harmonization`** — the cross-instrument concept layer: shared risk-tier CodeSystems/ValueSets, ConceptMaps/StructureMaps, and derived Observations that let disparate tools map into one actionable representation. Use for translation/crosswalk work spanning instruments.
