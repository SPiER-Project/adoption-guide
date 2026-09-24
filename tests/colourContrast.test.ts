/**
 * Every risk and status colour is a pair, and every pair clears WCAG AA.
 *
 * ⚠️ **Written against two pills that shipped failing.** White on
 * `--risk-high` (#ea580c) measured 3.56:1 and white on `--risk-moderate`
 * (#ca8a04) 2.94:1; the pills are 11px bold uppercase, so both needed 4.5.
 * Nothing measured them, because the ramp named a fill and left its text to
 * each consumer — which reached for `--text-on-brand` because a pill is plum
 * elsewhere.
 *
 * So the test holds two halves, and either alone is not enough:
 *
 *   1. THE TOKENS. Every solid step `--risk-X` has a `--risk-X-on`, every soft
 *      step `--risk-X-soft` has a `--risk-X-soft-text`, and each pair measures
 *      ≥ 4.5:1 — read out of foundation.css, never restated here, so a value
 *      edit is what gets measured.
 *   2. THE CONSUMERS. A pair that passes does nothing for a rule that puts
 *      white on the fill anyway, which is exactly how the moderate pill failed.
 *      A solid step `--risk-X` appears ONLY as the background of a rule that
 *      sets `color: var(--risk-X-on)`. Anything else — a border, a bar
 *      segment, a swatch, a gradient stop — is a mark, and reads --risk-X-edge.
 *
 * ⚠️ **The edge half joined on 2026-09-24.** Moderate's fill (#e0b54a) is
 * light so that plum text reads on it, and as a card edge or a bar segment it
 * measured 1.60-1.93:1, under the 3:1 WCAG 1.4.11 asks of a mark. Every
 * --risk-X-edge now clears 3:1 against white, the page, the muted bar track
 * and its own soft fill (a sim result's border sits on it). The rule above is
 * what replaced a TEXT_FREE list of eight selectors: a mark has its own token,
 * so there is no text-free fill left to exempt.
 *
 * The STATUS families joined on 2026-09-23, when twenty --accent-* tokens
 * became sixteen --status-*: every family has all four parts (bg, border,
 * edge, text), and its text clears 4.5:1 on its own ground.
 *
 * And one check spans both: every rule, anywhere, that sets a status or risk
 * FILL and a text colour in the same declaration block must measure ≥ 4.5:1
 * as the pair it actually renders. The token pairs only prove the pairs the
 * tokens name; this proves the pairs the stylesheets wrote.
 *
 * What it cannot see: a fill under text that some OTHER rule colours (the
 * breached caseload tile colours its children separately), and any rule whose
 * colours are not tokens. It also cannot tell a link from a status: a link set
 * in `--status-info-edge` passes every test here. That job is on the reader of
 * css-and-page-template.md, not on a gate — see its note on why the selector
 * allowlist was not built.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allStyleFiles, relRepo, REPO_ROOT } from '../scripts/lib/style-roots.mjs'

const FOUNDATION = join(REPO_ROOT, 'packages/ui/src/foundation.css')
const AA = 4.5

const MARK = 3

/** `--name: value;` declarations, comments stripped. The last one wins, as in CSS. */
export function tokensOf(css: string): Map<string, string> {
  const out = new Map<string, string>()
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of bare.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(m[1], m[2].trim())
  return out
}

/** A token's value with every `var(--x)` followed to a literal. */
export function resolve(tokens: Map<string, string>, name: string, seen: string[] = []): string {
  const raw = tokens.get(name)
  if (raw === undefined) throw new Error(`${name} is not defined in foundation.css`)
  if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(' → ')}`)
  const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(raw)
  return ref ? resolve(tokens, ref[1], [...seen, name]) : raw
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`not a 6-digit hex: ${hex}`)
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const tokens = tokensOf(readFileSync(FOUNDATION, 'utf8'))
const SOLID = [...tokens.keys()].filter(t => /^--risk-[a-z]+$/.test(t))
const SOFT = [...tokens.keys()].filter(t => /^--risk-[a-z]+-soft$/.test(t))

describe('the contrast helper', () => {
  it('measures the textbook pairs', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    // the defect this file exists for
    expect(contrast('#ffffff', '#ca8a04')).toBeCloseTo(2.94, 2)
  })
})

describe('the risk ramp in foundation.css', () => {
  it('has all four steps, solid and soft — an empty scan would pass everything below', () => {
    const steps = (ts: string[]) => ts.map(t => t.replace(/^--risk-|-soft$/g, '')).sort()
    expect(steps(SOLID)).toEqual(['acute', 'high', 'low', 'moderate'])
    expect(steps(SOFT)).toEqual(['acute', 'high', 'low', 'moderate'])
  })

  it.each(SOLID)('%s pairs with its -on at ≥ 4.5:1', fill => {
    const ratio = contrast(resolve(tokens, fill), resolve(tokens, `${fill}-on`))
    expect(ratio, `${fill} on ${fill}-on measures ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
  })

  it.each(SOFT)('%s pairs with its -text at ≥ 4.5:1', fill => {
    const ratio = contrast(resolve(tokens, fill), resolve(tokens, `${fill}-text`))
    expect(ratio, `${fill} under ${fill}-text measures ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
  })
})

const STATUS = [...tokens.keys()]
  .map(t => /^--status-([a-z]+)-bg$/.exec(t)?.[1])
  .filter((f): f is string => f !== undefined)

describe('the status families in foundation.css', () => {
  it('has exactly info, success, warning and danger — an empty scan would pass everything below', () => {
    expect([...STATUS].sort()).toEqual(['danger', 'info', 'success', 'warning'])
  })

  it.each(STATUS)('%s has all four parts', family => {
    for (const part of ['bg', 'border', 'edge', 'text']) resolve(tokens, `--status-${family}-${part}`)
  })

  it.each(STATUS)('--status-%s-text on its -bg at ≥ 4.5:1', family => {
    const ratio = contrast(resolve(tokens, `--status-${family}-bg`), resolve(tokens, `--status-${family}-text`))
    expect(ratio, `--status-${family}-text on -bg measures ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
  })

  it('left no --accent-* token behind, and no alias from old to new', () => {
    expect([...tokens.keys()].filter(t => t.startsWith('--accent-') || t === '--text-error')).toEqual([])
  })
})

/** Every rule in every style root, comments stripped. foundation.css defines tokens and sets none of these. */
const rules: { file: string; selector: string; body: string }[] = []
for (const file of allStyleFiles(['.css'])) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ file: relRepo(file), selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] })
  }
}

describe('the risk ramp as a mark', () => {
  const EDGE = SOLID.map(t => `${t}-edge`)
  const GROUNDS = ['--surface-card', '--surface-page', '--surface-muted']

  it.each(EDGE.flatMap(e => [...GROUNDS, e.replace(/-edge$/, '-soft')].map(g => [e, g] as const)))(
    '%s on %s at ≥ 3:1', (edge, ground) => {
      const ratio = contrast(resolve(tokens, edge), resolve(tokens, ground))
      expect(ratio, `${edge} on ${ground} measures ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MARK)
    })
})

describe('every rule that uses a solid risk step', () => {
  // foundation.css DEFINES the ramp (an -edge is `var(--risk-X)`); it is not a use of it.
  const uses = rules.filter(r => r.file !== 'packages/ui/src/foundation.css').flatMap(r => [...r.body.matchAll(/var\((--risk-(?:acute|high|moderate|low))\)/g)].map(m => ({ ...r, token: m[1] })))

  it('finds the known uses — a parse that matched nothing would pass', () => {
    expect(uses.length).toBeGreaterThanOrEqual(7)
  })

  it.each(uses.map(r => [`${r.selector} (${r.token})`, r] as const))('%s is text on its fill, or reads -edge', (_s, r) => {
    const fill = new RegExp(`background(?:-color)?\\s*:\\s*var\\(${r.token}\\)`).test(r.body)
    const on = new RegExp(`(?:^|[;\\s])color\\s*:\\s*var\\(${r.token}-on\\)`).test(r.body)
    expect(fill && on,
      `${r.file}: \`${r.selector}\` uses ${r.token} ${fill ? 'as a fill without its -on text colour' : 'as a mark'} — ` +
      `a fill under text sets color: var(${r.token}-on); a border, segment, swatch or gradient stop reads var(${r.token}-edge)`)
      .toBe(true)
  })
})

describe('every rule that sets a status or risk fill AND a text colour', () => {
  const paired = rules.flatMap(r => {
    const fill = /background(?:-color)?\s*:\s*var\((--(?:status|risk)-[a-z-]+)\)/.exec(r.body)?.[1]
    const text = /(?:^|[;\s])color\s*:\s*var\((--[a-z0-9-]+)\)/.exec(r.body)?.[1]
    return fill && text ? [{ ...r, fill, text }] : []
  })

  it('finds the known pairs — a parse that matched nothing would pass', () => {
    expect(paired.length).toBeGreaterThanOrEqual(25)
  })

  it.each(paired.map(r => [r.selector, r] as const))('%s renders its text at ≥ 4.5:1', (_s, r) => {
    const ratio = contrast(resolve(tokens, r.fill), resolve(tokens, r.text))
    expect(ratio, `${r.file}: \`${r.selector}\` sets ${r.text} on ${r.fill}, ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
  })
})

/**
 * Each density's label colour, on the two grounds a label sits on. The block's
 * own declarations override :root's, exactly as the cascade would, so a
 * density that set --label-color to a var() of another density token is
 * resolved inside its own block.
 */
describe('each density in foundation.css', () => {
  const css = readFileSync(FOUNDATION, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks = [...css.matchAll(/\[data-density="([a-z-]+)"\]\s*\{([^}]*)\}/g)]
    .map(m => ({ density: m[1], tokens: new Map([...tokens, ...tokensOf(m[2])]) }))

  it('defines exactly guide and clinical — an empty scan would pass everything below', () => {
    expect(blocks.map(b => b.density).sort()).toEqual(['clinical', 'guide'])
  })

  it.each(blocks.flatMap(b => ['--surface-page', '--surface-card'].map(g => [b.density, g, b] as const)))(
    '%s: --label-color on %s at ≥ 4.5:1', (density, ground, b) => {
      const ratio = contrast(resolve(b.tokens, '--label-color'), resolve(b.tokens, ground))
      expect(ratio, `${density} --label-color on ${ground} measures ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
    })
})
