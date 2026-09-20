# Repo layout: why each tree is where it is

`CLAUDE.md` lists the trees and states each one's rule in a line. This file
holds what those lines used to carry inline: the move that put each tree
where it is, the defect the move closed, and the thing a tidy-minded reader
will be tempted to put back. Every ⚠️ below is a defect that shipped. See
[`README.md`](README.md).

## `ig/input/resources/questionnaires/` — the hand-authored resources

Rules and history in [`ig-build.md`](ig-build.md) § *The hand-authored
Questionnaires*: the folders hold resource JSON and nothing else, every
resource's `id` equals its canonical's last segment, and the tree lived outside
`ig/` (as `FHIR-Resources/`, reached through a symlink and a hand-kept
per-folder list) until 2026-09-19. `docs/instruments/<Tool>/` is where
everything that is *not* a resource lives, and that separation is what lets
the single recursive `path-resource` entry work.

## `packages/core/` — the React-free domain layer (#389)

Consumed as `@spier/core/<path>` by both apps and the Workers that need it;
none of them has a deep import into an app tree. Its tests live **beside their
subject**, under `packages/core/src` — `packages/core/tsconfig.json` is a
`composite` project referenced from the root `tsconfig.json`, and the root
`vitest.config.ts`'s extended `test.include` is what reaches them. Still one
`npm run verify` and one `npx tsc -b`; no fourth pipeline.
`scripts/check-core-boundary.mjs` is what keeps it React-free and DOM-free.

## `packages/ui/` — the design system

The eight surface primitives, `cx`, and `foundation.css` (the `:root` token
block and global resets, formerly `web/src/index.css`). Consumed as
`@spier/ui/<name>`; a referenced composite project like `core`, its tests run
under the root vitest.

⚠️ **`WorkflowForm` is deliberately NOT here**: it reads `usePatient()`, so
moving it would invert the dependency. See `packages/ui/README.md`.

## `packages/tool-views/` — the 29 views, once

The 18 instrument fillers and 11 workflow recorders, defined ONCE, plus the
three contexts they read (`InspectContext`, `PatientContext`,
`PresentationContext` + `PresentationProvider`) and the frames around them
(`WorkflowForm`, `QuestionnaireView`, `CarePlanDisplay`, `FhirJsonViewer`,
`CodeDrawer`). Consumed as `@spier/tool-views/<path>`.

⚠️ **The contexts live here and that is what makes the package possible** —
`packages/ui` could not take `WorkflowForm` because it reads `usePatient()` and
ui knows nothing about patients; this package owns both sides, so nothing is
inverted. The *providers* (`PatientProvider`, `SmartProvider`,
`ToolConfigProvider`) stay in the app: a provider decides where data comes
from, which is an application's decision.

⚠️ **No `IS_DEMO` in here, ever.** A view renders the same for a clinician and
an implementer; what differs is `InspectContext`, which the app turns on for
`/guide`. See `packages/tool-views/README.md` and
[`surfaces-and-routing.md`](surfaces-and-routing.md).

## `packages/app-shell/` — the runtime both apps mount

The SMART plumbing (`SmartLaunch`, `SmartRedirect`, `SmartProvider`), the
providers (`PatientProvider`), the patient/data seam (`localDataSource`,
`usePatientSlice`, `useActivePatientId`), `FhircastListener`, `PathwayView` and
the chrome-agnostic bits (`PatientBanner`, `PatientIdentityStrip`,
`SpierLogo`). Consumed as `@spier/app-shell/<path>`. Extracted 2026-09-19
ahead of the `apps/{guide,clinical}` split.

⚠️ **A third package rather than one app importing the other, and the reason
is distribution** — the SMART apps are open-sourced and the mock EHR is not, so
`apps/clinical` must not depend on `apps/guide`'s tree.

⚠️ **The pages, `Sidebar`, `Shell`, `AppShell`, `PanelShell` and `LaunchShell`
are deliberately NOT here.** They are runtime too, but they are the chrome the
`apps/` split (#552) divided into two: `apps/guide` has its own `Sidebar` and
`AppShell`, `apps/clinical` has its own `Sidebar`, `Shell`, `PanelShell` and
`LaunchShell`, genuinely different implementations now rather than one
`IS_DEMO`-branching copy — so there is nothing left in common to extract here.

⚠️ **`fhirclient` is imported here and in `packages/core` it is not.** The SMART
components run the OAuth dance (`import FHIR from 'fhirclient/browser'`); core
consumes an authorized client through **`@spier/core/types/smartClient`**, a
surface this repo declares rather than importing — fhirclient 3 ships
declarations that reference a module its tarball omits, which `skipLibCheck`
turns into a silent `any`. The four alias/tsconfig entries this line used to
name are all deleted: v3 is exports-only, and a prefix alias resolves ahead of
an export map. See `packages/app-shell/README.md`.

## `packages/worker-http/`, `packages/worker-tooling/`

The shared *code* two asset hosts run, and the shared *toolchain* all four
Workers build with. Both are described, with their gates, in
[`workers.md`](workers.md).

## `packages/demo-population/`, `packages/fhir-artifacts/`

The 14 demo patients + scenario slices (#388), and SUSHI's output
(`generated/`, gitignored, #392). Neither app bundles the population — see
[`surfaces-and-routing.md`](surfaces-and-routing.md) § *Two build surfaces*.

## `apps/guide/` and `apps/clinical/`

The Adoption Guide, served by `services/guide`, and the two SMART apps, served
by `services/clinical` and framed by the mock EHR.

⚠️ **The guide carries no patient data and no data source** — its fillers write
into an unseeded local store, which is the blank "play with forms" state. The
chart experience belongs to the mock EHR. `check:guide-boundary` walks the
guide's pages transitively to hold that.

⚠️ **Two route tables, and `IS_DEMO` is GONE.** One `App.tsx` used to serve
both surfaces with `IS_DEMO ?` folding the other's pages out at build time;
`web/src/lib/surface.ts` is deleted. `VITE_SURFACE` survives as a build
**target** — which `index.html` vite starts from — read only by
`vite.config.ts`. `check:tool-view-routes` reads EVERY app's table and holds
them to the one tool-view definition.

## The repo root is the tooling host

⚠️ **`web/` is gone** (2026-09-19). `package.json`, the only `node_modules`
(#387 — no npm workspaces), the vite/vitest/eslint/stylelint configs, every
`tsconfig`, `public/`, `tests/` and `shims/` all live at the root, and
`web/scripts/` merged into the existing root `scripts/` (the two trees had
**no** filename collisions, including their two `lib/` directories). One
install and one config now serve both apps and all the packages, which is
what `web/` existed to provide and what an app-local config could not — an app
directory has no install under it.

⚠️ **There is no root `src/`, deliberately.** The obvious move — `web/src`
becomes `src/` — was made and then reverted: `check-md-paths.mjs` derives its
repo-rooted prefixes from the tracked tree's top-level names, so a top-level
`src` makes every package-relative `` `src/auth.ts` `` in a service README
resolve against the ROOT and fail. The two names that replaced it cannot
collide that way:

- `tests/` — the handful of cross-package tests (the rest live beside their
  subject, under each package).
- `shims/` — the two vite shims and `vite-env.d.ts`, aliased from
  `vite.config.ts` and gated by `check:ucum` / `check:fhir-r5`.

⚠️ Neither holds an entry module, so `APP_ROOTS` still names only the two apps
— the filesystem rule in `scripts/lib/app-roots.mjs` reaches that on its own
rather than being told.

⚠️ **`eslint .` got WIDER at the hoist and that is deliberate.** It ran from
`web/`, so `.` was web's own tree and every app and package went unlinted; from
the root it reaches them, and `eslint.config.js` now carries the ignore list
that draws the line (the four Workers lint themselves, all through
`packages/worker-tooling/eslint.mjs`). It found two real defects on first run
— see `packages/app-shell/src/context/PatientProvider.tsx`.

The apps consume generated FHIR JSON copied into
`packages/fhir-artifacts/generated/` by `scripts/copy-fhir.mjs`, and
Questionnaires imported from `ig/input/resources/questionnaires/` through
`packages/core/src/data/questionnaires.ts`, the single owner of those import
paths.
