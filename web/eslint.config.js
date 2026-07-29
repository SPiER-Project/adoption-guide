import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Deliberately narrow: only the two axes a wholesale reformat (Prettier
// defaults, an IDE "format on save", a drive-by bot PR) would flip. Adopting
// Prettier itself would rewrite ~92 of 113 source files, so these rules pin the
// house style without the churn. Not a general formatting policy — don't grow
// this list into one. Shared by both blocks below so app code and build scripts
// can't drift apart.
const styleRules = {
  '@stylistic/quotes': [
    'error',
    'single',
    { avoidEscape: true, allowTemplateLiterals: 'always' },
  ],
  '@stylistic/semi': ['error', 'never'],
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      ...styleRules,
      '@stylistic/jsx-quotes': ['error', 'prefer-double'],
    },
  },
  // Build and drift-check scripts. Without this block these files match no
  // config at all, so eslint applied ZERO rules to them — not just no style
  // rules: an unused variable or typo'd binding in the drift checks that guard
  // our hand-duplicated LOINC codes and stage ids was invisible.
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    plugins: { '@stylistic': stylistic },
    rules: styleRules,
  },
])
