import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Almost everything under test is a pure function walking FHIR JSON, so the
// lightweight `node` environment is the default. The DOM-dependent suites — 18
// of the 79 test files — opt in individually with a `@vitest-environment jsdom`
// docblock, which keeps jsdom's startup cost off the other 61. (`test.include`
// below reaches into every app and package, not just the root's own src/ —
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
  // ⚠️ Vitest serves test files through a Vite dev server rooted at this
  // config's directory, and a file outside that root is fetched over `/@fs/…` —
  // which the server refuses unless the path is allowed. packages/core's tests
  // never hit this because they run in the `node` environment; packages/ui's run
  // in `jsdom`, which goes through the browser-shaped module graph, and failed
  // with "Cannot find module '/@fs/…/Button.test.tsx'".
  // ⚠️ `'.'`, not `'..'`. It read `'..'` when this config lived in web/ and the
  // suites it had to reach were web's SIBLINGS. The root is the repo root now,
  // so every app and package is already underneath it and `'..'` would allow a
  // directory OUTSIDE the repository.
  server: { fs: { allow: ['.'] } },
  // ⚠️ This file does NOT inherit vite.config.ts — no `mergeConfig` — so the
  // demo-population alias is repeated here rather than shared. Verified, not
  // assumed: under vitest `@lhncbc/ucum-lhc` resolves to the real library, not
  // the shim vite.config.ts aliases. Editing one without the other breaks either
  // the build or the tests, never silently both.
  resolve: {
    alias: [
      // ⚠️ **No alias for React, the router, the icons, the form renderer or
      // `fhirclient`, and none is needed.** Until 2026-11-24 this list pointed
      // each of them at `node_modules` by hand, because the packages under
      // `packages/` had no install of their own to walk up into. The install
      // has been at the repo root since the tooling moved there, every app and
      // package is beneath it, and ordinary resolution finds all of them:
      // both builds and every test passed with the entries deleted. An alias
      // also rewrites a specifier BEFORE the package's export map is read,
      // which is how `fhirclient/browser` and `@formbox/hs-theme/style.css`
      // each broke once. Do not add one back to fix a failed import.
      //
      // ⚠️ **Every entry below is an anchored regex or a quoted prefix, because
      // those are the two forms `scripts/lib/vite-alias.mjs` can read.** That
      // parser THROWS on an alias it cannot make sense of, and check:ucum and
      // check:fhir-r5 both treat "not aliased" as "nothing to guard".
      {
        find: /^@spier\/demo-population$/,
        replacement: fileURLToPath(
          new URL('./packages/demo-population/src/index.ts', import.meta.url),
        ),
      },
      {
        // The shared application runtime (packages/app-shell): the SMART and
        // patient plumbing, the providers, and the chrome-agnostic components
        // BOTH apps mount. ⚠️ Anchored EXACT prefix, like its siblings — the
        // object alias form matches by prefix and would swallow more than
        // intended. See the package README.
        find: '@spier/app-shell/',
        replacement: fileURLToPath(
          new URL('./packages/app-shell/src/', import.meta.url),
        ),
      },
      {
        // The 18 instrument fillers and 11 workflow recorders, plus the three
        // contexts they read (packages/tool-views). ONE definition, now enforced
        // by a package boundary rather than by a test that parses two files as
        // text — see the package README.
        find: '@spier/tool-views/',
        replacement: fileURLToPath(
          new URL('./packages/tool-views/src/', import.meta.url),
        ),
      },
      {
        // The design system (packages/ui) — see vite.config.ts.
        find: '@spier/ui/',
        replacement: fileURLToPath(
          new URL('./packages/ui/src/', import.meta.url),
        ),
      },
      {
        // The React-free domain layer (packages/core), step B (#389). Prefix
        // alias: every consumer imports `@spier/core/<path>` mirroring the
        // package's own structure.
        find: '@spier/core/',
        replacement: fileURLToPath(
          new URL('./packages/core/src/', import.meta.url),
        ),
      },
      {
        // The compiled FHIR artifacts (packages/fhir-artifacts), step E1 (#392).
        // ⚠️ Static imports only — Vite does not resolve aliases inside
        // `import.meta.glob`, so the runtime globs use relative paths.
        find: '@spier/fhir-artifacts/',
        replacement: fileURLToPath(
          new URL('./packages/fhir-artifacts/', import.meta.url),
        ),
      },
      {
        find: '@spier/demo-population/',
        replacement: fileURLToPath(
          new URL('./packages/demo-population/src/', import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: 'node',
    // packages/core's mirror tests live beside their subject under
    // packages/core/src, not under the root's own src/ (see the packages/core
    // bullet in CLAUDE.md) — reached here rather than via a fourth test
    // pipeline. The scripts/lib entry reaches the helper scripts, which no
    // pipeline covered before — same reasoning: reach them from here rather
    // than stand up another test runner.
    // ⚠️ **A package whose tests are not in this list does not run, and
    // `verify` stays green.** packages/ui was extracted on 2026-09-19 taking
    // `Button.test.tsx` with it; the suite passed, 96 files, and that file
    // executed zero times. Nothing else would have noticed — which is why the
    // floor below exists rather than trust in this list.
    include: [
      // ⚠️ The two apps come FIRST because they are where most of the suite
      // now lives. Omitting them dropped the run from 96 files / 1088 tests
      // to 70 / 845 while every gate stayed green — the exact shape of the
      // packages/ui accident this list's own note describes.
      'apps/guide/src/**/*.test.{ts,tsx}',
      'apps/clinical/src/**/*.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
      'packages/core/src/**/*.test.{ts,tsx}',
      'packages/ui/src/**/*.test.{ts,tsx}',
      'packages/tool-views/src/**/*.test.{ts,tsx}',
      'packages/app-shell/src/**/*.test.{ts,tsx}',
      'scripts/lib/**/*.test.mjs',
    ],
  },
})
