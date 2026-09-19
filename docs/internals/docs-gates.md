# Docs gates: markdown links, prose paths, and the use-case workbook

The only gates that trigger on `docs/**`, and the generated HL7 working-group
workbook whose gap claims are statements to a standards body.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

Also at the repo root and dependency-free — every relative markdown link in a
tracked `.md` file must resolve:
```
node scripts/check-md-links.mjs   # every relative link in a tracked .md resolves
```
⚠️ **This is the ONLY gate that triggers on `docs/**` or the root `README.md`.**
`web-lint.yml` covers `apps/`, `packages/`, the root tooling, `services/`, `ig/input/resources/questionnaires/` and `ig/`, so a
docs-only change triggered no workflow at all — which is how the `packages/`
reorganizations left **14 dead links** across the plan docs and two READMEs:
#389 (`web/src/lib/` → `packages/core/src/lib/`), #392 (`web/src/data/fhir/` →
`packages/fhir-artifacts/generated/`), and the Roadmap page's deletion, which took
`roadmap-snapshot.yml` and `fetch-roadmap.mjs` with it. #470 fixed 4 of the 14
by hand while consolidating `docs/`; the other 10 needed this gate to find. One
was `services/mock-ehr/README.md` → the shared FHIR resource rules, the file this
document tells you to read before changing a write validation. It runs in its own
`docs-links.yml`.

It asserts only that a target **resolves** — not that it points at the right
thing, and a `:137` suffix is checked as far as the file, since pinning a line
number would churn on every edit above it. Four skips, each for its own reason:
`http(s):`/`mailto:`/bare `#anchor`; **`.html`**, which the IG Publisher resolves
at render time and `check-ig-narrative.mjs`'s check H owns; targets containing
**`…`**, prose
ellipsis in inline code shaped like a link (`StructureDefinition-…`) rather than a
path; and **gitignored** build output like `ig/fsh-generated/`, which is correct
to link to and absent from a clean checkout — asked of `git` rather than
hardcoded, and note git needs a **trailing slash** to match a directory-only
pattern against a path that does not exist.

⚠️ **Fenced code blocks are deliberately IN scope.** A link in a fence never
renders as a link, so skipping them would be defensible — but a stale *path* in a
code block is exactly the drift worth catching, and this is what found
`ig/input/resources/questionnaires/README.md` documenting copy-fhir's destination as
`web/src/data/fhir/*.json` long after #392 moved it. The cost is that prose
*about* link syntax trips the gate; write such an example without the parentheses.

Liveness is the #232/#261 guard: it fails when it finds no markdown files, and
when the count of resolved links drops under `LINK_FLOOR` (~half the real count,
printed on every run). All five failure modes were planted and watched to fail.



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

This `--check` really does rebuild and byte-compare, rather than pinning a
recorded hash, because the writer (`scripts/lib/xlsx-writer.mjs`) is
deterministic on purpose — every ZIP entry stored, never deflated, with a fixed
timestamp. **Make it deflate and the gate starts flaking against zlib
versions.** A recorded-hash gate is the weaker fallback, and is only the right
answer for a generator whose output cannot be made reproducible at all; the
outreach one-pager was that case (a browser-rendered PDF) until it was deleted.

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



## The other half: paths written as prose (`check-md-paths.mjs`, 2026-09-19)

```
node scripts/check-md-paths.mjs
```

The links gate resolves **links**. A path written as backticked prose —
``` `packages/core/src/lib/measures.ts` ``` in a running sentence — is not a
link, so it was invisible to every gate in the repo. That is precisely how it
rotted: a scan on 2026-09-19 found **113 missing backticked repo-rooted paths
across 34 tracked `.md` files** (82 outside `docs/plans/archive/`), accumulated
through the `packages/{core,ui,tool-views}` extractions.

⚠️ **Two of them were misses from #547 itself** — the PR that moved the tool
views updated neither `CLAUDE.md:535` nor `docs/internals/tool-views.md`, whose
**opening line** named the file it had just moved. A live internals doc that
`CLAUDE.md` sends readers to began by pointing at nothing.

### Why it is not a bare existence check

⚠️ **Most missing paths are correct prose, and a naive gate would have demanded
they be "fixed".** This repo supersedes rather than deletes, so a doc routinely
names a file precisely because it is gone — "`foundation.css` is the former
`packages/ui/src/index.css`", "they *were* `ig/input/fsh/population-patients.fsh` until
step E2", "(now deleted)". Others point *forward*: the licensing memos name
`ig/input/pagecontent/<tool>.md` pages not yet authored. Of the 82 live
findings, roughly **five** were real defects.

So absence is permitted only through `ALLOWED`, keyed `<md file>::<path>`, each
entry carrying a reason — a reasoned list, never a count, the same rule as
`check-sushi-output.mjs`'s warning allowlist.

The real defects it did find are the shape worth knowing:

- `docs/README.md` carried a link whose **label** named a nonexistent file while
  its **target** pointed at a different, real one. `check-md-links` resolved the
  target and passed; the reader sees only the label.
- `docs/best-practices/licensing-verification-backlog.md` asserted in the
  present tense that a deleted stylesheet "names it first in `--font-display`".

### The allowlist is built to expire

⚠️ An exemption that outlives its reason is worse than none, because it reads as
"checked" forever. Two rules beyond the obvious one:

- an entry whose path **now exists** fails. `apps/guide/src/App.tsx` sits in
  here twice as a forward reference to the `apps/` split; the day that tree
  lands, the gate demands both entries be deleted rather than letting a stale
  exemption cover a path nobody rechecked.
- an entry whose `(file, path)` pair **no longer occurs** fails, so a rewritten
  sentence cannot leave its exemption behind.

### What it cannot see

- **A path that is wrong rather than absent.** `packages/core/src/lib/foo.ts`
  when the file is really in `packages/tool-views/` passes, because something
  exists at the named path. Existence is checkable; *aboutness* is not.
- **A path not in backticks.** Bare prose paths are unscanned by construction —
  the false-positive rate on unquoted text is far too high.
- **A claim.** This gate checks that a path resolves, not that the sentence
  around it is true. "Docs gate links, not claims" remains the standing hole;
  this narrows it by one property, and `docs/plans/` is still ungated prose.

⚠️ **`docs/plans/archive/` is exempt by directory** (31 of the 113). It is
history by construction, and retargeting a path there would falsify the record
of what was true when the plan was written.

⚠️ **Floors, and why they are not optional.** Every rule above is a rule about
paths the scan *found*, so all of them pass vacuously over a scan that finds
nothing. `FLOOR_PATHS`/`FLOOR_FILES` fail the gate when it reads less than it
should — the same defence `check-md-links` carries, and the same failure
`web-gates.md` records when a module walk fell from 47 to 20 and reported ✓.
Proven by breaking the regex: 0 paths found, floor fired.

⚠️ **`docs-links.yml` deliberately has NO `paths:` filter, since 2026-09-19.**
Both gates resolve a tracked `.md` against **the whole working tree**, so their
input is not the `.md` files — it is those files *and every path they name*. A
commit that only moves `apps/guide/src/Foo.tsx` rots a link and a prose path while
touching no `.md` at all, and under the old `'**.md'` filter the workflow would
not have run. **A workflow that does not trigger reports nothing; it does not
report red** — the same hole one level up. The job has no dependencies and no
build, so running it always costs seconds.
