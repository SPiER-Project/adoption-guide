# `@spier/demo-population`

The 14 synthetic demo patients and their scenario slices. Step **A** of the repo
reshape ([#388](https://github.com/SPiER-Project/adoption-guide/issues/388), under
[#386](https://github.com/SPiER-Project/adoption-guide/issues/386)).

## Why it is not in the adoption guide any more

It was `web/src/data/population/`, which made the demo fixtures look like they
belonged to one consumer. They never did —
[`docs/plans/repo-and-package-boundaries.md`](../../docs/plans/repo-and-package-boundaries.md)
§9.3 counted the real consumers, and **nothing in the adoption guide has a durable
claim on them**: the chart-side consumers go with the chart, `PopulationView` is
being deprecated, both Workers already import them, and `validate-fhir.mjs` and
`build-use-case-workbook.mjs` are repo-root tooling rather than "the guide".

It is deliberately **not** in `services/mock-ehr/`: while the guide still has a
chart, that would make the product import from the demo host.

## How it is consumed

There is no npm workspace yet ([#387](https://github.com/SPiER-Project/adoption-guide/issues/387)
records the decision and the deferred workspaces migration), so this resolves by
**declared alias** rather than by package name resolution. Five places must agree,
and each is commented as such:

| Consumer | Where the alias lives |
|---|---|
| the two apps' build (repo root) | `vite.config.ts` |
| the two apps' tests | `vitest.config.ts` — **separately**, see below |
| the two apps' typecheck | `tsconfig.app.json` `paths` |
| the four `services/*` Workers | `packages/worker-tooling/aliases.mjs` (Vite + Vitest) and `packages/worker-tooling/tsconfig.worker.json` — once, gated by `scripts/check-service-toolchain.mjs` |
| Node scripts (gates, root tooling) | plain `fs` paths — no alias involved |

⚠️ **`vitest.config.ts` does NOT inherit `vite.config.ts`.** It is its own
`defineConfig` with no `mergeConfig`, so a Vite alias is invisible to the test run.
This was verified rather than assumed: under vitest, `@lhncbc/ucum-lhc` resolves to
the real library (`Ucum, UcumLhcUtils, UnitTables`), not the shim (`UcumLhcUtils`
plus a default) — so `vite.config.ts`'s own claim that "both apply to vitest too"
was wrong, and is corrected in that file. **Any alias this package needs must be
written in both.**

`package.json` here declares `exports` even though nothing resolves it yet. It
documents the intended surface and is what the deferred workspaces migration will
switch to.

## Two type-only edges, both into `packages/core`

`patients.ts` imports `PopulationPatient` and `scenarios/index.ts` imports
`PatientSlice` / `ScenarioEncounter` — both `import type`, so they are **erased
at build time and create no runtime dependency**:

- `PopulationPatient` is an alias of `RegistryPatient` in `packages/core/src/lib/registry.ts`
- `PatientSlice` / `ScenarioEncounter` live in `packages/core/src/types/fhir.ts`

Until step B ([#389](https://github.com/SPiER-Project/adoption-guide/issues/389))
both edges pointed back into the app's own source tree, the wrong direction; §4 of
the plan moved both modules to `packages/core`, which closed them. Do not add an
alias for app internals here — that would make an inverted direction look sanctioned.

## Dated at an anchor, served as of today

Every scenario is dated against `SCENARIO_ANCHOR` (`src/scenarioDates.ts`), and
the files stay that way. Both Workers serve them through
`populationScenariosAsOf(today)` — every date moved by the whole UTC days since
the anchor — so each patient shows the same reassessment state on any day. Read
statically on the real clock, the population drifted a day a day: two months
after the last re-date, every scheduled patient read overdue by about the two
months.

**Serve the `AsOf` view, never `POPULATION_SCENARIOS`.** The static export is
the files as authored: right for the gates and the structural tests, wrong for
anything a client reads. A date written into prose cannot be moved by the shift,
so `check:dates` fails one. Why the data moves rather than the apps' clock is in
the header of `src/scenarioDates.ts`.

## The gates that read this directory

Five in `scripts` and two at the repo root, all by `fs` path rather than by
import, plus two workflow path filters. They are listed on #388. **If you move
anything here, plant each gate's defect and watch it go red** — a script pointed at
a directory that no longer exists reports green, not red, and this repo has six
catalogued instances of exactly that.
