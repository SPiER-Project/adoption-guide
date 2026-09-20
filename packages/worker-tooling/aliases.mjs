/**
 * The `@spier/*` import aliases every service Worker's Vite and Vitest config
 * declares — once, here, instead of once per config file.
 *
 * Why an alias list and not an npm workspace: #387. Each service has its own
 * install, so `@spier/core` is not a package it can resolve; the bundler is
 * told where the source lives instead. Before this file the list was
 * hand-mirrored into eight config files (vite + vitest, four services) and
 * had already drifted in shape — `services/mock-ehr` used the object form,
 * which PREFIX-matches, while the others used the anchored exact + prefix
 * pair. One form now, the anchored one:
 *
 *  - the exact `/^@spier\/demo-population$/` entry serves the bare import of
 *    the package index;
 *  - every other entry ends in `/` so it matches `@spier/<pkg>/<path>` and
 *    nothing else (`@spier/core-extras` could never be swallowed by it).
 *
 * A service that imports none of a given package is unaffected by its alias
 * being declared — an alias is a rewrite rule, not an import — which is what
 * lets the list be the same for all four.
 *
 * Paths are built with `fileURLToPath`, not `new URL().pathname`, because a
 * repo path can contain a space (the worktree path does) and `.pathname`
 * percent-encodes it.
 *
 * ⚠️ These must agree with `tsconfig.worker.json`'s `paths` block in this
 * directory: the bundler resolves through this list, `tsc` through that one,
 * and a package present in one but not the other compiles yet fails to
 * bundle (or the reverse). `scripts/check-service-toolchain.mjs` asserts the
 * two name the same packages.
 */
import { fileURLToPath } from 'node:url'

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url))

/** `@spier/*` → source directory, for Vite's / Vitest's `resolve.alias`. */
export function workerAliases() {
  return [
    { find: /^@spier\/demo-population$/, replacement: here('../demo-population/src/index.ts') },
    { find: '@spier/demo-population/', replacement: here('../demo-population/src/') },
    // The Worker-side HTTP layer: the Static Assets catch-all and the
    // `frame-ancestors` policy, shared by services/guide and services/clinical
    // so the header cannot differ between them (scripts/check-worker-csp.mjs).
    { find: '@spier/worker-http/', replacement: here('../worker-http/src/') },
    // The React-free domain layer (#389). Prefix alias: every consumer imports
    // `@spier/core/<path>`, mirroring the package's own structure.
    { find: '@spier/core/', replacement: here('../core/src/') },
    // The compiled FHIR artifacts (#392). ⚠️ Static imports only — Vite does
    // not resolve aliases inside `import.meta.glob`, so runtime globs use
    // relative paths.
    { find: '@spier/fhir-artifacts/', replacement: here('../fhir-artifacts/') },
  ]
}
