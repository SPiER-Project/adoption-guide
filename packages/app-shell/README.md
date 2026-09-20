# `packages/app-shell` — the runtime both apps mount

The SMART plumbing, the providers, the patient/data seam, and the handful of
components that are neither guide nor clinical: everything `App.tsx` imports
**statically** and therefore everything both surfaces carry.

Extracted 2026-09-19, ahead of the `apps/{guide,clinical}` split
([`docs/plans/repo-and-package-boundaries.md`](../../docs/plans/repo-and-package-boundaries.md)
decision 3). On its own it changes no behaviour — it is the step that makes the
split a move rather than a rewrite.

## Why a third package, and not one app importing the other

⚠️ **Because of what reopened the split: distribution.** The SMART apps are to
be open-sourced and the mock EHR is not, so `apps/clinical` must not depend on
`apps/guide`'s tree — an import in that direction would drag the adoption guide
into the published distribution, which is the boundary the whole exercise
exists to draw. A package both apps depend on is the only arrangement where
neither app knows about the other.

## What is in here, measured

The contents were not chosen by taste. Walking the import graph from the two
page sets on `main` gave a clean three-way split — 18 files reachable only from
guide pages, 27 only from clinical pages, 23 reachable only from `App.tsx`'s
static imports, and seven crossing. This package is that third group plus the
crossings:

| Crossing | Why it crossed | Resolution |
|---|---|---|
| `PathwayView`, `usePathway` | `CarePathway` (guide) **and** `PathwayProtocol` (clinical) | here — genuinely both, by explicit design |
| `useScrollToHash`, `useLocalStorage`, `riskLabel` | reached through runtime components | here |
| `localDataSource` | `PatientProvider` **and** `PopulationView` | here — see the seam below |
| `guideSections`, `surfaces` | **only** `Sidebar.tsx` | NOT here — they become genuinely guide-only when the sidebar splits |
| `ToolConfigContext`, `toolPresets` | `ToolConfigProvider` is mounted globally, but **every consumer** is clinical | NOT here — the guide simply will not mount that provider |

## What is deliberately NOT here

- **Pages.** Every page belongs to exactly one app.
- **The three contexts the tool views read.** `InspectContext`,
  `PatientContext` and `PresentationContext` live in
  [`packages/tool-views`](../tool-views/README.md), which owns both the views
  and what they read. This package holds the *providers*; that split is what
  keeps the dependency pointing one way.
- **`Sidebar`, `Shell`, `AppShell`, `PanelShell`, `LaunchShell`.** They are
  runtime, but they are the chrome the `apps/` split (#552) divided into two:
  `apps/guide` has its own `Sidebar` and `AppShell`, `apps/clinical` has its own
  `Sidebar`, `Shell`, `PanelShell` and `LaunchShell` — genuinely different
  implementations now, not one `IS_DEMO`-branching copy, so there is nothing
  left in common to move here.

## Traps

⚠️ **`tsconfig.json`'s most important job is `jsx`, and not for `tsc`.** esbuild
— what vite and vitest actually transform `.tsx` with — finds a tsconfig by
walking up from the FILE. From `packages/app-shell/src` that walk reaches the
repo root and never sees `tsconfig.app.json`, so without `"jsx":
"react-jsx"` here every component compiles to the classic runtime and dies with
"React is not defined" **while `tsc` stays green**. `packages/ui` and
`packages/tool-views` both record the same thing.

⚠️ **`fhirclient` is imported BARE here, and that needed four new declarations.**
`SmartLaunch`, `SmartRedirect` and `SmartProvider` do `import FHIR from
'fhirclient'`; `packages/core` only ever reaches `fhirclient/lib/Client`, so no
bare entry existed. From `web/src` a bare specifier resolved by walking up into
`node_modules`; from here that walk finds nothing (no npm workspaces, #387).
It is now aliased in `vite.config.ts` **and** `vitest.config.ts`, and
mapped in this package's `tsconfig.json` **and** `tsconfig.app.json` — the
last because these files enter the app project's program through the
`@spier/app-shell/*` path mapping.

⚠️ **One TS2307 cascades.** Before that bare mapping existed, the unresolved
`fhirclient` also produced six unrelated-looking errors in `web/src` tests —
`Cannot find module 'node:fs'`, `Cannot find name '__dirname'`. They were noise
from the single failed resolution and vanished with it. Fixing them
individually would have meant adding `@types/node` to a project that does not
need it.

⚠️ **The demo-fixture seam is still here, in `localDataSource`.** It imports
`@spier/demo-population` to **seed** patients, and has an `EMPTY_SLICE` path for
a patient with no scenario. That single import is the whole reason a
build-surface concept survives this package; retiring it is the
`apps/{guide,clinical}` step, where the guide gets an unseeded store and drops
the fixtures entirely.

⚠️ **Gate exemption keys are repo-relative, so they moved with the files.**
`check-prose-measure.mjs`'s `NON_PROSE` and `check-fhir-render.mjs`'s
`NOT_A_RESOURCE_VIEW` both key on the path; both gates flagged their own stale
entries during this extraction rather than passing over them, which is the
intended behaviour and worth not "fixing".

⚠️ **Two gates read a file in here by path**, because `appRoot()` answers only
for *app* trees and this is not one: `check-catalog-integrity.mjs`
(`SmartRedirect.tsx`, for the post-launch landing routes) and
`check-population-patients.mjs` (`PatientProvider.tsx`). They use `REPO_ROOT`.
