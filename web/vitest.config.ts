import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Almost everything under test is a pure function walking FHIR JSON, so the
// lightweight `node` environment is the default. The one DOM-dependent suite
// (hooks/useScrollToHash.test.tsx) opts into jsdom with a
// `@vitest-environment jsdom` docblock, which keeps jsdom's startup cost off
// the other 34 files.
//
// ⚠️ jsdom is pinned to ^29 because CI runs Node 20 (`node-version: 20` in
// every workflow). jsdom 30 requires `^22.22.2 || ^24.15.0 || >=26.0.0` and
// dies at import with `webidl.util.markAsUncloneable is not a function`. The
// mismatch is invisible locally on a Node 22 machine — npm installs the newest
// jsdom your own Node satisfies — so before bumping it past 29, either raise
// the workflows' Node or check the new engines range against them. To test the
// way CI does: `volta run --node 20 -- npm run verify`.
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
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
