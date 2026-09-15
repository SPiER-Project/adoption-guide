# Maintainability audit — shared primitives, frameworks, and origins

**Date:** 2026-09-15 · **Branch audited:** `main` at `190081f` · **Status:** §2.1 applied on the audit branch; everything else is a recommendation

The question that prompted this: spacing and padding keep drifting even though
every value is on the token scale and three gates say so. This audit measured
the drift, found where it comes from, and gives a take on two architecture
questions that were raised alongside it — whether the three surfaces should
be built on different frameworks, and whether the SMART apps should move to
their own origin.

**The short version.** The gates check *vocabulary* — that a value is on the
scale — never *assignment* — which value a role gets. A card may legally be
`space-3 space-4 / radius-lg` or `space-4 / radius-xl`, and 76 card surfaces
chose 29 different combinations. No lint fixes that; a component does, because
a component is the one place the number lives. Below the page header there
are almost no components, so every file makes the decision again. The cheapest
first move is deleting the 11% of the CSS that nothing references; the
largest is collapsing ten workflow views that share one skeleton.

**Status 2026-09-15:** §2.1 is done on branch
`claude/app-maintainability-audit-650a61` — the dead CSS is deleted,
`Dashboard.css` became `ChartSectionHeader.css`, and `check:css-dead` is in
`verify` and the fast CI job (PR #506). §2.2 follows on branch
`claude/section-header-cx`, stacked on it: `lib/cx.ts`, and `SectionHeader`
replacing the six matching hand-rolled heads (the four card/stage heads with
a pill, indicator or description block wait for §2.4's `Card`). §2.3 follows on
`claude/workflow-form`, stacked again: `WorkflowForm` + `WorkflowField` +
`WorkflowHint` + `RecordedList` + `lib/dates.ts`; the ten recorders lose ~360
lines and `check:template` now recognizes a recorder by the frame it renders.
§2.4 follows on `claude/primitives-pill-card` (four commits: EmptyState +
Notice, Pill, Card): the decisions are written in each component's header,
`RiskPill` is a wrapper over `Pill`, and the byte-identical maturity and
rubric ramps became the soft risk tones. Deliberately not converted: the
consent gate, the FHIRcast banner, the pathway-pending panel, the two
interactive tiles (`preset-card`, `stage-tool-card`), and the Overview's
dynamically classed cards. `DataTable` (§2.4's last item) follows on `claude/data-table`: a shell that
owns the wrapper, header type, cell padding and dividers while the page keeps
its own `<thead>`/`<tbody>` — the five bodies were too different for a
`columns[]` API. §2.5 is on
`claude/audit-2-5`: `PatientIdentityStrip` over one `lib/riskLabel.ts`
(the banner and the panel strip, the three `RISK_LABEL`s), `lib/dates.ts`
absorbing `relativeTime` and `chartDisplay.formatDateTime` plus the 15
inline `.slice(0, 10)` / `toLocaleDateString` sites, two tracking tokens,
and the three breakpoints pinned by stylelint. Not done: the optional
`SharedConcepts` / `ToolDetail` extractions.

On frameworks: keep one React app. Six of the eight guide pages compute live
against the pathway engine and catalog, the drift gates all assume one route
table and one CSS tree, and the mock EHR is already the framework-free Worker
the question imagines. On origins: yes eventually, on a real domain as
same-*site* subdomains, and not before then — a third `workers.dev` host adds
the guide↔apps boundary to the cross-*site* storage-partitioning class that is
already the demo's highest-variance dependency.

---

## 1. Where the drift is (measured)

Corpus: 29 CSS files, 9,462 lines, 1,243 rule blocks, 980 class selectors.

| Primitive | Implementations | Distinct spellings of the same decision |
|---|---|---|
| Card / panel surface | 76 surfaces, 74 class families | 29 (padding, radius) combinations; the most common is 14.5% |
| Pill / badge / chip | 62 rules, ~40 inline JSX sites + `RiskPill` | 6 paddings, 5 font sizes, 4 radii incl. a raw `20px` ×4 |
| Section header row | 11 call sites | 4 gaps, 5 bottom margins, 2 `align-items` |
| Heading rules | 72 rules | 60 unique signatures; the page lede is written 6 times beside `.page-header__lede` |
| Eyebrow / uppercase label | 61 rules | 26 (size, weight, letter-spacing) triples; 5 letter-spacing literals, no token |
| Empty state | 15 | 4 shapes, 3 centring decisions, 4 type sizes |
| Note / callout | 26 | left-accent bar is `3px` ×19 and `4px` ×6 with no rule; two byte-identical warning boxes in two files |
| Table | 5 | 4 cell paddings, 5 header signatures, 3 body sizes |
| Key/value row | 3 `<dl>` + ~12 span pairs | ~15 spellings of "small caps label over a value" |
| Breakpoint | 19 media queries | 10 values; `768` vs `767`, `640` vs `639`, and `640` vs `720` in one file |

Two things are *not* drifting and should be named as the model to copy:

- **The page frame.** `PageHeader` is the only `<h2>` in `pages/` (zero
  violations), width has one owner per route, and `check:template` enforces
  it. This is what a decision owned by a component looks like.
- **The eight handoff views share one CSS file**, `WorkflowActionView.css`.
  That is the pattern the card and pill families should follow.

### Why the gates cannot see it

`stylelint`'s `declaration-strict-value` proves `padding: var(--space-3)` is
on the scale. It cannot say a card should be `--space-4`, because "card" is
not a CSS concept — it is content. `check:tokens` proves the token exists.
`check:prose` proves the measure is capped. None of them can know two rules
are the same *role*. The repo's own doctrine already says it, about the
spacing scale: *"a step is a decision every later author inherits."* The
decisions that are drifting were never given a place to be inherited from.

---

## 2. Easy wins, in the order to take them

### 2.1 Delete the dead CSS and gate it (half a day, zero behaviour risk)

**148 of 980 class selectors are referenced by nothing** in `web/src` — about
1,000 lines, 11% of the corpus. (A first pass counted 161 of 1,074; the
difference is class names mentioned inside CSS comments, which the gate
correctly ignores.)

| File | Unreferenced | Of | What it is |
|---|---|---|---|
| [`web/src/App.css`](../../web/src/App.css) | 92 | 135 | Screenings tab, tool-stage groups, available-tool grid, result badges, the old CarePlan tab, the old Encounters timeline, `.tools-grid`/`.tool-card`, `.btn-primary`/`.btn-secondary` — whole features whose TSX is gone |
| `web/src/css/Dashboard.css` (now deleted) | 35 | 45 | Lines 1–332: demo-scenario banner, risk-alert banner, dashboard-widget system. Only `.chart-section*` (334–397) is live, and it belongs to `ChartSectionHeader.tsx` |
| `PatientChart.css` | 8 | 125 | `.risk-summary` — a second, dead copy of `.risk-pill` |
| six others | 1–5 each | | |

After the delete, `App.css` is ~150 lines of genuinely global CSS (the
`form-card` shell, the `@formbox/renderer` hash overrides, `.route-loading`)
plus ~240 lines that belong beside `QuestionnaireView`, `InstrumentHeader`,
`SmartRedirect` and `WorkflowActionView`. Move those to sibling files; rename
the live tail of `Dashboard.css` to `css/ChartSectionHeader.css` and drop the
import at `PatientChart.tsx:24`.

Also fix while there: `.encounters-note` is defined in both `App.css:664` and
`PatientChart.css:631` with different margins and colours (import order
decides); `.risk-pill` is re-declared in `PatientBanner.css`; `.panel-shell`
is written in five files.

**Add `check:css-dead`.** The 20-line script that produced the table above
(every `.class` in `src/**/*.css` must appear as a literal in a `.ts`/`.tsx`,
allowing `root--${…}` dynamic modifiers and an allowlist for the formbox hash
classes) is the gate. Plant a dead selector and watch it fail before trusting
it — and note what it cannot see: a class that is referenced but whose element
never renders.

### 2.2 `cx()` and `SectionHeader` (a day)

- No class-name helper exists. 49 `className` template literals, 18 with a
  ternary, and `RiskPill.tsx:23`, `CarePlanDisplay.tsx:47` and
  `EhrAdoptionRubric.tsx:150,153,164` smuggle a trailing space inside the
  string to avoid a double space. A four-line `cx()` in `lib/` removes the
  hazard and is the prerequisite for any component with variant props.
- `ChartSectionHeader.tsx` already solves the title + count + toggle row and
  is used correctly in three chart sections. Eight other places hand-roll it
  (`PopulationSummary:41`, `PopulationAlertsPanel:29`,
  `WritebackScorecard:104`, `EpisodeRecordView:94`, `PatientPathway:90`,
  `MeasureDashboard:242`, `DataDictionary:208,711`, `EhrAdoptionRubric:151`,
  `PatientJourney:197`) with four gaps and five margins between them. Rename it
  `SectionHeader`, give it its own CSS file, and point the eight at it.

### 2.3 `WorkflowForm` — the single largest duplication (two to three days)

Ten of the twelve form views (`WorkflowActionView`, `RiskEpisodeView`,
`SafetyTaskView`, `DischargePacketView`, `SafetyReferralView`,
`FollowUpAppointmentView`, `SharingConsentView`, `OutreachAttemptView`,
`CaringContactView`, `LethalMeansCounselingView`) render the identical
skeleton — `PageHeader` → `form-wrapper` → `form-card` → no-patient hint →
`workflow-form` with N `workflow-field`s → submit → success notice → "on this
chart" list → `CodeDrawer`. That is 3,017 lines and 52 fields.

Evidence it is already drifting: the "No patient selected — this will be
recorded in the scratch chart…" sentence is pasted nine times and
`RiskEpisodeView.tsx:158` has different wording; `const d = new Date()` is
written ten times, and a four-line ISO-date guard is pasted four times.

A `WorkflowForm` with `Field`, `FormNotice` and `RecordedList` children turns
each view into its field list plus its FHIR builder. `check:template` already
requires a `form-view` root and a `PageHeader` per view, so the gate stays
satisfied by construction.

### 2.4 One token decision each, then `Pill`, `Card`, `EmptyState`, `Notice`

These four need a *decision* before any JSX moves, because today there is
none to inherit:

| Component | Decide | Replaces |
|---|---|---|
| `Pill` (generalise `RiskPill`; `tone`, `size`) | one padding pair, `--radius-pill`, two sizes | ~40 inline `<span className="…pill/badge/chip">` sites; the byte-identical `--risk-*-faded` ramp under `ar-mat-chip` and `rubric-level-chip` |
| `Card` (`padding: 'compact' \| 'roomy'`, `tone`) | two paddings, one radius, `gap` on the card not margins on children | ~20 section wrappers across 8 pages; 76 surfaces long-term |
| `EmptyState` (`message`, `dense`) | one colour, italic or not, one padding | 13 inline paragraphs and two orphan CSS rules |
| `Notice` (`tone`, `role`) | one accent-bar width (`3px` or `4px`), `alert` vs `status` by tone | 16 sites in 6 recipes, including the two identical scope notices |

Then `DataTable` (thin: `columns[]`, no sorting) for the five hand-rolled
tables, aligning `CaseloadTable`'s cell tokens to it.

### 2.5 Small, mechanical

- `RISK_LABEL` + `highestRiskLevel` are pasted in `PanelShell.tsx:53-76` and
  `PatientBanner.tsx:43-61`, with a third `RISK_LABEL` exported from
  `lib/populationSummary.ts:54` that differs on `unknown`. One
  `PatientIdentityStrip dense` component covers both call sites.
- `lib/dates.ts`: 29 inline `new Date(…)` formattings; `ChartArtifacts.tsx`
  alone formats a date three ways. Two helpers already exist with one consumer
  each.
- Breakpoint and letter-spacing tokens: ten breakpoint literals (with the
  off-by-one pairs above) and 61 letter-spacing literals in five values,
  neither on a token.
- `DataDictionary.tsx` (774 lines) contains a page-sized `SharedConcepts`
  section; `PatientJourney.tsx` contains a 118-line `ToolDetail` drill-in.
  Both are extractions, not abstractions, and are optional.

### What this changes about the gates

Nothing existing is weakened. `check:css-dead` is new. Once `Card`/`Pill`
exist, a *future* rule becomes possible that is not today: "no CSS file
outside `components/` may set `border-radius` on a `padding`ed box" — that
is the assignment-level check the vocabulary gates cannot express, and it is
only expressible once the assignment has an owner.

---

## 3. Frameworks: keep one React app

**The premise that the guide is static does not hold.** Of the eight guide
sections, only `PatientAppGuide` and `PopulationDashboardGuide` are prose.
`CarePathway` renders the `PlanDefinition` through `usePathway` *and* builds a
synthetic `QuestionnaireResponse`, runs `mapCSSRSScreener`, and shows the
derived Observations in `FhirJsonViewer`. `PatientJourney`, `DataDictionary`
and `AdoptionReadiness` compute tables from the catalog. `CdsServiceGuide`
fetches the live discovery endpoint at render. `EhrAdoptionRubric` scores into
`localStorage`. An Astro guide would host six React islands importing
`FhirJsonViewer`, `usePathway`, `PageHeader` and `Shell` — two React trees in
two build systems sharing one CSS tree. That is more surface to keep aligned,
which is the opposite of the ask.

**Every drift gate assumes one app.** `check:catalog` and
`check:guide-boundary` parse `App.tsx`'s route table; `check:template`
assumes one header implementation and one inset owner; `check:prose` and
`check:tokens` assume one CSS tree and one token file. A second framework moves
the guide *outside the gate net*, and
[`embedded-panel-smart-launch.md`](embedded-panel-smart-launch.md) §6 already
records the consequence: *"a new deployable outside the gate net will rot."*

**This was decided and upheld.**
[`surfaces-and-distribution.md`](surfaces-and-distribution.md) decision 2 —
guide and clinical demo stay one app — and its §3 endorses a
`VITE_SURFACE=clinical|demo` build flag as the way to ship an apps-only
deployable without forking: *"Nothing forks."* That flag is the mechanism if
a client ever needs the apps without the guide. It is deferred, not rejected.

**The mock EHR already is the lightweight thing.** Hono on a Worker,
server-rendered HTML from template strings, no React, ~7,850 lines, its own
slate-and-steel token block, its own `check:host-css` gate, and exactly four
imports from `packages/*` and none from `web/src`. Turning it into a Vite SPA
would add a build and a client runtime to something whose demo claim is that
it is visibly *not* SPiER. Leave it.

**When a framework split would pay:** if the guide grows into dozens of
markdown pages, Astro content collections earn their keep. Today the guide is
eight sections with prose in TypeScript (`content/overview.ts`). If authoring
prose in TS is the actual pain, MDX inside the existing Vite app is the cheap
step, and it keeps every gate.

---

## 4. Origins: the SMART apps deserve their own domain — later, and not on `workers.dev`

**Today: three SPiER origins, four addressable roots.**

| Origin | Serves |
|---|---|
| `spier-adoption-guide.bbthorson.workers.dev` | guide + both SMART apps + `/cds-services` + `/ig` redirect — one Worker, one build |
| `spier-mock-ehr.bbthorson.workers.dev` | mock EHR: FHIR, SMART AS, FHIRcast hub, host chrome |
| `spier-project.github.io/adoption-guide/` | a second full copy of the SPA |
| `…/adoption-guide/ig/` | the rendered IG (same Pages origin) |

**What a separate apps origin would buy.** The guide could send
`X-Frame-Options: DENY` — today it is framable only because the panel needs
`frame-ancestors`, which `surfaces-and-distribution.md` §4 calls a side effect
that *"should be a decision."* The `redirect_uri` a real EHR registers would
name the app, not the guide. And the guide's origin would carry no
patient-adjacent browser state at all.

**What it costs now.** `workers.dev` is on the Public Suffix List, so two
SPiER Workers are cross-*site*, not merely cross-origin — the strictest
storage-partitioning class. The mock-EHR↔panel boundary already lives there,
Safari's third-party-storage behaviour is recorded as **untested**, and the
plan doc names it *"the demo's single highest-variance dependency."* A third
`workers.dev` host puts the guide↔apps boundary in the same class. Concretely,
a split today touches: the exact-match `redirect_uri` list
(`services/mock-ehr/src/smart.ts:83-88`), `MOCK_PANEL_BASE_URL`, the CDS
endpoint derivation that deliberately ties the CDS host to the panel host
(`services/mock-ehr/src/app.ts:1035-1038`), the two hardcoded absolute URLs in
`packages/core/src/lib/cdsHooks/endpoint.ts` and `web/src/data/surfaces.ts`,
`check:catalog`'s assertion that the landing route is a page in `App.tsx`,
and the origin-scoped keys that stop crossing (`spier.toolConfig.v2`, the
standalone FHIRcast `BroadcastChannel`).

**The precondition is DNS, not code.** There is no access to
`thespierproject.org`. With a real apex, `app.`, `guide.` and `ehr.`
subdomains are cross-origin (what the embedded-panel work wants) but
same-*site* (so the partitioning risk drops to the ordinary case). That is
the configuration worth moving to.

**Recommendation.** Record the decision now: *the SMART apps get their own
origin when a real domain exists; the split runs along the existing
`/patient/record` and `/population/caseload` addresses; the `VITE_SURFACE`
flag is how the apps-only deployable is produced.* Then do the three pieces
of prep that are cheap now and needed regardless:

1. Make the CDS Hooks host a configured value rather than one derived from
   the panel origin.
2. Keep the guide off the app's `localStorage` — already true except
   `spier.toolConfig.v2`, which `/settings` owns.
3. Land `VITE_SURFACE` (§3 of `surfaces-and-distribution.md`) so the
   apps-only build exists and is gated before it is ever deployed.

An open question this audit did not settle: `deploy.yml` ships a second full
copy of the SPA to Pages beside the IG. If the Worker is the public URL, the
Pages SPA is a third deployable to keep aligned; whether the IG can stand
alone there is worth checking.

---

## Method and what was not checked

Three passes over `web/src`, `services/*`, `packages/*`, `web/scripts` and
`docs/plans`: a CSS rule-block parse of every `.css`, a JSX pattern sweep of
`pages/` and `components/`, and a read of the build, deploy, SMART-launch and
gate sources. Headline counts (form-skeleton duplication,
`RISK_LABEL` triplication, raw `20px` radii, absence of a class helper) were
re-derived independently before being reported. One agent finding was dropped
on re-check: the icon maps in `lib/statusIcons.tsx` *are* consumed. Not
checked: whether any "dead" class is referenced only through a string built at
runtime other than the `root--${…}` form; the Pages deploy's reasons for
coupling the SPA to the IG.
