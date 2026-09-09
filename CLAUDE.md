# CLAUDE.md

Guidance for AI agents changing this repo (SPiER — FHIR artifacts + adoption-guide demo app).

This file holds the layout, the commands, and the conventions as rules. The
**reasoning** — why each gate exists, what its load-bearing rule is, and what it
cannot see — lives in [`docs/internals/`](docs/internals/README.md), one file per
area, linked from each section below. Read the one for the area you are changing
**before** you change it: every ⚠️ in those files is a defect that shipped, and
most of them are a gate that passed while checking nothing.

## Repo layout

- `ig/` — FHIR Implementation Guide. FSH sources in `ig/input/fsh/` are compiled by SUSHI to `ig/fsh-generated/resources/` (gitignored). This is the **canonical, machine-readable** source for Profiles, ValueSets, CodeSystems, ActivityDefinitions, PlanDefinitions, and example Instances.
- `FHIR-Resources/` — hand-authored FHIR Questionnaire JSON (plus a few CarePlan templates), one folder per instrument (ASQ, PHQ-9, C-SSRS, SBQ-R, CAMS, Stanley-Brown). Imported **directly** by `web/src/App.tsx` at runtime.
- `packages/core/` — the **React-free domain layer** (#389): FHIR types, the tool
  catalog, instrument + care-plan mappers, the `FhirDataSource` seam, pathway /
  registry / measure logic, CDS Hooks, FHIRcast. Consumed as `@spier/core/<path>`
  by the app and both Workers, which have **zero** deep imports into `web/src`.
  Its tests live beside their subject, under `packages/core/src` itself, rather
  than under `web/src` — `packages/core/tsconfig.json` (a `composite` project
  referenced from `web/tsconfig.json`) and `web/vitest.config.ts`'s extended
  `test.include` are what reach them from there. Still `web`'s `npm run verify`
  and `npx tsc -b`; no fourth pipeline.
- `packages/demo-population/` — the 14 demo patients + scenario slices (#388).
- `packages/fhir-artifacts/generated/` — SUSHI's output, gitignored (#392).
- `web/` — React 19 + TypeScript (strict) + Vite app. Consumes generated FHIR JSON copied into `packages/fhir-artifacts/generated/` by `web/scripts/copy-fhir.mjs`, and Questionnaires imported from `FHIR-Resources/`.
- `docs/` — project/reference docs. `scripts/` — repo-level helper scripts.

## Verification commands

Run these before considering a change done.

### In `web/`

The one-shot entry point is **`npm run verify`** — copy-fhir (forced),
typecheck, both linters, every `check:*` gate below, and the unit tests, in
sequence. **CI runs `npm run verify` itself** rather than re-listing its steps,
so a gate added to `package.json` is enforced automatically; **do not re-expand
the CI job into individual steps.**

If you add a gate, add it to this list. **Deliberately not a count** — a pinned
number goes stale silently on every gate added.

```
npm run copy-fhir      # compile IG via SUSHI + copy resources into the generated tree (do this FIRST)
npx tsc -b             # typecheck (project references; needs generated files present)
npm run lint           # eslint
npm run lint:css       # stylelint (design-token enforcement)
npm run check:tokens   # every var(--token) resolves to a real definition
npm run check:template # one header implementation, one owner of the page inset, one owner of the width
npm run check:prose    # the reading measure: --measure-prose is a character count, every cap declared
npm run check:ucum     # the UCUM shim is still safe: no quantities, and it still covers its callers
npm run check:fhir-r5  # the R5-model shim is still safe: every fhirVersion is "r4"
npm run check:crosswalk        # concept-crosswalk validation
npm run check:extract          # observation-extract validation
npm run check:core-boundary    # packages/core stays React-free and DOM-free
npm run check:guide-boundary   # the Adoption Guide holds no patient data (walks guide pages transitively)
npm run check:catalog          # tool-catalog wiring: stubs, UI metadata, ADs, questionnaire URLs both
                               # ways, per-AD licensing metadata, per-AD tool-id identifiers
npm run check:stages           # stage ids in population data vs the canonical FSH stage list
npm run check:pathway          # the pathway PlanDefinition's tier codes, stage codes and
                               # definitionCanonicals all resolve against the generated artifacts
npm run check:readers          # every observation mapper's answer reads vs the Questionnaire's
                               # declared item `type`
npm run check:careplan-readers # the sibling rule for carePlanMappers: does the nesting each reader
                               # walks match what the Questionnaire declares
npm run check:patients         # the 14 demo patients' demographics agree across all three sites
npm run check:scenarios        # scenario QRs vs their Questionnaire, plus every other resource bucket
npm run check:dates            # the scenario fixtures' clinical dates are coherent relative to their
                               # anchor (--check validates; --apply is the separate re-dating command)
npm run check:measures         # Stage-8 Measure criteria vs the measures.ts engine
npm run check:reassessment     # the per-tier reassessment cadence agrees across the PlanDefinition,
                               # the app and the CQL
npm test                       # vitest
```

⚠️ **A green `check:*` is not proof of coverage.** Each gate has a rule it
cannot see, and several were shipped in a form that passed a planted defect.
[`docs/internals/web-gates.md`](docs/internals/web-gates.md) has the per-gate
detail — read it before adding a gate, changing one, or concluding that
something is covered.

### External terminology (nightly, not in `verify`)

Needs a terminology server, so it cannot be offline-reproducible:

```
npm run check:codings    # every LOINC / SNOMED / terminology.hl7.org code+display literal in
                         # web/src and services/, checked against tx.fhir.org
```

⚠️ **`tx.fhir.org` is not the authority — Regenstrief is.**
`bash scripts/loinc-audit/loinc-audit.sh .` checks every LOINC coding in every
Questionnaire against `fhir.loinc.org`, which never lags a release. Run it when
you add codings and after a LOINC release. It is not a gate: it needs a personal
Regenstrief account.

Before adding a coding, touching the `PENDING_TX` allowlist, or reading a red
nightly, see [`docs/internals/terminology.md`](docs/internals/terminology.md) —
including why the per-source floors are load-bearing and why an allowlist entry
is built to expire. A red nightly has a written triage path in
[`docs/scheduled-checks-triage.md`](docs/scheduled-checks-triage.md).

### In `ig/`

The package is `fsh-sushi`, so a bare `npx sushi .` fetches the wrong thing and
fails in a fresh worktree:

```
npx fsh-sushi .        # compile FSH → fsh-generated/resources/
```

### At the repo root

```
node scripts/check-sushi-output.mjs   # compile ig/ and gate the WARNING SHAPE against a reasoned
                                      # allowlist (never a count); pass a path to gate a captured log
node scripts/check-ig-menu.mjs        # the IG menu and its prose restatement agree, and every
                                      # menu: target is also in pages: (only pages: renders a page)
node scripts/check-ig-narrative.mjs   # what the IG's prose may say, and whether what it points at
                                      # exists — no repo internals, TL ids / #/routes / .html resolve
node scripts/check-md-links.mjs       # every relative link in a tracked .md resolves (the ONLY gate
                                      # that triggers on docs/** or the root README.md)
node scripts/validate-fhir.mjs        # HL7 validator_cli over ig/fsh-generated/, FHIR-Resources/ and
                                      # the unwrapped scenarios (needs Java 17+; caches a ~190MB jar)
node scripts/check-fml.mjs --tx https://tx.fhir.org   # FHIR Mapping Language gate (same Java + jar;
                                      # --tx needs the network — the transform engine requires a tx server)
node scripts/build-use-case-workbook.mjs           # <id>.json → dist/*.xlsx + *.csv + <id>.md
node scripts/build-use-case-workbook.mjs --check   # gate, in use-case-workbook.yml
```

⚠️ **A clean SUSHI run is not a quiet one, and `sushi` does not validate
everything.** Five separate gates cover five different classes of problem, and a
clean SUSHI run implies none of the others — the IG Publisher alone catches
FHIRPath invariants, everything about the StructureMaps, and the CQL→ELM
translation. What each gate covers, why the publisher's CQL compile hangs on one
config line, and the two traps in running the publisher locally are in
[`docs/internals/ig-build.md`](docs/internals/ig-build.md).

⚠️ **A validator warning can mean "nothing was checked"** — an unresolvable
Questionnaire or profile degrades to a PASS. That, the FML parser's limits, the
rules shared with the mock EHR's write endpoint, and what each half of the
scenario gate does and does not cover are in
[`docs/internals/fhir-conformance.md`](docs/internals/fhir-conformance.md). Read
it before editing a scenario fixture, a mapper, or an `.fml` map.

⚠️ **Edit `docs/use-cases/ed-scenario-11.json`, never `docs/use-cases/dist/` and
never `ed-scenario-11.md`** — all three are outputs. A gap claim in that workbook
is a statement to the HL7 working group; see
[`docs/internals/docs-gates.md`](docs/internals/docs-gates.md).

### The two Workers — easy to forget, and CI gates both

`web/`'s `npm run verify` covers **neither**, and both import the web catalog, so
a change to `tool-ui-metadata.ts` or the population scenarios can break them with
`web/` green.

```
cd services/cds-hooks && npm install && npm run verify   # typecheck + eslint + vitest
cd services/mock-ehr  && npm install && npm run verify   # + check:host-css (no hex outside TOKENS,
                                                         # every var(--…) resolves)
```

⚠️ **The mock EHR is deliberately NOT styled like SPiER** — that is a demo claim,
not a preference. See [`docs/internals/workers.md`](docs/internals/workers.md).

### Measures

A measure criterion lives in **four** places and `check:measures` ties only two
of them together; nothing asserts the CQL and the TypeScript compute the same
answer. `denominator-exclusion` and `denominator-exception` are **not**
interchangeable. Before changing a criterion, a population, or the scoring, read
[`docs/internals/measures.md`](docs/internals/measures.md).

## Conventions

- **Design tokens only.** Vanilla CSS with custom properties. stylelint
  (`.stylelintrc.json`) rejects raw hex (`color-no-hex`) and enforces `var(--…)`
  for `color`, `background-color`, `border-color`, `fill`, `font-size`,
  `box-shadow`. Raw values are allowed only in `src/index.css` (token
  definitions). Class selectors must be kebab-case BEM.
  ⚠️ **stylelint checks that a token is *used*, never that it *exists*** —
  `npm run check:tokens` closes that half.
- **One page template.** Every route under the app shell renders into
  `.app-shell__body`, the **sole owner of the page inset** — never pad a page's
  own root. The title block is `components/PageHeader.tsx` (eyebrow → title →
  accent rule → optional lede), the only definition of page-title typography; a
  page never renders its own `<h2>`, so section headings start at `<h3>`. A
  drill-in page passes `up` to make the first eyebrow segment its way back out.
- **Width has one owner per route, and the owner is whoever owns the header.** A
  page that renders its own `<PageHeader>` declares a root width, and it is
  `--page-width-prose` or `--page-width-wide` — those two are the whole
  vocabulary. A page that *inherits* its header from a layout inherits the
  layout's width and declares none.
- **`--measure-prose` is not a third page width.** It caps a *text run*, and it
  is in `em` because a measure is a character count, not a width. Put it on
  prose, never on a page root. Cap the text, not the box, when the two are set in
  different type sizes.
  ⚠️ `check:prose` cannot see a prose run with **no** cap — that needs to know
  which elements hold long prose, which is content, not CSS. Measure a wide
  page's prose by hand after adding it.
  The rationale for all four of these, the gates' exact limits, and the drift
  each was written against are in
  [`docs/internals/css-and-page-template.md`](docs/internals/css-and-page-template.md).
- **`ehr-` no longer names the app's own chrome.** The standalone browsing chrome
  is `AppShell` / `.app-shell__*`. ⚠️ `.ehr-rubric`, `context-ehr-patient` and the
  `ehr` strings under `services/mock-ehr/` deliberately keep the prefix — they
  really are about EHR vendors, SMART scopes and host internals.
- **Routing:** `HashRouter` (see `web/src/main.tsx`) — GitHub Pages compatible.
- **Vite base path:** `/adoption-guide/` (see `web/vite.config.ts`). Don't hardcode absolute asset paths.
- **Never hand-edit generated output** — `packages/fhir-artifacts/generated/`,
  `ig/fsh-generated/`, `docs/use-cases/dist/`, `web/.runtime-fhir/`. To change
  FHIR shapes, edit FSH in `ig/input/fsh/`; to change a Questionnaire, edit the
  JSON in `FHIR-Resources/`.

## Gotchas

- **Fresh worktrees need `npm install`** in `web/` before any npm script runs.
- **`copy-fhir` is incremental, on a CONTENT fingerprint — not mtimes.** It
  skips the ~30s SUSHI compile when `.copy-fhir-manifest` in the generated tree
  still matches the SUSHI version, the hash of every input's content, and the
  hash of the tree it produced. All three must agree, so a touched-but-unchanged
  input costs nothing while a hand-edited or truncated artifact rebuilds. Every
  caller (`predev`, `prebuild`, `pretest`) runs it plain; only `verify` passes
  `--force`. If FHIR data looks stale, run `npm run copy-fhir -- --force` —
  that still means recompile unconditionally.
- **Generated files must exist before `tsc -b`.** On a clean checkout, run
  `npm run copy-fhir` first or the typecheck/build fails on missing imports.
- **One canonical URL, one definition.** `ig/` is canonical for CodeSystems and
  ValueSets; `FHIR-Resources/` holds Questionnaires and the few local CodeSystems
  with no FSH counterpart. Never define the same canonical URL in both trees —
  three ASQ CodeSystems did, and the `FHIR-Resources` copies silently shadowed
  the IG's with drifted `display` values.
- **Drift-prone hand-duplicated values.** Stage IDs, LOINC codes and ASQ
  disposition codes are duplicated by hand across `ig/input/fsh/` (canonical),
  `packages/core/src/lib/observationMappers/` and `packages/demo-population/src/`.
  When you change any such code, **grep the whole repo** for the old value and
  update every site.
- **The Stanley-Brown CarePlan transformation exists twice on purpose** — the
  `.fml` declares it, `carePlanMappers/stanleyBrown.ts` executes it in the demo,
  and both are compared against one golden file. Change the transformation and you
  must change both.
- **Tool licensing lives in the FSH, and only there.** Every ActivityDefinition
  carries `copyright` plus an `instrument-licensing-status` extension;
  `Tool.licensing` is *derived* from it. Do not reintroduce a `licensing` field in
  `tool-ui-metadata.ts`. A new tool with unsettled terms gets `#unknown`, not a
  permissive guess. **No status has been verified against the rights holder's
  *current* published terms** —
  [`docs/best-practices/licensing-verification-backlog.md`](docs/best-practices/licensing-verification-backlog.md)
  is the standing list of what is owed.
- **Tool ids live in the FSH too, as `ActivityDefinition.identifier`.** `tools.ts`
  **derives** the pairing; the hand-written map is deleted with no fallback, and
  `check:catalog` fails if it comes back. ⚠️ `TL-0NN` is not an AD id, and the
  mapping is many-to-one on purpose (the CAMS SSF-5 is one tool across four ADs).
  IG prose should link the AD page under the tool's *name*, not a bare id.
- ⚠️ **A huge `git status` in the ROOT checkout usually means the ref moved, not
  the files** — `git branch -f main origin/main` from a linked worktree updates
  the shared ref without touching the root's files or index, and the whole gap
  reports as *staged* changes nobody staged. **Diagnose from the reflogs before
  touching anything**: the wrong reading here is destructive, `git reset --hard`
  destroys the mtimes that date the divergence, and `git worktree remove` deletes
  the record of which session moved the ref. The three commands and the
  tree-hashing confirmation are in
  [`docs/internals/build-gotchas.md`](docs/internals/build-gotchas.md).
- **Two of `@formbox/renderer`'s dependencies are aliased to shims** in
  `vite.config.ts` (and therefore in vitest): `fhirpath/fhir-context/r5` → an
  empty object, `@lhncbc/ucum-lhc` → a throwing shim. Together they cut the
  assessment chunk 391 → 208 KB gzip. `check:fhir-r5` and `check:ucum` guard
  them; the shared alias reader **throws** on an alias form it cannot parse,
  because both gates treat "not aliased" as "nothing to guard" and pass. ⚠️ The
  aliases are anchored regexes in the array form — the object form matches by
  prefix and would swallow more than intended. Details in
  [`docs/internals/build-gotchas.md`](docs/internals/build-gotchas.md).

## Skills (`.claude/skills/`)

- **`assessment-to-ig`** — author the *full* FHIR artifact set for a new instrument (Questionnaire JSON + FSH ActivityDefinition/CodeSystems/ValueSets/example QuestionnaireResponse/Observation profiles + IG page + catalog wiring). Use when adding/FHIR-ifying an instrument.
- **`fhir-questionnaire-quality`** — review/improve a *single* FHIR R4 Questionnaire (or its QuestionnaireResponse/Observation contract) for interoperability. Use for scoped review of one form.
- **`concept-harmonization`** — the cross-instrument concept layer: shared risk-tier CodeSystems/ValueSets, ConceptMaps/StructureMaps, and derived Observations that let disparate tools map into one actionable representation. Use for translation/crosswalk work spanning instruments.
