#!/usr/bin/env node
/**
 * lint:css — stylelint over EVERY declared style root, plus the one rule
 * stylelint cannot express: only the token sheet may switch the linter off.
 *
 * ── Why this is a script and not a glob in package.json ──────────────────
 *
 * ⚠️ `lint:css` used to be `stylelint "apps/*\/src/**\/*.css"
 * "packages/{ui,tool-views,app-shell}/src/**\/*.css"` — a SECOND hand-kept
 * list of the style roots. `scripts/lib/style-roots.mjs` says a tree is added
 * there and nowhere else, and the other four CSS gates obey it; a package
 * added to STYLE_ROOTS would have been read by all of them and linted by none.
 * The file list now comes from STYLE_ROOTS, so the two cannot disagree, and the
 * per-root floors fail a root that stops producing stylesheets.
 *
 * ── The scope of a disable ────────────────────────────────────────────────
 *
 * ⚠️ `foundation.css` opens with a file-level `stylelint-disable`, because it
 * is where the raw values live. Nothing stopped any other stylesheet from
 * opening with the same comment: a planted `/* stylelint-disable *\/` on top of
 * `Card.css`, followed by `color: #ff0000; padding: 13px`, linted clean. The
 * config now requires every disable to carry a `-- reason`
 * (`reportDescriptionlessDisables`), but a reason can be written for anything.
 * So the rule is a SCOPE: outside foundation.css a disable is line-scoped —
 * `stylelint-disable-next-line` or `stylelint-disable-line`, naming a rule and
 * a reason — and a block or file-level `stylelint-disable` fails here.
 *
 * Exits non-zero on any stylelint problem, any out-of-scope disable, or a
 * breached floor.
 */
import { readFileSync } from 'node:fs'

import stylelint from 'stylelint'

import { allStyleFiles, relRepo, styleRootFloors, REPO_ROOT } from './lib/style-roots.mjs'
import { reportFloors } from './lib/floors.mjs'

/** The one file whose job is to hold raw values. */
const TOKEN_SHEET = 'packages/ui/src/foundation.css'

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures++
}

const files = allStyleFiles(['.css'])
if (!files.map(relRepo).includes(TOKEN_SHEET)) fail(`${TOKEN_SHEET} is not under any declared style root`)

// A disable that is not line-scoped: `stylelint-disable` followed by anything
// other than `-next-line` / `-line`. `stylelint-enable` is only ever the other
// half of a block, so it is caught through its opener.
const BLOCK_DISABLE = /\/\*\s*stylelint-disable(?!-next-line|-line)\b/g
for (const file of files) {
  const rel = relRepo(file)
  if (rel === TOKEN_SHEET) continue
  const css = readFileSync(file, 'utf8')
  for (const m of css.matchAll(BLOCK_DISABLE)) {
    const line = css.slice(0, m.index).split('\n').length
    fail(
      `${rel}:${line}: a block or file-level \`stylelint-disable\` — only ${TOKEN_SHEET} may switch the linter ` +
        'off for more than one line. Use `stylelint-disable-next-line <rule> -- <why>` on the one declaration that needs it.',
    )
  }
}

const result = await stylelint.lint({ files, cwd: REPO_ROOT, formatter: 'string' })
if (result.report.trim()) console.log(result.report)
if (result.errored) fail('stylelint reported problems (above)')

reportFloors(styleRootFloors({ css: true, src: false }), fail)

if (failures) {
  console.error(`\nlint:css FAILED (${failures} problem(s)).`)
  process.exit(1)
}
console.log(`\nlint:css passed: ${files.length} stylesheet(s) across every declared style root.`)
