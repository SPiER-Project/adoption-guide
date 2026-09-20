# Surfaces and routing: what each surface may hold, and how the routes prove it

The Adoption Guide explains; the mock EHR holds patients and launches; the two
SMART apps are what gets launched. `CLAUDE.md` states those divisions as
rules. This file holds the decisions behind them, the dates they were settled,
and what each gate over them can and cannot see. Every ⚠️ below is a defect
that shipped. See [`README.md`](README.md).

## The guide does not configure (settled 2026-09-15)

The Adoption Guide's "Configure" group is gone, and with it the last guide
section that wrote state another surface read. Tool Configuration lives at
**`/settings`**, a page of the SMART app — which instruments a deployment
offers is a fact about SPiER's own deployment, not about the EHR (the EHR never
sees the tool catalog; its `/metadata` capability profile is the different,
genuinely EHR-side fact). CDS Service stayed in the guide: it configures
nothing, and it is the third thing that runs the pathway beside the two apps —
which is the group it is in since 2026-09-17.

⚠️ **`/settings` still does nothing in panel chrome**, and that is load-bearing
rather than unfinished — `apps/clinical/src/lib/toolEnablement.ts` has the four
reasons, one of which the "Configure" move retired. Read it before wiring the
preset into the panel.

## The guide's sidebar has three groups, and they are a claim about kind

`GUIDE_GROUPS` (`apps/guide/src/data/guideSections.ts`) is **The standard**
(Care Pathway, Tools, Data Dictionary — published artifacts and the contract
over them), **The applications** (Provider App, Population Dashboard, CDS
Service — the three things that run it) and **Evaluate** (Adoption Rubric).
`GUIDE_SECTIONS` must stay **grouped-contiguous** in that order, because the
pager walks it linearly; `guideSections.test.ts` pins that, plus the
subsection rules below.

⚠️ **A page under `/guide` that is not in that file is checked by nothing** —
`check:guide-boundary` and `check:catalog` both derive from it. A page that is
reachable but should not be a sidebar row or a pager step is declared as a
**`subsections` entry** on its owning section, whose `path` is the FULL
sub-path (`tools/readiness`, never `readiness`) because both gates build
`/guide/${path}`. Adoption Readiness is the one that exists: it renders one row
per catalogued instrument entirely from the catalog, so it is a view of Tools
rather than a peer of it.

## The guide explains and hosts; the mock EHR holds and launches (2026-09-09)

`/patient/chart` and `/population` are **redirects to guide pages that explain
the two SMART apps** (`/guide/provider-app`, `/guide/dashboard`); the apps
themselves answer on `/patient/record` and `/population/caseload`. See
[`docs/plans/embedded-panel-smart-launch.md`](../plans/embedded-panel-smart-launch.md)
§6.3, *"The explainer is the page, and the app is a launch"*.

⚠️ **An explainer is a `guideSections.ts` entry, and that is load-bearing** —
`check:guide-boundary` derives the guide's page set from that list, so "an
explainer holds no patient data" is gated rather than merely intended. A
hand-rolled route outside the list would be unchecked.

⚠️ **Renaming either app route needs the redirects too.** `check:catalog`
covers the catalog's launch paths, the panel's landing route, and (since
2026-09-15) every redirect's target — so a rename that strands a `<Navigate>`
now fails. What still nothing can see is a path that *resolves* but now lands
on the explainer rather than the app — that class needs a grep.

## A shared view holds no route literal; the app supplies its links (2026-09-20)

⚠️ **The apps split made every guide link into the clinical app dead, and the
grep above was pointed at one surface.** `check:surface-links` walked only
`apps/clinical`; on the guide, 33 launch buttons, 34 readiness rows, "View in
chart" after every submit, the recorders' cross-links, the try page's up-link
and seven redirects all fell to the catch-all and landed on the Overview,
silently, for a day. Found by the adoption-guide UX audit
([`docs/plans/adoption-guide-ux-audit-2026-09-20.md`](../plans/adoption-guide-ux-audit-2026-09-20.md) §1.1).

The rule that came out of it: **a view rendered by both apps holds no route
literal.** `SurfaceLinksContext`
(`packages/tool-views/src/context/SurfaceLinksContext.ts`) carries the parent
page, the chart, the registry and a slug → route function; `apps/clinical`
provides its own (`apps/clinical/src/surfaceLinks.ts`, routes read from the
catalog's launch paths) and the guide provides its own
(`apps/guide/src/data/surfaceLinks.ts`: Tools as parent, no chart, no registry,
`/guide/tools/<slug>/try` for a tool). The hook **throws** outside a provider —
a default would have to name one surface's routes, which is the defect in a
different file. A recorder links another view with `<LaunchLink slug="…">`,
and renders plain text where the surface has no route for it.

- On the guide, "launch" means the guide's own try route; the clinician's
  launch is the Demo EHR's to offer, and the Tools page says so with one
  outbound button.
- A published path whose home is now the other app is a **cross-origin hop**
  (`apps/guide/src/components/ClinicalRedirect.tsx`, origin from
  `deploy-origins.json`), never a `<Navigate>` — the router cannot reach
  another origin, and a `<Navigate>` into it resolves to the catch-all.
- `check:surface-links` walks **both** apps against their own tables and reads
  the `…href:`/`…Href:` property form, which is where each app's `SurfaceLinks`
  literals sit. It cannot see a computed target, and the guide's try route is
  one; `check:tool-view-routes` pins those slugs instead.

## The clinician-facing app shows no raw FHIR; the guide does

One invariant, one gate point: `InspectContext`
(`packages/tool-views/src/context/InspectContext.ts`) defaults to **false**,
and only the `/guide` layout and `/guide/tools/:slug/try` turn it on.
`FhirJsonViewer` and `CodeDrawer` return `null` without it, and the **three**
call sites that would otherwise leave an empty wrapper behind check it too:
`PatientDocuments`' disclosure row, `PatientPathway`'s `.cds-card-json`, and
`CarePlanDisplay`'s JSON toggle and download. An empty wrapper is its own
defect — a disclosure that opens onto nothing reads worse than no disclosure.
`ToolDetail` is deliberately not on that list; [`tool-views.md`](tool-views.md)
§3 says why it is safe where it renders and nowhere else. The five files that
check for themselves are `FhirJsonViewer`, `CodeDrawer` and the three above —
`grep -rl useInspect apps packages` is the list.

⚠️ **A FOURTH axis, not chrome mode, build surface or data source.** A
standalone `/patient/record` browse is still the clinician's app; the public
demo is the `demo` surface and is exactly where the app most needs to look
production-grade. The reasoning is beside the context, not restated here.

⚠️ **The leaf gate cannot see a component that does its own
`JSON.stringify`** — `CarePlanDisplay` did, and was missed by the plan's
inventory, which was built by listing `FhirJsonViewer`'s call sites.
**`check:fhir-render` derives that list instead**, so this is a gate rather
than a thing to remember: serialize a resource or render a `<pre>` and you must
have asked `useInspect()`. It covers the prose too ([`tool-views.md`](tool-views.md) §4).

⚠️ **The 18 fillers and 11 recorders are ONE element definition**
(`packages/tool-views/src/data/toolViews.tsx` — a package since 2026-09-19, so
the rule is a boundary rather than a convention), rendered by two route
families: the clinician's published `/patient/assessments/*` and
`/patient/workflow/*` paths (the catalog's 36 launch paths, every CDS card's
`type: "smart"` link, every SMART `intent`) and the guide's
`/guide/tools/:slug/try`. They must stay one definition — two copies drift on a
`persistName` and the guide then documents a resource the app does not write.
**`npm run check:tool-view-routes`** pins that the map and every app's route
lookups agree, by parsing both as text; `toolViews.test.ts` keeps only what is
local to the map itself.

⚠️ `/guide/tools/:slug/try` is a SIBLING of the `/guide` layout, not a child:
the views render their own `PageHeader`, and nesting would put two on a page.
It is also deliberately not a `guideSections.ts` entry — it renders recorders
that write to patient context, so it is not a guide page and
`check:guide-boundary`'s premise does not hold for it.

## Two build surfaces, two route tables — no flag folds either way any more

`VITE_SURFACE=clinical` is a build TARGET, read only by `vite.config.ts` to
pick which `index.html`/entry under `apps/{guide,clinical}` vite starts from;
the old `surface.ts` module and its `IS_DEMO` are deleted.
`apps/clinical/src/App.tsx` registers the two SMART apps with no guide route;
`apps/guide/src/App.tsx` registers the Adoption Guide with **no SMART-app
page**. A demo-only page is simply absent from the clinical table (and vice
versa) — no conditional import, no guard block, because each app is its own
file: "a page this app does not declare is not reachable here, full stop"
(`apps/guide/src/App.tsx`'s own header comment). A redirect that differs by
surface is just two apps each declaring their own `<Route>` (the route-table
reader wants `<Navigate to="…">` verbatim).

⚠️ **NEITHER build carries the demo population** (2026-09-19). It is not a shim
any more: `LocalDataSource` takes its seed corpus as a **constructor argument**
defaulting to empty, and `PatientProvider` takes `populationPatients` the same
way — nothing in either app passes one. The guide's fillers want exactly the
unseeded store, and the clinical app reads its cohort from the server. The old
`@spier/demo-population` → empty-shim alias is **gone**, because a
build-surface flag was doing a dependency's job.

`npm run build:clinical` then `npm run check:surface` reads BOTH bundles: guide
pages in demo only, SMART-app pages in clinical only, and the 14 patients in
neither. ⚠️ That third rule **cannot be checked both ways** — a marker absent
from everything is indistinguishable from one that stopped matching — so the
first two rules are its positive control, and weakening them makes it
unfalsifiable. It is in the CI build job, not in `verify`.

⚠️ The alias reader (`scripts/lib/vite-alias.mjs`) scans `vite.config.ts` for
the literal `find:` — even in a comment — and throws on one it cannot parse;
that is why the config's comments say "alias entry" and not the property name.

## Routing and base path

`HashRouter` (see `apps/guide/src/main.tsx`) — GitHub Pages compatible. The
Vite `base` is env-driven (`/adoption-guide/` on Pages, `/` on the Workers,
see `vite.config.ts`); never hardcode an absolute asset path. Which host serves
what, and why both still do, is in [`workers.md`](workers.md).
