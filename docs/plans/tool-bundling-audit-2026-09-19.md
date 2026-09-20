# Tool bundling audit — three axes, three verdicts

Written 2026-09-19 against `origin/main` at **`ce78e1f`** (#547, "The 29 tool
views become a package"). Every number below carries the command that produced
it. **The three axes were an audit and nothing was implemented for them.** The
two §5 findings, which are not bundling changes, WERE implemented in the same
PR — the measurements below describe the tree as it was when measured, and §5
says what changed.

**All three axes answer *no*.** Two of them are the wrong question as posed, and
the third is "not yet, and here is the trigger" — a trigger that shrank to one
condition when §3(a)'s blocker turned out not to exist. Per the brief's rule, **no
decision record is filed** — `docs/decisions/` records settled yeses, and there
are none.

What the audit *did* find worth acting on is in §5: two measured wins that have
nothing to do with bundling. Both are **implemented in the same PR as this
document** — §5.1 takes ~23.8 KB gzip off first paint on every surface, and its
diagnosis was wrong twice before it was right.

---

## 0. The baseline was wrong before it was right

⚠️ **The brief's starting facts were taken on a different commit.** The worktree
this audit began in sat at `a275a03` (#546), where `packages/tool-views` **does
not exist** — Axis C would have been unanswerable and every build number would
have described a tree that is no longer shipped.

```
git rev-parse --short origin/main     # ce78e1f
git merge-base --is-ancestor ce78e1f origin/main && echo YES   # YES
```

Reset to `origin/main` before measuring. This is the brief's own "compare
against the right baseline" rule firing on the brief itself, and it is the
reason the chunk figures below differ from the ones quoted in it
(1,026.80 KB vs 1,002.7 KB — #547 moved more into that chunk).

The gates are healthy on this baseline, with the corrected module counts
recorded in `docs/internals/web-gates.md` after the extraction:

```
cd web && npm run check:fhir-render check:template check:guide-boundary check:surface-links
#   fhir-render:     79 components, 11 recorders, 149 JSX text runs
#   template:        web/src 85+28, packages/ui/src 9, packages/tool-views/src 3
#   guide-boundary:  150 modules reached (floor 75)
#   surface-links:   210 modules reached (floor 105)
```

---

## 1. Axis B — **No, and the question is misaimed.** The weight is FHIRPath, not the forms *and not the renderer*

The brief already suspected the forms were not the weight. They are not — but
neither is `@formbox/renderer`, which is where the brief's own framing stops.

### The measurement

`npm run build`, then a rollup `generateBundle` probe that dumps
`chunk.modules[].renderedLength` for every module (probe config written, run,
and deleted; `git status` clean afterwards):

```
cd web && npm run build
# dist/assets/QuestionnaireView-Cao1ectN.js   1,026.80 kB │ gzip: 209.24 kB
```

Attribution of that chunk, 144 modules, 1,883.6 KB rendered (pre-minify):

| Origin | Rendered | Share |
|---|---:|---:|
| `fhirpath` (engine + R4 type model) | 924.5 KB | **49.1%** |
| `antlr4` (the FHIRPath parser runtime) | ~435 KB | **23.1%** |
| `@formbox/renderer` | 234.5 KB | 12.5% |
| `mobx` + `mobx-utils` + `mobx-react-lite` | 163.6 KB | 8.7% |
| `@formbox/hs-theme` | 72.8 KB | 3.9% |
| `@formbox/*` (fhir, strings, theme) | 40.7 KB | 2.2% |
| **`packages/tool-views` — our code** | **10.8 KB** | **0.6%** |
| the 18 forms | **0 KB** | **0%** |

A single file, `fhirpath/fhir-context/r4/path2Type.json`, is **446.1 KB
rendered** — more than the renderer, mobx and the theme combined.

### Two facts that end the axis

**The 18 forms are not in this chunk at all.** At the time of measurement all 18
JSON modules (166.8 KB rendered) compiled into the *eager* `index` chunk — they
are now in a lazy chunk of their own (§5.1), but in neither case are they in
this one. Splitting the views per tool cannot move a form out of a chunk it was
never in.

**There is nothing to split into 18 pieces.** The 29 catalog entries are **12
distinct components**; 19 of the entries are the same `QuestionnaireView`:

```
grep -o "<[A-Z][A-Za-z]*View" packages/tool-views/src/data/toolViews.tsx | sort | uniq -c
#   19 <QuestionnaireView   + 11 bespoke recorders, one each
```

The recorders already split, as the brief notes. A per-tool split of the fillers
produces 18 chunks that each import the same renderer and the same FHIRPath —
first load worse, every subsequent load no better.

### What would actually help, and what it is worth

Two probe builds, each an alias stubbing a dependency, measured against the
same baseline:

| Build | raw | gzip | vs baseline |
|---|---:|---:|---:|
| baseline | 1,026.80 KB | 209.24 KB | — |
| `fhirpath/fhir-context/r4` stubbed | 575.58 KB | 155.16 KB | **−54.1 KB gzip** |
| `fhirpath` stubbed entirely | 308.19 KB | 81.12 KB | **−128.1 KB gzip (61%)** |

FHIRPath is **61% of the gzip of the chunk every assessment route pulls**, and
the entire FHIRPath surface in the corpus is **two expressions, textually
identical**:

```
grep -ro "enableWhenExpression\|calculatedExpression\|initialExpression\|answerExpression" ig/input/resources/questionnaires --include="*.json" | sort | uniq -c
#   2 calculatedExpression        ← PHQ-9 total, SBQ-R total
#   0 everything else
grep -rc '"enableWhen"' ig/input/resources/questionnaires --include="*.json"   # 34, all the plain non-FHIRPath kind
```

Both are `%resource.item.where(linkId.startsWith('q')).answer.weight().sum()`.

⚠️ **The 54 KB prize is NOT available, and this was verified rather than
reasoned.** Serving the `no-r4-model` build and opening the PHQ-9 renders:

> PHQ-9 Total Score
> **Failed to evaluate calculated expression because it returned an error**

The baseline build, served the same way at the same route, renders `PHQ-9 Total
Score` with no error. So the stub is the cause, not a pre-existing fault. Note
the failure mode: it is **inline form text, with nothing on the console** — a
silently wrong-looking score, which is the one outcome `src/shims/ucum-lhc.ts`
was written to avoid.

The honest read: the 128 KB is real but it is the price of two sums, and
removing it means computing those two totals in TypeScript instead of FHIRPath
and dropping `calculatedExpression` from two Questionnaires. That trades a
**declarative, IG-published scoring rule** for app code — directly against
"behaviour derivable from the IG", which is the third audience's design
constraint. **Not recommended on size grounds.** Recorded here so the next
person does not re-derive it.

---

## 2. Should we switch off `@formbox/renderer`?

Asked alongside the axes; the Axis B measurement answers it. **No — and not
because formbox is good, but because the weight is not formbox.**

`@formbox/renderer` is 12.5% of the chunk. Every SDC-conformant renderer depends
on `fhirpath.js`, so **switching cannot touch the 61%**:

```
npm view @aehrc/smart-forms-renderer version dependencies   # 1.5.0
npm view lforms version dependencies                        # 44.0.0
```

| | `@formbox/renderer` 0.2.1 | `@aehrc/smart-forms-renderer` 1.5.0 | `lforms` 44.0.0 |
|---|---|---|---|
| fhirpath | peer `^4.6.0` | dep `^4.10.1` | dep `^4.8.0` |
| UI stack | own theme (`@formbox/hs-theme`) | **full MUI 7** + `@mui/lab` + `@mui/x-date-pickers` + emotion + **3 `@fontsource` packages** | **Angular 20** + `zone.js` + `jquery` + `ng-zorro-antd` + `moment` |
| also pulls | mobx | react-query, 2 DnD libraries, fhirclient, 4 lodash packages | `@lhncbc/ucum-lhc` |
| licence | MIT | Apache-2.0 | NLM public domain |

Both alternatives are **larger**, and each costs something specific here:

- **smart-forms** imports a second design system into a repo whose central rule
  is "design tokens only, eight primitives own the surfaces". MUI would be the
  ninth owner of padding, radius and type, and `check:tokens` / `check:css-dead`
  read none of it.
- **lforms** puts the Angular runtime inside a React app, and re-introduces
  `@lhncbc/ucum-lhc` — the 557 KB / 117 KB gzip library `src/shims/ucum-lhc.ts`
  deliberately stubs out. It would give back a prune the repo already paid for.

**The real argument for switching is maturity, not size, and it is not
compelling yet.** `@formbox/renderer` is at **0.2.1** — a pre-1.0 dependency
from Health Samurai on the render path of every instrument. That is a genuine
supply risk worth naming, and the SMART apps being open-sourced makes the
dependency public. But the mitigation is already in place and is cheap:
`QuestionnaireView` touches it at exactly **two import lines**, and the two shim
gates (`check:ucum`, `check:fhir-r5`) both fail if the renderer's internals move
under them.

```
grep -rn "@formbox" packages/tool-views/src
#   QuestionnaireView.tsx:3: import Renderer from '@formbox/renderer'
#   QuestionnaireView.tsx:4: import { theme } from '@formbox/hs-theme'
```

⚠️ One coupling is **not** at those two lines and should be on the record before
anyone swaps renderers: `App.css` reproduces `Button`'s token decisions for the
renderer's vendor-DOM submit, and `check:css-dead` scrapes the installed theme
to know which class selectors are live. A renderer swap invalidates both. That
is the cost to budget, and it is small — but it is not zero, and it is not
visible from the import lines.

**Verdict: stay.** Revisit if formbox goes unmaintained (no release in ~12
months), or if SPiER grows a Questionnaire needing SDC features formbox lacks —
at which point the comparison is about *coverage*, and should be re-run against
what the forms then need rather than against bundle size.

---

## 3. Axis A — **Not yet, and the reason is licensing alone.** The closure is small

### The measurement

The brief warned against filename grep, and it was right to: a canonical-URL
reference graph over `ig/fsh-generated/resources` + `ig/input/resources/questionnaires` (303
resources, excluding the `ImplementationGuide` resource itself, which references
all 303 and drowns every walk).

Two corrections were needed before the numbers meant anything, both recorded
because both produced confident nonsense first:

1. **Reverse edges must stop at instances.** Following out of an example
   Observation reaches the pathway PlanDefinition and from there every one of
   the 43 ADs — which reported 11 unrelated instrument tools as sharing 111
   artifacts each. Instances are leaves.
2. **Examples must be anchored to the tool's own Questionnaire or AD**, not to
   any node in its closure — otherwise every example attaches through a shared
   `meta.profile`.

Final per-tool closure (`scripts` retained in the session scratchpad; the graph
is ~60 lines and is reproducible from this description):

```
closure size: min 5, median 11, max 25, mean 11.6
union of all 40 tool closures: 207 of 303 corpus resources
artifacts reached by more than one tool: 29
tools with no output profile at all: 8
```

**The closure of one tool is small and mostly disjoint.** Only **29 artifacts**
are shared by more than one tool, and only **three** are shared by all forty —
the `instrument-licensing-status` triple (extension StructureDefinition +
CodeSystem + ValueSet). The C-SSRS family (3 tools) shares its risk-level
CodeSystem and its example QRs with itself and nothing else.

So the brief's "25 artifacts for the C-SSRS" was close, but it is a *family*
number, not a per-tool one. **Per-AD keying would split the CAMS SSF-5 into
four** exactly as warned; keyed per tool id, TL-020 comes out as one tool of 4
ADs and 25 artifacts, the largest closure in the set.

### Why "not yet"

**(a) ~~The IG does not publish the thing a bundle must carry.~~ — RETRACTED
2026-09-19, the same day. It does.**

This section originally read: *"every Questionnaire in a tool closure comes from
`ig/input/resources/questionnaires/` and none from the IG, so a per-tool Bundle is not a slice of
the IG but a new publication."* The measurement behind it was real and the
inference from it was wrong:

```
Questionnaire nodes inside tool closures: 18 from ig/input/resources/questionnaires/, 0 from ig/fsh-generated/
```

⚠️ **`ig/fsh-generated/` is SUSHI's output, and SUSHI never reads the
Questionnaires.** They reach the IG through `path-resource` entries in
`sushi-config.yaml` — one per tool folder, pointing at the tracked
`ig/input/resources/questionnaires` symlink — which the **IG Publisher**
consumes, not SUSHI. Measuring the SUSHI tree could never have answered the
question it was asked. CLAUDE.md states the mechanism plainly and this audit read
past it; the brief asserted the same false claim and it was taken on trust
instead of checked.

Verified against the live published IG, 2026-09-19:

```
curl -sL -o /dev/null -w "%{http_code}" .../ig/Questionnaire-PHQ-9.html                  # 200
curl -sL -o /dev/null -w "%{http_code}" .../ig/Questionnaire-C-SSRS-Screener.html        # 200
curl -sL -o /dev/null -w "%{http_code}" .../ig/Questionnaire-StanleyBrownSafetyPlan.html # 200
curl -sL -o /dev/null -w "%{http_code}" .../ig/Questionnaire-ASQ-Screening-Tool.html     # 200
```

⚠️ Follow the redirect — a bare `curl -I` returns 307 (path normalization on the
Worker's own origin) and reads as a failure. All ten Questionnaire-bearing tool
folders are `path-resource` entries; the eleventh folder on disk, `CARS-S`, holds
only a README and licensing notes and correctly is not one.

**So this blocker does not exist, and Axis A is easier than this document first
said.** The IG already publishes everything a per-tool Bundle would carry. What
remains is (b) alone.

**(b) The licence-encumbered tools are the ones an adopter most wants
pre-packaged — and the count is smaller than it looks.**

Grouped **by tool** rather than by AD (the brief's trap, caught here):

| Status | Tools | ADs |
|---|---:|---:|
| spier-authored | 23 | 23 |
| public-domain | 6 | 6 |
| registration | 6 | 6 |
| commercial | **4** | 7 |
| unknown | 1 | 1 |
| | **40** | **43** |

The AD-level split `check:catalog` reports is 7 commercial; at tool level it is
**4**, because the CAMS SSF-5's four ADs are one tool. Structurally: **29 tools
(23 SPiER-authored + 6 public-domain) could be bundled without a redistribution
question; 11 could not** (4 commercial + 6 registration + 1 unknown).

⚠️ Per the brief, no licence is resolved or guessed here, and
`docs/best-practices/licensing-verification-backlog.md` records that **no status
has been verified against the rights holder's current published terms** — so
even the 29 rest on unverified metadata. **TL-025 is `#unknown` and must not be
bundled under any recommendation.**

**(c) A per-tool bundle set omits what makes SPiER more than a form library.**
96 of 303 artifacts fall inside no tool closure, including:

- **all 8 `Measure`s** and the CQL `Library` (`SPiERSuicideSaferCareMeasures`) —
  the entire Stage-8 measurement layer;
- **all 6 `ConceptMap`s** — the crosswalk (`ASQDispositionToRiskTier`,
  `CSSRSRiskLevelToRiskTier`, `SPiERRiskTierToLOINC`, …). A crosswalk belongs to
  *two* tools or to none, and cannot be placed in a per-tool bundle without
  duplicating it.

⚠️ **A structural finding worth its own line: an ActivityDefinition names no
output profile.** All 39 output-profile references live on `PlanDefinition`
actions:

```
# ActivityDefinition-AdministerPHQ9.json has no `profile` key at all
# across all PlanDefinitions: outputs 40, profile refs 39
```

So a bundle keyed on the AD ships the form and its terminology but **not the
profiles its output must conform to** — those are declared by the pathway. Any
per-tool bundler must resolve them through the PlanDefinition, which is
precisely the artifact per-tool bundling is trying to avoid shipping.

### The trigger

Per-tool bundles become the right unit when **both** hold for a specific
instrument:

its licence status is **verified** against current published terms — not
`#unknown`, and confirmed rather than inherited.

That is the whole trigger. The second condition this section originally carried
("the IG publishes that instrument's Questionnaire itself") was retracted with
(a) above: it was already true when the audit was written.

Until then the closure work is not wasted: it says the bundle would be ~11
resources, that the sharing problem is 29 artifacts and not a tangle, and that
the natural unit is the **instrument family** (C-SSRS, CAMS), not the tool and
not the AD.

---

## 4. Axis C — **No.** The open-sourcing boundary does not cut through this package

The axis asks whether `packages/tool-views` should be several packages *given
the SMART apps get open-sourced*. The premise does not hold: the open-sourcing
line runs between the SMART apps and the mock EHR, and **tool-views is wholly on
one side of it.**

```
grep -rn "tool-views" services/*/src        # (no matches — no Worker imports it)
find packages/tool-views/src -name "*.ts*" -o -name "*.css" | wc -l    # 36 files
find packages/tool-views/src \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" | xargs wc -l   # 4,484 lines
```

Three reasons to leave it whole:

1. **4,484 lines across 36 files is not a package-splitting problem.** For
   comparison it is one `QuestionnaireView` plus eleven recorders.
2. **Most consumers want the contexts, not the views.** Of ~20 import sites in
   `web/src`, the majority reach for `context/PatientContext`,
   `context/PresentationContext` or `lib/dates` — not a tool view. A
   views/contexts split is the one the README already forecloses: *"this package
   owns both sides, the context and its consumers, so nothing is inverted."*
   Splitting them re-inverts it.
3. **A fillers/recorders split is a 1-vs-11 split, not 18-vs-11.** The fillers
   are one component; a `@spier/tool-views-fillers` package would contain
   `QuestionnaireView` and a data table.

### If it is split anyway, these must learn about it

Named per the brief's rule:

- **`scripts/lib/app-roots.mjs`** — today it declares **exactly one** root,
  `web/src` (floor 42). It does *not* list `packages/tool-views/src`. Any new
  `packages/<x>/src` holding app-ish `.tsx` needs a row plus a per-root floor,
  and the `undeclaredAppTrees` hard-failure keys on `src/main.tsx` / `src/App.tsx`
  so it will **not** catch a new *package* tree — only a new *app* tree.
- **`scripts/lib/style-roots.mjs`** — already carries
  `packages/tool-views/src` (floorCss 1, floorSrc 12). A split moves those CSS
  files; both halves need rows, and a floor that goes with a deleted row is the
  documented silent-pass.
- **`scripts/lib/module-graph.mjs`** — derives `@spier/<pkg>` →
  `packages/<pkg>/src` from the filesystem, so it follows a new package with no
  edit. This is the one that does *not* need changing, and it is the one that
  previously broke.
- **`check:tool-view-routes`** — iterates declared app roots against the one
  map. Two maps means the rule "this one definition serves every app" no longer
  has a single subject; that is the gate whose premise a split destroys.
- **`vite.config.ts` + `vitest.config.ts` + two `tsconfig.json`s** —
  the README's four-places rule, per new package.

**The gate I would plant and cannot:** I can construct the plant for a dropped
`style-roots` row (delete the row, watch `uncoveredStylesheets` fail) because
that mechanism already exists. I **cannot** construct a plant proving a
views/contexts split stays honest, because the failure there is an inverted
dependency that TypeScript resolves happily — `packages/ui`'s own README records
that this is why `WorkflowForm` never moved. That is an argument against the
split, not a gate to write.

---

## 5. What the audit found that is worth doing

Neither is a bundling change. Both are measured.

### 5.1 The 18 forms loaded eagerly, on every page, for every visitor — **fixed in this PR**

All 18 Questionnaire JSON modules — **166.8 KB rendered** — compiled into the
*entry* chunk of both surfaces: 10.0% of demo's, **11.3% of clinical's**, the one
an EHR frames.

⚠️ **The cause was diagnosed wrong twice, and the second wrong answer survived a
full read of the import graph.** Recorded because the mistake is instructive:

1. *First answer — the registry.* `packages/core/src/data/questionnaires.ts`
   static-imports all 18 files and is imported by
   `observationMappers/{phq9,sbqr,fallbackDispatch}.ts` for `ordinalForAnswer`,
   and those are reachable from the eager registry and measure engine. True, and
   a real coupling — but **not the binding edge**. Fixing it alone moved
   **0 KB**, measured.
2. *The actual cause — the route table.* `apps/guide/src/App.tsx` imports `TOOL_VIEWS`
   **statically**, and `toolViews.tsx` builds its 29 entries as JSX elements at
   module scope. Every entry therefore *held* a resolved Questionnaire. Every
   view component was already `lazy()` — which is exactly why this hid: laziness
   of the component is not the property that matters. **What an eagerly-imported
   map holds is eager, whatever it renders.**

**The fix, in three parts:**

- `QuestionnaireView` takes a `questionnaireUrl` (canonical) instead of a
  resource, and resolves it from `QUESTIONNAIRE_BY_URL` inside itself — that
  module is lazy, so the JSON follows it out of the entry chunk.
- `toolViews.tsx` imports no Questionnaire at all. The canonicals come from
  `questionnaire-urls.generated.ts`, emitted by `copy-fhir.mjs` from the same
  files, so no canonical is hand-typed and `QuestionnaireId` makes naming a
  non-existent one a type error.
- The SDC `weight()` join moved to `packages/core/src/data/questionnaireOrdinals.ts`,
  reading `questionnaire-ordinals.generated.ts` (59 weighted options across 2
  Questionnaires — PHQ-9 and SBQ-R are the only instruments with ordinals, and
  `grep -rl ordinalValue ig/input/resources/questionnaires` confirms it). This is item 1 above: it
  moves nothing by itself, but it stops the domain layer dragging 18 forms
  through the registry, which would otherwise re-create the problem on the next
  eager consumer.

**Measured, `npm run build` before and after:**

| surface | entry chunk before | after | saved |
|---|---:|---:|---:|
| demo | 230.25 KB gzip | **206.42 KB** | **−23.83 KB** |
| clinical | 204.00 KB gzip | **180.27 KB** | **−23.73 KB** |

The assessment chunk did not grow in exchange: `QuestionnaireView` went
209.24 → 209.35 KB gzip (+0.11), because on the demo surface the forms split into
their own `questionnaires-*.js` chunk rather than joining it.

**Gated by `npm run check:eager-forms`** (in `verify`), which walks *static*
imports from every declared app entry module and fails if a `ig/input/resources/questionnaires/`
JSON is reachable, printing the import chain. Proved by planting, each run and
reverted:

| Planted | Result |
|---|---|
| `toolViews.tsx` imports a Questionnaire resource again — the real defect | ✗ all 18 forms, with the chain `main.tsx → App.tsx → toolViews.tsx → questionnaires.ts → …` |
| `QuestionnaireView` imported eagerly instead of `lazy()` | ✗ |
| `APP_ROOTS` emptied — the silent-pass class | ✗ "this gate checked nothing" |

⚠️ **The first version of that gate PASSED the real defect**, and the reason is
worth keeping: it stripped block comments before line comments, and App.tsx's own
prose contains `/patient/*` — whose `/*` opened a block comment that a later `*/`
closed, swallowing the single import the gate exists to police. It walked 104
modules and reported ✓. Line comments are stripped first now, and the module
count (111) is itself the tell that the walk reaches further than it did.

### 5.2 `check:catalog` reports the licensing split per AD, where the decision is per tool

`✓ licensing: … (6 public-domain, 6 registration, 7 commercial, 23
spier-authored, 1 unknown)` counts ActivityDefinitions. Every question anyone
asks of that line — *which instruments can we redistribute, which need a
licence* — is a question about **tools**, where the answer is 4 commercial, not
7. The two differ only for `MULTI_AD_TOOLS`, which is exactly the merge the gate
was written to make visible. Reporting both counts on that line is a one-line
change and removes a number that reads as an answer to a question it does not
answer.

---

## Appendix — commands

```bash
# baseline
git rev-parse --short origin/main                       # ce78e1f
cd web && npm install && npm run build && npm run build:clinical

# chunk attribution (probe config, since deleted)
#   vite build with a generateBundle plugin dumping chunk.modules[].renderedLength

# probe builds
PROBE=no-fhirpath  npx vite build --config vite.probe.config.mts   # 308.19 kB / 81.12 kB gzip
PROBE=no-r4-model  npx vite build --config vite.probe.config.mts   # 575.58 kB / 155.16 kB gzip

# runtime verification of the no-r4-model probe
#   vite preview --outDir dist-probe-no-r4-model, then #/patient/assessments/phq-9

# FHIRPath surface
grep -ro "calculatedExpression\|enableWhenExpression" ig/input/resources/questionnaires --include="*.json" | sort | uniq -c
grep -rc '"enableWhen"' ig/input/resources/questionnaires --include="*.json"

# form JSON weight
find ig/input/resources/questionnaires -name "*.json" -exec cat {} + | wc -c        # 253592
find ig/input/resources/questionnaires -name "*.json" -exec cat {} + | gzip -9 | wc -c   # 29509

# closure graph: canonical-URL reference walk over
#   ig/fsh-generated/resources + ig/input/resources/questionnaires, ImplementationGuide excluded,
#   instances as leaves, examples anchored to the tool's Questionnaire/AD

# alternatives
npm view @aehrc/smart-forms-renderer version dependencies
npm view lforms version dependencies
```
