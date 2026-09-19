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
const REACT_DIR = fileURLToPath(new URL('./node_modules/react', import.meta.url))
const REACT_DOM_DIR = fileURLToPath(new URL('./node_modules/react-dom', import.meta.url))
const ROUTER_DIR = fileURLToPath(new URL('./node_modules/react-router-dom', import.meta.url))
const LUCIDE_DIR = fileURLToPath(new URL('./node_modules/lucide-react', import.meta.url))
const FORMBOX_RENDERER_DIR = fileURLToPath(new URL('./node_modules/@formbox/renderer', import.meta.url))
const FORMBOX_THEME_DIR = fileURLToPath(new URL('./node_modules/@formbox/hs-theme', import.meta.url))
// Test-only, so it is here and not in vite.config.ts — packages/ui's colocated
// tests import it and have no node_modules to walk up into.
const TESTING_LIBRARY_DIR = fileURLToPath(new URL('./node_modules/@testing-library/react', import.meta.url))

export default defineConfig({
  // ⚠️ Vitest serves test files through a Vite dev server rooted at `web/`, and
  // a file outside that root is fetched over `/@fs/…` — which the server
  // refuses unless the path is allowed. packages/core's tests never hit this
  // because they run in the `node` environment; packages/ui's run in `jsdom`,
  // which goes through the browser-shaped module graph, and failed with
  // "Cannot find module '/@fs/…/Button.test.tsx'".
  server: { fs: { allow: ['..'] } },
  // ⚠️ This file does NOT inherit web/vite.config.ts — no `mergeConfig` — so the
  // demo-population alias is repeated here rather than shared. Verified, not
  // assumed: under vitest `@lhncbc/ucum-lhc` resolves to the real library, not
  // the shim vite.config.ts aliases. Editing one without the other breaks either
  // the build or the tests, never silently both.
  resolve: {
    alias: [
      // ── React, resolved for packages/ui ──────────────────────────────
      // packages/ui has no node_modules of its own and is not an npm workspace
      // (#387), so Vite cannot resolve a bare `react` from it — the first
      // symptom is `Failed to resolve import "react/jsx-dev-runtime"`. These
      // point every React specifier at web's single copy, which is the only one
      // in the repo, so nothing about web's own resolution changes.
      //
      // ⚠️ **Written as an anchored regex and a quoted prefix because those are
      // the two forms `scripts/lib/vite-alias.mjs` can read.** That parser
      // THROWS on an alias it cannot make sense of, and check:ucum and
      // check:fhir-r5 both treat "not aliased" as "nothing to guard" — so an
      // unparseable entry here would take two shim gates down with it. A form
      // like /^react\// (no `$`) is exactly what it refuses.
      { find: /^react$/, replacement: REACT_DIR },
      { find: 'react/', replacement: `${REACT_DIR}/` },
      { find: /^react-dom$/, replacement: REACT_DOM_DIR },
      { find: 'react-dom/', replacement: `${REACT_DOM_DIR}/` },
      { find: /^react-router-dom$/, replacement: ROUTER_DIR },
      { find: /^lucide-react$/, replacement: LUCIDE_DIR },
      // ── formbox, resolved for packages/tool-views ────────────────────
      // Same problem, and the same fix, as React above: packages/tool-views has
      // no node_modules of its own, so Vite cannot resolve a bare
      // `@formbox/renderer` from it.
      //
      // ⚠️ **Anchored EXACT only — no `@formbox/hs-theme/` prefix entry.** A
      // prefix alias rewrites the path before Vite consults the package's
      // `exports` map, and `@formbox/hs-theme/style.css` (imported by App.tsx)
      // is an export-map entry pointing at `dist/index.css`. Aliasing the prefix
      // sent it looking for a `style.css` that does not exist on disk. App.tsx
      // lives under web/ and resolves that subpath by the ordinary node_modules
      // walk-up, so only the bare specifiers need help.
      { find: /^@formbox\/renderer$/, replacement: FORMBOX_RENDERER_DIR },
      { find: /^@formbox\/hs-theme$/, replacement: FORMBOX_THEME_DIR },
      { find: /^@testing-library\/react$/, replacement: TESTING_LIBRARY_DIR },
      {
        find: /^@spier\/demo-population$/,
        replacement: fileURLToPath(
          new URL('../packages/demo-population/src/index.ts', import.meta.url),
        ),
      },
      {
        // The 18 instrument fillers and 11 workflow recorders, plus the three
        // contexts they read (packages/tool-views). ONE definition, now enforced
        // by a package boundary rather than by a test that parses two files as
        // text — see the package README.
        find: '@spier/tool-views/',
        replacement: fileURLToPath(
          new URL('../packages/tool-views/src/', import.meta.url),
        ),
      },
      {
        // The design system (packages/ui) — see vite.config.ts.
        find: '@spier/ui/',
        replacement: fileURLToPath(
          new URL('../packages/ui/src/', import.meta.url),
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
    // ⚠️ **A package whose tests are not in this list does not run, and
    // `verify` stays green.** packages/ui was extracted on 2026-09-19 taking
    // `Button.test.tsx` with it; the suite passed, 96 files, and that file
    // executed zero times. Nothing else would have noticed — which is why the
    // floor below exists rather than trust in this list.
    include: [
      'src/**/*.test.{ts,tsx}',
      '../packages/core/src/**/*.test.{ts,tsx}',
      '../packages/ui/src/**/*.test.{ts,tsx}',
      '../packages/tool-views/src/**/*.test.{ts,tsx}',
      '../scripts/lib/**/*.test.mjs',
    ],
  },
})
