# The IG build: SUSHI, the publisher, and the deploy

Why a clean SUSHI run is not a quiet one, what only the IG Publisher can catch,
and the two caches and one config line that decide whether it runs at all.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

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

⚠️ **The other shape was never benign, and `CLAUDE.md` used to say it was.** A
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

Also at the repo root, and dependency-free — `ig/sushi-config.yaml`'s `menu:`
and `pages:` blocks each have to be right, and right about each other:
```
node scripts/check-ig-menu.mjs      # every menu: target is a page; menu: and pages: agree both ways
node scripts/check-ig-narrative.mjs # what the IG's PROSE may say, and whether
                                    # what it points at exists (checks E–H)
```
⚠️ **The menu gate used to compare `menu:` against a prose restatement**
(how-to-read.md's "## The menu", checks A and B, #409/#410), because that
restatement had drifted twice with nothing going red — two live Guidance
sub-entries missing, and a **Downloads** bullet describing a page
`fhir.base.template#current` never emits, so `/ig/downloads.html` was a 404 for
the guide's whole life while its own map sent readers to it. The IG cleanup
(2026-09-16) removed the restatement rather than keep gating it: the navigation
bar is the menu, and Home's "Find what you need" table sends readers by task,
with every link in it resolved by the narrative gate's check H. Checks A and B
went with the prose; the letters C and D are kept so this history reads true.
The publisher still cannot see either class of drift — its broken-link check
only sees links that *exist*.

Check C: every `menu:` target must resolve to a real `input/pagecontent/*.md`
or sit in `GENERATED_PAGES` — an allowlist with reasons, currently just
`artifacts.html`. That is what stops a drift being "fixed" in the wrong
direction, by declaring `Downloads: downloads.html` in `menu:` and shipping a
broken link.

⚠️ **Check D is the expensive one: a page needs BOTH `menu:` and `pages:`,
and only `pages:` makes the publisher render it.** Check C cannot see that
gap — the `.md` file genuinely exists, so C is satisfied, and SUSHI compiles
clean either way. The menu is rendered onto *every* page, so a menu target the
publisher never renders is one broken link **per page**: adding
`Care Pathway: care-pathway.html` to `menu:` alone took this IG from 0 to
**1812** broken links with `err = 0`, and only `ig-publish.yml`'s broken-link
gate caught it — 5 minutes of Java after a green local run. Check D now compares
the two blocks in both directions (the reverse being a rendered page nothing
navigates to; `UNLISTED_PAGES` is the allowlist, empty today).

Both parsers **bail rather than skip** on a form they cannot read, and a
missing block or zero parsed entries is an error — the
#232/#261 family, which this gate is deliberately built against. It runs in
`ig.yml` **before** the compile, since it needs neither SUSHI nor the network.

⚠️ **`check-ig-narrative.mjs` is its sibling, not a second copy of it.** They
share `scripts/lib/ig-config.mjs` (the `pages:` reader, the `path-resource`
reader, `GENERATED_PAGES`), and they are two scripts for one reason: **when
they can run.** The menu gate needs no SUSHI and runs before the compile;
the narrative gate's checks F and H resolve against `ig/fsh-generated/`, so it
runs after. Making F and H degrade when `fsh-generated/` is absent would have
been the worse trade — a gate that quietly checks less is the #232/#261 shape
exactly. Its four checks:

- **E. No repo internals** in `ig/input/pagecontent/*.md` — `web/src`,
  `packages/`, `npm run`, `scripts/`, `.mjs`, `vitest`, `sushi-config`,
  `path-binary`, a bare `check:<name>` gate name, and `#NNN` issue references. An IG page is read by
  implementers who do not have this repo; build and gate prose lives in
  `CLAUDE.md` and `docs/internals/`, never in an IG page. No opt-out marker
  until a real need appears.
- **F. Every `TL-0NN` resolves** to a tool id an ActivityDefinition actually
  carries. Before the identifiers landed, the rule could only be *prohibition*
  — an id named nothing a reader could look up, so A3 stripped them all out.
  Zero mentions is still a legitimate state and today's: the prose links AD
  pages under the tool's **name**, which is better for a reader than a bare id.
- **G. Every `#/route` link resolves** to a **non-legacy** route in
  `apps/guide/src/App.tsx`, and `#/guide/<x>` is also a section in
  `apps/guide/src/data/guideSections.ts`. ⚠️ *Non-legacy* is the whole point:
  `/guide/roadmap` and `/guide/measures` still exist as `<Navigate>` redirects,
  so a naive route scan calls a link to a page #440 deleted perfectly fine —
  and three pages linked `#/guide/roadmap` for exactly that reason. The one
  exception, which is the difference between a finding and a false positive: an
  **index** route navigating to a **relative** target is picking its parent's
  default child (`/patient` → `chart`), so the parent really does land
  somewhere; an **absolute** target is a redirect away from a page that is gone.
  ⚠️ Because G reads `web/src`, `ig.yml` triggers on those two files — a route
  rename breaks the IG's links with **no `ig/` change at all**.
- **H. Every internal `.html` link resolves** to a `pages:` entry, an artifact
  page the publisher will emit, or a `GENERATED_PAGES` entry. ⚠️ **H is the
  owner of `.html` links** — `check-md-links.mjs` skips them on purpose
  (see [`docs-gates.md`](docs-gates.md)), because the publisher resolves them at render time and a
  file-existence test cannot model that. Its artifact index is built from
  `resourceType` + `id` read out of each resource rather than from filenames,
  **and** from every `path-resource` directory: the five FML StructureMaps are
  hand-authored `.fml` under `input/resources/maps/`, absent from
  `fsh-generated/` entirely, so an index that read only SUSHI's output would
  call all five StructureMap pages broken — and the natural "fix" would delete
  the guide's only navigation to its own transformations. Anchors are checked
  as far as the page; heading slugification is the publisher's algorithm, not
  something to re-guess here.

Thirteen defects were planted against it and each watched to fail — one per
check, plus the false-positive controls (a LOINC code like `#93374-7` must not
read as issue `#93374`; a published `TL-` id and a live route must pass) and
every liveness mode: zero pages, zero `<Route>` tags, an unreadable
`GUIDE_SECTIONS`, a missing `fsh-generated/`, and a moved `.fml`.


Also at the repo root, after SUSHI — the Artifacts page's groups are generated,
not hand-kept:
```
node scripts/build-ig-groups.mjs           # regenerate the groups: block of sushi-config.yaml
node scripts/build-ig-groups.mjs --check   # every source has a rule; block current; every
                                           # compiled resource carries a groupingId
```
⚠️ **Without `groups:` the publisher renders `artifacts.html` by resource
type** — 300+ rows in 15 sections, every ActivityDefinition in one block and
every CodeSystem in another — and SUSHI's `groups:` names each member by
`<Type>/<id>` with no wildcards, so a hand-kept block is ~300 lines that rot on
every artifact added, silently: a new Instance nobody lists lands under a
default heading and nothing goes red. So membership is *derived* from where an
artifact is defined (one rule per FSH file, tool folder or `.fml`), the block
is regenerated between two marker comments, and `--check` gates three things:
every source has a rule (an unassigned file is named), the block matches what
the rules produce byte for byte, and — reading the compiled
ImplementationGuide — every published resource carries a `groupingId` that is
declared. All three were planted and watched to fail. What it cannot see is
whether a resource is in the *right* group; a file that mixes concerns puts
everything under one heading, so keep FSH files single-purpose.
⚠️ **The five FML StructureMaps go through `resources:`, not `groups:`.** SUSHI
never loads `.fml`, so naming a map under a group is a SUSHI error
("configured with nonexistent resource"); a `resources:` entry with a
`groupingId` is the sanctioned way to pre-declare a publisher-loaded resource,
and the generator emits those five there.

⚠️ **`^purpose` is invisible on a profile, code system or value set page.**
`fhir.base.template#current` renders `purpose` in the narrative of PlanDefinition
and ConceptMap pages and nowhere else — on a StructureDefinition or CodeSystem it
appears only in the raw JSON/XML/Turtle views. Probed 2026-09-16 with marker text
on one of each: only the PlanDefinition's reached an `-html.xhtml` fragment. So
rationale that must be read goes to `docs/decisions/`, and `^purpose` is used only
where the page shows it; a `^purpose` on a profile is text nobody will see.

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
code+display literals in `packages/core/src/lib/*Mappers/`, even though those land in
`Observation.code.coding` on every generated resource at runtime.

`ig/input/resources/questionnaires/` is checked by the validator job **and**, since #473, by the
IG Publisher: `ig/input/resources/questionnaires` is a tracked symlink to that
folder, and each tool folder under it is a `path-resource` entry in
`sushi-config.yaml`, so the 18 Questionnaires, the two CarePlan templates and
the ASQ yes/no ValueSet are loaded, validated and rendered as IG artifacts.
⚠️ **Per folder, never the recursive `questionnaires/*` form.** The publisher
tries to load every file it finds — SUSHI skips non-JSON/XML, the publisher does
not — and the tools' `references/` subfolders hold PDFs, DOCX and XLSX. The
first CI run with `/*` logged 34 *Error loading … as Turtle* lines, spilled the
binaries' bytes into `publisher.log`, and GNU grep then refused to read the QA
counts out of a "binary" file: the QA step died under `bash -e` with no message
while the QA itself was 0 errors / 0 broken links (#512). Both workflows now
grep with `-a` and fail by name on an unparsed count, and
`check-ig-narrative.mjs` fails on a resource JSON one folder below a listed
directory that no entry reaches, so a new tool folder cannot be silently
unpublished. `ig-publish.yml` therefore triggers on `ig/input/resources/questionnaires/**/*.json`
too, and `deploy.yml`'s render cache key hashes it — a Questionnaire edit with
no `ig/` change must not reuse a cached render. After a substantial change you
can still dispatch the publisher directly: `gh workflow run ig-publish.yml`.

⚠️ **Why a symlink and not `path-resource: ../ig/input/resources/questionnaires/*`.** The
publisher refuses any resource path that escapes the IG root — *"Computed path
does not start with first element"* — before it loads a single resource. The
Questionnaires cannot move under `ig/` without splitting every per-tool folder
(README, licensing memo, references) across two trees and re-pointing some
thirty consumers of the `ig/input/resources/questionnaires/` path, so the IG reaches out through
a symlink instead. SUSHI, the publisher and `check-ig-narrative.mjs` all follow
it; a Windows checkout without symlink support gets a text file where the
directory should be, and the publisher fails loudly on the missing path.

⚠️ **The `QuestionnaireRenderer` NPE that kept the Questionnaires out is gone,
and the suppression that covered for it was hiding real defects.**
`ignoreWarnings.txt` suppressed every unresolved Questionnaire canonical for
the guide's whole life on the strength of a crash observed against an older
publisher and never re-tested. Re-tested on 2.3.4 (2026-09-16): all 18 render.
The first run then reported **18 errors on the Questionnaires themselves**,
none of which any gate had seen because the files were never in the build: the
four CAMS Questionnaires carried ids (`cams-ssf5-section-a`, …) that did not
match the last segment of their canonical URL, which the publisher rejects
(fixed — the ids now equal the URL tail, as every other Questionnaire's already
did); and the ASQ's ten LOINC 2.83 codes are unknown to tx.fhir.org's LOINC
2.82, the same edition lag `check:codings` tolerates through `PENDING_TX`.
⚠️ **`ignoreWarnings.txt` cannot suppress an error** — its qa.html heading
reads *Suppressed Messages (Warnings, hints, broken links)*, and #512's first
run proved it with ten pinned lines that matched nothing. The one lever the
publisher offers is the `no-validate` IG parameter, scoped to
`Questionnaire/ASQ-Screening-Tool` in `sushi-config.yaml`; it skips that
resource's publisher validation entirely (structure is still checked by
`validate-fhir.mjs` on every PR, codes by the nightly), and it is the third of
three things deleted together when the server updates — see
[`docs/scheduled-checks-triage.md`](../scheduled-checks-triage.md) § Cause 1b.
Also: every non-blank line in `ignoreWarnings.txt`, comments included, is
listed on qa.html with a use count, so keep it short. A resource under
`path-resource` with no `id` is now a gate failure rather than a page the
publisher names unpredictably (the Stanley-Brown Questionnaire had none).

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
`Translating CQL source` — see `docs/plans/archive/stage-8-measure-and-share.md`.

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

