import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { workerEslintConfig } from '../../packages/worker-tooling/eslint.mjs'

// Mirrors eslint.config.js so the two agree on style, but it runs on
// workerd rather than in a browser — hence the different globals. Offline
// since the CDS split (#556): this Worker imports @spier/worker-http and
// nothing else, no longer the catalog, mappers or scenarios. The config body
// itself is shared with the other three service Workers; see
// packages/worker-tooling/eslint.mjs for why it takes its dependencies as arguments
// rather than importing them.
export default workerEslintConfig({ js, stylistic, globals, tseslint, defineConfig, globalIgnores })
