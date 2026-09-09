# Build and repo gotchas

The stale-worktree diagnosis that looks like a reverted repo, the two aliased
shims, and the values still duplicated by hand across trees.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).


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
  `CLAUDE.md` said that for a day, and it was wrong.

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
- **`copy-fhir` is incremental on a content fingerprint, not on mtimes.** It writes `.copy-fhir-manifest` into `packages/fhir-artifacts/generated/` recording the SUSHI version, a hash of every input's content, and a hash of the tree it produced; it skips the ~30s compile only when all three still match. `predev`, `prebuild` and `pretest` run it plain; `verify` passes `--force`, which still means recompile unconditionally. If FHIR data looks stale, run `npm run copy-fhir -- --force`.

  ⚠️ **It used to compare mtimes, and that is why `prebuild` passed `--force`.** mtimes track edits only where the tree came from editing it — in a fresh CI checkout git stamps every file with checkout time, so they carry no information at all. The cost was a second, identical ~20s compile in the `verify` job moments after the first (measured 2026-09-09: 13:12:07→13:12:48, then 13:13:25→13:13:45). The cheaper half of the fix is incidental; the load-bearing half is that mtimes were also **weaker**, because a hand-edited output looks *newer* and therefore looked fine. The manifest hashes the outputs too, so tampering and truncation rebuild. All six branches — unchanged-but-touched input, changed input, edited output, deleted generated TS, wrong SUSHI version, `--force` — were planted and observed before this landed.
- **Generated files must exist before `tsc -b`.** `packages/fhir-artifacts/generated/*.json` and `packages/fhir-artifacts/generated/care-plan-profiles.generated.ts` (the whole `generated/` directory is gitignored) are produced by `copy-fhir`. On a clean checkout, run `npm run copy-fhir` first or the typecheck/build fails on missing imports.
- **One canonical URL, one definition.** `ig/` is canonical for CodeSystems and
  ValueSets; `FHIR-Resources/` holds Questionnaires (plus a couple of CarePlan
  templates) and the few local CodeSystems that have no FSH counterpart. Never
  define the same canonical URL in both trees — three ASQ CodeSystems did, and
  the `FHIR-Resources` copies silently shadowed the IG's with drifted `display`
  values until `validate-fhir.mjs` caught it. `node scripts/validate-fhir.mjs`
  loads both trees, so a fresh collision shows up as a display or binding error.
- **Drift-prone hand-duplicated values.** Stage IDs, LOINC codes, and ASQ disposition codes are duplicated by hand across `ig/input/fsh/` (canonical, e.g. `pathway-stages.fsh`), `packages/core/src/lib/observationMappers/` (e.g. `phq9.ts`, `asq.ts`), and `packages/demo-population/src/` (e.g. `patients.json`). LOINC **per-item** codes are no longer hand-copied into `packages/core/src/lib/observationMappers/fallbackDispatch.ts`: `INSTRUMENT_SIGNATURES` (used to recognize foreign QRs) names only linkIds, and their codes are resolved from `packages/fhir-artifacts/generated/instrument-signatures.generated.ts`, which `copy-fhir` derives from the Questionnaire JSON — so a linkId that stops carrying a code is a type error rather than drift. When you change any such code, **grep the whole repo** for the old value and update every site.
- **The Stanley-Brown CarePlan transformation exists twice on purpose.**
  `ig/input/resources/maps/StanleyBrownQRToCarePlan.fml` declares it (and is
  what `PlanDefinition.action.transform` points at);
  `packages/core/src/lib/carePlanMappers/stanleyBrown.ts` executes it in the demo. Both
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
- **Tool ids live in the FSH too, as `ActivityDefinition.identifier`.** A
  `TL-0NN` names one catalogued entry on a stage tile, and every catalogued AD
  carries it in `http://thespierproject.org/fhir/identifier/tool-id` — a system
  the IG publishes as a `NamingSystem`, with the reasoning in
  `ig/input/fsh/tool-id-identifier.fsh`. `tools.ts` **derives** the pairing;
  the hand-written `AD_TO_TOOL_ID` map it used to carry is deleted, with no
  fallback, and `check:catalog` fails if it comes back. That map could only
  ever check itself: the IG published no ids, so the app's pairing was
  unverifiable and an IG page naming `TL-017` named nothing a reader could
  resolve — which is why those ids were stripped out of the rendered pages.
  ⚠️ **`TL-0NN` is not an AD id, and the mapping is many-to-one on purpose.**
  The CAMS SSF-5 is one tool (TL-020) across four session-form ADs, all
  carrying the same identifier. Prose in the IG should still link the AD page
  under the tool's *name* rather than quoting a bare id — the id is for
  machines, and a named link is what a reader can act on.

