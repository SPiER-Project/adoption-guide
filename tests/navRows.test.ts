/**
 * Every row of the sidebar's outline is one pill, at every depth.
 *
 * ⚠️ **Written against a nested row that grew its own geometry.** The setting
 * pathways' rows under Care Pathway (2026-10-09) were a 4px-padded pill around
 * 12px text, hung under 8 × 12px pills around 14px text — each value a token,
 * so stylelint and check:tokens both passed, and the column looked like two
 * design systems. The geometry now lives once: the `--nav-*` tokens in
 * foundation.css, applied by `.sidebar-link`. A depth modifier moves the label
 * and nothing else.
 *
 * What this holds:
 *
 *   1. `.sidebar-link` takes its padding from `--nav-row-pad-block` and
 *      `--nav-row-pad-inline`, so the pill is the tokens' and not a copy.
 *   2. A rule naming a `.sidebar-link--*` modifier declares only padding-left,
 *      color and font-weight. Padding on any other side, a margin, a radius, a
 *      font, a size or a gap is a second row geometry.
 *   3. A depth modifier's padding-left is built from `--nav-text-column` (plus
 *      whole `--nav-indent-step`s), so depth is a step on one column rather than
 *      a number typed by eye.
 *
 * What it cannot see: whether a label FITS its row. That is a rendered width
 * (147px for a depth-2 label today, at the row's own type), measured in the
 * browser and recorded beside the tokens; jsdom lays nothing out.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { allStyleFiles, relRepo } from '../scripts/lib/style-roots.mjs'

const rules: { file: string; selector: string; decls: [string, string][] }[] = []
for (const file of allStyleFiles(['.css'])) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = m[2]
      .split(';')
      .map(d => d.trim())
      .filter(Boolean)
      .map(d => {
        const i = d.indexOf(':')
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as [string, string]
      })
    rules.push({ file: relRepo(file), selector: m[1].trim().replace(/\s+/g, ' '), decls })
  }
}

const base = rules.filter(r => r.selector === '.sidebar-link')
const modifiers = rules.filter(r => /\.sidebar-link--[a-z-]+/.test(r.selector))
/** The depth modifiers: the rule that places a row's label at a depth. */
const DEPTHS = ['.sidebar-link--child', '.sidebar-link--grandchild']

describe('the row geometry', () => {
  it('is one rule, padded from the --nav-* tokens', () => {
    expect(base).toHaveLength(1)
    const padding = base[0].decls.find(([p]) => p === 'padding')?.[1]
    expect(padding).toBe('var(--nav-row-pad-block) var(--nav-row-pad-inline)')
  })

  it('finds the modifiers — a parse that matched nothing would pass', () => {
    expect(modifiers.length).toBeGreaterThanOrEqual(5)
    for (const depth of DEPTHS) expect(modifiers.map(r => r.selector)).toContain(depth)
  })
})

describe('a modifier changes the label, never the pill', () => {
  const ALLOWED = new Set(['padding-left', 'color', 'font-weight'])

  it.each(modifiers.map(r => [r.selector, r] as const))('%s', (_s, r) => {
    const extra = r.decls.map(([p]) => p).filter(p => !ALLOWED.has(p))
    expect(extra, `${r.file}: \`${r.selector}\` sets ${extra.join(', ')} — a second row geometry. ` +
      'Depth moves the label (padding-left from --nav-text-column); the pill is .sidebar-link\'s.').toEqual([])
  })

  it.each(DEPTHS)('%s indents from the text column, in whole steps', (selector) => {
    const value = rules.find(r => r.selector === selector)?.decls.find(([p]) => p === 'padding-left')?.[1]
    expect(value).toMatch(/^(var\(--nav-text-column\)|calc\(var\(--nav-text-column\)( \+ var\(--nav-indent-step\))+\))$/)
  })
})
