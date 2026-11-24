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

/**
 * Which app this build is for.
 *
 * ⚠️ **This is a BUILD TARGET, not the old surface flag.** `VITE_SURFACE` used
 * to fold one source tree two ways at compile time; the trees are separate now
 * (`apps/guide`, `apps/clinical`) and nothing in either reads a flag. All this
 * chooses is which `index.html` vite starts from and where the output lands.
 * The name is kept because `deploy.yml`, both Workers' staging scripts and
 * `check-surface.mjs` all speak it already.
 *
 * ⚠️ The config lives at the REPO ROOT, and that is the whole arrangement: the
 * root owns package.json, the single node_modules and every gate script, so one
 * config resolves dependencies for both apps and all four packages. An
 * app-local config would sit in a directory with no install under it (#387 — no
 * npm workspaces), which is what kept this in `web/` until the hoist.
 */
const APP = process.env.VITE_SURFACE === 'clinical' ? 'clinical' : 'guide'
const APP_ROOT = fileURLToPath(new URL(`./apps/${APP}/`, import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  root: APP_ROOT,
  // Shared by both apps, and the root's like the rest of the tooling — so it
  // does NOT sit under `root`, which points into apps/<app>.
  publicDir: fileURLToPath(new URL('./public/', import.meta.url)),
  build: {
    // ⚠️ ABSOLUTE, and `emptyOutDir` explicit. With `root` pointing into
    // apps/<app>, a relative outDir would land at apps/<app>/dist — and vite
    // refuses to empty a directory outside its root unless told to. Both
    // Workers' staging scripts and deploy.yml read these two paths, which the
    // hoist moved from dist and dist-clinical to the repo root.
    outDir: fileURLToPath(
      new URL(APP === 'clinical' ? './dist-clinical/' : './dist/', import.meta.url),
    ),
    emptyOutDir: true,
  },
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
        // The demo population (packages/demo-population), step A of the repo
        // reshape (#388). Not an npm workspace yet (#387), so it resolves by
        // declared alias. Anchored exact + prefix pair, for the same reason the
        // shims above are anchored: a bare string `find` matches by prefix.
        //
        // ⚠️ **It no longer branches on the build surface, because no app module
        // imports it (2026-09-19).** It used to resolve to an empty shim on the
        // clinical build, which was a build-surface flag doing a dependency's
        // job: `LocalDataSource` imported the fixtures outright, and
        // `PatientProvider` reaches a data source unconditionally, so the guide
        // compiled in all 14 synthetic patients too. The seed corpus is injected
        // now and both apps inject nothing. This entry survives for the TESTS,
        // which legitimately use the fixtures, and for packages/demo-population's
        // real consumers — services/{cds-hooks,mock-ehr}.
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
        // The design system (packages/ui): the eight surface primitives, the
        // `cx` helper they share, and `foundation.css` — every token they
        // consume. Prefix alias entry, mirroring the package's own structure.
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
      {
        // The full UCUM units library, instantiated at import time by fhirpath
        // though nothing here has a quantity to convert: 557KB raw / 117KB gzip.
        // See shims/ucum-lhc.ts and `npm run check:ucum`.
        find: /^@lhncbc\/ucum-lhc$/,
        replacement: fileURLToPath(new URL('./shims/ucum-lhc.ts', import.meta.url)),
      },
      {
        // The R5 type model, which the renderer imports beside R4 and selects by
        // its `fhirVersion` prop — always the literal "r4" here: 575KB raw /
        // 67KB gzip. See shims/fhirpath-r5-context.ts and
        // `npm run check:fhir-r5`.
        find: /^fhirpath\/fhir-context\/r5$/,
        replacement: fileURLToPath(
          new URL('./shims/fhirpath-r5-context.ts', import.meta.url),
        ),
      },
    ],
  },
  // Honor a PORT assigned by the environment (e.g. a preview harness) so the
  // dev server binds where callers expect it; otherwise Vite's default 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
