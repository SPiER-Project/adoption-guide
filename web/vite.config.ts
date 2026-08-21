import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is env-driven so one codebase serves at the domain root (Cloudflare and
// local dev — the default `/`) and under /adoption-guide/ (legacy GitHub Pages,
// whose deploy workflow sets VITE_BASE). In-app asset + IG links read
// import.meta.env.BASE_URL, so they follow whichever base is active.
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
      {
        // The demo population (packages/demo-population), step A of the repo
        // reshape (#388). Not an npm workspace yet (#387), so it resolves by
        // declared alias. Anchored exact + prefix pair, for the same reason the
        // shims above are anchored: a bare string `find` matches by prefix.
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
