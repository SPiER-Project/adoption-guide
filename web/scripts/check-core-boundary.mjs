#!/usr/bin/env node
/**
 * packages/core must stay React-free and DOM-free.
 *
 * This is the constraint that makes the boundary worth drawing at all. §4 of
 * docs/plans/repo-and-package-boundaries.md: the point of declaring `core` is
 * that its independence from the app becomes *enforceable* rather than merely
 * true today — two Workers and (eventually) other consumers import it, and none
 * of them has a `window`.
 *
 * Why a drift-check rather than an eslint rule: `eslint .` runs from `web/` and
 * cannot see `packages/`, and giving core its own eslint config would need a
 * fourth `verify` pipeline for one rule. This runs inside web's verify, which CI
 * invokes wholesale, so it is enforced automatically.
 *
 * Comments and string literals are stripped before scanning, because core's
 * prose legitimately discusses `localStorage` (smartDataSource explains that it
 * deliberately does NOT fall back to one) and "since last contact window".
 * A gate that fired on those would be turned off within a week.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const coreSrc = join(root, 'packages/core/src')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

/** Strip comments only. Strings survive, so guard literals stay readable. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
}

/** Strip line comments, block comments and string/template literals. */
function stripNonCode(src) {
  return stripComments(src)
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

// Bare module specifiers core may not depend on, and the DOM globals it may not
// touch. Both lists are deliberately short: this gate answers one question.
const FORBIDDEN_MODULES = [/^react$/, /^react-dom(\/.*)?$/, /^react-router(-dom)?$/]
// `alert` is deliberately NOT here: `RiskAlert` values are named `alert`
// throughout the mappers, so `alert.interpretation` is a local property access.
// The gate flagged 16 of those on its first run — a rule that cries wolf on the
// domain vocabulary gets switched off, and it was never the valuable entry.
const FORBIDDEN_GLOBALS = [
  'window', 'document', 'localStorage', 'sessionStorage', 'navigator',
  'BroadcastChannel', 'HTMLElement',
]

const files = [...walk(coreSrc)]
const tsFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

// A check that reads nothing must fail, not pass (#232 / #261). If core is moved
// or renamed, this gate must go red rather than certify an empty directory.
if (tsFiles.length === 0) {
  console.error(`✗ no TypeScript found under ${coreSrc} — this gate reads that tree, so an empty read would certify nothing.`)
  process.exit(1)
}

// A .tsx file in core is a React component by definition.
for (const f of tsFiles.filter((f) => f.endsWith('.tsx'))) {
  fail(`${relative(root, f)}: .tsx in packages/core — a component belongs in an app, not the domain layer`)
}

// A FEATURE-DETECTED browser API is allowed, and this is the substantive rule
// rather than a loophole: `lib/fhircast.ts` reaches for `BroadcastChannel` only
// behind `typeof BroadcastChannel === 'undefined'`, which is precisely how a
// module shared with a Worker should treat a browser-only API. An UNGUARDED use
// still fails. The guard must be in the same file as the use.
const featureDetected = (code, g) =>
  new RegExp(`typeof\\s+${g}\\s*[!=]==\\s*['"]undefined['"]`).test(code)

let detected = 0
for (const f of tsFiles) {
  const rel = relative(root, f)
  const raw = readFileSync(f, 'utf8')
  const code = stripNonCode(raw)
  // The guard test needs string literals intact — `stripNonCode` blanks
  // `'undefined'`, which silently defeated this check on its first run.
  const guardable = stripComments(raw)

  // ⚠️ `guardable`, not `code`: a module specifier IS a string literal, and
  // `stripNonCode` blanks it. Scanning `code` here made this — the gate's
  // primary rule — match nothing, and it reported green while a planted
  // `import { useMemo } from 'react'` sailed through. Second instance of the
  // same mistake in this file; the other was the feature-detection guard.
  for (const m of guardable.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    if (FORBIDDEN_MODULES.some((re) => re.test(spec))) {
      fail(`${rel}: imports "${spec}" — packages/core is consumed by two Workers, which have no DOM`)
    }
  }

  for (const g of FORBIDDEN_GLOBALS) {
    if (featureDetected(guardable, g)) { detected++; continue }
    // `\b` then a member access or a call: `window.x`, `document.y`, `alert(`.
    const re = new RegExp(`\\b${g}\\s*[.(\\[]`, 'g')
    for (const m of code.matchAll(re)) {
      // A property named the same thing is fine (`opts.window`), so require the
      // identifier not to be preceded by a dot.
      const before = code.slice(Math.max(0, m.index - 1), m.index)
      if (before === '.') continue
      fail(
        `${rel}: touches \`${g}\` unguarded — packages/core must run in a Worker as well as a ` +
          `browser. Either drop it, or feature-detect it (\`typeof ${g} === 'undefined'\`) the way ` +
          `lib/fhircast.ts does.`,
      )
    }
  }
}

if (failures) {
  console.error(`\ncore-boundary check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(
  `✓ core boundary: ${tsFiles.length} file(s) in packages/core are React-free and DOM-free ` +
    `(${FORBIDDEN_GLOBALS.length} globals and ${FORBIDDEN_MODULES.length} module patterns checked; ` +
      `${detected} feature-detected use(s) allowed)`,
)
