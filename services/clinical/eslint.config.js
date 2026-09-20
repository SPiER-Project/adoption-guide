import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { workerEslintConfig } from '../../scripts/lib/worker-eslint-config.mjs'

// Mirrors services/guide/eslint.config.js exactly. This Worker imports no
// web source, but it is read alongside the other two and a third style would
// be one more thing to notice rather than one fewer. The config body itself
// is shared with the other three service Workers; see
// worker-eslint-config.mjs for why it takes its dependencies as arguments
// rather than importing them.
export default workerEslintConfig({ js, stylistic, globals, tseslint, defineConfig, globalIgnores })
