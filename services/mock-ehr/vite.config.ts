import { defineConfig } from 'vite'

// Bundle the Worker entry (src/index.ts) into a single ESM file for Cloudflare.
// Same arrangement as services/cds-hooks: plain Vite rather than
// @cloudflare/vite-plugin, because the point of the Vite build here is that the
// app's `import.meta.glob` loaders — the population scenarios and the generated
// Patient resources, both imported from ../../web/src — are transformed and
// their JSON inlined at build time. A Worker has no filesystem, so this is the
// only way the fixtures reach it.
export default defineConfig({
  build: {
    ssr: './src/index.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      // `cloudflare:*` modules are provided BY the runtime, so Rollup must leave
      // the import alone rather than try to resolve it — step 4's Durable Object
      // imports `cloudflare:workers`. Without this the build fails with "failed
      // to resolve import", which reads as a missing dependency.
      external: [/^cloudflare:/],
      output: { entryFileNames: 'index.js', format: 'es' },
    },
  },
  ssr: { target: 'webworker', noExternal: true },
})
