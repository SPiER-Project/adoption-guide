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
    alias: {
      // `fhirpath` (via @formbox/renderer) pulls in the full UCUM units library
      // and instantiates it at import time, though nothing here has a quantity
      // item to convert: 557KB raw / 117KB gzip, 30% of the chunk every
      // assessment route loads. The shim satisfies the API and throws if it is
      // ever actually used; `npm run check:ucum` is what keeps that safe, and
      // carries the full rationale alongside src/shims/ucum-lhc.ts.
      // Applies to vitest too, which reads this config.
      '@lhncbc/ucum-lhc': fileURLToPath(new URL('./src/shims/ucum-lhc.ts', import.meta.url)),
    },
  },
  // Honor a PORT assigned by the environment (e.g. a preview harness) so the
  // dev server binds where callers expect it; otherwise Vite's default 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
