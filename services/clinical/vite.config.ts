import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Bundle the Worker entry (src/index.ts) into a single ESM file for Cloudflare.
// Plain Vite (not @cloudflare/vite-plugin) so the build stays decoupled from
// asset handling — wrangler serves ./web-dist natively. Same shape as the other
// two services, though this one imports no `import.meta.glob` loader: the SPA it
// serves is a separate build staged by `npm run stage:assets`.
export default defineConfig({
  // Shared code resolves by declared alias, not by npm workspace (#387).
  // Must agree with tsconfig.json's `paths`.
  resolve: {
    alias: [
      {
        // The Worker-side HTTP shared layer (packages/worker-http): the Static
        // Assets catch-all and the `frame-ancestors` policy, shared with
        // services/guide so the header cannot differ between the two.
        find: '@spier/worker-http/',
        replacement: fileURLToPath(
          new URL('../../packages/worker-http/src/', import.meta.url),
        ),
      },
    ],
  },
  build: {
    ssr: './src/index.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      output: { entryFileNames: 'index.js', format: 'es' },
    },
  },
  // Bundle every dependency (hono + the shared module) into the single output
  // so the Worker has no runtime resolution to do.
  ssr: { target: 'webworker', noExternal: true },
})
