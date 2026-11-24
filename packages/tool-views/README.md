# `@spier/tool-views` — the 29 tool views, and the contexts they read

The 18 instrument fillers and 11 workflow recorders, **defined once**, plus the
three React contexts they consume.

## Why this is a package

CLAUDE.md has always carried the rule:

> The 18 fillers and 11 recorders are ONE element definition, rendered by two
> route families … They must stay one definition — two copies drift on a
> `persistName` and the guide then documents a resource the app does not write.

That was enforced by `toolViews.test.ts`, which sat beside the map and read
`../App.tsx` by relative path. Both of its premises are going away. The
[`apps/` split](../../docs/plans/repo-and-package-boundaries.md) turns one route
table into one per app, and a rule stated as *"these two files agree"* cannot
express *"this one definition serves every app"*.

So the map became a package boundary, and the rule became a gate —
`npm run check:tool-view-routes` — which iterates the declared app roots and
checks every route table against this one map, both ways. A second app's routes
are checked the day that app exists.

## What is in here, and what is deliberately not

**In:** the 29 views; `WorkflowForm` (the recorder frame) and `QuestionnaireView`
(the filler frame); `CarePlanDisplay`, `FhirJsonViewer` and `CodeDrawer`;
`InstrumentHeader` and `RiskPill`; `InspectContext`, `PatientContext` and
`PresentationContext` with `PresentationProvider`; and the four helpers the views
share (`dates`, `launchStage`, `statusIcons`, `toggleCode`) and the `InclusionBadge` both apps render.

**Out since 2026-09-20:** `lethalMeans.ts`, the TL-008 Procedure/Observation builder,
which was the one FHIR builder outside `packages/core` — invisible to
`check:core-boundary` there, and carrying its own copies of `stageTag`,
`displayFor` and `effectiveOf`. It is `packages/core/src/lib/lethalMeans.ts` now,
and `LethalMeansCounselingView` imports it like every other recorder imports its
builder.

**⚠️ The contexts are in here on purpose, and it is what makes the package
possible at all.** `packages/ui/README.md` records why `WorkflowForm` could not
join the design system: *"it reads `usePatient()`, so moving it would invert the
dependency."* That is true of `packages/ui`, which knows nothing about patients.
It is not true here — this package owns **both** sides, the context and its
consumers, so nothing is inverted.

**Out:** `PatientProvider`, `SmartProvider` and `ToolConfigProvider` stay in the
app. A provider decides where data comes from — fixtures, a SMART session, a
preset — and that is an application's decision, not a view's. The app supplies
the context; this package defines its shape and reads it.

Also out: anything surface-specific. There is no `IS_DEMO` in here and there
must not be. A view renders the same for a clinician and for an implementer;
what differs is `InspectContext`, which the *app* turns on for `/guide` and
leaves off everywhere else. That is the whole mechanism behind *"the
clinician-facing app shows no raw FHIR; the guide does"*, and it works precisely
because it is one component reading a context rather than two components.

## Depends on

`@spier/core` (the React-free domain layer), `@spier/ui` (the surface
primitives), `@formbox/renderer` + `@formbox/hs-theme`, React and
`react-router-dom`. **Nothing else** — no demo population, no data source, no
page, no app.

## Build wiring you will trip over

Like `packages/core` and `packages/ui`, this is a **referenced composite
project** with no `node_modules` of its own (#387), and that has three
consequences:

1. **`tsconfig.json`'s most important job is `jsx`.** esbuild finds a tsconfig by
   walking up from the FILE; from here that walk reaches the repo root and never
   sees `tsconfig.app.json`. Without a config here that extends
   `tsconfig.base.json`, where `jsx` is set, the views compile to the classic
   JSX runtime and die with "React is not defined" while `tsc` stays green.
2. **A bare dependency needs no alias and no `paths` entry.** Since 2026-11-24
   neither the vite configs nor any tsconfig maps a dependency into
   `node_modules`: ordinary resolution reaches the root install from here. Only
   the `@spier/*` packages are aliased, in `vite.config.ts` AND
   `vitest.config.ts`.
3. **`vitest.config.ts`'s `test.include` must name this package**, or its
   colocated tests silently do not run and `verify` stays green. That is not
   hypothetical — `packages/ui`'s `Button.test.tsx` executed zero times for a
   whole commit.
