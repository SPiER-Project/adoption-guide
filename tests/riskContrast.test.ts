/**
 * Every risk colour is a pair, and every pair clears WCAG AA.
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
 *      Every rule, in every style root, that fills with a solid step must set
 *      `color` to that step's `-on` — or be named below as carrying no text.
 *
 * What it cannot see: a soft fill under text that some OTHER rule colours (the
 * breached caseload tile colours its children separately), and any colour that
 * is not a risk token. The status families join in the next pass.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { allStyleFiles, relRepo, REPO_ROOT } from '../scripts/lib/style-roots.mjs'

const FOUNDATION = join(REPO_ROOT, 'packages/ui/src/foundation.css')
const AA = 4.5

/**
 * Rules that fill with a solid step and hold no text, so they have no text
 * colour to set. Keyed by selector; the reason is the markup, which is where
 * to look before adding one.
 */
const TEXT_FREE: Record<string, string> = {
  '.pop-census-seg--acute': 'PopulationSummary: an empty <span> sized by flex-grow, and the key dot beside a label',
  '.pop-census-seg--high': 'as above',
  '.pop-census-seg--moderate': 'as above',
  '.pop-census-seg--low': 'as above',
  '.pop-alert--red .pop-alert-dot': 'a status dot; the alert text sits beside it, not on it',
  '.pathway-matrix__tier--low .pathway-matrix__swatch': 'a colour swatch beside the tier name',
  '.pathway-matrix__tier--moderate .pathway-matrix__swatch': 'as above',
  '.pathway-matrix__tier--high .pathway-matrix__swatch': 'as above',
}

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

describe('every rule that fills with a solid risk step', () => {
  const files = allStyleFiles(['.css'])
  const rules: { file: string; selector: string; body: string }[] = []
  for (const file of files) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      rules.push({ file: relRepo(file), selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] })
    }
  }
  const filled = rules.flatMap(r => {
    const m = /background(?:-color)?\s*:\s*var\((--risk-[a-z]+)\)/.exec(r.body)
    return m ? [{ ...r, fill: m[1] }] : []
  })

  it('finds the known consumers — a parse that matched nothing would pass', () => {
    expect(filled.length).toBeGreaterThanOrEqual(12)
  })

  it.each(filled.map(r => [r.selector, r] as const))('%s sets its step\'s -on text colour', (_s, r) => {
    if (r.selector in TEXT_FREE) return
    const color = /(?:^|[;\s])color\s*:\s*(var\(--[a-z0-9-]+\))/.exec(r.body)?.[1]
    expect(color, `${r.file}: \`${r.selector}\` fills with ${r.fill}; set color: var(${r.fill}-on), or list it in TEXT_FREE if it holds no text`)
      .toBe(`var(${r.fill}-on)`)
  })

  it('lists no TEXT_FREE selector that no longer exists', () => {
    const present = new Set(filled.map(r => r.selector))
    expect(Object.keys(TEXT_FREE).filter(s => !present.has(s))).toEqual([])
  })
})
