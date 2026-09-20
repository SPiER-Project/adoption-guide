import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { workerEslintConfig } from '../../scripts/lib/worker-eslint-config.mjs'

// The CDS Hooks service imports web source (the catalog, mappers, demo
// population) so it must agree on style with eslint.config.js, but it runs
// on workerd rather than in a browser — hence the different globals. The
// config body itself is shared with the other three service Workers; see
// worker-eslint-config.mjs for why it takes its dependencies as arguments
// rather than importing them.
export default workerEslintConfig({ js, stylistic, globals, tseslint, defineConfig, globalIgnores })
