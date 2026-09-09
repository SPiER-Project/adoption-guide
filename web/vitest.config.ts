import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Almost everything under test is a pure function walking FHIR JSON, so the
// lightweight `node` environment is the default. The DOM-dependent suites — 18
// of the 79 test files — opt in individually with a `@vitest-environment jsdom`
// docblock, which keeps jsdom's startup cost off the other 61. (`test.include`
// below reaches into packages/core/src and scripts/lib too, not just web/src —
// see the packages/core mirror-test note in CLAUDE.md.)
//
// jsdom is ^30. It sat at ^29 for as long as CI ran Node 20, because jsdom 30
// requires `^22.22.2 || ^24.15.0 || >=26.0.0` and will not load on anything
// older. That mismatch is invisible locally — npm installs the newest jsdom your
// OWN Node satisfies — so the pin was the only thing holding the two
// environments together. Raising the floor to Node 22 removed the reason for it.
//
// ⚠️ **jsdom constrains `.github/.nvmrc` from below.** `^22.22.2` is a floor,
// not a preference: the pin reads `22`, which resolves to the newest 22.x
// (22.23.2 in CI today) and satisfies it, but pinning `.nvmrc` to an exact older
// 22.x breaks every one of those 18 suites. npm will not stop you —
// `engine-strict` is off by default, so a violating install only *warns* and the
// failure surfaces later, at test time. Also in `.github/README.md`, where
// someone editing the pin will be looking.
//
// Verified rather than assumed, on jsdom 30.0.1: Node 20.17.0 fails, 22.22.2
// (the exact floor) passes, as do 22.22.3 and 24.18.0.
//
// ⚠️ Do not go looking for one specific error message. This comment used to name
// `webidl.util.markAsUncloneable is not a function`; on 30.0.1 + Node 20.17.0 the
// actual failure is `ERR_REQUIRE_ESM` — `require() of ES Module @exodus/bytes
// from html-encoding-sniffer`. The symptom moves with the version; what is
// stable is that jsdom fails to LOAD, so the tests never run at all.
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
