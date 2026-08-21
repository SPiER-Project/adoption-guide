import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests run the real Hono app through `app.request()` — no workerd needed, and
// running under Vitest (which is Vite) means the fixture `import.meta.glob`
// loaders transform normally, exactly as they do in the deployed bundle.
export default defineConfig({
  resolve: {
    alias: {
      // The integration test drives the app's real SmartDataSource, which needs
      // a real fhirclient Client. `fhirclient` is web's dependency and this
      // package deliberately does not declare its own copy — a second copy
      // could drift from the version the app actually ships, and then the test
      // would be exercising a client the panel never uses.
      //
      // Prefix aliasing is what is wanted here (unlike web/vite.config.ts's
      // anchored shim regexes): 'fhirclient/lib/Client' must resolve under the
      // same package root.
      fhirclient: fileURLToPath(new URL('../../web/node_modules/fhirclient', import.meta.url)),
      // The demo population — declared alias, not a workspace (#387). Object
      // form matches this file's existing shape; prefix matching is wanted, so
      // '@spier/demo-population/patients.json' resolves under the same root.
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
