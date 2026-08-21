import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Bundle the Worker entry (src/index.ts) into a single ESM file for Cloudflare.
// Plain Vite (not @cloudflare/vite-plugin) so the build stays decoupled from
// asset handling — wrangler serves ./web-dist natively. This is still a Vite
// build, so the app's `import.meta.glob` catalog + scenario loaders (imported
// from ../../web/src) are transformed and their JSON inlined at build time.
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
        find: '@spier/demo-population/',
        replacement: fileURLToPath(
          new URL('../../packages/demo-population/src/', import.meta.url),
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
  // Bundle every dependency (hono + the web/src modules) into the single output
  // so the Worker has no runtime resolution to do.
  ssr: { target: 'webworker', noExternal: true },
})
