# CLAUDE.md

Guidance for AI agents changing this repo (SPiER — FHIR artifacts + adoption-guide demo app).

## Repo layout

- `ig/` — FHIR Implementation Guide. FSH sources in `ig/input/fsh/` are compiled by SUSHI to `ig/fsh-generated/resources/` (gitignored). This is the **canonical, machine-readable** source for Profiles, ValueSets, CodeSystems, ActivityDefinitions, PlanDefinitions, and example Instances.
- `FHIR-Resources/` — hand-authored FHIR Questionnaire JSON (plus a few CarePlan templates), one folder per instrument (ASQ, PHQ-9, C-SSRS, SBQ-R, CAMS, Stanley-Brown). Imported **directly** by `web/src/App.tsx` at runtime.
- `packages/core/` — the **React-free domain layer** (#389): FHIR types, the tool
  catalog, instrument + care-plan mappers, the `FhirDataSource` seam, pathway /
  registry / measure logic, CDS Hooks, FHIRcast. Consumed as `@spier/core/<path>`
  by the app and both Workers, which have **zero** deep imports into `web/src`.
  ⚠️ **Its tests live in the mirrored path under `web/src`**, so web's `verify`
  covers it; moving them would need a fourth pipeline.
- `packages/demo-population/` — the 14 demo patients + scenario slices (#388).
- `packages/fhir-artifacts/generated/` — SUSHI's output, gitignored (#392).
- `web/` — React 19 + TypeScript (strict) + Vite app. Consumes generated FHIR JSON copied into `packages/fhir-artifacts/generated/` by `web/scripts/copy-fhir.mjs`, and Questionnaires imported from `FHIR-Resources/`.
- `docs/` — project/reference docs. `scripts/` — repo-level helper scripts.

## Verification commands

Run these before considering a change done.

In `web/`, the one-shot entry point is **`npm run verify`** — it runs copy-fhir (forced), typecheck, both linters, every `check:*` drift gate listed below, and the unit tests in sequence. (**Deliberately not a count.** This line said "eleven" while `verify` ran fourteen, because a pinned number goes stale silently on every gate added — the same failure as a stale `check:codings` floor in #232. If you add a gate, add it to this list; there is no number to bump.)

⚠️ **CI runs `npm run verify` itself**, rather than re-listing its steps, so a
gate added to `package.json` is enforced automatically. It did not always: the
`verify` job in `web-lint.yml` hand-listed a subset, and **eight gates ran only
on developer machines** — `check:template`, `check:patients`, `check:fallback`,
`check:measures`, `check:reassessment`, `check:dates`, `check:ucum`,
`check:fhir-r5`. All eight passed and all eight together take ~3s, so cost was
never the reason; a hand-copied list simply has nothing to compare itself
against. **Do not re-expand that job into individual steps.** The fast
`lint-css` job deliberately re-runs the copy-fhir-free gates for quick feedback;
that overlap is intentional, and nothing may live there that is not also in
`verify`. The individual pieces, in the order `verify` runs them:
```
npm run copy-fhir      # compile IG via SUSHI + copy resources into src/data/fhir/ (do this FIRST)
npx tsc -b             # typecheck (project references; needs generated files present)
npm run lint           # eslint
npm run lint:css       # stylelint (design-token enforcement)
npm run check:tokens   # every var(--token) resolves to a real definition
npm run check:template # page template: one header implementation, one owner of the page inset
npm run check:ucum     # the UCUM shim is still safe: no quantities in the Questionnaires,
                       # and the shim still covers every method its consumers call
npm run check:fhir-r5  # the R5-model shim is still safe: every fhirVersion is "r4",
                       # and the renderer still imports the specifier we alias
npm run check:crosswalk  # concept-crosswalk validation
npm run check:extract    # observation-extract validation
npm run check:core-boundary # packages/core stays React-free and DOM-free — the constraint
                         # that makes the boundary worth drawing. A feature-detected
                         # browser API (`typeof BroadcastChannel === 'undefined'`) is
                         # allowed; an unguarded one is not. `alert` is deliberately
                         # NOT forbidden: `RiskAlert` values are named `alert`
npm run check:guide-boundary # the Adoption Guide holds no patient data — it explains and
                         # configures the pathway; the caseload lives on the EHR side
                         # (#391). Walks the guide's pages TRANSITIVELY, so a guide page
                         # importing a component that reads fixtures is caught too
npm run check:catalog    # tool-catalog wiring (stubs / UI metadata / ActivityDefinitions /
                         # questionnaire URLs BOTH ways / per-AD licensing metadata).
                         # Check B stops a TOOL from reaching the app with no
                         # ActivityDefinition; check C stops the artifact one
                         # layer down — a Questionnaire in FHIR-Resources/ that
                         # no AD administers, which was ungated until 2026-08-20
npm run check:stages     # stage ids in population data vs canonical FSH stage list
npm run check:fallback   # fallback-dispatch LOINC item codes vs Questionnaire JSON
npm run check:readers    # every observation mapper's answer READS vs the Questionnaire's
                         # declared item `type` — see the mapper-reader note below
npm run check:patients   # the 14 demo patients' demographics agree across all THREE
                         # sites: demo-population/src/patients/*.json (canonical), patients.json
                         # (display copies), and populationToFhir's MRN system in
                         # PatientProvider.tsx — which is SCRAPED, not restated
npm run check:scenarios  # BOTH halves of the population-scenario gate:
                         #  check-scenario-responses.mjs — QuestionnaireResponses vs their
                         #    Questionnaire (linkIds, nesting, answer options, ranges)
                         #  check-scenario-resources.mjs — every OTHER bucket (Observation,
                         #    CarePlan, Communication, EpisodeOfCare, Appointment,
                         #    ServiceRequest, Procedure, DocumentReference, Consent, Flag,
                         #    Task) — see the scenario-gate note below for what it does NOT do
npm run check:dates      # the scenario fixtures' clinical dates are still coherent
                         # RELATIVE TO their anchor — a `fulfilled` appointment dated
                         # next week, a reassessment overdue by months. Default is
                         # --check (validates what is on disk and writes nothing);
                         # `--apply` is the separate re-dating command, so the script's
                         # name says "shift" while the gate only reads
npm run check:measures   # Stage-8 Measure criteria vs the measures.ts engine
npm run check:reassessment # the per-tier reassessment cadence agrees across all THREE
                         # places it is stated: the PlanDefinition (FHIRPath condition
                         # *and* action.code), the app, and the CQL's
                         # ReassessmentIntervalDays. Also that the tiers deliberately
                         # left out (imminent, no-risk) stay out — an interval
                         # appearing for `imminent` would answer an open clinical
                         # question by accident
npm test                 # vitest
```

Deliberately **not** in `verify`, because it needs a terminology server and so
cannot be offline-reproducible — it runs nightly instead:
```
npm run check:codings    # every LOINC / SNOMED / terminology.hl7.org code+display
                         # literal in web/src and services/, checked against tx.fhir.org
```

Its floors are per source **and** per vocabulary family, and the guard loop reads
the declared floors rather than the family list — see the comment on `SCAN`. Both
directions of that contract are now enforced rather than requested: deleting a
family from `EXTERNAL_FAMILIES` leaves its floor behind and starves, and *adding*
one without a floor in every `SCAN` entry fails at startup. Declare a real zero
as `0`; never leave it out.

A floor asserts **liveness, not completeness** — "did this scan still look at
this vocabulary in this source" — so the convention is roughly half the real
count. That needs a deliberate re-check whenever a source grows, because nothing
re-checks it on its own: #43 doubled the manifest's SNOMED inventory from 10
codings to 20 while its floor sat at 5, dropping it to a quarter of the real
count with nothing going red (#232). Every run prints the live count beside each
floor, so any recent nightly log tells you where the ratios stand.

⚠️ **A floor only protects the source as a whole, so `SCAN` entries deliberately
overlap.** When one path holds two independent contributors, a whole-path floor
cannot tell them apart and losing either one stays green. #261 measured this:
reverting the data dictionary to its old un-gated shape dropped `web/src` LOINC
from 69 to 41, still clearing a floor of 34, while ~28 codings silently left the
scan. The fix is a second, narrower `SCAN` entry (`web/src/data/catalog`) that
overlaps the first — safe, because `found` is keyed by system|code|display and
`perSource` is tallied per entry. **When you add a substantial new source of
codings inside an already-scanned tree, give it its own entry** rather than
assuming the parent floor covers it.

⚠️ **The two timer-driven workflows have a named reader and a written triage
path — `docs/scheduled-checks-triage.md`.** A red nightly has two causes needing
opposite responses (real drift → fix the code; `tx.fhir.org` down → re-run), and
`roadmap-snapshot.yml` opens its own PR only while the `ROADMAP_PR_TOKEN` PAT is
live — the org still forbids Actions from opening PRs, so an expired PAT falls
back to `GITHUB_TOKEN` and silently returns to the hand-opened path. Both
workflows link that doc from every issue they file. Note also that `schedule`
runs only from the default branch, and GitHub disables scheduled workflows after
60 days of repo inactivity.

In `ig/` — the package is `fsh-sushi`, so a bare `npx sushi .` fetches the wrong
thing and fails in a fresh worktree:
```
npx fsh-sushi .        # compile FSH → fsh-generated/resources/
```

⚠️ **A clean SUSHI run is not a quiet one.** Slicing `.category` (#271) makes
every Instance that reaches the element by numeric index emit an advisory
warning. **6 of those are expected today, all on `Communication`**, and they are
the only benign shape: `category[+].text` writes a *sub-element* of index 0, so
the concept-domain coding merges into that CodeableConcept and both survive.

⚠️ **The other shape was never benign, and this file used to say it was.** A
whole-value `* category[+] = <coding>` was being **overwritten** by the domain
slice resolving onto index 0 — 23 of 25 example Instances silently lost their
`survey` / `procedure` / `problem-list-item` / SNOMED category, and no gate saw
it, because a missing optional category is not a validation error. Those profiles
now declare their standard category as a **named slice**
(`SurveyCategorySlice` and friends in `ig/input/fsh/concept-layer.fsh`), which
fixed the loss, cut the warnings 31 → 6, and made the instrument Observations
conformant to `us-core-observation-screening-assessment`. `check-sushi-output.mjs`
now allows the warning **only for `Communication`** — if another resource type
starts emitting it, read the generated JSON before touching the allowlist.

The remaining cost is that a real warning arrives in a field of expected ones, so
from the repo root:
```
node scripts/check-sushi-output.mjs        # compile ig/ and gate the warning SHAPE
node scripts/check-sushi-output.mjs <log>  # gate an already-captured compile log
```
It asserts the **shape** of every warning against a reasoned allowlist, never a
count (a pinned number churns on each new Instance and trains people to bump it
— what a stale `check:codings` floor already did in #232), and reconciles its own
parse against SUSHI's `N Errors / N Warnings` summary so a change in SUSHI's
output format fails loudly instead of passing vacuously. `ig.yml` runs it on the
tee'd output of its compile step; a new expected warning belongs in `ALLOWED`,
with the reason it is expected.

Also at the repo root, and dependency-free — `ig/input/pagecontent/how-to-read.md`
describes the guide's navigation in prose while `ig/sushi-config.yaml`'s `menu:`
block defines it:
```
node scripts/check-ig-menu.mjs   # the IG menu and its prose restatement agree
```
⚠️ **The IG Publisher cannot see this drift.** Its broken-link check only sees
links that *exist*, and a bullet describing a menu entry is not a link. Both
directions had already gone wrong with nothing going red, and each is caught by a
different rule here:

- the **Guidance** bullet was missing two live sub-entries (*Relationship to Other
  IGs* and *Measurement (Stage 8)*) until `9702356` corrected it by hand;
- a **Downloads** bullet described a menu entry and a page that never existed —
  introduced with the page in `bf4eb87` and still there at `dd0a53c`, so
  `/ig/downloads.html` was a 404 for the guide's whole life while its own map
  sent readers to it. `fhir.base.template#current` emits no `downloads.html`;
  that is a US Core template convention, and this IG uses the base template.

It asserts three things, and the third is the one that matters most: every
`menu:` target must resolve to a real `input/pagecontent/*.md` or sit in
`GENERATED_PAGES` — an allowlist with reasons, currently just `artifacts.html`.
That is what stops the drift being "fixed" in the wrong direction, by declaring
`Downloads: downloads.html` in `menu:` and shipping a broken link instead. Both
parsers **bail rather than skip** on a form they cannot read, and a missing
block, a missing section or zero parsed entries is an error — the #232/#261
family, which this gate is deliberately built against. It runs in `ig.yml`
**before** the compile, since it needs neither SUSHI nor the network.

At the repo root, resource-level FHIR conformance (needs Java 17+; downloads and
caches the ~190MB HL7 validator jar into `.fhir-validator/` on first run):
```
node scripts/validate-fhir.mjs   # HL7 validator_cli over ig/fsh-generated/, FHIR-Resources/
                                 # and packages/demo-population/src/scenarios/ (unwrapped)
```

Also at the repo root, the FHIR Mapping Language gate (same Java + jar; the
`--tx` half needs the network, because the FML transform engine refuses to run
without a terminology server):
```
node scripts/check-fml.mjs --tx https://tx.fhir.org
```

And the outreach one-pager, whose PDF is generated from HTML rather than
hand-exported (needs Chrome to build; `--check` needs nothing but Node):
```
node scripts/build-onepager.mjs           # re-render web/public/SPiER-Overview-Care-Pathway.pdf
node scripts/build-onepager.mjs --check   # gate: is that PDF current with its HTML?
```
⚠️ **Edit `web/public/SPiER-Overview-Care-Pathway.html`, never the PDF**, then
re-export and commit the HTML, the PDF, and `docs/outreach/onepager.build.json`
together — `onepager.yml` fails otherwise. The check compares *recorded hashes*
and never re-renders, because Chrome's PDF bytes are not reproducible even
between two runs of the same version; the structural assertions that need a
browser (2 pages, letter MediaBox, Poppins embedded in four weights — which is
also the "did the webfont actually load" check) run at export time instead.

⚠️ **That one HTML file is both the handout's source and a served web page**, and
its stylesheet has two halves that cannot see each other's failures. The print
layer governs the PDF; a `@media screen` layer below a banner comment governs the
page (fluid below 900px, exact print geometry above it) and is invisible to
`--print-to-pdf`, which resolves `print` media. So editing the screen layer can
never fix the PDF, and a browser can never show you a print regression — after
touching any shared rule, re-export **and** open the page narrow. The reset that
keeps the footer's real `<a>` elements from printing with the UA's blue underline
has to sit in the *print* layer for that reason.

Both files live under `web/public/` so both hosts serve them at stable URLs (Vite
→ `web/dist` → the Worker's `web-dist`); the PDF stays committed because the
Cloudflare build is dashboard-configured and can't be given a browser.
`docs/outreach/README.md` has the full rationale.

And the HL7 working-group use-case workbook, which is generated rather than
hand-maintained (Node builtins only — no install, sub-second):
```
node scripts/build-use-case-workbook.mjs           # <id>.json → dist/*.xlsx + *.csv + <id>.md
node scripts/build-use-case-workbook.mjs --check   # gate, in use-case-workbook.yml
```
⚠️ **Edit `docs/use-cases/ed-scenario-11.json`, never `docs/use-cases/dist/` and
never `ed-scenario-11.md`** — all three are outputs, same rule as
`packages/fhir-artifacts/generated/`. In particular a review comment typed into the workbook is
discarded by the next build; notes go in the JSON's `reviewNotes` and are
rendered onto the mapping sheet.

Markdown is the authoritative form of the mapping prose in that JSON
(`fhirText`, `profileBinding`, `cdsHook`), because only it can carry a link to
the artifact it describes; the spreadsheet gets it flattened at build time. The
document's FHIR-resource lists, its consolidated gap list and its gating-tool
promotions are all **derived** from the per-step fields rather than restated,
and `--check` asserts the two directions of that (a `**gap**` binding must name
a `profileGaps` or `gatingIssues` entry, and vice versa).

⚠️ **A gap claim in that document is a statement to the HL7 working group, and
four of them stayed true-looking long after they stopped being true (#341).**
The workbook described BSSA, SAFE-T, Means Counseling and Transition as
`status:planned` when all four were built, shipped and launchable in the demo —
which is also what made a missing demo artifact read as intentional (#324). So
`--check` now gates tool-status claims: **a `status:planned` claim, or a
gating-tool entry, must not name a tool the app can already launch.** "Built" is
read from the app — a TL id in `tool-ui-metadata.ts` with a launch path that
resolves to a route in `App.tsx` — because GitHub's `status:` labels are the
real authority but live outside the repo. Only that direction is an error; a
built tool the document never mentions is not.

Both parsers **fail when they read nothing** rather than passing over an unread
file, which is the #232 / #261 failure mode and was planted-and-verified before
this shipped. When a gap genuinely closes, promote the binding (name the profile
and link its FSH), delete the `profileGaps` entries, drop the gating entry, and
rebuild — the consolidated gap list and the gating-promotions list are derived,
so neither is edited by hand. Where a profile covers only *part* of a claim,
narrow the text to what is still missing instead of promoting it whole; eight of
the sixteen #341 corrections were that shape.

⚠️ **Ten of the 37 steps are SPiER proposals, not the scenario the working group
circulated** — `origin: "spier-proposed"`, rendered `11.2-1C (proposed)`
everywhere the id appears, each owing a `rationale`. Do not drop the marker to
tidy a table, and do not renumber the original 27: a proposal takes the next
free letter in its group. `docs/use-cases/README.md` explains what each closes.

Unlike the one-pager above, this `--check` really does rebuild and byte-compare,
because the writer (`scripts/lib/xlsx-writer.mjs`) is deterministic on purpose —
every ZIP entry stored, never deflated, with a fixed timestamp. **Make it
deflate and the gate starts flaking against zlib versions.** Do not unify the
two patterns in either direction.

The same `--check` gates the scenario's linkage to its demo walkthroughs — four
ED patients, `patient-011` through `patient-014`, referenced as qualified
`"<patient>/<walkthrough id>"` strings — in both directions, as an allowlist with reasons rather than a
coverage count. Each gap declares a `walkthroughGapKind`: `not-narrated` is a
to-do (closing it means deleting the `walkthroughGapReason` *and* adding the
narration, and the gate requires both), while `branch-exclusive` cannot be closed on
a given patient at all, because the step describes a course they did not take
(the ED scenario needs four patients for that reason — one negative screen, one
deferred-then-transferred, one elopement). `--check` prints the split; all 37
ED steps are narrated today, so both counts are zero. A narrated proposal must
also carry `proposed: true` on its walkthrough entry, so the chart cannot show
a SPiER proposal as settled. `docs/use-cases/README.md` has the rationale,
including why review notes are not emitted as Excel cell comments.

⚠️ **The scenario gate's per-resource rules are SHARED with the mock EHR's write
endpoint, and that is a guardrail rather than a refactor.**
`web/scripts/lib/fhir-resource-rules.mjs` holds the base-R4 tables, the
profile-derived checks and the date/binding rules; `check-scenario-resources.mjs`
and `services/mock-ehr/src/validate.ts` both call it. The embedded-panel plan §1
permits a mock we control **only** if it validates writes with these checks
"rather than inventing a second, laxer opinion" — a lenient mock accepts writes a
real EHR rejects, so the demo looks better while proving less. If you change a
rule, you change both callers at once, which is the point. The rule bodies were
moved unchanged into a closure that supplies `fail` and `structureDefs`, so
`git log -p` on that file shows an empty diff for the rules themselves.

Two properties there are load-bearing. `assertUsableIndex` makes an **empty**
conformance index a startup failure in both callers — otherwise every
profile-derived rule reports nothing and the gate (or the write endpoint) green-lights
what it never read. And the rules require an `id`, while a FHIR **create** must
not carry one; `validate.ts` assigns the server's id *before* validating rather
than relaxing the rule, because relaxing it would have loosened the scenario gate
too.

In `services/cds-hooks/` — **easy to forget, and CI gates it:**
```
npm install && npm run verify   # typecheck + eslint + vitest for the Worker
```
`web/`'s `npm run verify` does NOT cover this package, but the `cds-hooks` CI job
does. It imports the web catalog, so a change to `tool-ui-metadata.ts` (launch
actions especially) or to the population scenarios can break its tests without
anything in `web/` failing.

⚠️ **`sushi` does not validate everything.** Five separate gates cover five
different classes of problem, and a clean SUSHI run implies none of the others:

| Gate | Catches | Where |
|---|---|---|
| `npx fsh-sushi .` | FSH syntax, unresolved FSH references — plus, via `scripts/check-sushi-output.mjs`, any warning that is not the one expected advisory | `ig.yml` |
| `node scripts/validate-fhir.mjs` | resource-level conformance: cardinality, extension context, required items, `display` vs CodeSystem, QR structure against its Questionnaire | `ig.yml` (`validate` job) |
| IG Publisher | FHIRPath invariants, narrative link integrity, **everything about the StructureMaps** (element names, FHIRPath typeability, `import` target types), **and CQL→ELM translation** of `ig/input/cql` (gated on `path-binary` — see below) | `ig-publish.yml`, and the same gates in `deploy.yml` on every push to main |
| `node scripts/check-fml.mjs` | FML syntax + the Stanley-Brown map still producing the CarePlan the runtime produces | `fml-validate.yml` |
| `check:codings` + `validate-fhir --tx` | **external** terminology: LOINC, SNOMED and terminology.hl7.org codes that don't exist, and displays that don't match the publishing authority — including codings written in TypeScript, which no other gate reads | `terminology-nightly.yml` (nightly + `workflow_dispatch`) |

⚠️ **`check-fml.mjs` is a parser, not a profile checker.** It catches FML syntax
and header mistakes; it does *not* catch a misspelled target element, an
untypeable FHIRPath expression, or an `import` pointing at the wrong resource
type. Promoting the four draft maps in #92 surfaced sixteen such errors that
were all invisible to it and all fatal to `ig-publish.yml`. After touching an
`.fml`, a green `fml-validate` is necessary and not sufficient — let the
publisher run. `ig/input/resources/maps/README.md` has the specifics, including
the two FHIRPath spellings (`repeat()` and `answer.valueString`) that execute
correctly but fail the publisher's static analyser.

That fourth row exists because of issue #220: seven LOINC codes SPiER emitted for
safety-plan sections were fabricated or misused, and no gate could see them. Six
did not exist in LOINC; `81344-4` resolved to healthcare-agent disclosure
authority rather than "reason for living", so it validated cleanly while meaning
the wrong thing. The blind spot had two halves — `validate-fhir.mjs` runs `-tx n/a`
in CI so external codes go unchecked, and **nothing at all** validated the
code+display literals in `web/src/lib/*Mappers/`, even though those land in
`Observation.code.coding` on every generated resource at runtime.

The validator job is the only thing that checks `FHIR-Resources/` at all — the IG
Publisher is triggered by `ig/**` alone. After a substantial `ig/` change you can
still dispatch the publisher directly: `gh workflow run ig-publish.yml`.

⚠️ **The IG Publisher compiles the measure CQL, and only because of one config
line.** `ig/input/cql/SPiERSuicideSaferCareMeasures.cql` is translated to ELM
and attached to `Library/SPiERSuicideSaferCareMeasures`; a translation error
fails the build. What turns it on is `path-binary: input/cql` in
`ig/sushi-config.yaml` — the CQL loader's activation switch. **Remove that line
and the publisher walks past `input/cql` in silence**, translating nothing and
reporting nothing, which reads exactly like a passing gate. That silence is what
made #201 conclude the publisher *cannot* translate CQL (it bundles the full
cqframework translator) and move the file out of the build for a release; #212
re-tested it, and the first real compile failed on five defects that had been
invisible the whole time. To confirm the gate is alive, grep a publisher log for
`Translating CQL source` — see `docs/plans/stage-8-measure-and-share.md`.

⚠️ **`deploy.yml` caches the rendered IG, so a push to main usually does not
re-render it.** Pages replaces the whole site with one artifact, so the SPA
cannot ship without a rendered IG under `dist/ig` — the two cannot be
decoupled, and a failed render still blocks the deploy. What *is* skipped is
re-rendering an IG that did not change: the render is cached under
`ig-render-<hash of ig/input + sushi-config + ig.ini>-<publisher version>-<run
id>`, and on a hit the whole Java/Ruby/Jekyll/publisher half of the job is
skipped. Two properties hold that up, and both must survive any edit there:

- the cache is written with an explicit `cache/save` **after** both gates pass,
  never by the combined `actions/cache` action (whose post-step saves even when
  a later step failed, which would make a broken render the cached answer);
- `publisher.log` is cached beside `output/`, so the CQL and QA gates re-run
  identically on the hit path. Skipping the render never skips the checks.

The one input the key cannot see is `template = fhir.base.template#current` in
`ig/ig.ini` — `#current` moves without any change here, so a template release is
not picked up until some `ig/` input changes. `gh workflow run deploy.yml -f
force_ig_render=true` forces it. Every run prints whether it rendered or reused,
plus the rendered size, to the job summary.

Running the IG Publisher locally is worth it before a substantial `ig/` change,
and has two traps: it **refuses any path containing a space**, which this
worktree's path has (`public health`), so copy `ig/` to a space-free directory
first; and it shells out to `sushi` and `jekyll`, so pass `-no-sushi` if
`fsh-generated/` is already built, and expect it to fail at the Jekyll step if
Jekyll is absent. The per-resource QA results are written before Jekyll runs, in
`temp/qa/*-validation.html` — that is where the StructureMap errors above were
found.

⚠️ **The population scenarios are hand-authored FHIR, and are gated by two
things that cover different amounts.** `packages/demo-population/src/scenarios/patient-*.json`
holds Observations, CarePlans, Communications, EpisodeOfCares, Appointments,
ServiceRequests, Procedures and DocumentReferences that the Stage-8 measure
engine reads directly, so a malformed one produces a *wrong* measure score
rather than an empty one (issue #226). Be precise about which gate sees what:

| | `npm run check:scenarios` (offline, in `verify`) | `node scripts/validate-fhir.mjs` (Java, `ig.yml`) |
|---|---|---|
| Runs | every `web/` verify | PR + push touching `ig/`, `FHIR-Resources/`, or the scenarios |
| QuestionnaireResponses | linkIds, nesting, answerOption, ranges, value[x] type | full conformance against the Questionnaire |
| Other buckets | unknown-bucket typos, `resourceType`, unique ids, patient linkage, **the subject Patient actually existing**, base-R4 required elements + status/intent codes, profile canonicals resolving, profile `min`/fixed/required-binding from the generated StructureDefinitions, SPiER extension bindings, date parsing | everything: real cardinality, **slicing**, invariants, extension context, reference targets, unknown elements |
| Misses | cardinality *counts*, slices, invariants, unknown elements, external codes | nothing structural — but runs `-tx n/a`, so LOINC/SNOMED displays wait for the nightly |

The offline half's base-R4 required-element and status-code tables are
hand-maintained (`BASE_REQUIRED` / `STATUS_CODES` in
`check-scenario-resources.mjs`) because the base R4 StructureDefinitions are not
vendored here. An omission there costs offline coverage only — the validator
still catches the underlying defect. Everything profile-derived is read from
`packages/fhir-artifacts/generated/StructureDefinition-*.json`, so changing FSH changes the
check.

`validate-fhir.mjs` unwraps the scenario buckets into a temp directory first
(`collectScenarioResources`), dropping only `_savedAt` — SPiER's client-side
persistence stamp, which `smartDataSource` also strips before writing to a real
server. `riskAlerts` and `walkthrough` are deliberately not fed to the validator:
neither is FHIR (`walkthrough` is `ScenarioEncounter` narration, not a FHIR
Encounter), and the offline half checks both against their TypeScript shapes
instead.

⚠️ **The scenarios' 116 `subject: Patient/patient-0NN` references dangled for
months, and no gate could see it.** A `subject` naming a nonexistent Patient is
not a conformance error, so the HL7 validator passed it; the offline checker
asserted every resource named the *right* id, never that the id resolved. The 14
subjects now exist as hand-authored FHIR in `packages/demo-population/src/patients/`
(they were IG example Instances until #392 moved them out — nothing in the IG
referenced them),
and `check-scenario-resources.mjs`'s check 8 closes the loop — it **exits non-zero
when it finds no Patient resources at all**, rather than passing vacuously when
`copy-fhir` has not run.

Two things there are easy to get wrong. The Patient index is built **before** the
`if (typeof doc?.url !== 'string') continue` guard, because a `Patient` has no
`url` and would otherwise be skipped — folding it into the conformance-resource
branch chain yields an empty set and a green gate. And `* id = "patient-0NN"` in
the FSH is load-bearing: the Instance *name* is CamelCase, but the resource id
must be the exact string the scenarios reference, or they dangle again.

⚠️ **`encounters` used to be that narration bucket and no longer is.** #285 made
it real FHIR `Encounter`s — the correlation hinge every other artifact reaches
the episode through — and moved the walkthrough narration to `walkthrough`. Both
gates now cover it (`encounters: 'Encounter'` in `check-scenario-resources.mjs`
*and* `validate-fhir.mjs`), so an Encounter defect fails offline and in the
validator. If you are reasoning about what SPiER does or does not emit, check the
bucket map in those two scripts rather than trusting a doc — this line was itself
stale for a day, and a plan doc merged on top of the stale version.

⚠️ **A validator warning can mean "nothing was checked".** If the HL7 validator
cannot resolve a QuestionnaireResponse's Questionnaire (or a claimed profile), it
says so as a *warning* and then reports zero errors — a context-loading mistake
degrades to a PASS. Two traps caused this in practice, both now guarded in
`validate-fhir.mjs`: `-ig <folder>` does **not** recurse, so `-ig FHIR-Resources`
loads 0 resources (every file is one level down); and `-output` emits a bare
`OperationOutcome` rather than a `Bundle` when given exactly one source. The
script now treats those warnings as errors and understands both output shapes.
When you touch it, re-run it against a deliberately broken input and confirm it
*fails* — a green gate you have never seen go red is not evidence of anything.

The validator runs without a terminology server (`-tx n/a`) so the gate stays
fast and offline-reproducible. Consequence: codes from **external** systems
(LOINC, SNOMED) are not verified there — the IG Publisher covers those. Codes
from SPiER-local CodeSystems *are* fully checked, including that every
`Coding.display` matches the CodeSystem's display or one of its designations.
Pass `--tx https://tx.fhir.org` to check external terminology locally.

⚠️ **A mapper can read an answer shape its Questionnaire never declares, and
every other gate will call that fine.** For months the whole C-SSRS family and
CAMS Section B read `answer.valueBoolean`, while **not one Questionnaire in this
repo declares a `boolean` item** — every yes/no question is `type: choice` bound
to SNOMED Yes `373066001` / No `373067005`. So a screener filled in through
SPiER's own form read `undefined` for every item, and the risk ladders treat
`undefined` as "not endorsed": a patient endorsing q5, *specific plan and
intent*, derived `tier: none`, "No risk identified" (issue #327). Three blind
spots lined up, and each is worth knowing on its own:

- **A mapper test can encode the wrong shape and then defend it.** Those suites
  hand-built `valueBoolean` responses, so they proved the mappers correct against
  input the app never produces. Tests now build responses with
  `__fixtures__/nativeQr.ts`, which derives item nesting and every `value[x]`
  from the Questionnaire JSON — a fixture that asserts the shape of the app's
  data has to *derive* that shape from the artifact defining it.
- **`check:scenarios:responses` does check `value[x]` against `item.type`** — it
  simply had no C-SSRS or CAMS-B fixture *with items* to look at. `p011-cssrs-full`
  and `p007-cssrs-pediatric` now carry coded answers, so the native shape is
  gated.
- **The #230 fallback normalizes a foreign QR to `valueBoolean` on purpose**, so
  a *foreign* C-SSRS derived the right tier while a *native* one did not. That
  inversion is the tell; `getYesNoBoolean` is now the single yes/no reader and
  accepts both shapes, so booleans stay valid.

`npm run check:readers` is the class-level fix: it parses each mapper with the
TypeScript AST, resolves which linkId every `walkItems` read names and which
reader is applied, and checks that reader against the item's declared `type`.
It needs no test to exist and no fixture to be written. It resolves the linkId
forms this codebase uses (literal, `for…of` over a code table, `.reduce` over a
list, helper parameter fed by literal call sites) and **fails on anything it
cannot follow** rather than skipping it — a silent skip is how a gate reports
green while checking nothing (#232, #261). Its first run found that `getYesNoBoolean`
is deliberately pointed at PSS-3 items offering the SNOMED pair **plus**
`unable-to-complete` / `patient-refused`; the rule is containment, not equality,
because a non-response must stay `undefined` rather than becoming a "No".

⚠️ **A measure change lands in FOUR places, and `check:measures` only ties two
of them together.** A population criterion lives in `ig/input/fsh/measure-and-share.fsh`
(the published definition), `ig/input/cql/SPiERSuicideSaferCareMeasures.cql` (the
portable statement, compiled by the IG Publisher) and `web/src/lib/measures.ts`
(the executable reference implementation the app runs) — and if it changes
scoring, in `MeasureDashboard.tsx` too. `check:measures` asserts the FSH
criterion names and the TS implementations agree in both directions; the
publisher asserts the CQL compiles. **Nothing asserts the CQL and the TypeScript
compute the same answer** — that is a reading, not a gate.

⚠️ **`denominator-exclusion` and `denominator-exception` are not
interchangeable, and the engine treats them differently on purpose (#324).** An
exclusion is removed outright — the case never belonged in the cohort. An
exception is removed **only if the numerator is not met**, so a patient who met
the criterion *and* the numerator stays in and counts as a pass. Consequences
worth knowing before adding either:

- the exception's count is `removedByException`, **not** the raw population
  flag. Tallying the flag would subtract a case that is still being scored, and
  the score can then exceed 100%.
- the numerator has to be resolved before the denominator can be, which is why
  `evaluateMeasure` computes it first.
- lethal-means counseling is the only exception in the set today: transfer to a
  higher level of care (not yet due) or departure before disposition (no
  opportunity), read off `Encounter.hospitalization.dischargeDisposition`.

⚠️ **The demo's narration and the demo's measures can disagree, and only one
test looks.** Patient-011's walkthrough said "Lethal-means counseling delivered
and documented" while her scenario carried no Procedure, so the dashboard scored
her a *miss* on a step her own chart calls completed — for as long as the ED
scenario had existed. `measures.narration.test.ts` gates it from both ends: a
narrated-completed step must reach the numerator it claims, and **any** measure
miss for a patient who has a `walkthrough` must be written down in
`EXPLAINED_MISSES` with a reason. That allowlist is empty today, which is the
finding — every remaining miss among the ED patients is a pass, an exclusion or
an exception. It does NOT assert that a step materializes every resource type it
names: 21 completed steps name a SPiER-profiled type with no artifact behind it,
which is filed separately.

## Conventions

- **Design tokens only.** Vanilla CSS with custom properties. stylelint (`.stylelintrc.json`) rejects raw hex (`color-no-hex`) and enforces `var(--…)` for `color`, `background-color`, `border-color`, `fill`, `font-size`, `box-shadow`. Raw values are allowed only in `src/index.css` (token definitions). Class selectors must be kebab-case BEM.
  ⚠️ **stylelint checks that a token is *used*, never that it *exists*** — any
  `var(--…)` satisfies the rule, so `color: var(--made-up)` linted clean and
  shipped as a value the browser drops (issue #280). `npm run check:tokens`
  closes that half: every `var(--token)` under `web/src` must resolve to a CSS
  declaration or to a `setProperty('--token'…)` call in the TypeScript (that
  second source is scraped, not allowlisted, so the exemption dies with the code
  that earns it — `--patient-banner-height` is the only one). A fallback does
  not excuse an undefined token; it just hides it. `index.css` is in stylelint's
  `ignoreFiles` but *is* read by this check.
- **One page template.** Every route under the EHR shell renders into
  `.ehr-content-body`, which is the **sole owner of the page inset** — a page
  that pads its own root indents its content relative to every other page, for a
  reason invisible from the page itself. The title block is
  `components/PageHeader.tsx` (eyebrow → title → accent rule → optional lede),
  the only definition of page-title typography in the app; a page never renders
  its own `<h2>`, so section headings start at `<h3>`. A drill-in page passes
  `up` to make the first eyebrow segment its way back out. Root width is
  `--page-width-prose` or `--page-width-wide`, and those two are the whole
  vocabulary.
  Two families are templated, found in different ways. The **lenses**
  (`src/pages`) are a declared allowlist, because which pages own a header is a
  decision. The **form views** (`src/components` — every assessment and workflow
  recorder, reached directly by route) are *derived* from the form layout they
  render (`.form-wrapper`), so a thirteenth view is covered the day it is
  written. A form view's root is `.form-view`, which exists so the header can sit
  above the layout instead of becoming a third flex item inside it — which is
  what the old `.breadcrumb` trail was, `width: 100%` and all.
  ⚠️ All four lenses had drifted off this before it was a template: the
  Population view added `padding: var(--space-6)` to its root and the guide
  padded both its header band and each sub-page container, so those two started
  24px further in than Overview and the Patient Chart, and each lens had grown
  its own eyebrow style and title color. `npm run check:template` gates it —
  including in the *reverse* direction, so a guide sub-page cannot quietly grow a
  second page header (`LENSES` in `web/scripts/check-page-template.mjs` is an
  allowlist with reasons). It reads source text, so it cannot see padding added
  to an intermediate wrapper *inside* a page; that limit is stated on the rule.
  Two of its rules were written wrong and passed planted defects before being
  fixed — both worth knowing if you extend it. `/\bpage-header\b/` never matches
  `page-header__title`, because `_` is a word character (so the class rules carry
  no trailing `\b`); and the CSS walk read `src/css/*.css` only, leaving
  `App.css` and `index.css` — where `.form-view` and the tokens live —
  **entirely unread**. It now walks all of `src/`.
- **Routing:** `HashRouter` (see `web/src/main.tsx`) — GitHub Pages compatible.
- **Vite base path:** `/adoption-guide/` (see `web/vite.config.ts`). Don't hardcode absolute asset paths.
- **Never hand-edit `packages/fhir-artifacts/generated/`** — it's a gitignored build artifact regenerated by `copy-fhir.mjs`. To change FHIR shapes, edit FSH in `ig/input/fsh/`; to change a Questionnaire, edit the JSON in `FHIR-Resources/`.

## Gotchas

- **Fresh worktrees need `npm install` in `web/`** before any npm script runs.
- ⚠️ **A huge `git status` in the ROOT checkout usually means the ref moved, not
  the files.** Sessions here run `git branch -f main origin/main` from linked
  worktrees to resync after a squash-merge. That updates the shared
  `refs/heads/main` **without touching the root worktree's files or index** — so
  the root can sit on a weeks-old tree while `HEAD` reports today's commit, and
  `git status` reports the whole gap as *staged* changes nobody staged. Observed
  2026-08-13: the root's files were last updated 2026-07-29 (`eaec385`) while
  `main` had advanced to `9d3ef83`, giving **328 "staged" files, 117 of them
  deletions** — which reads exactly like someone reverted the repo.

  **Diagnose from the reflogs before touching anything**, because the wrong
  reading here is destructive and the right fix is one command:

  ```
  git log --oneline -1                      # what HEAD claims
  git reflog show main --date=iso -5        # `branch: Reset to origin/main` = git branch -f
  tail -3 .git/logs/HEAD                    # only records HEAD-mediated changes
  ```

  The tell is a **discontinuity in `.git/logs/HEAD`**: consecutive lines where one
  entry's new value is not the next entry's old value. A checkout cannot produce
  that, so the ref moved without one and the working tree is simply stale. Confirm
  by hashing the tree — `git write-tree`, then look for a commit with that tree
  (`git log --all --format='%H %T' | grep <tree>`). A clean match to an *older
  commit* means no local work exists and `git reset --hard origin/main` is safe
  and lossless. It is **not** evidence that someone ran `git checkout <old> -- .`;
  this file said that for a day, and it was wrong.

  Do this diagnosis FIRST. `git reset --hard` destroys the mtimes that date the
  divergence, and `git worktree remove` deletes that worktree's
  `.git/worktrees/<name>/logs/HEAD` — the two records that identify which session
  moved the ref. Both were lost that way before the cause was found.
- **Two of `@formbox/renderer`'s dependencies are aliased to shims** in
  `vite.config.ts` (`web/src/shims/`, and therefore in vitest too), because the
  chunk every assessment route loads carried 47% of its gzip in code this app
  cannot execute: **391 → 208 KB gzip**. Each has a gate, each gate treats "not
  aliased" as "nothing to guard" and passes — so the shared alias reader
  (`web/scripts/lib/vite-alias.mjs`) **throws** on an alias form it cannot parse
  rather than reporting an absence. Do not soften that: a quiet parse failure
  turns both gates green over unguarded shims.
  ⚠️ **The aliases are anchored regexes in the array form, not the object form.**
  Object aliases match by *prefix*, so a `fhirpath` entry also swallows
  `fhirpath/fhir-context/r4` and resolves it to `<shim>.ts/fhir-context/r4`.
  That mistake cost a debugging round; `$` is the fix.
  - **`fhirpath/fhir-context/r5`** → an empty object (575KB raw / 67KB gzip). The
    renderer statically imports both models and picks by its `fhirVersion` prop,
    which is the literal `"r4"` at both call sites. `npm run check:fhir-r5`
    fails on any other `fhirVersion` (including a computed one it cannot read)
    **and** if the renderer stops importing that exact specifier — the silent
    failure being an upgrade that renames it, putting the 67KB back with the app
    behaving completely normally. That rule first shipped as a substring
    `includes()` and passed a planted rename to `…/r5-renamed`; it matches the
    whole quoted specifier now.
  - **`@lhncbc/ucum-lhc`** → a throwing shim (557KB raw / 117KB gzip). The full
    UCUM units library, for a conversion nothing here performs: all 18
    Questionnaires are choice/group/string/text/integer/display, and their only
    two FHIRPath expressions are unit-free integer sums.
  ⚠️ **It is `fhirpath` that needs UCUM, not the renderer** — `fhirpath` requires
  it *eagerly at module scope* (`UcumLhcUtils.getInstance()` in three of its
  files) and only uses it for Quantity arithmetic; `@formbox/renderer` builds it
  lazily on Quantity paths alone. So a stack trace mentioning UCUM is not a
  formbox bug, and there is no supported opt-out to reach for: fhirpath declares
  it as a plain dependency with no optional flag and no lighter entry point.
  The shim's methods **throw** rather than returning `{status: 'failed'}`, which
  fhirpath would quietly fold into a result — a silently wrong instrument score
  is the one outcome this app must not produce. `npm run check:ucum` is what makes
  reaching one a build error: it fails if a Questionnaire grows a quantity item, a
  `valueQuantity`/`answerQuantity`, or a unit-bearing expression, **and** it
  derives the required method list from the installed `fhirpath` and
  `@formbox/renderer` rather than hardcoding it, so an upgrade that calls a new
  UCUM method fails the gate instead of a form. Same trade as the `expo-random`
  override documented in `web/package.json` — prune what cannot execute, and say
  why in the place someone will look.
- **`copy-fhir` is incremental:** it skips the ~30s SUSHI compile when `packages/fhir-artifacts/generated/` is newer than every FSH input. `predev` runs it plain; `prebuild` runs it with `--force`. If FHIR data looks stale, run `npm run copy-fhir -- --force`.
- **Generated files must exist before `tsc -b`.** `packages/fhir-artifacts/generated/*.json` and `packages/fhir-artifacts/generated/care-plan-profiles.generated.ts` (the whole `generated/` directory is gitignored) are produced by `copy-fhir`. On a clean checkout, run `npm run copy-fhir` first or the typecheck/build fails on missing imports.
- **One canonical URL, one definition.** `ig/` is canonical for CodeSystems and
  ValueSets; `FHIR-Resources/` holds Questionnaires (plus a couple of CarePlan
  templates) and the few local CodeSystems that have no FSH counterpart. Never
  define the same canonical URL in both trees — three ASQ CodeSystems did, and
  the `FHIR-Resources` copies silently shadowed the IG's with drifted `display`
  values until `validate-fhir.mjs` caught it. `node scripts/validate-fhir.mjs`
  loads both trees, so a fresh collision shows up as a display or binding error.
- **Drift-prone hand-duplicated values.** Stage IDs, LOINC codes, and ASQ disposition codes are duplicated by hand across `ig/input/fsh/` (canonical, e.g. `pathway-stages.fsh`), `packages/core/src/lib/observationMappers/` (e.g. `phq9.ts`, `asq.ts`), and `packages/demo-population/src/` (e.g. `patients.json`). LOINC **per-item** codes additionally live in `packages/core/src/lib/observationMappers/fallbackDispatch.ts` (`INSTRUMENT_SIGNATURES`, used to recognize foreign QRs) — guarded against the Questionnaire JSON by `npm run check:fallback`. When you change any such code, **grep the whole repo** for the old value and update every site.
- **The Stanley-Brown CarePlan transformation exists twice on purpose.**
  `ig/input/resources/maps/StanleyBrownQRToCarePlan.fml` declares it (and is
  what `PlanDefinition.action.transform` points at);
  `web/src/lib/carePlanMappers/stanleyBrown.ts` executes it in the demo. Both
  are compared against one golden file,
  `scripts/fixtures/stanley-brown/careplan-expected.json` — the FML side by
  `scripts/check-fml.mjs` (Java + network, in `fml-validate.yml`), the
  TypeScript side by `stanleyBrown.parity.test.ts` (offline, in `verify`).
  Change the transformation and you must change both. The normalizer that
  decides which fields are compared is itself duplicated
  (`scripts/lib/careplan-parity.mjs` and the test) because `tsconfig.app.json`
  includes only `src/`; the `.mjs` carries the rationale for every excluded
  field and the two must be edited together.
- **Tool licensing lives in the FSH, and only there.** Every ActivityDefinition
  carries `copyright` plus an `instrument-licensing-status` extension
  (`ig/input/fsh/instrument-licensing.fsh`, issue #127); `Tool.licensing` in
  `web/src/data/catalog/tools.ts` is *derived* from that extension. It used to
  be hand-typed in `tool-ui-metadata.ts`, where the adoption guide could — and
  did — state a licensing position no FHIR artifact backed. Do not reintroduce
  a `licensing` field there. `npm run check:catalog` fails if any AD is missing
  either half, if the code is not in the CodeSystem, or if a multi-AD tool's ADs
  disagree. R4 has no `copyrightLabel`; the extension is the stand-in.
  **A new tool with unsettled terms gets `#unknown`, not a permissive guess** —
  the notice must name where its claim comes from (a filed
  `FHIR-Resources/<tool>/licensing/MEMO.md`, or the Questionnaire's own recorded
  notice, or nothing). **No status has been verified against the rights holder's
  *current* published terms** — `docs/best-practices/licensing-verification-backlog.md`
  is the standing list of what is owed, and of why a recorded notice is not a
  verification.

## Skills (`.claude/skills/`)

- **`assessment-to-ig`** — author the *full* FHIR artifact set for a new instrument (Questionnaire JSON + FSH ActivityDefinition/CodeSystems/ValueSets/example QuestionnaireResponse/Observation profiles + IG page + catalog wiring). Use when adding/FHIR-ifying an instrument.
- **`fhir-questionnaire-quality`** — review/improve a *single* FHIR R4 Questionnaire (or its QuestionnaireResponse/Observation contract) for interoperability. Use for scoped review of one form.
- **`concept-harmonization`** — the cross-instrument concept layer: shared risk-tier CodeSystems/ValueSets, ConceptMaps/StructureMaps, and derived Observations that let disparate tools map into one actionable representation. Use for translation/crosswalk work spanning instruments.
