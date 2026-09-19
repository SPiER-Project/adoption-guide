import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is env-driven so one codebase serves at the domain root (Cloudflare and
// local dev — the default `/`) and under /adoption-guide/ (GitHub Pages, whose
// deploy workflow sets VITE_BASE). In-app asset + IG links read
// import.meta.env.BASE_URL, so they follow whichever base is active.
//
// Neither host is legacy: both are deployed from deploy.yml on every push to
// main, and both serve the rendered IG at <base>ig/ since 2026-09-18.
const REACT_DIR = fileURLToPath(new URL('./node_modules/react', import.meta.url))
const REACT_DOM_DIR = fileURLToPath(new URL('./node_modules/react-dom', import.meta.url))
const ROUTER_DIR = fileURLToPath(new URL('./node_modules/react-router-dom', import.meta.url))
const LUCIDE_DIR = fileURLToPath(new URL('./node_modules/lucide-react', import.meta.url))
// ⚠️ Needed for packages/app-shell, whose SMART components import `fhirclient`
// BARE. From web/src that resolved by walking up into web/node_modules; from
// packages/app-shell/src the walk reaches the repo root and finds nothing.
const FHIRCLIENT_DIR = fileURLToPath(new URL('./node_modules/fhirclient', import.meta.url))
const FORMBOX_RENDERER_DIR = fileURLToPath(new URL('./node_modules/@formbox/renderer', import.meta.url))
const FORMBOX_THEME_DIR = fileURLToPath(new URL('./node_modules/@formbox/hs-theme', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  resolve: {
    // Two prunes of the assessment-route chunk, together 47% of its gzip: what
    // @formbox/renderer's dependency tree loads but this app can never execute.
    // Each has a gate that fails if that stops being true, and the reasoning
    // lives beside the shim it points at.
    //
    // ⚠️ These do NOT apply to vitest. `vitest.config.ts` is its own
    // `defineConfig` with no `mergeConfig`, so it does not inherit this block —
    // verified 2026-08-20 by resolving `@lhncbc/ucum-lhc` under vitest and
    // getting the real library's three exports rather than the shim's one. This
    // comment previously claimed the opposite. Nothing is broken by it (the
    // shims are bundle-size prunes and `check:ucum` gates the build), but an
    // alias that tests must also see has to be written in BOTH files.
    //
    // The array form with anchored patterns, not the object form: object aliases
    // match by *prefix*, so `fhirpath` would also capture
    // `fhirpath/fhir-context/r4` and resolve it to `<shim>.ts/fhir-context/r4`.
    // That is a real mistake this file made in a draft, and `$` is the fix.
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
      { find: /^fhirclient$/, replacement: FHIRCLIENT_DIR },
      { find: 'fhirclient/', replacement: `${FHIRCLIENT_DIR}/` },
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
      {
        // The demo population (packages/demo-population), step A of the repo
        // reshape (#388). Not an npm workspace yet (#387), so it resolves by
        // declared alias. Anchored exact + prefix pair, for the same reason the
        // shims above are anchored: a bare string `find` matches by prefix.
        find: /^@spier\/demo-population$/,
        replacement: fileURLToPath(
          // The build surface (src/lib/surface.ts): on `clinical` the demo
          // population resolves to an empty shim, so the scenario glob is never
          // compiled in. One alias entry, two possible targets — the shim
          // gates' alias reader (scripts/lib/vite-alias.mjs) scans the pattern
          // list and must keep seeing exactly one entry for this package.
          new URL(
            process.env.VITE_SURFACE === 'clinical'
              ? './src/shims/demo-population.clinical.ts'
              : '../packages/demo-population/src/index.ts',
            import.meta.url,
          ),
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
          new URL('../packages/app-shell/src/', import.meta.url),
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
        // The design system (packages/ui): the eight surface primitives, the
        // `cx` helper they share, and `foundation.css` — every token they
        // consume. Prefix alias entry, mirroring the package's own structure.
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
      {
        // The full UCUM units library, instantiated at import time by fhirpath
        // though nothing here has a quantity to convert: 557KB raw / 117KB gzip.
        // See src/shims/ucum-lhc.ts and `npm run check:ucum`.
        find: /^@lhncbc\/ucum-lhc$/,
        replacement: fileURLToPath(new URL('./src/shims/ucum-lhc.ts', import.meta.url)),
      },
      {
        // The R5 type model, which the renderer imports beside R4 and selects by
        // its `fhirVersion` prop — always the literal "r4" here: 575KB raw /
        // 67KB gzip. See src/shims/fhirpath-r5-context.ts and
        // `npm run check:fhir-r5`.
        find: /^fhirpath\/fhir-context\/r5$/,
        replacement: fileURLToPath(
          new URL('./src/shims/fhirpath-r5-context.ts', import.meta.url),
        ),
      },
    ],
  },
  // Honor a PORT assigned by the environment (e.g. a preview harness) so the
  // dev server binds where callers expect it; otherwise Vite's default 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
