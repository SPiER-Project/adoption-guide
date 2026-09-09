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

Also at the repo root, and dependency-free — `ig/input/pagecontent/how-to-read.md`
describes the guide's navigation in prose while `ig/sushi-config.yaml`'s `menu:`
block defines it:
```
node scripts/check-ig-menu.mjs      # the IG menu and its prose restatement agree
node scripts/check-ig-narrative.mjs # what the IG's PROSE may say, and whether
                                    # what it points at exists (checks E–H)
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

It asserts four things. The third: every `menu:` target must resolve to a real
`input/pagecontent/*.md` or sit in `GENERATED_PAGES` — an allowlist with
reasons, currently just `artifacts.html`. That is what stops the drift being
"fixed" in the wrong direction, by declaring `Downloads: downloads.html` in
`menu:` and shipping a broken link instead.

⚠️ **The fourth is the expensive one: a page needs BOTH `menu:` and `pages:`,
and only `pages:` makes the publisher render it.** Checks A–C cannot see that
gap — the `.md` file genuinely exists, so C is satisfied, and SUSHI compiles
clean either way. The menu is rendered onto *every* page, so a menu target the
publisher never renders is one broken link **per page**: adding
`Care Pathway: care-pathway.html` to `menu:` alone took this IG from 0 to
**1812** broken links with `err = 0`, and only `ig-publish.yml`'s broken-link
gate caught it — 5 minutes of Java after a green local run. Check D now compares
the two blocks in both directions (the reverse being a rendered page nothing
navigates to; `UNLISTED_PAGES` is the allowlist, empty today).

All three parsers **bail rather than skip** on a form they cannot read, and a
missing block, a missing section or zero parsed entries is an error — the
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
  `path-binary`, and `#NNN` issue references. An IG page is read by
  implementers who do not have this repo; build and gate prose lives in
  `CLAUDE.md` and `docs/internals/`, never in an IG page. No opt-out marker
  until a real need appears.
- **F. Every `TL-0NN` resolves** to a tool id an ActivityDefinition actually
  carries. Before the identifiers landed, the rule could only be *prohibition*
  — an id named nothing a reader could look up, so A3 stripped them all out.
  Zero mentions is still a legitimate state and today's: the prose links AD
  pages under the tool's **name**, which is better for a reader than a bare id.
- **G. Every `#/route` link resolves** to a **non-legacy** route in
  `web/src/App.tsx`, and `#/guide/<x>` is also a section in
  `web/src/data/guideSections.ts`. ⚠️ *Non-legacy* is the whole point:
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

