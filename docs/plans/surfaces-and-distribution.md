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
| **3 — a third axis: build surface (`demo` / `clinical`)** | **PROPOSED.** One codebase, one route table, two builds. §3 |
| **4 — the IG stays on GitHub Pages** | **PROPOSED.** §4 |
| **5 — mock EHR gets its own Worker** | **PROPOSED**, per [`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §3. §4 |

| Phase | State |
|---|---|
| A — measure the IG's file count | **Not started.** One line in `deploy.yml`. §4 |
| B — surface flag + clinical build | **Not started.** Design in now, retrofit later is expensive. §3 |
| C — a gate asserting the clinical surface is clean | **Not started, and load-bearing.** §3 |
| D — licensing verification before any client ships | **Standing backlog**, [`licensing-verification-backlog.md`](../best-practices/licensing-verification-backlog.md). §6 |

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
`ig/input/fsh` and `copy-fhir.mjs` feeds the result into `web/src/data/fhir/`.
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

Two axes were already in play — **chrome mode** (`EhrShell` vs `PanelShell`) and
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

[`web/src/data/population/scenarios/index.ts`](../../web/src/data/population/scenarios/index.ts):

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
| Rendered IG | **GitHub Pages** | the Worker only *redirects* — see below |
| Mock EHR | its own Worker | separate origin is a requirement, not a preference |

The Worker does not serve the IG. [`services/cds-hooks/src/index.ts`](../../services/cds-hooks/src/index.ts)
redirects `/ig` and `/ig/*` to `https://spier-project.github.io/adoption-guide/ig/`,
with a comment calling that "transitional" — so a move was once intended.

### The IG measurement, and the one that is missing

**254 MB** — `ig/output`, measured from deploy run `32155158199` (2026-08-18).
`deploy.yml`'s summary step reports it via `du -sh ig/output`.

⚠️ **That is not the number that decides whether it fits on Workers.** Static
Assets binds on **file count and per-file size** — on the order of 20,000 files
and 25 MiB per file, worth re-checking against current published limits — not on
total bytes. An IG Publisher render emits several serializations per resource
plus package artifacts, so with ~190 resources the count could land anywhere from
a few thousand to well past the cap, and **nothing measures it.**

**Phase A is one line** in the same summary step:

```sh
find ig/output -type f | wc -l
```

### Recommendation: leave the IG on Pages

Even if it fits. It is free, it is already canonical in the redirect, pushing
254 MB on every deploy would be slow, and `deploy.yml` uploads the SPA and the
IG as a single Pages artifact — CLAUDE.md notes the two cannot be decoupled, so
moving the IG means unpicking that coupling for little gain. Treat the redirect
as a permanent answer and drop "transitional" from the comment, or file the move
deliberately; leaving the word there implies a plan nobody holds.

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

Also outstanding, and cheaper: the demo's synthetic `Patient` resources do not
exist at all ([`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md)
§7), and `PopulationView` / `MeasureDashboard` bypass the `FhirDataSource`
abstraction ([`mock-patient-smart-launch.md`](mock-patient-smart-launch.md) §8).
Neither blocks a clinical build — both lenses are demo-surface — but both block
the claim that the whole app runs on a connected server.

## 7. Open questions

- **Is a client deployment actually near-term?** The SMART filler work was
  scoped PoC-only — sandboxes, public client + PKCE, no app gallery. If a client
  ship is a year out, phase B is still worth doing with the panel (it is cheap
  then and expensive later) and phases C–D can wait. If it is near, §6 is the
  critical path and the code layout is not.
- **Does the `clinical` surface include the code drawer?**
  ([`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §2 —
  "nice for the demo, hidden in real life.") Likely a third setting rather than
  a property of the surface.
- **Per-deployment instrument allowlist** — §6.

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
