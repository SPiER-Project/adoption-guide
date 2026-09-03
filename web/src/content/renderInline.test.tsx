/**
 * The Overview content module (C4) trades JSX prose for strings carrying five
 * inline-markup rules. That swap introduces a parser, and a parser this app
 * wrote itself needs its own test — the rendered-DOM comparison that justified
 * the extraction proves today's content is unchanged, not that the next
 * sentence someone writes will render correctly.
 *
 * The cases below are the ones the real content depends on, plus the ones it
 * does NOT contain and must therefore keep surviving: unmatched punctuation,
 * parentheses that are not links, and text with no markup at all.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import { renderInline } from './renderInline'
import { OVERVIEW_LEDE, OVERVIEW_SECTIONS, OVERVIEW_LENSES } from './overview'

// Server-rendered to a string rather than mounted, so this suite stays in the
// default `node` environment — vitest.config.ts keeps jsdom an explicit opt-in
// because of its startup cost, and a string is what these assertions want
// anyway. MemoryRouter is needed because in-app links render as <Link>.
const draw = (text: string) =>
  renderToStaticMarkup(<MemoryRouter>{renderInline(text)}</MemoryRouter>)

describe('renderInline', () => {
  it('leaves plain prose alone, real characters included', () => {
    expect(draw('A tier — carried on a generic LOINC — that every tool maps into.')).toBe(
      'A tier — carried on a generic LOINC — that every tool maps into.',
    )
  })

  it('renders **bold** as <strong>', () => {
    expect(draw('the **Adoption Guide** here')).toBe(
      'the <strong>Adoption Guide</strong> here',
    )
  })

  it('renders *italic* as <em>', () => {
    expect(draw('specify *how* screeners')).toBe('specify <em>how</em> screeners')
  })

  it('renders `code` as <code>', () => {
    expect(draw('a `Questionnaire` and its `QuestionnaireResponse`')).toBe(
      'a <code>Questionnaire</code> and its <code>QuestionnaireResponse</code>',
    )
  })

  // The ordering hazard: alternation must try ** before *, or "**Act**" reads
  // as an empty italic followed by stray asterisks.
  it('does not mistake **bold** for two *italic* runs', () => {
    expect(draw('**Capture → Translate → Act**')).toBe(
      '<strong>Capture → Translate → Act</strong>',
    )
  })

  it('mixes marks in one string', () => {
    expect(draw('**US Core** and *USCDI* and `code`')).toBe(
      '<strong>US Core</strong> and <em>USCDI</em> and <code>code</code>',
    )
  })

  it('renders an in-app route as a router link, not an external anchor', () => {
    const html = draw('see the [Care Pathway](/guide/pathway) for the protocol')
    expect(html).toContain('href="/guide/pathway"')
    expect(html).toContain('>Care Pathway</a>')
    expect(html).not.toContain('target=')
  })

  it('renders the `ig` token as an external link with a safe rel', () => {
    const html = draw('see the [published HL7 FHIR Implementation Guide](ig).')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toMatch(/href="[^"]*ig\/"/)
  })

  // Prose in the real content contains all of these. A parser that treated
  // parentheses or apostrophes as markup would mangle live sentences.
  it('leaves parentheses that are not links untouched', () => {
    const text = 'guidelines (FHIR is their modern standard) and (or the policy) decides'
    expect(draw(text)).toBe(text)
  })

  it('leaves an unmatched backtick or asterisk as literal text', () => {
    expect(draw('an unpaired ` tick')).toBe('an unpaired ` tick')
    expect(draw('an unpaired * star')).toBe('an unpaired * star')
  })

  // ⚠️ This asserts idempotence, and that is ALL it asserts. `INLINE` is a
  // module-level /g regex, so stale `lastIndex` is the obvious hazard — but the
  // loop runs to exhaustion, which resets it, so deleting the explicit
  // `INLINE.lastIndex = 0` does NOT fail this test. Checked, rather than
  // assumed. The reset stays as insurance against a future early `break`; if
  // you add one, this test will not catch it.
  it('gives the same result on repeated calls', () => {
    const first = draw('**one**')
    const second = draw('**one**')
    expect(second).toBe(first)
    expect(second).toBe('<strong>one</strong>')
  })
})

describe('the Overview content module', () => {
  // A guard against the extraction quietly losing a block: if a `kind` is added
  // to the union and not to the renderer, `tsc` catches it — but a section that
  // loses its blocks, or a lens that loses its href, is still valid TypeScript.
  it('every section has a heading and at least one block', () => {
    expect(OVERVIEW_SECTIONS.length).toBeGreaterThan(0)
    for (const s of OVERVIEW_SECTIONS) {
      expect(s.heading.trim()).not.toBe('')
      expect(s.blocks.length).toBeGreaterThan(0)
    }
  })

  it('places each of the three rendered components exactly once', () => {
    const kinds = OVERVIEW_SECTIONS.flatMap(s => s.blocks.map(b => b.kind))
    for (const kind of ['steps', 'pathway', 'lenses']) {
      expect(kinds.filter(k => k === kind)).toHaveLength(1)
    }
  })

  it('every lens card carries a resolvable href', () => {
    expect(OVERVIEW_LENSES.length).toBeGreaterThan(0)
    for (const lens of OVERVIEW_LENSES) {
      expect(lens.href === 'ig' || lens.href.startsWith('/')).toBe(true)
      expect(lens.title.trim()).not.toBe('')
      expect(lens.cta.trim()).not.toBe('')
    }
  })

  // Every marked-up run in the real content must close. An unclosed `**` would
  // render as literal asterisks on the page rather than failing anything.
  it('has balanced markup in every string the page renders', () => {
    const strings = [
      OVERVIEW_LEDE,
      ...OVERVIEW_SECTIONS.flatMap(s => [
        s.heading,
        ...s.blocks.flatMap(b =>
          'text' in b ? ('heading' in b ? [b.heading, b.text] : [b.text]) : [],
        ),
      ]),
    ]
    expect(strings.length).toBeGreaterThan(10)
    for (const text of strings) {
      expect(text.split('`').length % 2, `unbalanced backtick in: ${text.slice(0, 60)}`).toBe(1)
      const stars = text.replace(/\*\*/g, '').split('*').length - 1
      expect(stars % 2, `unbalanced * in: ${text.slice(0, 60)}`).toBe(0)
      expect(
        (text.match(/\[/g) ?? []).length,
        `unbalanced link brackets in: ${text.slice(0, 60)}`,
      ).toBe((text.match(/\]\(/g) ?? []).length)
    }
  })
})
