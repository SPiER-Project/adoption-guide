# `packages/worker-tooling`

The Worker toolchain, once. The four service Workers under `services/`
(`cds`, `guide`, `clinical`, `mock-ehr`) each carried their own copy of the
eslint config, the tsconfig, the Vite config and the Vitest config — twelve
files that were meant to be identical and were not: the tsconfigs disagreed on
`paths` and `baseUrl`, the vitest configs on alias *form* (object vs anchored
array), and the devDependency ranges had forked to the point of holding three
HIGH advisories open (`docs/internals/workers.md`). This package is where each
of those bodies lives now, and `scripts/check-service-toolchain.mjs` is what
keeps a copy from coming back.

| File | What a service does with it |
|---|---|
| `eslint.mjs` | `export default workerEslintConfig({ js, stylistic, globals, tseslint, defineConfig, globalIgnores })` — the service imports those six from **its own** `node_modules` and passes them in |
| `tsconfig.worker.json` | `"extends"` it; the service's own `tsconfig.json` declares only `include` |
| `vite.mjs` | `export default defineConfig(workerViteConfig({ external }))` and `defineConfig(workerVitestConfig())` |
| `aliases.mjs` | the `@spier/*` alias list both of the above use; `tsconfig.worker.json`'s `paths` is its `tsc` twin |

## Why nothing here imports a dependency

There is no npm workspace (#387). Each service installs its own `eslint`,
`vite` and `vitest`, and a bare `import 'vite'` from a file under `packages/`
would resolve against the **root** install's copy — a different version,
silently. So every module here is dependency-free: `eslint.mjs` takes its six
dependencies as arguments, `vite.mjs` returns plain objects for the service's
own `defineConfig` to type, and the `.d.mts` declarations describe those
objects structurally rather than importing `UserConfig` from anyone's Vite.
`aliases.mjs` imports only `node:url`.

## Two lists that must agree

`aliases.mjs` is what the bundler resolves `@spier/core/...` through;
`tsconfig.worker.json`'s `paths` is what `tsc` resolves it through. A package
in one but not the other typechecks and fails to bundle, or the reverse.
The gate's rule 4 asserts they name the same packages and that every target
exists on disk.

## The gate

`node scripts/check-service-toolchain.mjs` (`npm run check:toolchain` in every
service's `verify`) holds five rules: identical `devDependencies` across the
four manifests; every config file value-imports its body from here (and the
tsconfig `extends` the base); no config re-declares an alias, a `paths` block
or `compilerOptions`; the two alias lists agree; and a floor of four services
found, so an empty scan cannot report ✓. Each rule was planted against before
it was trusted — see the PR that added it.

## What is deliberately not here

- **`.gitignore`** — four near-identical copies remain, because git reads the
  file in place and there is nothing to import.
- **`wrangler.jsonc`** — each Worker's bindings and vars are its own; the one
  cross-Worker rule about them (`frame-ancestors`) is
  `scripts/check-worker-csp.mjs`'s.
- **Runtime code** — `packages/worker-http` is the shared *code* two asset
  hosts run; this package is the shared *tooling* all four build with.
