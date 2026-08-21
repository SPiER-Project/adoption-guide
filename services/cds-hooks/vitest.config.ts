import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests exercise the pure service logic (src/service.ts) — no Workers runtime,
// no Hono. Running under Vitest (which is Vite) means the web app's
// `import.meta.glob` catalog/scenario loaders transform normally, and
// crypto.randomUUID is available from the Node global. The Cloudflare plugin is
// intentionally NOT loaded here: we don't need workerd to test card derivation.
export default defineConfig({
  // The demo population resolves by declared alias, not by npm workspace
  // (#387 records why there is no workspace yet). Anchored exact + prefix
  // pair; must agree with tsconfig.json's `paths`.
  resolve: {
    alias: [
      {
        find: /^@spier\/demo-population$/,
        replacement: fileURLToPath(
          new URL('../../packages/demo-population/src/index.ts', import.meta.url),
        ),
      },
      {
        // The React-free domain layer (packages/core), step B (#389). Prefix
        // alias: every consumer imports `@spier/core/<path>` mirroring the
        // package's own structure.
        find: '@spier/core/',
        replacement: fileURLToPath(
          new URL('../../packages/core/src/', import.meta.url),
        ),
      },
      {
        // The compiled FHIR artifacts (packages/fhir-artifacts), step E1 (#392).
        // ⚠️ Static imports only — Vite does not resolve aliases inside
        // `import.meta.glob`, so the runtime globs use relative paths.
        find: '@spier/fhir-artifacts/',
        replacement: fileURLToPath(
          new URL('../../packages/fhir-artifacts/', import.meta.url),
        ),
      },
      {
        find: '@spier/demo-population/',
        replacement: fileURLToPath(
          new URL('../../packages/demo-population/src/', import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
