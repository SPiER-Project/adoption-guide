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
  // ⚠️ A `eslint-disable` whose rule no longer fires is a suppression that
  // outlived its reason, and it reads to the next author as if the rule still
  // has something to say here. Two were found the moment this was switched on.
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  // ⚠️ **The hoist WIDENED what `eslint .` reaches, and that is deliberate.**
  // This ran from `web/` until 2026-09-19, so `.` was web's own tree and every
  // app and package went unlinted — which is what `check-core-boundary.mjs`
  // records as its reason for existing as a drift-check rather than a rule.
  // From the repo root `.` is everything, so the ignores below are what draw
  // the line: the four Workers (guide, cds, clinical, mock-ehr) lint
  // themselves under their own configs (and their own `verify`), and the rest
  // of these hold no JS/TS this config owns.
  globalIgnores([
    'dist',
    'dist-clinical',
    '.runtime-fhir',
    'services/**',
    'ig/**',
    'docs/**',
    'public/**',
    'packages/fhir-artifacts/generated/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      // ⚠️ **`recommendedTypeChecked`, not `recommended`, and the difference is
      // the whole point.** The untyped set cannot see an `any`: it has no types,
      // so `response.data.patient.id` on an untyped value is four member
      // accesses it has nothing to say about. Every rule below that starts
      // `no-unsafe-` needs the type checker, and those are the ones that catch a
      // FHIR payload flowing into a writer unchecked.
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      // ⚠️ **`projectService` rather than a `project` array, because a list of
      // tsconfigs is a list that goes stale.** This asks TypeScript which
      // project owns each file, the same way an editor does, so adding a
      // referenced project needs no edit here. It also turns "this file is in
      // NO project" into a hard parse error — which is how
      // `packages/worker-http/src/spaAssets.ts` and `vitest.config.ts` were
      // found: both were typechecked by nothing at the root, and both linted
      // green under the untyped rules the whole time.
      parserOptions: {
        project: [
          './tsconfig.app.json', './tsconfig.node.json',
          './apps/*/tsconfig.json', './packages/*/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      ...styleRules,
      '@stylistic/jsx-quotes': ['error', 'prefer-double'],
      // A leading underscore means "required by the signature, deliberately
      // unused" — the convention the code already used before this config
      // reached the trees that use it.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // ── The four that needed type information to exist at all ────────────
      //
      // `no-floating-promises` is the one with a shipped defect behind it:
      // `useRegistrySlices` had an un-awaited `Promise.all` chain whose
      // rejection after unmount was an unhandled rejection nothing could see.
      '@typescript-eslint/no-floating-promises': 'error',
      // An async function passed where a void-returning one is expected — the
      // classic being an `async` React effect callback, whose returned promise
      // React treats as a cleanup function.
      '@typescript-eslint/no-misused-promises': 'error',
      // ⚠️ `!` is a hand-asserted invariant the compiler cannot check, and the
      // ones that were here sat on catalog lookups. Narrow it or throw with a
      // message — an `undefined` deref names no reason.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // ── Tests ─────────────────────────────────────────────────────────────────
  //
  // ⚠️ **`no-non-null-assertion` is OFF here, and that is a judgement about
  // what a test is for rather than an exemption granted to get to green.** In
  // production, `x!` is a claim the compiler cannot check and nothing will
  // re-examine. In a test, `bundle.entry![0]` against a fixture the same file
  // constructs IS the assertion — if the invariant breaks, the test fails,
  // which is the outcome the rule exists to produce. 175 of them would
  // otherwise have to become `expect(x).toBeDefined()` prologues that add
  // nothing.
  //
  // The `no-unsafe-*` family deliberately stays ON: a test reading `any` off a
  // fixture is how a mapper's real contract goes unasserted.
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // ⚠️ **OFF because the `async` is load-bearing in a test double**, which
      // is the opposite of what this rule assumes. Five fakes here implement a
      // promise-returning interface (`client.request`, `createResource`) and
      // `throw` to simulate a server error; `async` is what turns that throw
      // into a REJECTED promise, which is exactly what the assertions await.
      // Removing it — the fix the rule is pointing at — makes the throw
      // synchronous and the tests stop testing the failure path. The one
      // production hit it found was real and is fixed (`localDataSource.listCohort`).
      '@typescript-eslint/require-await': 'off',
      // ⚠️ `expect(obj.method).toHaveBeenCalledWith(…)` is the assertion form,
      // and passing the reference unbound is the whole point of it — nothing
      // calls it. The rule's hazard (losing `this`) cannot arise.
      '@typescript-eslint/unbound-method': 'off',
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
