import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests run the real Hono app through `app.request()` — no workerd needed, and
// running under Vitest (which is Vite) means the fixture `import.meta.glob`
// loaders transform normally, exactly as they do in the deployed bundle.
export default defineConfig({
  resolve: {
    alias: {
      // ⚠️ **No `fhirclient` alias, and it had to go at fhirclient 3.** The
      // integration test drives the app's real SmartDataSource, which needs a
      // real fhirclient Client; this package deliberately declares no copy of
      // its own, so the root install is the one it gets. An alias used to point
      // at that directory and PREFIX-match, which is what `fhirclient/lib/
      // Client` needed. v3 is exports-only — `fhirclient/Client` is an
      // export-map name resolving to `types/Client.d.ts` + `esm/Client.js`, not
      // a path — and a prefix rewrite happens BEFORE the export map is read, so
      // the alias sent it to a `<dir>/Client` that does not exist. The ordinary
      // walk-up from services/mock-ehr/src reaches the same root install and
      // does consult the export map.
      // The demo population — declared alias, not a workspace (#387). Object
      // form matches this file's existing shape; prefix matching is wanted, so
      // '@spier/demo-population/patients.json' resolves under the same root.
      // The React-free domain layer (packages/core), step B (#389).
      '@spier/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      // The compiled FHIR artifacts — static imports only; Vite does not
      // resolve aliases inside `import.meta.glob`.
      '@spier/fhir-artifacts': fileURLToPath(
        new URL('../../packages/fhir-artifacts', import.meta.url),
      ),
      '@spier/demo-population': fileURLToPath(
        new URL('../../packages/demo-population/src', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
