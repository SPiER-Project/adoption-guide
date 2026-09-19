# CLAUDE.md

Guidance for AI agents changing this repo (SPiER — FHIR artifacts + adoption-guide demo app).

This file holds the layout, the commands, and the conventions as rules. The
**reasoning** — why each gate exists, what its load-bearing rule is, and what it
cannot see — lives in [`docs/internals/`](docs/internals/README.md), one file per
area, linked from each section below. Read the one for the area you are changing
**before** you change it: every ⚠️ in those files is a defect that shipped, and
most of them are a gate that passed while checking nothing.

## Repo layout

- `ig/` — FHIR Implementation Guide. FSH sources in `ig/input/fsh/` are compiled by SUSHI to `ig/fsh-generated/resources/` (gitignored). This is the **canonical, machine-readable** source for Profiles, ValueSets, CodeSystems, ActivityDefinitions, PlanDefinitions, and example Instances.
- `FHIR-Resources/` — hand-authored FHIR Questionnaire JSON (plus a few CarePlan templates), one folder per instrument (ASQ, PHQ-9, C-SSRS, SBQ-R, CAMS, Stanley-Brown). Imported **directly** by `web/src/App.tsx` at runtime, **and published into the IG** through `ig/input/resources/questionnaires`, a tracked symlink to this folder whose tool folders are each a `path-resource` entry in `sushi-config.yaml` (#473). ⚠️ The publisher refuses a `path-resource` outside the IG root, which is why it is a symlink and not `../FHIR-Resources`; one entry **per tool folder**, never the recursive `/*` form, because the publisher tries to load every file it finds and `references/` holds PDFs (`check-ig-narrative.mjs` fails on a folder with JSON that no entry names); and every resource JSON here needs an `id` equal to its canonical's last segment, because the publisher names the page `<Type>-<id>.html` and rejects a mismatch.
- `packages/core/` — the **React-free domain layer** (#389): FHIR types, the tool
  catalog, instrument + care-plan mappers, the `FhirDataSource` seam, pathway /
  registry / measure logic, CDS Hooks, FHIRcast. Consumed as `@spier/core/<path>`
  by the app and both Workers, which have **zero** deep imports into `web/src`.
  Its tests live beside their subject, under `packages/core/src` itself, rather
  than under `web/src` — `packages/core/tsconfig.json` (a `composite` project
  referenced from `web/tsconfig.json`) and `web/vitest.config.ts`'s extended
  `test.include` are what reach them from there. Still `web`'s `npm run verify`
  and `npx tsc -b`; no fourth pipeline.
- `packages/ui/` — the **design system**: the eight surface primitives
  (`Button`, `Card`, `DataTable`, `EmptyState`, `Notice`, `PageHeader`, `Pill`,
  `SectionHeader`), the `cx` helper, and `foundation.css` — the `:root` token
  block and global resets, formerly `web/src/index.css`. Consumed as
  `@spier/ui/<name>`. A referenced composite project like `packages/core`, and
  its colocated tests run under `web`'s vitest; **no fourth pipeline.**
  ⚠️ `WorkflowForm` is deliberately NOT here: it reads `usePatient()`, so moving
  it would invert the dependency. See `packages/ui/README.md`.
- `packages/tool-views/` — the **18 instrument fillers and 11 workflow
  recorders**, defined ONCE, plus the three contexts they read
  (`InspectContext`, `PatientContext`, `PresentationContext` +
  `PresentationProvider`) and the frames around them (`WorkflowForm`,
  `QuestionnaireView`, `CarePlanDisplay`, `FhirJsonViewer`, `CodeDrawer`).
  Consumed as `@spier/tool-views/<path>`. ⚠️ **The contexts live here and that is
  what makes the package possible** — `packages/ui` could not take `WorkflowForm`
  because it reads `usePatient()` and ui knows nothing about patients; this
  package owns both sides, so nothing is inverted. The *providers*
  (`PatientProvider`, `SmartProvider`, `ToolConfigProvider`) stay in the app: a
  provider decides where data comes from, which is an application's decision.
  ⚠️ **No `IS_DEMO` in here, ever.** A view renders the same for a clinician and
  an implementer; what differs is `InspectContext`, which the app turns on for
  `/guide`. See `packages/tool-views/README.md`.
- `packages/worker-http/` — what the two asset-serving Workers share about
  *being an asset host*: the Static Assets catch-all, the explicit SPA fallback,
  and the one `frame-ancestors` policy. React-free and DOM-free like
  `packages/core`, and gated by `scripts/check-worker-csp.mjs`.
- `packages/demo-population/` — the 14 demo patients + scenario slices (#388).
- `packages/fhir-artifacts/generated/` — SUSHI's output, gitignored (#392).
- `web/` — React 19 + TypeScript (strict) + Vite app. Consumes generated FHIR JSON copied into `packages/fhir-artifacts/generated/` by `web/scripts/copy-fhir.mjs`, and Questionnaires imported from `FHIR-Resources/`.
- `docs/` — project/reference docs. `scripts/` — repo-level helper scripts.

## Verification commands

Run these before considering a change done.

### In `web/`

The one-shot entry point is **`npm run verify`** — copy-fhir (forced),
typecheck, both linters, every `check:*` gate below, and the unit tests, in
sequence. **CI runs `npm run verify` itself** rather than re-listing its steps,
so a gate added to `package.json` is enforced automatically; **do not re-expand
the CI job into individual steps.**

If you add a gate, add it to this list. **Deliberately not a count** — a pinned
number goes stale silently on every gate added.

```
npm run copy-fhir      # compile IG via SUSHI + copy resources into the generated tree (do this FIRST)
npx tsc -b             # typecheck (project references; needs generated files present)
npm run lint           # eslint
npm run lint:css       # stylelint (design-token enforcement)
npm run check:tokens   # every var(--token) resolves to a real definition
                       # ⚠️ This, check:css-dead, check:prose and check:template all read TWO trees
                       # now — web/src and packages/ui/src — declared once in
                       # web/scripts/lib/style-roots.mjs with a PER-ROOT floor. A global floor is
                       # what they had when packages/ui was extracted, and 31 stylesheets cleared
                       # it while nine were missing: css-dead and template reported ✓ over
                       # three-quarters of the CSS. The floors alone still could not see a root
                       # DELETED from the list (it takes its own floor with it), so the roots are
                       # additionally checked against the filesystem
npm run check:favicons # the tab mark still matches the brand tokens. The icons in web/public/
                       # are GENERATED from --brand-primary and --brand-gradient-1…5 by
                       # scripts/build-favicons.mjs (`npm run build:favicons` rewrites them).
                       # ⚠️ A favicon is its own document and cannot read a var(), so its six
                       # colours are necessarily a hand-duplicated copy of the palette — which is
                       # exactly why it is gated. The 2026 redesign would otherwise have left a
                       # raspberry icon nobody looks at
npm run check:css-dead # every class selector is referenced by a component (or by the
                       # formbox renderer, scraped from its installed theme)
npm run check:template # one header implementation, one owner of the page inset, one owner of the width
npm run check:prose    # the reading measure: --measure-prose is a character count, every cap
                       # declared, and prose is set at one of three sizes
npm run check:fhir-render # the clinician sees no raw FHIR — in JSON or in words. A component that
                       # serializes a resource or renders a <pre> has asked useInspect() in the
                       # same file; and a workflow recorder's JSX TEXT (parsed, not grepped)
                       # names no resource type, profile, extension or element path, and holds
                       # no <code> — that is what fhirNote is for
npm run check:ucum     # the UCUM shim is still safe: no quantities, and it still covers its callers
npm run check:fhir-r5  # the R5-model shim is still safe: every fhirVersion is "r4"
npm run check:crosswalk        # concept-crosswalk validation
npm run check:extract          # the SDC observationExtract contract: a declaring item carries a code,
                               # the declared codes equal what the mapper emits, and EVERY mapper's
                               # Questionnaire is classified — in EXPECTED, or in NO_LITERAL_EXTRACTS
                               # with the reason. ⚠️ That third rule is new: absence from the hand list
                               # used to mean "checked and empty" and "never opened" indistinguishably,
                               # and four of fourteen mappers were in the second state
npm run check:core-boundary    # packages/core stays React-free and DOM-free
npm run check:guide-boundary   # the Adoption Guide holds no patient data (walks guide pages transitively)
                               # ⚠️ This, check:surface-links, check:fhir-render, check:template,
                               # check:fhir-r5 and check:outputs no longer name `web/src` themselves —
                               # the root comes from web/scripts/lib/app-roots.mjs, the `.ts`/`.tsx`
                               # twin of style-roots.mjs. Ten gates hardcoded that path, and the
                               # `apps/` split turns one tree into two. Same two-part rule: a PER-ROOT
                               # floor, plus a filesystem scan that HARD-FAILS on an app tree no root
                               # declares — keyed on `src/main.tsx` or `src/App.tsx`, because an app
                               # has an entry module by construction and a bare `src` glob would drag
                               # in packages/core and packages/ui. The floor cannot see a root deleted
                               # from the list; the filesystem can
npm run check:catalog          # tool-catalog wiring: stubs, UI metadata, ADs, questionnaire URLs both
                               # ways, per-AD licensing metadata, per-AD tool-id identifiers — plus
                               # every declared navigation target resolves to a real App.tsx route:
                               # the 36 catalog launch paths, and the panel's post-launch landing
                               # route, which must be a PAGE and not a redirect — and every
                               # <Navigate> TARGET still points at a real route, so a compatibility
                               # redirect kept for a published path cannot rot into the catch-all
npm run check:tool-view-routes # the 29 tool views are ONE definition and EVERY app's route table
                               # agrees with it, both ways. ⚠️ Replaced the App.tsx half of
                               # toolViews.test.ts, which read `../App.tsx` by relative path — a
                               # shape that can only ever check ONE table, while the invariant is
                               # every table. Iterates the roots in lib/app-roots.mjs instead
npm run check:eager-forms      # the 18 hand-authored Questionnaires stay OUT of the entry chunk.
                               # ⚠️ Every tool view was already `lazy()` when they were IN it — laziness
                               # of the component is not the property that matters, because `App.tsx`
                               # imports TOOL_VIEWS statically and an eagerly-imported map's CONTENTS are
                               # eager whatever they render. So this walks STATIC imports only (not
                               # module-graph.mjs's reader, whose pattern also matches `import(`) from
                               # every declared app entry. Worth ~23.8 KB gzip off first paint on both
                               # surfaces. ⚠️ Its first version stripped block comments before line
                               # comments, and `/patient/*` in App.tsx's own prose opened a fake block
                               # comment that swallowed the one import it polices — it walked 104 modules
                               # and said ✓
npm run check:surface-links    # every in-app link a CLINICIAN can reach resolves on the CLINICAL
                               # surface. ⚠️ A different question from `check:surface`, which reads the
                               # two BUNDLES and asserts what is compiled in. A component that ships on
                               # both surfaces can still link into `{IS_DEMO && (…)}`: `PatientPathway`
                               # did, twice, one of them the embedded panel's only navigation. It does
                               # not 404 — the `*` catch-all returns the clinician to the patient
                               # record, silently. check:catalog resolves paths against the WHOLE route
                               # table, so it passed this and always would have
npm run check:stages           # stage ids in population data vs the canonical FSH stage list
npm run check:pathway          # the pathway PlanDefinition's tier codes, stage codes and
                               # definitionCanonicals all resolve against the generated artifacts
npm run check:outputs          # the OTHER half of a tool's FHIR contract: every
                               # PlanDefinition.action.output profile is stamped by a resource the app
                               # actually emits, on the declared type, and every launchable recorder
                               # declares one. ⚠️ Runs AFTER `npm test` in `verify`, because it reads
                               # web/.runtime-fhir — the emitted corpus, not the source. A lexical scan
                               # would have PASSED the TL-009 defect: the canonical was in the source
                               # the whole time, in measures.ts, as the constant a filter READ
npm run check:published-profiles # the COMPLEMENT: every profile the IG publishes is claimed by
                               # something the app emits, or is exempted with a reason.
                               # check:outputs starts from what a tool DECLARES, so it is blind to a
                               # profile no tool declares — published, read by a measure, never
                               # written. ⚠️ Also AFTER `npm test`, same corpus
npm run check:readers          # every observation mapper's answer reads vs the Questionnaire's
                               # declared item `type`
npm run check:careplan-readers # the sibling rule for carePlanMappers: does the nesting each reader
                               # walks match what the Questionnaire declares
npm run check:patients         # the 14 demo patients' demographics agree across all three sites
npm run check:scenarios        # scenario QRs vs their Questionnaire, plus every other resource bucket;
                               # a RiskAlert's suggestedAction.path must resolve to a route
npm run check:dates            # the scenario fixtures' clinical dates are coherent relative to their
                               # anchor (--check validates; --apply is the separate re-dating command)
npm run check:measures         # Stage-8 Measure criteria vs the measures.ts engine
npm run check:reassessment     # the per-tier reassessment cadence agrees across the PlanDefinition,
                               # the app and the CQL
npm test                       # vitest
```

⚠️ **A green `check:*` is not proof of coverage.** Each gate has a rule it
cannot see, and several were shipped in a form that passed a planted defect.
[`docs/internals/web-gates.md`](docs/internals/web-gates.md) has the per-gate
detail — read it before adding a gate, changing one, or concluding that
something is covered.

### External terminology (nightly, not in `verify`)

Needs a terminology server, so it cannot be offline-reproducible:

```
npm run check:codings    # every LOINC / SNOMED / terminology.hl7.org code+display literal in
                         # packages/core/src, web/src and services/, checked against tx.fhir.org
```

⚠️ **`tx.fhir.org` is not the authority — Regenstrief is.**
`bash scripts/loinc-audit/loinc-audit.sh .` checks every LOINC coding in every
Questionnaire against `fhir.loinc.org`, which never lags a release. Run it when
you add codings and after a LOINC release. It is not a gate: it needs a personal
Regenstrief account.

Before adding a coding, touching the `PENDING_TX` allowlist, or reading a red
nightly, see [`docs/internals/terminology.md`](docs/internals/terminology.md) —
including why the per-source floors are load-bearing and why an allowlist entry
is built to expire. A red nightly has a written triage path in
[`docs/scheduled-checks-triage.md`](docs/scheduled-checks-triage.md).

### In `ig/`

The package is `fsh-sushi`, so a bare `npx sushi .` fetches the wrong thing and
fails in a fresh worktree:

```
npx fsh-sushi .        # compile FSH → fsh-generated/resources/
```

### At the repo root

```
node scripts/check-sushi-output.mjs   # compile ig/ and gate the WARNING SHAPE against a reasoned
                                      # allowlist (never a count); pass a path to gate a captured log
node scripts/check-ig-menu.mjs        # every menu: target is a real page, and menu: and pages: agree
                                      # both ways (only pages: renders a page; the menu is on every page)
node scripts/check-ig-narrative.mjs   # what the IG's prose may say, and whether what it points at
                                      # exists — no repo internals, TL ids / #/routes / .html resolve
node scripts/build-ig-groups.mjs      # regenerate the `groups:` block of sushi-config.yaml from the FSH
                                      # tree (one rule per source file; the Artifacts page reads by purpose)
node scripts/build-ig-groups.mjs --check   # gate: every source has a rule, the block is current, and
                                      # every compiled resource carries a groupingId (needs SUSHI first)
node scripts/check-canonical-uniqueness.mjs   # one canonical URL, one definition — across BOTH the FSH
                                      # tree and FHIR-Resources/. Needs `ig/fsh-generated/` (a missing
                                      # tree is a hard error, never a skip)
node scripts/check-md-links.mjs       # every relative link in a tracked .md resolves (the ONLY gate
                                      # that triggers on docs/** or the root README.md)
node scripts/check-worker-csp.mjs     # ONE frame-ancestors policy across every Worker that serves a
                                      # SPiER SMART surface. Run from services/cds-hooks AND
                                      # services/clinical (`npm run check:csp`) rather than from web,
                                      # which reads none of it; it scans the whole repo, so either
                                      # caller is sufficient
node scripts/validate-fhir.mjs        # HL7 validator_cli over ig/fsh-generated/, FHIR-Resources/ and
                                      # the unwrapped scenarios (needs Java 17+; caches a ~190MB jar)
node scripts/check-fml.mjs --tx https://tx.fhir.org   # FHIR Mapping Language gate (same Java + jar;
                                      # --tx needs the network — the transform engine requires a tx server)
node scripts/build-use-case-workbook.mjs           # <id>.json → dist/*.xlsx + *.csv + <id>.md
node scripts/build-use-case-workbook.mjs --check   # gate, in use-case-workbook.yml
```

⚠️ **A clean SUSHI run is not a quiet one, and `sushi` does not validate
everything.** Five separate gates cover five different classes of problem, and a
clean SUSHI run implies none of the others — the IG Publisher alone catches
FHIRPath invariants, everything about the StructureMaps, and the CQL→ELM
translation. What each gate covers, why the publisher's CQL compile hangs on one
config line, and the two traps in running the publisher locally are in
[`docs/internals/ig-build.md`](docs/internals/ig-build.md).

⚠️ **A validator warning can mean "nothing was checked"** — an unresolvable
Questionnaire or profile degrades to a PASS. That, the FML parser's limits, the
rules shared with the mock EHR's write endpoint, and what each half of the
scenario gate does and does not cover are in
[`docs/internals/fhir-conformance.md`](docs/internals/fhir-conformance.md). Read
it before editing a scenario fixture, a mapper, or an `.fml` map.

⚠️ **Edit `docs/use-cases/ed-scenario-11.json`, never `docs/use-cases/dist/` and
never `ed-scenario-11.md`** — all three are outputs. A gap claim in that workbook
is a statement to the HL7 working group; see
[`docs/internals/docs-gates.md`](docs/internals/docs-gates.md).

### The three Workers — easy to forget, and CI gates all three

`web/`'s `npm run verify` covers **none of them**, and two of the three import
the web catalog, so a change to `tool-ui-metadata.ts` or the population
scenarios can break them with `web/` green.

```
cd services/cds-hooks && npm install && npm run verify   # typecheck + eslint + check:csp + vitest
cd services/clinical  && npm install && npm run verify   # the same, minus copy-fhir — this Worker
                                                         # imports nothing from web/src, so its
                                                         # verify is offline and takes seconds.
                                                         # Do not add the FHIR dance for symmetry
cd services/mock-ehr  && npm install && npm run verify   # + check:host-css (no hex outside TOKENS,
                                                         # every var(--…) resolves)
```

⚠️ **`services/clinical` is the Worker a real EHR frames, and that decides three
things about it.** It serves `web/dist-clinical` (`VITE_SURFACE=clinical`) and
nothing else — no `/cds-services` (cards come from `buildCdsCards` in-process,
the endpoint's only runtime caller is a guide page, and `CDS_JWT_AUDIENCE` is
baked to the adoption-guide Worker's URL) and no `/ig/`. `src/app.test.ts`
asserts both as negative tests, because "someone copies a route across for
parity" is the failure. The mock EHR frames **this** Worker, not the guide one
(`DEFAULT_PANEL_BASE_URL` in `services/mock-ehr/src/app.ts`).

⚠️ **The `frame-ancestors` policy lives in `packages/worker-http`, once.** Two
Workers serve a SPiER SMART surface over Static Assets and a header that differs
between them is a clickjacking surface on the clinical one — which is also the
copy nobody re-reads after editing the other. `node scripts/check-worker-csp.mjs`
(in both services' `verify`) holds five rules: the shared module still sets the
header, no service re-types it in a string, every Worker with an `assets` block
**value**-imports `serveSpaAsset`/`withFrameAncestors` (a type import is erased
and cannot set a header — a planted defect passed the first version of this rule
on exactly that), and every such Worker keeps
`not_found_handling: "none"`.

⚠️ **The SPA Worker also serves the rendered IG at `/ig/`, and CI is the only
thing that can put it there.** `deploy.yml`'s `cloudflare` job stages the IG
Publisher's render into `web-dist/ig` and runs `wrangler deploy`; a local
`npm run deploy` in `services/cds-hooks` ships a Worker whose `/ig/*` 404s,
because `stage:assets` begins with `rm -rf web-dist` and nothing local renders
the IG. Cloudflare's **Workers Builds** git integration is disconnected on
purpose (2026-09-18) — reconnecting it races a second, IG-less deploy against
the Actions one. `index.ts` must NOT regain an `/ig` route; `run_worker_first`
means any such handler shadows ~4,000 real files, and `app.test.ts` gates it.

⚠️ **The mock EHR is deliberately NOT styled like SPiER** — that is a demo claim,
not a preference. See [`docs/internals/workers.md`](docs/internals/workers.md).

⚠️ **That includes its favicon.** The host serves its own slate record-card mark
from `/favicon.svg` (`FAVICON_SVG` in `hostChrome.ts`, a Worker route because
there is no Static Assets binding). Two tabs carrying the same plum icon read as
one product, which is the impression the whole host palette exists to prevent —
so its colours are `var(--chrome…)`, resolved out of `TOKENS` at module load
rather than typed, and `check:host-css` holds them to the same one-definition
rule as the pages.

⚠️ **An embedded activity gets a VIEWPORT; never size a guest frame to its
content.** Both the chart's dock and the front door's caseload frame are fixed
heights that the guest scrolls inside. The panel's own chrome is `position:
fixed` — the code drawer, the FHIRcast notice — so a frame sized to its content
strands that chrome below the fold. Three attempts at a content height are on
the record in `chartPage.ts`; read them before trying a fourth.

⚠️ **A framed launch is minted at RUNTIME, never baked into the markup.** Both
frames ship `src="about:blank"` and POST to `/_admin/launch`. A launch URL in
server-rendered HTML is a context minted at cache time and handed to whoever
loads the page next; `chartPage.test.ts` asserts no absolute iframe `src`.

### Measures

A measure criterion lives in **four** places and `check:measures` ties only two
of them together; nothing asserts the CQL and the TypeScript compute the same
answer. `denominator-exclusion` and `denominator-exception` are **not**
interchangeable. Before changing a criterion, a population, or the scoring, read
[`docs/internals/measures.md`](docs/internals/measures.md).

## Conventions

- **Design tokens only.** Vanilla CSS with custom properties. stylelint
  (`.stylelintrc.json`) rejects raw hex (`color-no-hex`) and enforces `var(--…)`
  for `color`, `background-color`, `border-color`, `fill`, `font-size`,
  `box-shadow`, `font-family`, **and every spacing property** — `padding`,
  `margin` and `gap` with their longhands. Raw values are allowed only in
  `packages/ui/src/foundation.css` (token definitions), which carries its own
  `stylelint-disable` banner saying so. ⚠️ That exemption used to be an
  `ignoreFiles` glob naming `src/index.css`; stylelint matches it by PATH, so
  the move silently un-exempted the file and it reported 85 errors for doing its
  job. A path-shaped exemption is one rename from not applying — it lives in the
  file now. Class selectors must be kebab-case BEM.
  **Type has three families and no others** — `--font-display` (headings,
  buttons; names Area Normal, renders Manrope until the licence lands — the
  `@font-face` note at the top of `index.css` says why), `--font-body`
  (Poppins) and `--font-mono`.
  **Brand colour is role-named, and the raspberry is gone.** Since the 2026
  website redesign there is no `--brand-accent`: an eyebrow is
  `--brand-terracotta-text`, a link is `--brand-link`, a selected or active
  state is `--tint-peach-soft` under plum, focus and accent bars are
  `--brand-primary`, and the four tints (`--tint-peach/sand/sage/sky`, each
  with a `-soft`) plus `--gradient-brand` are the rest of the palette.
  ⚠️ Values commented `sampled` in `index.css` were read off the rendered
  Figma, not its variables — replace them from the file, do not tune them by
  eye. Two are deliberately deeper than the design for WCAG AA at app sizes.
  **Spacing is a 10-step scale**, `--space-0-5` … `--space-8`; the two
  half-steps exist because the 0.25rem grid is too coarse below 0.5rem, where
  pill and badge padding lives. Don't add an eleventh — a step is a decision
  every later author inherits. Three things are deliberately *not* on it:
  `--gap-inline` (an `em`, for an icon beside its label), a derived alignment
  (write the `calc()` over the tokens it depends on rather than typing the sum
  — `.sidebar-link--child` and `.stage-tools` do), and a sub-step hairline
  nudge (keeps its raw value behind a `stylelint-disable` naming why it is not
  spacing). ⚠️ `ignoreValues` permits any `calc(…)`, so a raw length inside one
  is unchecked; that is where a deliberate derived value lives.
  **Tracking has two tokens** — `--tracking-caps` for any small-caps label and
  `--tracking-caps-wide` for an eyebrow — and `letter-spacing` is on the
  strict-value list. **Breakpoints are three literals, not tokens**, because
  `var()` cannot be read inside `@media`: 640 / 768 / 1024, with `max-width`
  written as the complement (639 / 767 / 1023) so a min and a max never
  overlap by a pixel; stylelint's `media-feature-name-value-allowed-list` pins
  them, and a content-driven width (a table that fits at 1100, a title that
  wraps at 340) is a `stylelint-disable-next-line` naming why.
  ⚠️ **stylelint checks that a token is *used*, never that it *exists*** —
  `npm run check:tokens` closes that half.
- **One page template.** Every route under the app shell renders into
  `.app-shell__body`, the **sole owner of the page inset** — never pad a page's
  own root. The title block is `components/PageHeader.tsx` (eyebrow → title →
  accent rule → optional lede), the only definition of page-title typography; a
  page never renders its own `<h2>`, so section headings start at `<h3>`. A
  drill-in page passes `up` to make the first eyebrow segment its way back out.
- **Below the page header, eight components own the surfaces**, and seven of
  them now live in `packages/ui` (`@spier/ui/<name>`); `WorkflowForm` stays in
  `web/src/components` because it reads patient context. `SectionHeader`
  (the `<h3>` row), `Card` (a bordered panel), `Pill` (a small inline marker),
  `Notice` (a tinted message box), `EmptyState` ("nothing here"), `DataTable`
  (the table shell: wrapper, header type, cell padding, dividers),
  `WorkflowForm` (the recorder frame) and `Button` (the plum pill: `primary` /
  `secondary` / `link`, `accent` for a gradient label, `arrow` for one that
  navigates; renders a Link, an anchor or a button by which of `to` / `href` /
  neither it is given) each make one decision about padding, radius, type and
  colour, and a page never redeclares it. ⚠️ The formbox renderer's submit is
  vendor DOM and copies `Button`'s decisions by token in `App.css` — move one,
  move both. A page may pass a
  `className` for **layout or a domain colour only** — where a card sits, the
  colour of a FHIR resource type's pill — never a radius, padding, border or
  background. Before these existed 76 card surfaces used 29 padding/radius
  combinations and ~40 pills 12 paddings; the gates check that a value is on
  the token scale, not which value a role gets, so only a component can hold
  that. Reach for one of the seven before writing a new class; if none fits,
  the audit at `docs/plans/maintainability-audit-2026-09-15.md` §2.4 says how
  a variant is added (a named prop, never a seventh look).
- **Width has one owner per route, and the owner is whoever owns the header.** A
  page that renders its own `<PageHeader>` declares a root width, and it is
  `--page-width-prose` or `--page-width-wide` — those two are the whole
  vocabulary. A page that *inherits* its header from a layout inherits the
  layout's width and declares none.
  The Adoption Guide is the one layout serving both: `.implementation-guide`
  declares `prose` and `.implementation-guide--wide` the other, picked per
  section by **`width` on `GuideSection`** (`data/guideSections.ts`), which is
  required with no default. Ownership is unchanged — both declarations sit on
  the layout's own class family — and a *sub-page* root still may not declare a
  width. A new guide section chooses `prose` when unsure: `wide` on a prose page
  is invisible, while `prose` on a page with a table shows up at once.
- **`--measure-prose` is not a third page width.** It caps a *text run*, and it
  is in `em` because a measure is a character count, not a width. Put it on
  prose, never on a page root. Cap the text, not the box, when the two are set in
  different type sizes.
  **Prose has three sizes and no others** — `--font-size-lg` (lede),
  `--font-size-md` (body), `--font-size-base` (note) — enforced by `check:prose`
  RULE 5. Not new role tokens: a role aliasing a size is two names for one
  number. A smaller size does not shorten the line, because the `em` cap holds
  the character count; it only makes the paragraph narrower than its column.
  ⚠️ `check:prose` cannot see a prose run with **no** cap — that needs to know
  which elements hold long prose, which is content, not CSS. Measure a wide
  page's prose by hand after adding it. The same blind spot covers RULE 5: an
  uncapped run has no size for it to check either.
  The rationale for all four of these, the gates' exact limits, and the drift
  each was written against are in
  [`docs/internals/css-and-page-template.md`](docs/internals/css-and-page-template.md).
- **A recorder is bespoke because of what it writes, and it describes the ACT.**
  (The map itself is covered under "no raw FHIR" below.) Of the 11 workflow
  recorders in `toolViews.tsx`, 2 are the generic `WorkflowActionView` and 9 are
  bespoke because they write something other than one Communication.
  ⚠️ **"It is only a Communication" is not grounds to merge one** —
  `caring-contact` WAS the generic recorder, and stamped neither its profile nor
  the opt-out extension, so a Stage-8 measure's exclusion could never fire.
  ⚠️ **The prose is part of "no raw FHIR".** Settled 2026-09-17: a recorder's
  `lede`, labels and help describe the act — no resource type, profile name,
  extension id or `Element.path`, and no `<code>` at all. The wire format goes in
  `WorkflowForm`'s `fhirNote`, which renders inside the `useInspect()`-gated
  `CodeDrawer`. `check:fhir-render` RULE 3 parses the JSX text to enforce it.
  Which recorders are load-bearing, what that gate cannot see, and why a view
  cannot be derived from its ActivityDefinition are in
  [`docs/internals/tool-views.md`](docs/internals/tool-views.md).
- **`ehr-` no longer names the app's own chrome.** The standalone browsing chrome
  is `AppShell` / `.app-shell__*`. ⚠️ `.ehr-rubric`, `context-ehr-patient` and the
  `ehr` strings under `services/mock-ehr/` deliberately keep the prefix — they
  really are about EHR vendors, SMART scopes and host internals.
- **Routing:** `HashRouter` (see `web/src/main.tsx`) — GitHub Pages compatible.
- **The guide does not configure.** Settled 2026-09-15: the Adoption Guide's
  "Configure" group is gone, and with it the last guide section that wrote state
  another surface read. Tool Configuration lives at **`/settings`**, a page of
  the SMART app — which instruments a deployment offers is a fact about SPiER's
  own deployment, not about the EHR (the EHR never sees the tool catalog; its
  `/metadata` capability profile is the different, genuinely EHR-side fact).
  CDS Service stayed in the guide: it configures nothing, and it is the third
  thing that runs the pathway beside the two apps — which is the group it is in
  since 2026-09-17.
- **The guide's sidebar has three groups, and they are a claim about kind.**
  `GUIDE_GROUPS` (`data/guideSections.ts`) is **The standard** (Care Pathway,
  Tools, Data Dictionary — published artifacts and the contract over them),
  **The applications** (Provider App, Population Dashboard, CDS Service — the
  three things that run it) and **Evaluate** (Adoption Rubric). `GUIDE_SECTIONS`
  must stay **grouped-contiguous** in that order, because the pager walks it
  linearly; `guideSections.test.ts` pins that, plus the subsection rules below.
  ⚠️ **A page under `/guide` that is not in that file is checked by nothing** —
  `check:guide-boundary` and `check:catalog` both derive from it. A page that is
  reachable but should not be a sidebar row or a pager step is declared as a
  **`subsections` entry** on its owning section, whose `path` is the FULL
  sub-path (`tools/readiness`, never `readiness`) because both gates build
  `/guide/${path}`. Adoption Readiness is the one that exists: it renders one
  row per catalogued instrument entirely from the catalog, so it is a view of
  Tools rather than a peer of it.
  ⚠️ **`/settings` still does nothing in panel chrome**, and that is load-bearing
  rather than unfinished — `web/src/lib/toolEnablement.ts` has the four reasons,
  one of which this move retired. Read it before wiring the preset into the panel.
- **The guide explains and hosts; the mock EHR holds and launches.** `/patient/chart`
  and `/population` are **redirects to guide pages that explain the two SMART
  apps** (`/guide/provider-app`, `/guide/dashboard`); the apps themselves answer on
  `/patient/record` and `/population/caseload`. Decided 2026-09-09 — see
  [`docs/plans/embedded-panel-smart-launch.md`](docs/plans/embedded-panel-smart-launch.md)
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
- **The clinician-facing app shows no raw FHIR; the guide does.** One
  invariant, one gate point: `InspectContext` (`web/src/context/InspectContext.ts`)
  defaults to **false**, and only the `/guide` layout and `/guide/tools/:slug/try`
  turn it on. `FhirJsonViewer` and `CodeDrawer` return `null` without it, and the
  **three** call sites that would otherwise leave an empty wrapper behind check
  it too: `PatientDocuments`' disclosure row, `PatientPathway`'s
  `.cds-card-json`, and `CarePlanDisplay`'s JSON toggle and download. An empty
  wrapper is its own defect — a disclosure that opens onto nothing reads worse
  than no disclosure.
  ⚠️ **`ToolDetail` is NOT one of them, and this list said it was** until
  2026-09-17. It wraps its FHIR examples in a `<section>` with a heading and
  calls no `useInspect()`. It is safe only because `PatientJourney` is its one
  caller and that page is inside the guide, so inspection is always on where it
  renders; render it anywhere else and the heading outlives its content. The
  five files that check for themselves are `FhirJsonViewer`, `CodeDrawer` and
  the three above — `grep -rl useInspect web/src` is the list.
  ⚠️ **A FOURTH axis, not chrome mode, build surface or data source.** A
  standalone `/patient/record` browse is still the clinician's app; the public
  demo is the `demo` surface and is exactly where the app most needs to look
  production-grade. The reasoning is beside the context, not restated here.
  ⚠️ **The leaf gate cannot see a component that does its own `JSON.stringify`** —
  `CarePlanDisplay` did, and was missed by the plan's inventory, which was built
  by listing `FhirJsonViewer`'s call sites. **`check:fhir-render` derives that
  list instead**, so this is a gate rather than a thing to remember: serialize a
  resource or render a `<pre>` and you must have asked `useInspect()`. It covers
  the prose too — see the tool-views bullet above.
  ⚠️ **The 18 fillers and 11 recorders are ONE element definition**
  (`packages/tool-views/src/data/toolViews.tsx` — a package since 2026-09-19, so
  the rule is a boundary rather than a convention), rendered by two route families: the clinician's
  published `/patient/assessments/*` and `/patient/workflow/*` paths (the
  catalog's 36 launch paths, every CDS card's `type: "smart"` link, every SMART
  `intent`) and the guide's `/guide/tools/:slug/try`. They must stay one
  definition — two copies drift on a `persistName` and the guide then documents a
  resource the app does not write. **`npm run check:tool-view-routes`** pins that
  the map and every app's route lookups agree, by parsing both as text;
  `toolViews.test.ts` keeps only what is local to the map itself.
  ⚠️ `/guide/tools/:slug/try` is a SIBLING of the `/guide` layout, not a child:
  the views render their own `PageHeader`, and nesting would put two on a page.
  It is also deliberately not a `guideSections.ts` entry — it renders recorders
  that write to patient context, so it is not a guide page and `check:guide-boundary`'s
  premise does not hold for it.
- **Vite base path:** `/adoption-guide/` (see `web/vite.config.ts`). Don't hardcode absolute asset paths.
- **Two build surfaces, one route table.** `VITE_SURFACE=clinical` (`web/src/lib/surface.ts`)
  builds the two SMART apps with no guide route registered and no synthetic
  patient compiled in — `@spier/demo-population` resolves to an empty shim. A
  demo-only page is declared `IS_DEMO ? lazy(() => import(…)) : NotOnThisSurface`
  **inline** (a helper would keep the import reachable), a demo-only route sits in
  an `IS_DEMO && (…)` block, and a redirect that differs by surface is two literal
  `<Route>`s (the route-table reader wants `<Navigate to="…">` verbatim).
  `npm run build:clinical` then `npm run check:surface` reads BOTH bundles and
  checks every marker both ways; it is in the CI build job, not in `verify`.
  ⚠️ The alias reader scans `vite.config.ts` for the literal `find:` — even in a
  comment — and throws on one it cannot parse; that is why the config's comments
  say "alias entry" and not the property name.
- **Never hand-edit generated output** — `packages/fhir-artifacts/generated/`,
  `ig/fsh-generated/`, `docs/use-cases/dist/`, `web/.runtime-fhir/`, and
  `web/public/favicon.*` + `web/public/apple-touch-icon.png`. To change
  FHIR shapes, edit FSH in `ig/input/fsh/`; to change a Questionnaire, edit the
  JSON in `FHIR-Resources/`.

## Gotchas

- **Fresh worktrees need `npm install`** in `web/` before any npm script runs.
- **`copy-fhir` is incremental, on a CONTENT fingerprint — not mtimes.** It
  skips the ~30s SUSHI compile when `.copy-fhir-manifest` in the generated tree
  still matches the SUSHI version, the hash of every input's content, and the
  hash of the tree it produced. All three must agree, so a touched-but-unchanged
  input costs nothing while a hand-edited or truncated artifact rebuilds. Every
  caller (`predev`, `prebuild`, `pretest`) runs it plain; only `verify` passes
  `--force`. If FHIR data looks stale, run `npm run copy-fhir -- --force` —
  that still means recompile unconditionally.
  ⚠️ **CI's cache key for that tree comes from the same fingerprint** —
  `copy-fhir.mjs --print-input-fingerprint`. Never restate the input set as
  `hashFiles(...)` in a workflow; add new inputs to the script's input list and
  every job's key follows. `verify` keeps `--force` on purpose, so one job per
  run still compiles from source.
  ⚠️ **The SUSHI compile is retried 3× (10s, then 30s), and that is about the
  CLOUDFLARE deploy, not about flaky FSH.** SUSHI downloads seven FHIR packages
  from `packages.fhir.org` on a cold cache; a few minutes of trouble there failed
  the Workers build of the public demo on 2026-09-15, on a commit that touched no
  FHIR at all. The exposure is asymmetric — Actions caches the generated tree on
  the fingerprint above and usually skips SUSHI entirely, while Cloudflare has no
  equivalent and compiles from scratch on every deploy. It retries EVERY failure
  rather than matching a network error string, because a signature list is a
  guard that can silently stop guarding; a real FSH error just fails again, fast,
  since the first attempt warmed the package cache. `COPY_FHIR_SUSHI_ATTEMPTS=1`
  turns it off while debugging a real error. See `scripts/lib/retry.mjs`.
  ⚠️ `scripts/check-sushi-output.mjs` invokes SUSHI too and is **not** retried —
  it is a CI gate you can re-run, not a deploy.
- **Generated files must exist before `tsc -b`.** On a clean checkout, run
  `npm run copy-fhir` first or the typecheck/build fails on missing imports.
- **One canonical URL, one definition.** `ig/` is canonical for CodeSystems and
  ValueSets; `FHIR-Resources/` holds the 18 Questionnaires, 2 CarePlan templates
  and one ValueSet (`ASQ/yes-no.json`). ⚠️ **No CodeSystems live there** — this
  line said "and the few local CodeSystems with no FSH counterpart" until
  2026-09-18, describing a category of exception that no longer exists and
  inviting the very thing the next sentence forbids. A new CodeSystem goes in
  FSH; there is no local-exception path.
  Never define the same canonical URL in both trees — three ASQ CodeSystems did,
  and the `FHIR-Resources` copies silently shadowed the IG's with drifted
  `display` values. **`npm run`-free gate:
  `node scripts/check-canonical-uniqueness.mjs`** (needs SUSHI output; in
  `ig.yml`). ⚠️ SUSHI catches only *half* of this — it keys duplicates on
  resourceType + id and never reads `FHIR-Resources/` at all, so a collision on
  the same URL with a *different* id was caught by nothing before that gate.
- **Drift-prone hand-duplicated values.** Stage IDs, LOINC codes and ASQ
  disposition codes are duplicated by hand across `ig/input/fsh/` (canonical),
  `packages/core/src/lib/observationMappers/` and `packages/demo-population/src/`.
  When you change any such code, **grep the whole repo** for the old value and
  update every site.
- **The Stanley-Brown CarePlan transformation exists twice on purpose** — the
  `.fml` declares it, `carePlanMappers/stanleyBrown.ts` executes it in the demo,
  and both are compared against one golden file. Change the transformation and you
  must change both.
- **Tool licensing lives in the FSH, and only there.** Every ActivityDefinition
  carries `copyright` plus an `instrument-licensing-status` extension;
  `Tool.licensing` is *derived* from it. Do not reintroduce a `licensing` field in
  `tool-ui-metadata.ts`. A new tool with unsettled terms gets `#unknown`, not a
  permissive guess. **No status has been verified against the rights holder's
  *current* published terms** —
  [`docs/best-practices/licensing-verification-backlog.md`](docs/best-practices/licensing-verification-backlog.md)
  is the standing list of what is owed.
- **SMART registrations live in `web/src/config/smart-registrations.json`, and
  only there.** A SMART app does not have *a* `client_id` — it is registered
  separately with every EHR it launches from, so the file maps an issuer's
  ORIGIN to the id that EHR issued. ⚠️ **Deliberately a checked-in file and NOT
  an env var**: a build-time variable lets the deployed app and the EHR's actual
  registration disagree, and the disagreement is invisible until a launch fails
  at someone else's authorization server. `scripts/medplum-register-launch.mjs`
  READS this file rather than restating a UUID, which is what closes the loop;
  `smartClients.test.ts` asserts it still does, that every key is a bare origin
  (a FHIR base path silently never matches), and that no issuer is registered
  under the fallback id. ⚠️ A `client_id` is not a secret — it travels in the
  `/authorize` query string in the clear and this is a public client with PKCE.
  The reason an adopter replaces the file is that the registrations are not
  *theirs*, not that they are sensitive.
- **Tool ids live in the FSH too, as `ActivityDefinition.identifier`.** `tools.ts`
  **derives** the pairing; the hand-written map is deleted with no fallback, and
  `check:catalog` fails if it comes back. ⚠️ `TL-0NN` is not an AD id, and the
  mapping is many-to-one on purpose (the CAMS SSF-5 is one tool across four ADs).
  IG prose should link the AD page under the tool's *name*, not a bare id.
- ⚠️ **A huge `git status` in the ROOT checkout usually means the ref moved, not
  the files** — `git branch -f main origin/main` from a linked worktree updates
  the shared ref without touching the root's files or index, and the whole gap
  reports as *staged* changes nobody staged. **Diagnose from the reflogs before
  touching anything**: the wrong reading here is destructive, `git reset --hard`
  destroys the mtimes that date the divergence, and `git worktree remove` deletes
  the record of which session moved the ref. The three commands and the
  tree-hashing confirmation are in
  [`docs/internals/build-gotchas.md`](docs/internals/build-gotchas.md).
- **Two of `@formbox/renderer`'s dependencies are aliased to shims** in
  `vite.config.ts` (and therefore in vitest): `fhirpath/fhir-context/r5` → an
  empty object, `@lhncbc/ucum-lhc` → a throwing shim. Together they cut the
  assessment chunk 391 → 208 KB gzip. `check:fhir-r5` and `check:ucum` guard
  them; the shared alias reader **throws** on an alias form it cannot parse,
  because both gates treat "not aliased" as "nothing to guard" and pass. ⚠️ The
  aliases are anchored regexes in the array form — the object form matches by
  prefix and would swallow more than intended. Details in
  [`docs/internals/build-gotchas.md`](docs/internals/build-gotchas.md).

## Skills (`.claude/skills/`)

- **`assessment-to-ig`** — author the *full* FHIR artifact set for a new instrument (Questionnaire JSON + FSH ActivityDefinition/CodeSystems/ValueSets/example QuestionnaireResponse/Observation profiles + IG page + catalog wiring). Use when adding/FHIR-ifying an instrument.
- **`fhir-questionnaire-quality`** — review/improve a *single* FHIR R4 Questionnaire (or its QuestionnaireResponse/Observation contract) for interoperability. Use for scoped review of one form.
- **`concept-harmonization`** — the cross-instrument concept layer: shared risk-tier CodeSystems/ValueSets, ConceptMaps/StructureMaps, and derived Observations that let disparate tools map into one actionable representation. Use for translation/crosswalk work spanning instruments.
