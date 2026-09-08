#!/usr/bin/env node
/**
 * Anti-drift check for the READING MEASURE — `--measure-prose`.
 *
 * A measure is a character count. `max-width` is a width. The two agree at
 * exactly one font size, and that is the whole reason this gate exists: for as
 * long as `--measure-prose` was `760px` it was calibrated against
 * `--font-size-lg` (the page lede it was lifted from) and every smaller run
 * reading it got a LONGER measure — ~103 characters at 15px, ~110 at 14px,
 * ~126 at 12px, all outside the 45-90 band, while looking from the CSS exactly
 * like a cap. Three pages that were never capped at all sat at 145-182, and
 * `.dd-detail` escaped a table's column budget to `52rem` under a comment
 * claiming it was the prose measure, which on 13px type is 134.
 *
 * ⚠️ **Why this is static and not a measurement.** The honest number needs
 * layout — the element's computed font, its resolved width, the font's actual
 * advance widths — and `jsdom` has no layout engine, so a rendered measurement
 * would mean a headless browser, a dev server and a network-shaped dependency
 * in a gate that has to stay offline-reproducible. It is not needed. The
 * rendered number is a CONSEQUENCE of one rule — a prose cap must scale with
 * its own type — and that rule is statically checkable while the pixels are
 * not. So this gate checks the rule, and the character counts in the comments
 * here and in `index.css` are measured by hand in the browser and cited as
 * evidence for the band, not recomputed on every run.
 *
 * ⚠️ **What it therefore CANNOT see, stated so a green run is not read as more
 * than it is: a prose run with NO cap at all.** That was the original defect on
 * all three wide pages, and catching it needs to know which elements hold long
 * prose — which is content, not CSS. A `<p>` with no `max-width` is correct on
 * a narrow page and wrong on a wide one, and nothing in the stylesheet says
 * which. RULE 2 covers every cap that EXISTS; it cannot demand one. Re-measure
 * a wide page's prose by hand after adding it.
 *
 * The four rules, each written against a defect that actually shipped:
 *
 *   RULE 1  `--measure-prose` is declared exactly once, in `em`, inside the
 *           band. This is the 760px defect. A px or rem value is right for one
 *           font size only; `em` resolves against the run's OWN font-size, so
 *           one number holds the character count at every size.
 *
 *   RULE 2  Every `max-width` in `src/**\/*.css` is one of: the measure token,
 *           a `--page-width-*` token (page roots — `check:template` RULE 5
 *           owns those), or an entry in NON_PROSE with a reason. This is the
 *           `.dd-detail` defect: a raw length on a text run reads as a
 *           considered cap and is one only by accident.
 *
 *   RULE 3  Every `max-width: none` is an entry in REVOKED_CAPS with a reason.
 *           This is the `.dd-cell-desc` defect — its base rule carried
 *           `max-width: 46rem` while the only rule that matched the element in
 *           practice set `max-width: none`, so the class had two caps and the
 *           one a reader finds first had never applied to anything.
 *
 *   RULE 4  A rule that caps with the measure token declares its own
 *           `font-size`, or some rule with the same subject class does, or it
 *           is an entry in INHERITS_TYPE with a reason recording what type it
 *           actually resolves against. This is the `.tool-config-effect`
 *           defect: an `em` cap resolves against the element it is written on,
 *           so a callout sitting at the inherited 16px while its paragraph is
 *           14px measures the wrong type, and the number it produces is a
 *           coincidence.
 *
 * Every allowlist wants a REASON, not just an entry — the point is to force
 * the decision at the moment someone writes the number, which is the only
 * moment anyone knows why.
 *
 * Liveness is the #232/#261 guard: a scan that reads nothing passes vacuously,
 * which is the failure mode this whole family of gates exists to prevent. It
 * fails on zero stylesheets, zero parsed rules, zero `max-width` declarations,
 * and on the count of token-capped rules dropping below MEASURE_FLOOR.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const srcDir = join(webRoot, 'src')

/**
 * The band, in `em`, and where its edges come from.
 *
 * A measure is characters; the token is `em`; the bridge between them is the
 * font's average advance width, which for the app's Poppins at these sizes
 * measures ~0.5em per character. So characters ≈ 2 × the em value, and the
 * spread around that (1.9-2.17× across real content, because a paragraph of
 * narrow glyphs fits more) is what makes the ceiling empirical rather than
 * arithmetic.
 *
 * MAX is 41 because 42 was measured at 91 characters on
 * `.cds-service-guide__section p` — the widest-measuring run in the app. MIN is
 * 24 because below that the widest-measuring content drops under 45, the bottom
 * of the comfortable band, where a measure starts costing more in eye returns
 * than it saves in line length.
 *
 * To move either edge: change the token, run the app, and measure the affected
 * runs rather than adjusting the number until this gate goes green. The
 * measurement is `chars × contentWidth / canvasMeasuredTextWidth` per element,
 * at a 1440px viewport.
 */
const MEASURE_MIN_EM = 24
const MEASURE_MAX_EM = 41

/** Half the 25 token-capped rules on main — liveness, not completeness. */
const MEASURE_FLOOR = 12

/**
 * RULE 2 — `max-width` declarations that are deliberately NOT a reading
 * measure. Keyed `<file>|<selector>`; the value is why.
 *
 * None of these is a text run: a measure is meaningless for a box that holds
 * no wrapped prose, and wrong for one whose job is a column budget.
 */
const NON_PROSE = {
  'src/App.css|.completed-item-summary':
    'A single-line label that never wraps — `white-space: nowrap` + `text-overflow: ellipsis`. ' +
    'This is a TRUNCATION width; a measure caps line length, and this run has exactly one line.',
  'src/css/AdoptionGuide.css|.guide-pager__link':
    'A percentage, not a length: half the pager row, so prev and next sit side by side at any page width.',
  'src/css/DataDictionary.css|.dd-code-display':
    "The publishing authority's display string inside a table column — part of the column budget " +
    'documented under `.dd-table--fixed`, not prose.',
  'src/css/DataDictionary.css|.dd-detail':
    'The budget for the detail row\'s DATA lines — a code display, a value-set canonical, a row of ' +
    'tool chips — which want room to stay on one line. Its prose is `.dd-detail-desc`, which caps ' +
    'itself with the token. ⚠️ This rule USED to claim the prose cap in its comment while 52rem on ' +
    '13px type is 134 characters; that is the defect RULE 2 is written against.',
  'src/css/FhircastListener.css|.fhircast-banner':
    'A fixed-position toast, clamped to the viewport with `min()`. A box size, and it holds one short line.',
  'src/css/PageHeader.css|.page-header__rule':
    "The brand's 4px gradient accent rule. Not text at all.",
  'src/css/PatientBanner.css|.patient-banner-switcher':
    'A control (the patient `<select>`), sized so a long name does not push the banner apart.',
  'src/css/PopulationView.css|.caseload-filter-menu':
    'A dropdown menu panel holding filter rows, not prose.',
}

/**
 * RULE 3 — `max-width: none` declarations that are deliberate.
 *
 * Empty today, and that is the finding rather than an oversight: every cap in
 * the app is now live. Revoking one is legitimate — an element whose cap comes
 * from a better-placed rule, say — but it has to be said out loud, because a
 * revoked cap is indistinguishable from a cap that works until someone
 * measures the page.
 */
const REVOKED_CAPS = {}

/**
 * RULE 4 — rules that cap with the token while their type comes from
 * inheritance. The reason must record what they actually resolve against,
 * measured, because that is the number the cap is really made of.
 */
const INHERITS_TYPE = {
  'src/css/ToolConfiguration.css|.tool-config-intro':
    'Inherits 16px from the page (measured), so the cap lands at 656px and the run at 83 characters. ' +
    'Left on inheritance rather than pinned: it is the page intro and takes the body size by default.',
  'src/css/ToolConfiguration.css|.tool-config-effect':
    'Deliberate, and the reason the box is capped at all. It sets no font-size, so it resolves the ' +
    'token at the inherited 16px and gets a CALLOUT width (656px); `.tool-config-effect__body` ' +
    'resolves the same token at its own 14px and gets the MEASURE (574px), which is narrower and so ' +
    'governs the text. Dropping the box cap left a full-width tinted band with the sentence stopping ' +
    'halfway across.',
}

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }
const rel = (p) => relative(webRoot, p).split('\\').join('/')

const stripComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const walk = (dir) => {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.css')) out.push(full)
  }
  return out
}

/**
 * The subject of a selector: the class the rule is actually about. `.a > .b`
 * and `.a .b:hover` both have subject `.b`, which is what makes RULE 4 able to
 * see that `.dd-cell-desc`'s font-size is set by `.dd-concept-body >
 * .dd-cell-desc` — a different rule about the same element.
 */
const subjectOf = (selector) => {
  const last = selector.trim().split(/[>+~\s]+/).filter(Boolean).pop() || ''
  const classes = last.match(/\.[A-Za-z0-9_-]+/g)
  return classes ? classes[classes.length - 1] : last.replace(/[:[].*$/, '')
}

const declares = (body, prop) =>
  new RegExp(`(?:^|[;{\\s])${prop}\\s*:`).test(body)

// ---- parse -------------------------------------------------------------------
const files = walk(srcDir)
if (files.length === 0) {
  console.error(`✗ no stylesheets found under ${rel(srcDir)} — the scan is broken, not clean`)
  process.exit(1)
}

const allRules = []        // { file, line, selector, body }
const fontSizeSubjects = new Set()
for (const file of files) {
  const css = stripComments(readFileSync(file, 'utf8'))
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    const body = m[2]
    if (!selector || selector.startsWith('@')) continue
    const line = css.slice(0, m.index).split('\n').length
    allRules.push({ file: rel(file), line, selector, body })
    if (declares(body, 'font-size')) {
      for (const part of selector.split(',')) fontSizeSubjects.add(subjectOf(part))
    }
  }
}

if (allRules.length === 0) {
  console.error(`✗ no CSS rules parsed from ${files.length} stylesheet(s) — the scan is broken, not clean`)
  process.exit(1)
}

const maxWidths = []       // { file, line, selector, value }
for (const r of allRules) {
  for (const m of r.body.matchAll(/(?:^|[;{\s])max-width\s*:\s*([^;}]+)/g)) {
    maxWidths.push({ ...r, value: m[1].trim() })
  }
}

if (maxWidths.length === 0) {
  console.error('✗ no max-width declarations parsed — the scan is broken, not clean')
  process.exit(1)
}

// ---- RULE 1: the token is font-relative and in band ---------------------------
const tokenDefs = []
for (const file of files) {
  const css = stripComments(readFileSync(file, 'utf8'))
  for (const m of css.matchAll(/(?:^|[;{])\s*--measure-prose\s*:\s*([^;}]+)/g)) {
    tokenDefs.push({ file: rel(file), line: css.slice(0, m.index).split('\n').length, value: m[1].trim() })
  }
}

if (tokenDefs.length === 0) {
  fail('`--measure-prose` is not defined in any stylesheet. It is the reading measure; every prose cap reads it.')
} else if (tokenDefs.length > 1) {
  fail(
    '`--measure-prose` is defined more than once — one measure, one owner:\n    ' +
    tokenDefs.map((d) => `${d.file}:${d.line} = ${d.value}`).join('\n    '),
  )
} else {
  const { file, line, value } = tokenDefs[0]
  const em = /^([0-9]*\.?[0-9]+)em$/.exec(value)
  if (!em) {
    fail(
      `\`--measure-prose\` is \`${value}\` at ${file}:${line} — it must be in \`em\`.\n` +
      '    A measure is a character count and any absolute unit is a width, so the two agree at exactly\n' +
      '    one font size. This was `760px`, calibrated against --font-size-lg, and every smaller run\n' +
      '    reading it got a longer measure: ~103 characters at 15px, ~110 at 14px, ~126 at 12px.\n' +
      "    `em` resolves against the run's own font-size, which is what holds the count at every size.",
    )
  } else {
    const n = Number(em[1])
    if (n < MEASURE_MIN_EM || n > MEASURE_MAX_EM) {
      fail(
        `\`--measure-prose\` is \`${value}\` at ${file}:${line}, outside the ${MEASURE_MIN_EM}-${MEASURE_MAX_EM}em band.\n` +
        `    Characters ≈ 2 × the em value for this app's type, so ${n}em is roughly ${Math.round(n * 1.9)}-${Math.round(n * 2.17)}\n` +
        '    characters, and the comfortable band is 45-90. The ceiling is empirical: 42em measured 91\n' +
        '    characters on `.cds-service-guide__section p`. Measure the affected runs in the browser\n' +
        '    rather than moving the band to fit the number.',
      )
    }
  }
}

// ---- RULE 2: every cap is a token or a classified non-prose width -------------
const measureCapped = []
const seenNonProse = new Set()
for (const { file, line, selector, value } of maxWidths) {
  if (value.includes('var(--measure-prose)')) { measureCapped.push({ file, line, selector, body: null }); continue }
  if (/var\(--page-width-/.test(value)) continue      // page roots — check:template RULE 5 owns these
  if (value === 'none') continue                       // RULE 3 below

  const key = `${file}|${subjectOf(selector.split(',')[0])}`
  if (NON_PROSE[key]) { seenNonProse.add(key); continue }
  fail(
    `unclassified \`max-width: ${value}\` at ${file}:${line} on \`${selector}\`.\n` +
    '    Every cap is one of three things, and which one is a decision someone has to make:\n' +
    '      • a TEXT RUN     → `max-width: var(--measure-prose)`, which scales with the run\'s own type\n' +
    '      • a PAGE ROOT    → `var(--page-width-prose)` / `var(--page-width-wide)` (check:template RULE 5)\n' +
    `      • NOT PROSE      → add \`'${key}'\` to NON_PROSE in ${rel(join(here, 'check-prose-measure.mjs'))}, with the reason\n` +
    '    A raw length on a text run reads as a considered cap and is one only by accident: `.dd-detail`\n' +
    '    escaped a column budget to 52rem, which on 13px type is 134 characters a line.',
  )
}

// ---- RULE 3: a revoked cap is declared, not discovered ------------------------
const seenRevoked = new Set()
for (const { file, line, selector, value } of maxWidths) {
  if (value !== 'none') continue
  const key = `${file}|${subjectOf(selector.split(',')[0])}`
  if (REVOKED_CAPS[key]) { seenRevoked.add(key); continue }
  fail(
    `unclassified \`max-width: none\` at ${file}:${line} on \`${selector}\`.\n` +
    '    Revoking a cap is legitimate, but it has to be said out loud — a revoked cap is\n' +
    '    indistinguishable from a working one until someone measures the page. `.dd-cell-desc` carried\n' +
    '    `max-width: 46rem` while the rule that actually matched the element set `none`, so the cap a\n' +
    `    reader finds first had never applied to anything.\n` +
    `    Add \`'${key}'\` to REVOKED_CAPS with the reason, or delete the declaration.`,
  )
}

// ---- RULE 4: an em cap has to know what type it resolves against --------------
const seenInherits = new Set()
for (const { file, line, selector } of measureCapped) {
  const subjects = selector.split(',').map((s) => subjectOf(s))
  const unresolved = subjects.filter((s) => !fontSizeSubjects.has(s))
  if (unresolved.length === 0) continue
  const key = `${file}|${subjects[0]}`
  if (INHERITS_TYPE[key]) { seenInherits.add(key); continue }
  fail(
    `\`max-width: var(--measure-prose)\` at ${file}:${line} on \`${selector}\`, but nothing sets a\n` +
    `    \`font-size\` for ${unresolved.join(', ')} — so the \`em\` resolves against inherited type.\n` +
    '    An `em` cap is made of the font-size of the element it is written on. `.tool-config-effect`\n' +
    '    sat at the inherited 16px while the paragraph inside it was 14px, so the box measured the\n' +
    '    wrong type and the number it produced was a coincidence.\n' +
    '    Either declare the `font-size` on this rule, or measure what it inherits and record that in\n' +
    `    INHERITS_TYPE under \`'${key}'\`.`,
  )
}

// ---- liveness ----------------------------------------------------------------
console.log(
  `prose measure: ${files.length} stylesheet(s), ${allRules.length} rules, ` +
  `${maxWidths.length} max-width declaration(s) — ` +
  `${measureCapped.length} on the measure token, ${Object.keys(NON_PROSE).length} classified non-prose`,
)
if (tokenDefs.length === 1) console.log(`  --measure-prose = ${tokenDefs[0].value} (band ${MEASURE_MIN_EM}-${MEASURE_MAX_EM}em)`)
for (const key of Object.keys(INHERITS_TYPE)) {
  console.log(`  inherits its type: ${key}${seenInherits.has(key) ? '' : '  ← stale allowlist entry'}`)
}

if (measureCapped.length < MEASURE_FLOOR) {
  fail(
    `only ${measureCapped.length} rule(s) cap with \`--measure-prose\`, below the floor of ${MEASURE_FLOOR}.\n` +
    '    The floor asserts LIVENESS, not completeness: it is roughly half the real count, and it is\n' +
    '    here so that deleting the caps — or breaking the parse that finds them — fails loudly instead\n' +
    '    of reporting a clean run over nothing.',
  )
}

// A stale allowlist entry is drift in the other direction: it documents a
// decision the CSS no longer contains, and the next reader trusts it.
for (const [key, why] of Object.entries(NON_PROSE)) {
  if (!seenNonProse.has(key)) fail(`stale NON_PROSE entry \`${key}\` — no such unclassified max-width exists any more. Delete it.\n    (was: ${why.slice(0, 80)}…)`)
}
for (const key of Object.keys(REVOKED_CAPS)) {
  if (!seenRevoked.has(key)) fail(`stale REVOKED_CAPS entry \`${key}\` — no \`max-width: none\` there any more. Delete it.`)
}
for (const key of Object.keys(INHERITS_TYPE)) {
  if (!seenInherits.has(key)) fail(`stale INHERITS_TYPE entry \`${key}\` — that rule either sets a font-size now or no longer caps. Delete it.`)
}

if (failures) {
  console.error(`\nprose-measure check FAILED (${failures} problem(s)).`)
  process.exit(1)
}
console.log('\nprose-measure check passed.')
