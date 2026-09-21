/**
 * @vitest-environment jsdom
 *
 * The three "see it running" pages, on one pattern (adoption-guide UX audit
 * §4.4, applied 2026-09-20).
 *
 * The pattern is the point, and the reason it is pinned here rather than three
 * times over is that §4.4's finding was about all three together: the Provider
 * App was 981 words in 2.9 screens with four `Notice`s, the Population
 * Dashboard at 462 was "the one page near the right length", and the CDS page
 * was 730 words with 28 code elements and a section contradicting another
 * section. What they now share:
 *
 *   what it is (two sentences) → what you see (four bullets) → the button →
 *   two CLOSED drawers, *How it decides…* and *What this does and does not
 *   prove*.
 *
 * ⚠️ **"Closed" is the whole mechanism, and "never deleted" is the other
 * half.** The mock-EHR pass settled it: task first, caveats demoted into
 * closed drawers, never removed. So these tests assert both directions — the
 * drawers start closed AND each caveat's load-bearing sentence is still in the
 * document. A page that deleted a caveat to get shorter would go green on
 * length and red here.
 *
 * ⚠️ **The interoperability claim (§1 guardrail 3) is stated in full on ONE
 * page and in a sentence on the other two**, which is §5 rule 2 — a caveat
 * stated once per site and linked from everywhere else. The last test pins
 * which page owns it, because "state it everywhere" is exactly the regression
 * the audit measured (the phrase was on four pages).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProviderAppGuide } from './ProviderAppGuide'
import { PopulationDashboardGuide } from './PopulationDashboardGuide'
import { CdsServiceGuide } from './CdsServiceGuide'
import { MOCK_EHR_URL } from '../data/surfaces'

afterEach(cleanup)

beforeEach(() => {
  // The CDS page fetches its live discovery document on mount. Left unstubbed
  // it is a real network call from a unit test; stubbed to reject, the page
  // renders its own "couldn't reach the endpoint" line, which is the state
  // every assertion below is indifferent to.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
})

const PAGES = [
  { name: 'Provider App', el: <ProviderAppGuide />, decides: 'How it decides what to recommend' },
  { name: 'Population Dashboard', el: <PopulationDashboardGuide />, decides: 'How it decides an action is owed' },
  { name: 'CDS Service', el: <CdsServiceGuide />, decides: 'How it decides' },
] as const

function renderPage(el: React.ReactElement) {
  return render(<MemoryRouter>{el}</MemoryRouter>)
}

/** Everything a reader sees before opening anything. */
function visibleText(): string {
  const root = document.querySelector('.surface-guide')!.cloneNode(true) as HTMLElement
  root.querySelectorAll('.disclosure__body').forEach(b => b.remove())
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe.each(PAGES)('$name — the "see it running" pattern', ({ el, decides }) => {
  it('closes the mechanism and the caveat into exactly two drawers', () => {
    renderPage(el)
    const drawers = [...document.querySelectorAll('details.disclosure')] as HTMLDetailsElement[]
    expect(drawers).toHaveLength(2)
    expect(drawers.every(d => !d.open)).toBe(true)
    expect(drawers.map(d => d.querySelector('.disclosure__label')?.textContent)).toEqual([
      decides,
      'What this does and does not prove',
    ])
  })

  it('leaves no caveat sitting inline at the weight of the instruction', () => {
    renderPage(el)
    // Every `Notice` on these three pages became a bullet or a paragraph inside
    // the second drawer. A new one is a decision to re-open that argument.
    expect(document.querySelectorAll('.notice')).toHaveLength(0)
  })

  it('answers "what you see" in four bullets and offers one way in', () => {
    renderPage(el)
    const sections = [...document.querySelectorAll('.surface-guide__section')]
    const listSection = sections.find(s => s.querySelector('.surface-guide__list'))!
    expect(listSection.querySelectorAll(':scope > .surface-guide__list > li')).toHaveLength(4)
    const buttons = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(
      a => a.href === MOCK_EHR_URL,
    )
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toContain('Open the Demo EHR')
  })

  it('says under 300 words before a reader opens anything (§5 rule 4)', () => {
    renderPage(el)
    const words = visibleText().split(' ').length
    expect(words).toBeLessThanOrEqual(300)
  })
})

describe('the caveats survive the move into the drawers', () => {
  it('Provider App keeps all four of its Notices, as drawer content', () => {
    renderPage(<ProviderAppGuide />)
    const proves = within(
      document.querySelectorAll('.disclosure__body')[1] as HTMLElement,
    )
    expect(proves.getByText(/clinician.s app, not the patient.s/)).toBeDefined()
    expect(proves.getByText(/will not see any FHIR in it/)).toBeDefined()
    expect(proves.getByText(/server this project wrote/)).toBeDefined()
    // The Tool Configuration exception is a mechanism, so it went into the
    // FIRST drawer — it explains what the panel offers, not what it proves.
    const decides = document.querySelectorAll('.disclosure__body')[0] as HTMLElement
    expect(decides.textContent).toMatch(/every catalogued tool is offered regardless of that preset/)
  })

  it('Population Dashboard is the one page that states guardrail 3 in full', () => {
    renderPage(<PopulationDashboardGuide />)
    const proves = document.querySelectorAll('.disclosure__body')[1] as HTMLElement
    expect(proves.textContent).toMatch(/written and run by the same project as the app/)
    expect(proves.textContent).toMatch(/needs a third-party sandbox/)
    expect(proves.querySelector<HTMLAnchorElement>('a[href*="issues/401"]')).not.toBeNull()
    // Its siblings say it in a sentence and link here rather than restating it.
    for (const el of [<ProviderAppGuide key="p" />, <CdsServiceGuide key="c" />]) {
      cleanup()
      renderPage(el)
      const text = document.querySelector('.surface-guide')!.textContent ?? ''
      expect(text).not.toMatch(/written and run by the same project as the app/)
      expect(document.querySelector('a[href*="issues/401"]')).toBeNull()
    }
  })
})

describe('CDS Service — what §1.2 and §1.3 took off this page', () => {
  it('keeps both curl blocks: they are the task, not the reference', () => {
    renderPage(<CdsServiceGuide />)
    const pres = [...document.querySelectorAll('pre')]
    expect(pres).toHaveLength(2)
    expect(pres.every(p => (p.textContent ?? '').startsWith('curl'))).toBe(true)
    // Neither is inside a drawer.
    expect(pres.every(p => p.closest('.disclosure__body') === null)).toBe(true)
    // The invoke command carries the header, because the service enforces one.
    expect(pres[1].textContent).toMatch(/Authorization: Bearer \$CDS_CLIENT_JWT/)
  })

  it('names no function, package or npm script (§1.3)', () => {
    renderPage(<CdsServiceGuide />)
    const text = document.querySelector('.surface-guide')!.textContent ?? ''
    for (const jargon of [
      'observationMappers',
      'derivePathwayStatus',
      'buildCdsCards',
      'packages/core',
      'npm run',
      'check:',
    ]) {
      expect(text).not.toContain(jargon)
    }
    // The CLAIM those names used to carry is still made.
    expect(text).toMatch(/same derivation as the Provider App/)
  })

  it('states enforcement once, and says require rather than warn (§1.2)', () => {
    renderPage(<CdsServiceGuide />)
    const text = document.querySelector('.surface-guide')!.textContent ?? ''
    expect(text).not.toMatch(/warn/i)
    expect(text).toMatch(/Enforcement is on/)
    expect(text).toMatch(/any failure is a 401/)
  })
})
