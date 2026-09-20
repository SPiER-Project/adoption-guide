import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { workerEslintConfig } from '../../packages/worker-tooling/eslint.mjs'

// Mirrors eslint.config.js. The Worker imports web source (catalog,
// mappers, scenarios) so the two must agree on style, but it runs on
// workerd rather than in a browser — hence the different globals. The
// config body itself is shared with the other three service Workers; see
// packages/worker-tooling/eslint.mjs for why it takes its dependencies as arguments
// rather than importing them.
export default workerEslintConfig({ js, stylistic, globals, tseslint, defineConfig, globalIgnores })
