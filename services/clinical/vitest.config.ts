import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// HTTP-level tests against the Hono app's `fetch` directly — no Workers
// runtime, no wrangler. The Cloudflare plugin is intentionally NOT loaded: the
// Static Assets binding is stubbed, which is what makes a 404 from it
// controllable at all.
export default defineConfig({
  // Must agree with vite.config.ts and tsconfig.json's `paths`.
  resolve: {
    alias: [
      {
        find: '@spier/worker-http/',
        replacement: fileURLToPath(
          new URL('../../packages/worker-http/src/', import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
