import { defineConfig } from 'vitest/config'

// Tests exercise the pure service logic (src/service.ts) — no Workers runtime,
// no Hono. Running under Vitest (which is Vite) means the web app's
// `import.meta.glob` catalog/scenario loaders transform normally, and
// crypto.randomUUID is available from the Node global. The Cloudflare plugin is
// intentionally NOT loaded here: we don't need workerd to test card derivation.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
