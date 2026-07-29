import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

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
    // Deliberately narrow: only the two axes a wholesale reformat (Prettier
    // defaults, an IDE "format on save", a drive-by bot PR) would flip. Adopting
    // Prettier itself would rewrite ~92 of 113 source files, so these two rules
    // pin the house style without the churn. Not a general formatting policy —
    // don't grow this list into one.
    rules: {
      '@stylistic/quotes': [
        'error',
        'single',
        { avoidEscape: true, allowTemplateLiterals: 'always' },
      ],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/jsx-quotes': ['error', 'prefer-double'],
    },
  },
])
