import { defineConfig } from 'vite'

/**
 * The BROWSER build: the three page modules under src/client, compiled to
 * src/client/dist/ for the Worker to serve (see src/clientAssets.ts). Separate
 * from vite.config.ts on purpose — that one bundles the Worker for workerd via
 * packages/worker-tooling, and a Worker build has no DOM and no browser target.
 *
 * Library mode with three entries and plain ES output: each page loads one
 * module as `<script type="module">`, and a module two entries share becomes a
 * content-hashed chunk beside them that the Worker serves under the same route.
 * Not minified, so the tests can assert on the code and a reader can read what
 * the demo host actually runs.
 */
export default defineConfig({
  build: {
    lib: {
      entry: {
        home: 'src/client/home.ts',
        chart: 'src/client/chart.ts',
        settings: 'src/client/settings.ts',
      },
      formats: ['es'],
    },
    outDir: 'src/client/dist',
    emptyOutDir: true,
    target: 'es2020',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' },
    },
  },
})
