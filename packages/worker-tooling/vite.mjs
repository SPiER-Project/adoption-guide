/**
 * The Vite and Vitest config bodies shared by the four service Workers
 * (services/{cds,guide,clinical,mock-ehr}).
 *
 * Each service's `vite.config.ts` is now
 *
 *     export default defineConfig(workerViteConfig({ ... }))
 *
 * and its `vitest.config.ts` the same with `workerVitestConfig()`. The
 * `defineConfig` call stays in the service on purpose: this file imports
 * NOTHING from `vite` or `vitest`, because a bare `import 'vite'` from under
 * `packages/` would resolve against the ROOT install's copy, not the
 * service's — the same reason `eslint.mjs` beside this file takes its
 * dependencies as arguments. A plain object crosses that line safely;
 * `defineConfig` in the service then types it against the service's own Vite.
 *
 * The build shape, and why it is what it is (from the four files this
 * replaced): the Worker entry is bundled into ONE ESM file for Cloudflare with
 * plain Vite rather than `@cloudflare/vite-plugin`, so the build stays
 * decoupled from asset handling — wrangler serves `./web-dist` natively where
 * there is one. It is still a Vite build, which is the point: the population
 * scenarios and generated Patient resources reach the Workers through
 * `import.meta.glob` loaders in `../../packages`, and only a Vite transform
 * inlines their JSON. A Worker has no filesystem, so this is the only way the
 * fixtures get there. Every dependency (hono + the shared packages) is bundled
 * into the single output so the Worker has no runtime resolution to do.
 */
import { workerAliases } from './aliases.mjs'

/**
 * @param {object} [options]
 * @param {string} [options.entry] the Worker entry module; `./src/index.ts` in
 *   every service today
 * @param {Array<string | RegExp>} [options.external] module ids Rollup must
 *   leave unresolved because the RUNTIME provides them. `services/mock-ehr`
 *   passes `/^cloudflare:/`: its Durable Objects import `cloudflare:workers`,
 *   and without this the build fails with "failed to resolve import", which
 *   reads as a missing dependency rather than a missing external.
 */
export function workerViteConfig({ entry = './src/index.ts', external = [] } = {}) {
  return {
    resolve: { alias: workerAliases() },
    build: {
      ssr: entry,
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      rollupOptions: {
        external,
        output: { entryFileNames: 'index.js', format: 'es' },
      },
    },
    ssr: { target: 'webworker', noExternal: true },
  }
}

/**
 * HTTP-level tests against the Hono app's `fetch` directly — no workerd, no
 * wrangler, and deliberately not the Cloudflare Vitest plugin: the Static
 * Assets binding is stubbed in the tests, which is what makes a 404 from it
 * controllable at all. Running under Vitest (which is Vite) means the fixture
 * `import.meta.glob` loaders transform exactly as they do in the deployed
 * bundle.
 *
 * ⚠️ No `fhirclient` alias, and it had to go at fhirclient 3. The mock EHR's
 * integration test drives the app's real SmartDataSource, which needs a real
 * fhirclient Client; no service declares its own copy, so the ordinary walk-up
 * from `services/<name>/src` reaches the root install. v3 is exports-only —
 * `fhirclient/Client` is an export-map name, not a path — and a prefix alias
 * rewrites BEFORE the export map is read, sending it to a `<dir>/Client` that
 * does not exist. The walk-up does consult the export map.
 */
export function workerVitestConfig() {
  return {
    resolve: { alias: workerAliases() },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
}
