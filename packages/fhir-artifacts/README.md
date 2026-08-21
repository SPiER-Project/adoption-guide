# `@spier/fhir-artifacts`

The compiled FHIR artifacts every consumer reads: SUSHI's output from
`ig/input/fsh/`, plus the TypeScript derived from it. **Everything under
`generated/` is a build artifact — gitignored, and never edited by hand.**

Produced by [`web/scripts/copy-fhir.mjs`](../../web/scripts/copy-fhir.mjs) —
`npm run copy-fhir` in `web/`, or `-- --force` to skip the incremental check.

## Why it is not `web/src/data/fhir/` any more

It was, and that was the §2.4 inversion
[`docs/plans/repo-and-package-boundaries.md`](../../docs/plans/repo-and-package-boundaries.md)
identified: the canonical machine-readable artifacts were written *into an
application's source tree*, so two Workers and ten gates read one app's
`src/` directory to find them.

This is step **E1** (#392) — the *output location* only. The rest of step E
(moving the SUSHI build itself so `fsh-sushi` leaves the React app's
devDependencies, and the open question of whether the 14 demo `Patient`s should
leave the IG) is deliberately **not** done here.

⚠️ **It was moved before step B (#389), reversing the plan's A–E order, and that
was deliberate.** §4 assigns `data/catalog` to `packages/core`, but
`data/catalog/stages.ts`, `tools.ts`, `triggers.ts`, `lib/measures.ts` and
`lib/reassessment.ts` all read these artifacts — five of them with
`import.meta.glob` at **runtime**. So `core` could not have been clean before
this moved: it would have needed a runtime dependency on an app's gitignored
build output. The dependency runs E → B; the plan sequenced E last for churn
reasons, not dependency reasons.

## ⚠️ `import.meta.glob` cannot use the alias

Vite requires a glob pattern to be relative or absolute — **aliases are not
resolved inside `import.meta.glob`**. So static imports use
`@spier/fhir-artifacts/generated/…`, while the five runtime globs use relative
paths that climb out of `web/`. Verified to work under vitest and in a
production build; they get shorter and more natural when step B moves `core` to
`packages/core/`, which is a sibling of this package.

## The incremental-skip trap

`copy-fhir` skips the ~30s SUSHI compile when these outputs are newer than every
FSH input. It keys off the **consumed** artifacts — this directory and the
generated TypeScript — rather than `ig/fsh-generated/`, so deleting either forces
a rebuild. An empty output directory is handled (`destFiles.length === 0` →
build); ⚠️ a path change pointing it at a **stale populated** directory is not.
If artifacts look wrong, `npm run copy-fhir -- --force`.
