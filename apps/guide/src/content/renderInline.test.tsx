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
import { OVERVIEW_LEDE, OVERVIEW_SECTIONS, OVERVIEW_DOORS } from './overview'
import { DEMO_CHART_PICKS } from '../data/surfaces'

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
    // ⚠️ The set changed with the rewrite: `pathway` moved to /guide/why-spier
    // with the paragraph that explains why there are two vocabularies, and
    // `lenses` became `doors`. Keep this list equal to the placement kinds in
    // `OverviewBlock`, which is what makes a placement that is declared and
    // never rendered — or rendered twice — a failing test rather than a page
    // someone notices later.
    const kinds = OVERVIEW_SECTIONS.flatMap(s => s.blocks.map(b => b.kind))
    for (const kind of ['demo', 'doors', 'steps']) {
      expect(kinds.filter(k => k === kind)).toHaveLength(1)
    }
  })

  // The audit's §4.1 cap, as a test rather than a note nobody re-measures.
  //
  // It counts everything the page renders ABOVE the closing step cards: the
  // lede, every heading, every prose block, the three doors, and the three
  // chart picks, which are rendered from `data/surfaces.ts` and are the only
  // words on the page that this module does not hold. The cards' own bodies are
  // below the cap by the audit's wording and are one claim each anyway. The
  // measured page was 1,716 words before this rewrite.
  it('stays inside the 400-word cap', () => {
    const marks = (t: string) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '')
    const words = (t: string) => marks(t).trim().split(/\s+/).filter(Boolean).length
    const total =
      words(OVERVIEW_LEDE) +
      OVERVIEW_SECTIONS.reduce(
        (n, s) =>
          n + words(s.heading) + s.blocks.reduce((m, b) => m + ('text' in b ? words(b.text) : 0), 0),
        0,
      ) +
      OVERVIEW_DOORS.reduce((n, d) => n + words(d.reader) + words(d.text), 0) +
      DEMO_CHART_PICKS.reduce((n, p) => n + words(p.name) + words(p.situation) + words(p.shows), 0)
    expect(total).toBeLessThanOrEqual(400)
  })

  it('every door names a reader and carries at least one link', () => {
    expect(OVERVIEW_DOORS.length).toBeGreaterThan(0)
    for (const door of OVERVIEW_DOORS) {
      // The door's whole job: say who it is for, and hand them a destination.
      expect(door.reader.trim()).not.toBe('')
      expect(door.text).toMatch(/\]\(/)
    }
  })

  it('gives every door href a branch renderInline has', () => {
    // ⚠️ Enumerated rather than loosened to "any non-empty string". This is the
    // lens cards' assertion, kept: an href that is none of these three falls to
    // the in-app `<Link>`, which renders and looks right and navigates nowhere.
    for (const door of OVERVIEW_DOORS) {
      for (const [, href] of door.text.matchAll(/\]\(([^)]+)\)/g)) {
        const kind =
          href === 'ig' ? 'ig' : href.startsWith('/') ? 'route' : /^https:\/\//.test(href) ? 'external' : 'unknown'
        expect(kind, `${door.key}: ${href}`).not.toBe('unknown')
      }
    }
  })

  // Every marked-up run in the real content must close. An unclosed `**` would
  // render as literal asterisks on the page rather than failing anything.
  it('has balanced markup in every string the page renders', () => {
    const strings = [
      OVERVIEW_LEDE,
      ...OVERVIEW_SECTIONS.flatMap(s => [
        s.heading,
        ...s.blocks.flatMap(b => ('text' in b ? [b.text] : [])),
      ]),
      // The doors carry every in-app link on the page, so they are the strings
      // an unclosed bracket would cost the most.
      ...OVERVIEW_DOORS.flatMap(d => [d.reader, d.text]),
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

describe('renderInline — absolute URLs (#466)', () => {
  it('renders an https link as an external anchor, not a router Link', () => {
    // ⚠️ The failure this prevents is silent. Before the `http` branch existed,
    // an absolute href fell through to `<Link to="https://…">`; React Router
    // treats that as an in-app path, so the markup looked correct and the link
    // navigated to a route that does not exist. Nothing about the rendered
    // anchor said which kind it had become.
    const html = draw(
      'Open the [Demo EHR](https://spier-mock-ehr.bbthorson.workers.dev/) and launch.',
    )
    expect(html).toContain('href="https://spier-mock-ehr.bbthorson.workers.dev/"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('still renders an in-app route as a router Link', () => {
    // The control: the new branch must not have swallowed the ordinary case.
    const html = draw('See the [Care Pathway](/guide/pathway).')
    expect(html).toContain('href="/guide/pathway"')
    expect(html).not.toContain('target="_blank"')
  })
})
