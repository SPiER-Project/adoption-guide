# `apps/guide` — the Adoption Guide

The case for the pathway, the published artifacts, the Data Dictionary, the
adoption rubric, and a playground for every instrument. Served by
`services/cds-hooks`, which also serves the rendered IG at `/ig/`.

Built with `npm run build` from the repo root; the output is `dist`.

## It holds no patient data, and that is structural

No module here imports `@spier/demo-population`, and `npm run check:surface`
asserts the 14 synthetic patients are in **neither** bundle. The instrument
fillers write into an **unseeded** `LocalDataSource` — the blank "play with
forms" state — which is what lets a tool be tried with nothing running.

⚠️ **The chart experience is the mock EHR's**, not a demo screen here. The
sidebar's "Try it" zone has always made that the primary call to action; since
2026-09-19 the SMART-app pages are not registered on this build at all, so
`/patient/record` falls to the catch-all and lands on the front door.

⚠️ Three patients ARE named, in `data/surfaces.ts` — `DEMO_CHART_PICKS` tells a
reader which chart to open in the host to see a pathway from zero, one
part-way through, and one finished. They are hand-typed prose about the demo's
three scenarios; no fixture travels with them, and `check:surface` allows
exactly those three by name.

## What is here that looks like it should be shared

- **`components/AppShell.tsx`** — the browsing chrome. `apps/clinical` has
  `LaunchShell` and `PanelShell` instead and never renders this one, which is
  why the `Shell` chooser stayed with the clinical app rather than moving to a
  package.
- **`components/Sidebar.tsx`** — the implementer's navigation. The clinical app
  has its own, four destinations long. ⚠️ Splitting this is what let
  `data/guideSections.ts` and `data/surfaces.ts` become genuinely guide-only;
  while one component held both navigations they read as shared code.

## Traps

⚠️ **`tsconfig.json` must set `jsx: "react-jsx"`.** esbuild finds a tsconfig by
walking up from the FILE, and from here that walk reaches the repo root without
passing the root tooling. Every package in this repo records the same thing.

⚠️ **Dependencies resolve by alias, not by walk-up** (#387 — no npm
workspaces): React, `react-router-dom`, `lucide-react`, `fhirclient` and
`@formbox/*` are aliased in `vite.config.ts` and `vitest.config.ts`,
and mapped in this tsconfig. ⚠️ `@formbox/hs-theme/style.css` needs its own
**anchored exact** entry — a prefix alias would rewrite the path before Vite
consulted the package's `exports` map.

⚠️ **A guide page must be declared in `data/guideSections.ts`.** Both
`check:guide-boundary` and `check:catalog` derive the guide's page set from that
file; a route under `/guide` it does not name is walked by nothing.
`/guide/tools/:slug/try` is the deliberate exception — it renders recorders that
write to patient context, so it is not a guide page and the boundary gate's
premise does not hold for it.
