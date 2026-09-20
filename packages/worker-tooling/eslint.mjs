/**
 * The eslint config body shared by the four service Workers
 * (services/{cds,guide,clinical,mock-ehr}), which mirrored each other
 * byte-for-byte (bar a header comment) before this file existed.
 *
 * Every dependency the config needs — `js`, `stylistic`, `globals`,
 * `tseslint`, `defineConfig`, `globalIgnores` — is passed in by the caller
 * rather than imported here. This repo has no npm workspaces (#387): each
 * service installs its own `eslint`/`typescript-eslint`/etc, at a version
 * that already differs from the root's. A bare `import '@eslint/js'` from a
 * file living under the repo-root `scripts/` tree would resolve against the
 * ROOT's node_modules regardless of which service is linting — silently
 * building the config from the wrong package versions. Taking every
 * dependency as an argument means this file does no module resolution of
 * its own, so each service's own `eslint.config.js` (importing from its own
 * node_modules, as it always did) is what actually determines which
 * versions build the config.
 *
 * It lived in `scripts/lib/` first (#558), with a note that this package was
 * its eventual home; `aliases.mjs`, `vite.mjs` and `tsconfig.worker.json`
 * beside it are the same move for the other three config files each service
 * carried. `scripts/check-service-toolchain.mjs` is what keeps a copy from
 * coming back.
 */
export function workerEslintConfig({ js, stylistic, globals, tseslint, defineConfig, globalIgnores }) {
  return defineConfig([
    // `.wrangler/` holds wrangler's generated temp bundles (a `wrangler dev`
    // run leaves `middleware-loader.entry.ts` behind). It is gitignored, so CI
    // never sees it and never lints it — but a developer who has run the dev
    // server gets ~50 style errors from generated code, which makes
    // `npm run verify` fail locally and pass in CI. That asymmetry is worse
    // than the noise.
    globalIgnores(['dist', 'web-dist', '.wrangler']),
    {
      files: ['**/*.ts'],
      extends: [js.configs.recommended, tseslint.configs.recommended],
      languageOptions: {
        ecmaVersion: 2022,
        globals: { ...globals.node, ...globals.serviceworker },
      },
      plugins: { '@stylistic': stylistic },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        '@stylistic/quotes': [
          'error',
          'single',
          { avoidEscape: true, allowTemplateLiterals: 'always' },
        ],
        '@stylistic/semi': ['error', 'never'],
        // Same convention as the root config: a leading underscore means
        // "required by the signature, deliberately unused".
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
      },
    },
  ])
}
