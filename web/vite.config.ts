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
    // lives beside the shim it points at. Both apply to vitest too, which reads
    // this config.
    //
    // The array form with anchored patterns, not the object form: object aliases
    // match by *prefix*, so `fhirpath` would also capture
    // `fhirpath/fhir-context/r4` and resolve it to `<shim>.ts/fhir-context/r4`.
    // That is a real mistake this file made in a draft, and `$` is the fix.
    alias: [
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
