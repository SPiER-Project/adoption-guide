import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Almost everything under test is a pure function walking FHIR JSON, so the
// lightweight `node` environment is the default. The one DOM-dependent suite
// (hooks/useScrollToHash.test.tsx) opts into jsdom with a
// `@vitest-environment jsdom` docblock, which keeps jsdom's startup cost off
// the other 55 files (`test.include` below reaches into packages/core/src
// too, not just web/src — see the packages/core mirror-test note in CLAUDE.md).
//
// jsdom is pinned to ^29. It was pinned because CI ran Node 20 while jsdom 30
// requires `^22.22.2 || ^24.15.0 || >=26.0.0` and dies at import with
// `webidl.util.markAsUncloneable is not a function` — a mismatch invisible
// locally, because npm installs the newest jsdom your OWN Node satisfies.
//
// That blocker is gone: the floor is Node 22 (`.github/.nvmrc`). The pin stays
// only because nothing needs jsdom 30 — bumping it is now a normal dependency
// decision rather than something gated on the runtime.
//
// ⚠️ `.nvmrc` says `22`, a floating minor, and jsdom 30's range starts at
// 22.22.2 — so if you do bump it, check what `setup-node` actually resolves
// rather than assuming any 22.x satisfies it.
export default defineConfig({
  // ⚠️ This file does NOT inherit web/vite.config.ts — no `mergeConfig` — so the
  // demo-population alias is repeated here rather than shared. Verified, not
  // assumed: under vitest `@lhncbc/ucum-lhc` resolves to the real library, not
  // the shim vite.config.ts aliases. Editing one without the other breaks either
  // the build or the tests, never silently both.
  resolve: {
    alias: [
      {
        find: /^@spier\/demo-population$/,
        replacement: fileURLToPath(
          new URL('../packages/demo-population/src/index.ts', import.meta.url),
        ),
      },
      {
        // The React-free domain layer (packages/core), step B (#389). Prefix
        // alias: every consumer imports `@spier/core/<path>` mirroring the
        // package's own structure.
        find: '@spier/core/',
        replacement: fileURLToPath(
          new URL('../packages/core/src/', import.meta.url),
        ),
      },
      {
        // The compiled FHIR artifacts (packages/fhir-artifacts), step E1 (#392).
        // ⚠️ Static imports only — Vite does not resolve aliases inside
        // `import.meta.glob`, so the runtime globs use relative paths.
        find: '@spier/fhir-artifacts/',
        replacement: fileURLToPath(
          new URL('../packages/fhir-artifacts/', import.meta.url),
        ),
      },
      {
        find: '@spier/demo-population/',
        replacement: fileURLToPath(
          new URL('../packages/demo-population/src/', import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: 'node',
    // packages/core's mirror tests live beside their subject under
    // packages/core/src, not under web/src (see the packages/core bullet in
    // CLAUDE.md) — reached here rather than via a fourth test pipeline.
    // The third entry reaches the repo-root helper scripts in scripts/lib/,
    // which no pipeline covered before — same reasoning as packages/core above:
    // reach them from here rather than stand up another test runner.
    include: [
      'src/**/*.test.{ts,tsx}',
      '../packages/core/src/**/*.test.{ts,tsx}',
      '../scripts/lib/**/*.test.mjs',
    ],
  },
})
