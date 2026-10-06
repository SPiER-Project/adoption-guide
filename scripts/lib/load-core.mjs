/**
 * Load TypeScript modules from `packages/*` into a plain Node gate, so the gate
 * reads core's REAL values instead of scraping its source.
 *
 * ── Why this exists ─────────────────────────────────────────
 *
 * `packages/core` uses Vite's `import.meta.glob` to read the generated FHIR
 * artifacts, so plain Node cannot import it — and every `check:*` gate that
 * needed something from it either regex-parsed the `.ts` source or kept a hand
 * copy "in sync". Both are the failure this repo keeps documenting: a scrape
 * that stops matching reports green over nothing (#232, #261), and a copy that
 * drifts passes while describing code that no longer exists. Each scraping gate
 * had to grow its own guard against its own parser — a floor, a shape
 * assertion, a raw-count cross-check — because the parser was the weak link.
 *
 * This runs the modules through the repo's own `vite.config.ts` (aliases,
 * `import.meta.glob`, JSON imports) using Vite's SSR module loader: no new
 * dependency, and the same resolution the apps and the tests get.
 *
 * ── The rule ────────────────────────────────────────────────
 *
 * A gate that needs a VALUE from core — a table, a registry, a set of keys —
 * loads it here. A gate whose subject is the SOURCE itself — which file a symbol
 * lives in, which literal a reader passes, whether a string reaches the UI —
 * stays static (an AST or text scan), because the runtime cannot answer that.
 *
 * ⚠️ **The server is closed before the modules are returned.** Every glob in
 * core is `eager`, so a module is fully evaluated by the time it loads. A module
 * that imported lazily at call time would throw after the close — loudly, which
 * is the acceptable failure; it cannot silently answer from nothing.
 */
import { createServer } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Load each module id (an `@spier/...` alias or a repo-relative path) and
 * return them in order. Throws if a module cannot be loaded; a gate must not
 * treat "could not load core" as "core has nothing in it".
 *
 * @param {string[]} ids
 * @returns {Promise<Record<string, any>[]>}
 */
export async function loadCore(ids) {
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    // Nothing here is served to a browser, so there is nothing to pre-bundle;
    // discovery would only crawl the apps' entry points.
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  try {
    const modules = []
    for (const id of ids) modules.push(await server.ssrLoadModule(id))
    return modules
  } finally {
    await server.close()
  }
}
