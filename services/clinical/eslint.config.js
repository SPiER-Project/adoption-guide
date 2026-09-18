import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Mirrors services/cds-hooks/eslint.config.js exactly. This Worker imports no
// web source, but it is read alongside the other two and a third style would be
// one more thing to notice rather than one fewer.
export default defineConfig([
  // `.wrangler/` holds wrangler's generated temp bundles (a `wrangler dev` run
  // leaves `middleware-loader.entry.ts` behind). It is gitignored, so CI never
  // sees it and never lints it — but a developer who has run the dev server gets
  // ~50 style errors from generated code, which makes `npm run verify` fail
  // locally and pass in CI. That asymmetry is worse than the noise.
  globalIgnores(['dist', 'web-dist', '.wrangler']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.serviceworker },
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/quotes': [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: 'always' },
      ],
      '@stylistic/semi': ['error', 'never'],
    },
  },
])
