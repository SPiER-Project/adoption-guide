/**
 * Type is seven roles, 11px is uppercase labels only, and nothing is smaller.
 *
 * ⚠️ **Written against a scale authors picked from by eye.** Ten size-named
 * --font-size-* tokens, six of them 1px apart between 10 and 15px;
 * --font-size-2xs (10px) set in 37 places; --font-size-4xl defined and never
 * used. On 2026-09-24 they became the --type-* roles in foundation.css, each a
 * `font` shorthand, and all ten definitions were deleted.
 *
 * What stylelint already holds: `font` and `font-size` take only var() or a
 * keyword (declaration-strict-value), so a raw `font: 700 10px/1 sans-serif`
 * fails there. What it cannot hold, and this does:
 *
 *   1. --type-label (11px, 700) appears only in a rule that ALSO sets
 *      `text-transform: uppercase`. An 11px run in mixed case is the size the
 *      floor exists to retire, back under a new name. Uppercase inherited from
 *      another rule does not count, because the rule is where a reader looks.
 *   2. No --font-size-* token is defined or read anywhere a stylesheet lives.
 *      `check:tokens` would fail a READ of a deleted token; this also fails a
 *      token quietly redefined in some other file.
 *
 * What it cannot see: text that is uppercase at 11px through a rule it did not
 * write (a label role on a parent, uppercase on the child). The computed-style
 * diff recorded in the PR that introduced this file is how that was checked;
 * nothing gates it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { allStyleFiles, relRepo } from '../scripts/lib/style-roots.mjs'

const rules: { file: string; selector: string; body: string }[] = []
const sources: { file: string; css: string }[] = []
for (const file of allStyleFiles(['.css'])) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  sources.push({ file: relRepo(file), css })
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ file: relRepo(file), selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] })
  }
}

describe('the label role', () => {
  const labels = rules.filter(r => /(?:^|[;\s])font\s*:\s*var\(--type-label\)/.test(r.body))

  it('finds the labels — a parse that matched nothing would pass', () => {
    expect(labels.length).toBeGreaterThanOrEqual(20)
  })

  it.each(labels.map(r => [r.selector, r] as const))('%s sets text-transform: uppercase', (_s, r) => {
    expect(/text-transform\s*:\s*uppercase/.test(r.body),
      `${r.file}: \`${r.selector}\` is --type-label (11px) but not uppercase — 11px is for uppercase labels only; use --type-caption`)
      .toBe(true)
  })
})

describe('the retired size tokens', () => {
  it('are neither defined nor read in any stylesheet', () => {
    const hits = sources.flatMap(({ file, css }) =>
      [...css.matchAll(/--font-size-[a-z0-9]+/g)].map(m => `${file}: ${m[0]}`))
    expect(hits).toEqual([])
  })

  it('left the scan something to read', () => {
    expect(sources.length).toBeGreaterThanOrEqual(40)
  })
})
