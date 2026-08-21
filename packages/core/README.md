# `@spier/core`

The React-free domain layer: FHIR types, the tool catalog, the instrument and
care-plan mappers, the `FhirDataSource` seam, the pathway / registry / measure
logic, CDS Hooks and FHIRcast. Step **B** of the repo reshape
([#389](https://github.com/SPiER-Project/adoption-guide/issues/389), under
[#386](https://github.com/SPiER-Project/adoption-guide/issues/386)).

## Why it exists

It was `web/src/lib/`, `web/src/types/` and `web/src/data/catalog/` — so the two
Cloudflare Workers reached into an application's source tree with **21 deep
`../../../web/src/…` imports**, and nothing said which direction was allowed.
Those are now `@spier/core/…`, and the count is **zero**.

The point is not tidiness. It is that the independence from the app becomes
*enforceable*: `npm run check:core-boundary` (in web's `verify`, so CI runs it)
fails on a React import, a `.tsx` file, or an unguarded DOM global.

## What it may not do, and the one exception

React, `react-dom`, `react-router` — never. `window`, `document`,
`localStorage`, `sessionStorage`, `navigator`, `BroadcastChannel`,
`HTMLElement` — not **unguarded**.

⚠️ **A feature-detected browser API is allowed, and that is deliberate rather
than a loophole.** `lib/fhircast.ts` reaches for `BroadcastChannel` only behind
`typeof BroadcastChannel === 'undefined'`, which is exactly how a module shared
with a Worker should treat a browser-only API — the Workers import `MRN_SYSTEM`
and the protocol types from it and never execute the transport. The gate requires
the guard to be in the same file as the use.

`alert` is deliberately **not** on the forbidden list: `RiskAlert` values are
named `alert` throughout the mappers, so `alert.interpretation` is a local
property access. The gate flagged 16 of those on its first run, and a rule that
cries wolf on the domain vocabulary gets switched off.

## How it is consumed

There is no npm workspace yet
([#387](https://github.com/SPiER-Project/adoption-guide/issues/387)), so this
resolves by **declared alias** — `@spier/core/<path>`, mirroring this package's
own structure. Nine sites must agree, and each is commented:

| Consumer | Where |
|---|---|
| `web` | `vite.config.ts`, `vitest.config.ts`, `tsconfig.app.json` |
| `services/cds-hooks` | `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` |
| `services/mock-ehr` | `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` |

⚠️ `web/vitest.config.ts` does **not** inherit `web/vite.config.ts` — see
[`../demo-population/README.md`](../demo-population/README.md), where that was
measured. Every alias is written in both.

⚠️ **`import.meta.glob` cannot use an alias**, so the five runtime globs onto
`packages/fhir-artifacts/generated/` are relative. They are one hop shorter than
they were in `web/src`, because `fhir-artifacts` is now a sibling.

## Two things that are NOT here

- **The tests.** They stayed in `web/src/**/*.test.ts` and import
  `@spier/core/…`, so `web`'s `verify` still covers this package. Moving them
  would mean a fourth `verify` pipeline for a package with no build — a
  deliberate deferral, not an oversight. **When editing a module here, its test
  is in the mirrored path under `web/src`.**
- **`fhir-resource-rules.mjs` is here but not under `src/`.** It is plain ESM
  with a hand-written `.d.mts`, imported by a Node CLI gate
  (`web/scripts/check-scenario-resources.mjs`) *and* by the mock EHR's write
  endpoint — the single opinion on whether a FHIR resource is valid. It sits at
  the package root because it is not part of the TypeScript source tree and must
  stay importable from a bare `node scripts/…` with nothing compiled.

## The edge that closed

`packages/demo-population` used to carry two type-only imports back into the app
(`PopulationPatient`, `PatientSlice`/`ScenarioEncounter`). Both targets — 
`lib/registry` and `types/fhir` — now live here, so that package **no longer
references the app at all**.
