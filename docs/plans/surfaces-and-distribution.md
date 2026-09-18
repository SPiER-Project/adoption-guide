# Surfaces and distribution: what is an app, what ships to whom, and where it runs

Written 2026-08-18, from two questions asked while reviewing
[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md):

> we are headed towards 3–4 different applications, I think … can all of these
> live on Cloudflare Workers?

and then the one that mattered:

> if we actually need to give a client the SMART on FHIR application, they
> probably wouldn't want to take the whole adoption guide info though, right?

**They wouldn't, and neither existing plan noticed.** This document corrects the
surface inventory, introduces the axis both plans were missing — *build
surface*, distinct from chrome mode — and records the hosting topology with the
measurements it rests on.

## Status

| Decision | State |
|---|---|
| **1 — the IG is not an application** | **RESTATED**, from [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §1, because the framing keeps recurring. §1 |
| **2 — guide and clinical demo stay ONE app** | **UPHELD, and its scope corrected.** §5 of that doc answered a demo question, not a distribution one. §2 |
| **3 — a third axis: build surface (`demo` / `clinical`)** | **SHIPPED 2026-09-15.** One codebase, one route table, two builds: `VITE_SURFACE=clinical` (`web/src/lib/surface.ts`). §3 |
| **4 — the IG stays on GitHub Pages** | **PROPOSED.** §4 |
| **5 — mock EHR gets its own Worker** | **PROPOSED**, per [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §3. §4 |

| Phase | State |
|---|---|
| A — measure the IG's file count | **Not started.** One line in `deploy.yml`. §4 |
| B — surface flag + clinical build | **Done 2026-09-15.** `npm run build:clinical` → `web/dist-clinical/`. The guide routes and their chunks fold out; `@spier/demo-population` resolves to an empty shim (`web/src/shims/demo-population.clinical.ts`) so no scenario is compiled in. Not deployed anywhere yet — no client ship is near-term (§7). §3 |
| C — a gate asserting the clinical surface is clean | **Done 2026-09-15.** `npm run check:surface` (`web/scripts/check-surface.mjs`) reads BOTH builds and checks every derived marker both ways — absent from clinical, present in demo — so a stale marker fails rather than proving nothing. In the build job of `web-lint.yml`, not in `verify` (it needs the builds). Proven red on two plants before it was trusted. §3 |
| D — licensing verification before any client ships | **Off the critical path, not off the list.** A conference showing is lower stakes than a ship, not zero. §6, §8 |

---

## 1. The inventory, corrected

Four things get counted as "applications." Two of them are not.

| Surface | Kind | Where today |
|---|---|---|
| `ig/` | **upstream source + a rendered static site — not an app** | built in CI; served by GitHub Pages; the Worker redirects `/ig/*` there |
| Adoption Guide + SMART panel | **one app**, two chrome modes, and now two build surfaces (§3) | Worker Static Assets |
| CDS Hooks service | app #2, already in production | same Worker, `/cds-services/*` |
| Mock EHR | app #3, proposed | its own Worker — needs its own origin |
| Patient-facing app | app #4, hypothetical | doesn't exist; [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §5 |

**Two apps today, three with the mock EHR.**

⚠️ **The IG is upstream of everything, not a peer.** `fsh-sushi` compiles
`ig/input/fsh` and `copy-fhir.mjs` feeds the result into
`packages/fhir-artifacts/generated/`.
Counting it as an application inverts the dependency direction, which is why
[`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §1 says so
explicitly. Where its *rendered output* is hosted is a real question (§4); that
is a hosting question, not an architecture one.

## 2. What §5 actually rejected — and what it did not

[`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) §5 rejected
splitting the guide from the clinical demo. Its reasons, read back:

- #316 deliberately unified the four lenses under one page template, with
  `check:template` gating it in both directions;
- the cross-lens links are load-bearing;
- the product's rhetorical move is *"here is the tool, and here it is working on
  a real patient"*, which needs both lenses in one artifact;
- at ~31k LOC, "easier to build in" is not the constraint.

**Every one of those is about the demo as a persuasion artifact.** None of them
transfers to a client deployment, where there is nobody to persuade and the
cross-lens links point at pages the client has no business seeing.

So the decision stands and its scope was too broad. The conclusion "one app" is
right; the unstated premise "therefore one build" is not.
[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §3 inherited
that premise and needs the same correction.

## 3. The missing axis: build surface

Two axes were already in play — **chrome mode** (`AppShell` vs `PanelShell`) and
**data source** (`LocalDataSource` vs `SmartDataSource`). Neither answers "what
does a client receive." That is a third, independent axis:

| Surface | Routes registered | Scenarios | Data source |
|---|---|---|---|
| `demo` | everything — guide lenses, population, measures, chart, panel | bundled | local, or SMART when launched |
| `clinical` | patient + panel only | **not bundled at all** | SMART only |

### The problem is not bundle size

All 24 routes in `App.tsx` are `React.lazy`, so a client who never visits
`/guide/roadmap` never downloads it. **Weight is a weak argument and is not the
reason to do this.**

### The problem is that the demo patients are not lazy

[`packages/demo-population/src/scenarios/index.ts`](../../packages/demo-population/src/scenarios/index.ts):

```ts
const modules = import.meta.glob<PatientScenario>('./patient-*.json', {
  eager: true,
  import: 'default',
})
```

`POPULATION_SCENARIOS` is imported by
[`localDataSource.ts`](../../web/src/lib/dataSource/localDataSource.ts) **and by
[`PatientProvider.tsx`](../../web/src/context/PatientProvider.tsx)** — which
`App.tsx` mounts around every route, on every build. So **14 synthetic patients
ship in the always-loaded path**, and `/#/population` renders them as a caseload.

⚠️ **A clinician inside a client's EHR reaching a patient list containing Jane
Doe and Marcus Chen is a chart-safety problem, not an aesthetic one.** That —
not the roadmap page — is what makes shipping the demo build untenable, and it
is the reason this axis exists.

### Why a flag rather than a second app

Splitting the repo into two applications would re-lose exactly what §5 was
protecting — one page template, shared components, no divergence between what
the guide documents and what the app does — to solve a problem that is not about
code organization.

`VITE_SURFACE=clinical | demo` decides which routes are registered and whether
the scenario glob is compiled in at all. Nothing forks. The clinical build runs
SMART-only, so there is no local store for a synthetic patient to live in.

**Design it in with the panel, not after.** The panel already introduces a
chrome seam; the surface flag rides the same seam. Once two chrome modes and two
data sources have shipped and grown assumptions about each other, adding a third
axis means revisiting all of them.

### The gate this axis inherited from #401 — added 2026-09-09

`user-scoped-smart-launch.md` Phase D proposed a gate reading *no non-test module
under `web/src` imports `@spier/demo-population`* — the machine-checkable form of
"the adoption guide holds no patient data". **It belongs here, not there**, and
the reason is the distinction this section exists to draw.

As a rule over `web/src` it forbids the guide's offline demo path — the `Demo
chart` / `Demo caseload` / `Demo measures` screens that let a workflow be walked
with no host running, which is a stated requirement (Brad, 2026-09-09: *"it's
okay to not have the mock ehr up, we can still show the workflows in the adoption
guide"*). So it can only ever be true of a build that has no demo, which is
precisely the `clinical` surface.

⚠️ **It is therefore the same assertion as Phase C's, and it inherits Phase C's
trap below in full**: "no scenario import" is exactly the shape that passes
vacuously when the build it is checking was never produced. Four `web/src`
modules import the fixtures today — `localDataSource`, `PatientProvider`,
`useActivePatientId` (its crafted-URL allowlist) and `usePatientOpenBroadcast` —
so a clinical build has real work behind it, not just a flag.

What #401 landed instead is a **test** of the conditional property that actually
mattered for the demo: connected to a server ⇒ no bundled row. A grep cannot see
a condition; see that plan's Phase D.

### What shipped (2026-09-15)

`web/src/lib/surface.ts` exports `SURFACE` and `IS_DEMO`, folded from
`import.meta.env.VITE_SURFACE` at build time. In `App.tsx` every demo-only page
is declared `IS_DEMO ? lazy(() => import(…)) : NotOnThisSurface` — inline, not
through a helper, because an `import()` inside an arrow passed to a function is
reachable as far as the bundler knows — and the guide lens, the Overview, the
legacy guide redirects and the `/` → `/overview` front door sit in `IS_DEMO`
blocks; the clinical front door is `/patient/record`. Conditional redirects are
written as two literal `<Route>`s under the condition, because
`scripts/lib/route-table.mjs` reads `<Navigate to="…">` literally. The sidebar
shows the two apps and settings instead of the guide. `vite.config.ts` points
the `@spier/demo-population` alias at an empty shim on `clinical` — one alias
entry, two targets, so `scripts/lib/vite-alias.mjs` still sees one — and the
four importers see a population of nobody with no code path changed. The
clinical bundle is 39 chunks to the demo's 54; the ten guide pages' chunks are
not emitted.

⚠️ The first run of the gate found two things, and only one was a leak worth the
name. `"pathway"` and `"tools"` are route segments under `/patient` and keys in
the catalog as well as guide sections, and `patient-001` / `patient-011` are
literals in the app itself (a localStorage migration, the demo default id). A
marker has to name something that exists nowhere but the thing it guards —
the patients' display names, the `/guide` and `/overview` route roots, the page
chunks — and the gate now says which markers it chose and why.

### ⚠️ Phase C is the part that will be got wrong

Every gate in this repo runs against the demo build. A clinical build that
registers fewer routes is a configuration **nothing currently checks**, and the
assertion it needs — *the clinical surface contains no scenario import and no
guide route* — is precisely the shape that passes vacuously when written
carelessly: a grep that finds nothing reports success whether the rule holds or
the glob is wrong.

Follow the repo's standing rule and this document's own precedent (#232, #261,
#280, #201): **plant the defect and watch it go red** — build `clinical`, import
a scenario, and confirm the gate fails — before the gate is trusted. A gate that
has never been seen red is not evidence of anything.

## 4. Hosting

### What runs where

| Thing | Host | Note |
|---|---|---|
| Guide + panel (SPA) | Worker Static Assets | also deployed to GitHub Pages under `/adoption-guide/` |
| CDS Hooks API | same Worker, `/cds-services/*` | `run_worker_first`, Hono |
| Rendered IG | **both** — Worker Static Assets *and* GitHub Pages | one gated render, deployed twice — see below |
| Mock EHR | its own Worker | separate origin is a requirement, not a preference |

The Worker serves the IG from `web-dist/ig` as of **2026-09-18**. `deploy.yml`
renders it once, gates it on CQL + QA, and two jobs ship the same bytes: `build`
nests it into the Pages artifact, `cloudflare` stages it into the Worker's Static
Assets. [`services/cds-hooks/src/index.ts`](../../services/cds-hooks/src/index.ts)
has **no `/ig` route at all** — the catch-all serves it like any other file, and
`app.test.ts` asserts no handler comes back to shadow it.

⚠️ **The history is worth keeping, because this section was wrong twice in
opposite directions.** The Worker's comment called the redirect *"transitional"*
until 2026-08-23 — read as "the IG is on its way to the Worker", which had to be
settled by curling the live host. It was then corrected to *"does not and will
not serve the IG"*, which was an equally strong claim resting on a number nobody
had. Both readings were confident; neither was measured.

### The IG measurement — taken 2026-09-18

**254 MB** — `ig/output`, measured from deploy run `32155158199` (2026-08-18).
`deploy.yml`'s summary step reports it via `du -sh ig/output`.

⚠️ **That is not the number that decides whether it fits on Workers.** Static
Assets binds on **file count and per-file size**, not total bytes. This section
said that number had never been measured, and used its absence to support leaving
the IG on Pages. It has now been measured — without a CI run, because the
published IG ships its own `full-ig.zip`:

```sh
curl -sL -o full-ig.zip https://spier-project.github.io/adoption-guide/ig/full-ig.zip
unzip -l full-ig.zip | tail -3          # 4,070 entries, 230 MB uncompressed
```

| | Measured | Limit | |
|---|---|---|---|
| Files | **4,176** (IG + SPA, first real deploy) | 20,000 free / 100,000 paid | ✅ ~5× under |
| Largest file | **36.84 MiB** — `ig/output/full-ig.zip` | 25 MiB | ❌ over; dropped, redirects to Pages |
| Next largest | 8.88 MB — `site/package.db` | 25 MiB | ✅ |
| Uncompressed | 230 MB | no stated aggregate cap | — |

⚠️ **The first version of this table was wrong, and it failed the deploy.** It
read the largest file **inside** `full-ig.zip` (8.88 MB) and did not notice that
`full-ig.zip` is itself a file in `ig/output`, at 36.8 MiB. #533 shipped on that
reading, asserted only the file count, and `wrangler deploy` refused the upload:
*"Asset too large. We found a file … full-ig.zip with a size of 36.8 MiB."* Fixed
in #534.

The lesson is narrower than "measure twice": the zip was a *convenient* stand-in
for the directory, and it was off by exactly the one file that mattered — itself.
`deploy.yml` now asserts **both** caps against the real staged tree on every
deploy, and drops oversized files **by size, never by name**, because a filename
list would encode the same guess.

### Decision: serve the IG from BOTH — ADOPTED 2026-09-18, reversing 2026-08-23

The 2026-08-23 recommendation (*"leave the IG on Pages, even if it fits"*) rested
on four supports. The measurement removed one and weakened two:

- ~~*Nobody knows whether it fits.*~~ It fits — 4,069 files against 20,000.
- ~~*Pushing 254 MB on every deploy would be slow.*~~ Wrangler content-hashes
  assets and uploads only what changed, so steady state is the handful of pages
  that actually moved, not the tree.
- ~~*`deploy.yml` uploads the SPA and the IG as ONE artifact, so they cannot be
  decoupled.*~~ True of **GitHub Pages**, whose artifact replaces the whole site.
  It was never a property of the Worker, and the `cloudflare` job is a separate
  job precisely so the two targets fail independently.
- *Pages is free.* Still true, and it is why Pages **stays** rather than being
  retired. This is not a migration.

What the reversal buys is one origin: the SPA, the CDS Hooks API and the IG the
guide links to now answer on the same host, so `/ig/` is a real page instead of a
302 off-site, and the published IG survives the Worker being the only thing a
reader has open.

⚠️ **One consequence, recorded because it surfaced through the rename question
(`repo-and-package-boundaries.md` §5):** Pages held the *only* copy of the render
until 2026-09-18, which made it load-bearing rather than legacy. That is no longer
true — the Worker has a full copy — so renaming the repository now costs a stale
Pages URL rather than the render itself. `CANONICAL_IG_BASE` is gone from the
Worker; nothing in code points at the Pages IG any more.

⚠️ **`not_found_handling` is `"none"`, not `"single-page-application"`** — the
one SPA setting nobody expects. #533 left it on SPA fallback and recorded the
consequence as a deferred follow-up; #534 had to fix it, because the oversized-file
fallback depends on it. Under SPA fallback the binding answered a missing
`/ig/full-ig.zip` with `index.html` and a **200**, so the browser saved HTML as a
`.zip` — a dead download that looks like a live one. With `"none"` the miss is a
real 404, which is what lets `src/index.ts` tell "we do not hold this IG file"
from "this is an app route" and redirect the first to Pages. The catch-all
replicates SPA fallback explicitly for non-IG paths, so nothing else changed.

### One consequence of keeping guide and panel on one origin

The panel must be embeddable by the mock EHR, so this origin cannot refuse
framing — `frame-ancestors` must admit the host, and `X-Frame-Options: DENY`
cannot be set. Because guide and panel share an origin, **the guide becomes
embeddable too.** Low stakes for a demo, and consistent with the SMART launch
requirement, but it should be a decision rather than a side effect — and it is
one more reason the `clinical` surface should not carry guide routes at all.

## 5. Mock EHR and origins

Two Workers give two `*.workers.dev` hostnames at no cost and with no DNS —
which matters, because there is no DNS access to `thespierproject.org`. The mock
EHR must be its own Worker rather than another route on the existing one, since
[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §6 depends on
a genuine origin boundary.

Note the standing constraint it inherits: **the browser talks to FHIR directly.**
Tokens and patient data are never proxied through a SPiER Worker. The mock EHR
holds synthetic data only, so it is not an exception — but a future real-server
integration is not permitted to become one.

## 6. What "give a client the app" needs beyond code layout

A clean build is necessary and not sufficient.

⚠️ **Instrument licensing is the binding constraint, and it is not
architectural.** Every ActivityDefinition carries a coded
`instrument-licensing-status` (`ig/input/fsh/instrument-licensing.fsh`), and per
CLAUDE.md **no status has been verified against the rights holder's current
published terms** — [`licensing-verification-backlog.md`](../best-practices/licensing-verification-backlog.md)
is the standing list of what is owed, including why a recorded notice is not a
verification.

Demoing C-SSRS and CAMS is one posture. Shipping them to a client who then
screens patients with them is a materially different one. **That gates
distribution independently of anything in this document**, it will not be
discovered by reading code, and a `clinical` build that quietly includes every
instrument makes it worse rather than better — a per-deployment instrument
allowlist is the likely shape, and it is a real design question, not a config
line.

Also outstanding, and cheaper: ~~the demo's synthetic `Patient` resources do not
exist at all~~ (**landed 2026-08-18** — `ig/input/fsh/population-patients.fsh`,
gated by `check:patients` and check 8 of `check:scenarios`), and `PopulationView` / `MeasureDashboard` bypass the `FhirDataSource`
abstraction ([`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) §8).
Neither blocks a clinical build — both lenses are demo-surface — but both block
the claim that the whole app runs on a connected server.

## 7. Open questions

- ~~**Is a client deployment actually near-term?**~~ **Answered 2026-08-18: no.
  PoC only — sandboxes, public client + PKCE, no app gallery. The near-term goal
  is a conference demo.** That reorders everything below; see §8.
- **Does the `clinical` surface include the code drawer?**
  ([`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §2 —
  "nice for the demo, hidden in real life.") Likely a third setting rather than
  a property of the surface.
- **Per-deployment instrument allowlist** — §6.

## 8. What a conference demo optimizes for instead

Answered 2026-08-18: **no client ship is near-term; the near-term goal is
demonstrating at conferences.** Phases B–D were all justified by distribution,
so they defer. What replaces them is a different objective with a different
failure mode.

### The tension worth naming

[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) optimizes for
architectural honesty: cross-origin, real SMART launch, real FHIR reads and
writes, real capability negotiation. That is also, precisely, the most fragile
thing to run in a conference hall — captive-portal wifi, someone else's laptop,
a projector, and browser privacy settings nobody controls.

⚠️ **Because `workers.dev` is on the Public Suffix List, two SPiER Workers are
cross-*site*, not merely cross-origin** — the stricter category for browser
storage partitioning and tracking heuristics. The panel's `fhirclient` session
lives in `sessionStorage` inside a cross-site iframe. It should work partitioned,
but this is exactly the class of behavior that differs across browsers and
versions, and it is the demo's single highest-variance dependency.

### ⚠️ The two-track split is RETIRED — decided 2026-08-18

This section proposed splitting the work into an **offline Track 1** for the
conference and a **Track 2** that added the real claim later. **Track 1 as a
rehearsed offline demo is retired.** The conference demo runs against the mock
EHR ([`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §8), and
per Brad, 2026-08-18: *"don't try and solve for problems involving lack of
network connectivity."*

**What is retired is the demo deliverable, NOT the interface discipline** — and
the distinction is the whole reason this was safe to retire:

- ❌ **A second, offline demo to rehearse and maintain.** Gone. There is one
  demo, and it talks to the mock EHR.
- ✅ **The panel reads through `FhirDataSource` rather than binding to
  `SmartDataSource`.** Kept, and already true — #358 built `PanelShell` this way.
  It costs nothing: the chart already works both ways, and `LocalDataSource`
  cannot be removed regardless, because every gate and all 673 tests run against
  it and it is the no-patient "play with the forms" mode.

The practical value of keeping the discipline is worth stating plainly, since the
offline *demo* is gone: **if the mock EHR is down mid-talk, the app still runs.**
That is a fallback nobody has to rehearse, not a second track to maintain.

The honesty guardrail is unchanged and now applies to the mock rather than to a
local track: **never assert interoperability from a host we control.** The
portability claim is made by loading the same Bundles into a *public* sandbox —
see `mock-patient-smart-launch.md` §5–§6.

### The one constraint to honor now — ✅ satisfied

⚠️ **The panel must not assume a connected server.** Retained after the track
split was retired above, for the fallback reason rather than the offline-demo
reason.

**Satisfied by #358 and #360:** the panel reads through `FhirDataSource` as the
chart does, and `?embed=1` on the real query string is the directed-launch path
where there is no SMART `intent` to read.

One piece deliberately **not** built: this section asked that the code drawer's
*Written* tab "degrade honestly to *what would be written*" with no server. With
the offline track retired there is always a server, so panel §2 governs — the tab
reports **what happened**, never a hypothetical. #360 renders a real
`WritebackReport` or an empty state naming the absence.

### Licensing, at a conference

Lower stakes than a client ship, not zero — a conference talk is the most public
this project gets, and §6 still records that no instrument's status has been
verified against current published terms. Worth a look at the specific
instruments a demo puts on a projector before it is given, which is a much
smaller job than the full backlog.

## Related

- [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) — the panel;
  its §3 "one app, two chrome modes" is scoped to the demo surface and is amended
  to say so.
- [`repo-and-package-boundaries.md`](repo-and-package-boundaries.md) — §1 (the IG
  is not an app) and §5 (the split this document re-scopes rather than reverses).
- [`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) — subject
  resources and the population-lens gap.
- [`licensing-verification-backlog.md`](../best-practices/licensing-verification-backlog.md)
  — §6, the constraint that actually gates distribution.
