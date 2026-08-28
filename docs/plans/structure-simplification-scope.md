# Structure simplification — implementation scope

Status: scoped 2026-08-28, not started. Each phase is one PR. Phases are
independent — do them in order of appetite, but never combine two in one PR.

## Why

The repo carries ~38k LOC of app/domain code and ~8.5k LOC of bespoke drift-gate
scripts. Most gates exist because one fact is hand-stated in 2–4 places. Where a
copy can be *derived at build time* instead of checked, the duplication, the gate,
its `verify` step, and its CLAUDE.md warning block all disappear at once.
Precedent already in-repo: `copy-fhir.mjs` emits
`packages/fhir-artifacts/generated/care-plan-profiles.generated.ts`.

## Ground rules (every phase)

1. **Branch per PR, squash-merged.** After merge, reset the branch to
   `origin/main` before further commits.
2. **Run all three verifies** when touching anything under `packages/`:
   `web/`, `services/cds-hooks/`, `services/mock-ehr/` each have their own
   `npm run verify` (fresh worktrees need `npm install` in each first, and
   `npm run copy-fhir` in `web/` before typechecking).
3. **Prove a change to a gate can fail before trusting it.** When you delete or
   modify a check script, first plant a defect of the kind it guarded, confirm
   the *new* arrangement catches it (type error, test failure, or remaining
   gate), then remove the plant. Report what you planted and what caught it.
4. **Never hand-edit `packages/fhir-artifacts/generated/`** — it is gitignored
   build output. New generated modules go there, produced by
   `web/scripts/copy-fhir.mjs`, and are never committed.
5. **Update CLAUDE.md in the same PR** — only the blocks your change makes
   stale (e.g. a deleted gate's entry in the `verify` list). Do not rewrite
   unrelated sections.
6. If any step here contradicts what you find in the code, stop and say so
   rather than improvising — this doc was written from a cursory survey.

---

## Phase 1 — Archive completed plan docs (lowest risk)

**Problem:** `docs/plans/` holds 18 ungated prose docs; most describe work that
merged months ago, and stale docs have repeatedly generated false-claim audits
(#349, #355).

**Steps:**
1. For each file in `docs/plans/`, determine whether its work is complete:
   check `git log --oneline -- <file>`, search the file itself for
   plan-vs-done language, and cross-check the PR numbers it names with
   `gh pr view <n> --repo SPiER-Project/adoption-guide`.
2. **Before moving anything, grep the whole repo for each filename.**
   Known live references: CLAUDE.md cites `docs/plans/stage-8-measure-and-share.md`
   and "the embedded-panel plan §1" (`embedded-panel-smart-launch.md`).
   A referenced doc either stays put or has every reference updated to the
   new path in the same commit.
3. Move completed docs to `docs/plans/archive/` with `git mv`. Add one line at
   the top of each: `> Archived <date>: work complete (PR #NNN).` Do not
   otherwise edit their content.
4. Leave in place: anything describing unmerged/ongoing work, and
   `next-session-handoff.md` unless its content is demonstrably stale.

**Verification:** repo-wide grep for `docs/plans/<moved-name>` returns only
archive-internal hits; `web` verify still green (nothing should depend on docs,
but confirm).

---

## Phase 2 — Derive `INSTRUMENT_SIGNATURES`, delete `check:fallback`

**Problem:** `packages/core/src/lib/observationMappers/fallbackDispatch.ts`
hand-duplicates per-item LOINC codes from the Questionnaire JSON in
`FHIR-Resources/`. `web/scripts/check-fallback-signatures.mjs` (npm script
`check:fallback`) exists only to check the two agree.

**Approach:** generate the signature table from the Questionnaires at
copy-fhir time; the hand copy and the gate both go away.

**Steps:**
1. Read `web/scripts/check-fallback-signatures.mjs` first. **The gate script is
   the spec**: it already encodes exactly how a signature relates to a
   Questionnaire's `item.code` entries (which instruments, which codes, any
   deliberate exclusions). Port that derivation logic into a generator; do not
   invent your own reading of the Questionnaires.
2. Extend `web/scripts/copy-fhir.mjs` to emit
   `packages/fhir-artifacts/generated/instrument-signatures.generated.ts`
   (follow the existing `care-plan-profiles.generated.ts` pattern for shape,
   header comment, and incremental-build handling).
3. In `fallbackDispatch.ts`, replace the hand-written `INSTRUMENT_SIGNATURES`
   literal with an import from the generated module. `packages/core` already
   imports from `packages/fhir-artifacts` in five files (e.g.
   `packages/core/src/lib/measures.ts`), so this crosses no boundary.
   If the hand-written table carries per-entry commentary that the generator
   cannot reproduce, keep that commentary in `fallbackDispatch.ts` next to the
   import — do not lose reasoning, only duplication.
4. Delete `check-fallback-signatures.mjs`, remove `check:fallback` from
   `web/package.json` (both the script entry and the `verify` chain), and
   delete its bullet from CLAUDE.md's verify list and from the
   "Drift-prone hand-duplicated values" gotcha.
5. **Planted defect (ground rule 3):** change one LOINC item code in one
   Questionnaire JSON, run `npm run copy-fhir -- --force` + the fallback
   dispatch tests (`fallbackDispatch.test.ts`), and confirm something fails or
   the generated table visibly follows the change. Revert the plant.

**Verification:** all three verifies green (⚠️ `services/cds-hooks` imports the
web catalog and can break with web green); `fallbackDispatch.test.ts` passes
unmodified — if the tests needed edits beyond import paths, the generator's
output diverged from the old table, which is a bug in the generator, not the
tests.

**Landmines:**
- The generated file must exist before `tsc -b`; copy-fhir already runs first
  in `verify` and `pretest`, so no ordering change is needed — but confirm the
  Workers' verifies also run copy-fhir (mock-ehr's does; check cds-hooks).
- `copy-fhir` is incremental: make the new output participate in its
  staleness check so a Questionnaire edit regenerates it.

---

## Phase 3 — Move `packages/core`'s mirror tests home

**Problem:** `web/src/lib` holds 55 test files but only 15 implementation
files; 47 tests are mirrors testing `packages/core` code (they import their
subject via `@spier/core/...`), parked there so web's verify would cover them.
This makes `web/src/lib` illegible and couples core's tests to web's tree.

**Approach:** move each mirror test to sit beside its subject in
`packages/core/src/**`, and extend web's *existing* vitest and tsc setup to
reach them. No fourth CI pipeline — web's `npm test` and `npx tsc -b` must
still cover everything they cover today.

**Steps:**
1. Identify mirrors mechanically: a `web/src/lib/**/*.test.ts` whose
   neighboring `<name>.ts`/`.tsx` does **not** exist in web is a mirror; its
   home is the identical relative path under `packages/core/src/lib/`.
   Ambiguous cases (e.g. `measures.narration.test.ts`): decide by what the
   test imports — if the subject under test is `@spier/core/...`, it moves.
   Tests of web-only code (15 impl files, plus anything under
   `web/src/hooks`, `context`, components) stay.
2. Move shared fixtures with their consumers:
   `web/src/lib/observationMappers/__fixtures__/` and
   `web/src/lib/carePlanMappers/__fixtures__/` are used by mirror tests
   (`nativeQr.ts` derives response shapes from the Questionnaire JSON — it is
   load-bearing, see #327; move it, never rewrite it).
3. Extend `web/vitest.config.ts` `include` to add
   `../packages/core/src/**/*.test.ts`. The `@spier/core/` and
   `@spier/demo-population` aliases already resolve there, so imports keep
   working. ⚠️ That config deliberately does NOT merge `vite.config.ts` — read
   its header comment before touching aliases.
4. **Typechecking is the hard part.** `web/tsconfig.app.json` includes only
   `src/`, so moved tests would silently stop being typechecked.
   `packages/core` currently has **no tsconfig.json**. Fix: give
   `packages/core` a tsconfig (extending web's compiler options, including
   vitest types) and wire it into the `tsc -b` project references so
   `npx tsc -b` in web still checks every moved file.
   **Prove it (ground rule 3):** plant a type error in one moved test and
   confirm `npx tsc -b` fails; revert.
5. `npm run check:core-boundary` walks **all** of `packages/core/src` and
   forbids React/DOM imports and unguarded browser globals. Run it after the
   move. Test files importing `vitest` should pass (it forbids a specific
   module list, not all dev deps) — but if any test trips it, prefer making
   the test conform; only exclude `*.test.ts` from the walk as a last resort,
   with a comment saying why, and re-verify the gate still fails on a planted
   React import in a non-test core file.
6. Update the CLAUDE.md `packages/core` bullet (the "⚠️ its tests live in the
   mirrored path under web/src" warning becomes false) and the vitest config
   comment about suite counts if it names one.

**Verification:** `npm test` in web runs the same total test count as before
the move (capture the count first); all three verifies green; the planted
type error and planted boundary violation both failed when planted.

**Landmines:**
- The one jsdom suite (`hooks/useScrollToHash.test.tsx`) is web-only and stays.
- Some mirror tests may import web-relative helpers besides the fixtures;
  resolve by moving the helper if core-only, or importing across the alias if
  shared. Do not duplicate helpers.
- `git mv`, not delete+create, so history follows the files.

---

## Phase 4 (optional) — Generated stage-id type

**Problem:** stage IDs are hand-duplicated across `ig/input/fsh/pathway-stages.fsh`
(canonical), `packages/core` mappers, and demo-population JSON. The JSON side
must stay gated (`check:stages` validates hand-authored data — keep it), but
the TypeScript side could import a generated literal-union type so drift
becomes a compile error instead of a runtime/gate concern.

Only attempt after Phase 2 establishes the generator pattern. Emit
`stage-ids.generated.ts` from copy-fhir, type the relevant constants in
`packages/core` with it, and *narrow* (not delete) `check:stages` if any of
its work becomes redundant. Same planted-defect discipline.

## Explicitly out of scope

- **npm workspaces / root package.json.** `@spier/core` is wired via tsconfig
  paths + vite aliases, not workspaces; converting touches lockfiles, CI, and
  the dashboard-configured Cloudflare build. Not worth the risk for this pass.
- **`check:reassessment` derivation** — requires parsing FHIRPath conditions
  out of a PlanDefinition; the gate stays.
- **`check:patients` derivation** — patients.json display copies are
  intertwined with hand-authored data; the gate stays.
- **Any rewrite of CLAUDE.md beyond blocks made stale by these changes.**
- **Anything under `ig/`, `FHIR-Resources/` content, or the check scripts not
  named above.** Gates that validate hand-authored FHIR against artifacts
  (`check:scenarios`, `check:readers`, `check:catalog`, etc.) earn their keep.
