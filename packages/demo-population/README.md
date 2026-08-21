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
**declared alias** rather than by package name resolution. Four places must agree,
and each is commented as such:

| Consumer | Where the alias lives |
|---|---|
| `web` app + build | `web/vite.config.ts` |
| `web` tests | `web/vitest.config.ts` — **separately**, see below |
| `web` typecheck | `web/tsconfig.app.json` `paths` |
| `services/cds-hooks` | its `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` |
| `services/mock-ehr` | its `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` |
| Node scripts (gates, root tooling) | plain `fs` paths — no alias involved |

⚠️ **`web/vitest.config.ts` does NOT inherit `web/vite.config.ts`.** It is its own
`defineConfig` with no `mergeConfig`, so a Vite alias is invisible to the test run.
This was verified rather than assumed: under vitest, `@lhncbc/ucum-lhc` resolves to
the real library (`Ucum, UcumLhcUtils, UnitTables`), not the shim (`UcumLhcUtils`
plus a default) — so `vite.config.ts`'s own claim that "both apply to vitest too"
was wrong, and is corrected in that file. **Any alias this package needs must be
written in both.**

`package.json` here declares `exports` even though nothing resolves it yet. It
documents the intended surface and is what the deferred workspaces migration will
switch to.

## ⚠️ Two type-only edges back into the app

`patients.ts` imports `PopulationPatient` and `scenarios/index.ts` imports
`PatientSlice` / `ScenarioEncounter` from `web/src`. Both are `import type`, so
they are **erased at build time and create no runtime dependency** — but they are
still the wrong direction, and they are not hidden:

- `PopulationPatient` is an alias of `RegistryPatient` in `web/src/lib/registry`
- `PatientSlice` / `ScenarioEncounter` live in `web/src/types/fhir`

§4 of the plan assigns **both** modules to `packages/core`, so step B
([#389](https://github.com/SPiER-Project/adoption-guide/issues/389)) closes both
edges. Do not add a second alias for app internals to paper over them — that would
make the inverted direction look sanctioned.

## The gates that read this directory

Five in `web/scripts` and two at the repo root, all by `fs` path rather than by
import, plus two workflow path filters. They are listed on #388. **If you move
anything here, plant each gate's defect and watch it go red** — a script pointed at
a directory that no longer exists reports green, not red, and this repo has six
catalogued instances of exactly that.
