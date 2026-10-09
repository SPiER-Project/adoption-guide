/**
 * @vitest-environment jsdom
 *
 * The Care Pathway explainer: its simulator, its tier table, and its copy rules.
 *
 * ⚠️ **What the simulator half gates is zero drift, not a rendering.** The
 * simulator's whole justification is that it builds a native-shaped
 * QuestionnaireResponse — item nesting and every `value[x]` derived from the
 * C-SSRS Screener Questionnaire — and runs it through the *shipped*
 * `mapCSSRSScreener`. Nothing here asserts a tier the page invented; each case
 * asserts that the page shows what the mapper says, and the mapper is asserted
 * separately in `packages/core/src/lib/observationMappers/cssrsScreener.test.ts`.
 *
 * That is #327 turned into a test. The bug there was a suite that hand-built
 * `valueBoolean` answers no SPiER Questionnaire declares, certifying mappers
 * against input the app never produces. A demo page that hand-rolled its own
 * ladder would be the same mistake in front of an audience — so the two cases
 * below are the ends of the ladder (all-No, and a single endorsed q5), and
 * each is read off the page's own output.
 *
 * The copy half pins what the adoption-guide UX audit (§4.2, §5) changed on
 * 2026-09-20 and what a later edit would quietly undo: the prose stays under
 * its cap, the page never says "PlanDefinition" (that sentence belongs to the
 * protocol page alone), no FHIRPath reaches it, and the one link onward exists.
 *
 * NOT asserted: how it looks. Layout and the dimming of the two non-selected
 * tier columns are computed styles, invisible to jsdom.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CarePathway } from './CarePathway'
import { InspectContext } from '@spier/tool-views/context/InspectContext'

afterEach(cleanup)

/**
 * ⚠️ **`InspectContext` is supplied here because the LAYOUT supplies it in the
 * app, not because this test wants a special mode.** Raw FHIR renders inside
 * `/guide` and nowhere else (see context/InspectContext.ts), and the provider
 * sits on the `AdoptionGuide` layout that every `/guide/*` route renders into.
 * Mounting the page component on its own skips that layout, so without this the
 * page's `FhirJsonViewer` returns null and the simulator's QuestionnaireResponse
 * assertion below has nothing to read — a false failure describing a state no
 * reader can reach.
 */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/guide/pathway']}>
      <InspectContext.Provider value>
        <CarePathway />
      </InspectContext.Provider>
    </MemoryRouter>,
  )
}

/**
 * The tier code the simulator's live region carries. The panel SHOWS the tier's
 * title from the artifact ("High risk"), and carries the mapper's code beside it
 * so a case can assert what the mapper said rather than what the page words.
 */
function derivedTier(): string {
  const region = document.querySelector('.pathway-sim__result')
  if (!region) throw new Error('the simulator rendered no derived tier')
  return region.getAttribute('data-tier') ?? ''
}

/** What the result panel shows: the tier's title, and what that tier is owed. */
function resultPanel() {
  return {
    title: document.querySelector('.pathway-sim__result-tier')?.textContent ?? '',
    owed: [...document.querySelectorAll('.pathway-sim__owed-item')].map(li => li.textContent),
  }
}

/** Toggle one C-SSRS item by its question number label ("Q5"). */
function toggle(label: string) {
  const marker = screen.getByText(label)
  const checkbox = marker.closest('label')?.querySelector('input[type="checkbox"]')
  if (!checkbox) throw new Error(`no toggle found for ${label}`)
  fireEvent.click(checkbox)
}

/** Queries scoped to the tier table — the result panel repeats the obligation titles. */
function matrix() {
  const table = document.querySelector('.pathway-matrix')
  if (!table) throw new Error('the page rendered no tier table')
  return within(table as HTMLElement)
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

describe('CarePathway — the explainer', () => {
  it('names its reader first and tells the five things in the protocol\'s order', () => {
    renderPage()
    const lede = document.querySelector('.care-pathway__lede')?.textContent ?? ''
    expect(lede.startsWith('If you are deciding whether to adopt')).toBe(true)
    const leads = [...document.querySelectorAll('.care-pathway__para > strong')].map(s => s.textContent)
    expect(leads).toEqual([
      'Screen everyone.',
      'Gate on a positive.',
      'Clarify with a validated assessment.',
      'Tier the response.',
      'Keep asking, and step down only by rule.',
    ])
  })

  it('keeps the prose under the audit\'s cap — about 400 words plus the simulator', () => {
    renderPage()
    // The lede, the story and the onward card: everything the page SAYS, as
    // distinct from what the simulator asks and the table reads off the
    // artifact. §5 rule 4 puts a guide section at ≤ 600 words before its first
    // interactive element; §4.2 asks this page for about 400 in total.
    const prose = ['.care-pathway__lede', '.care-pathway__story', '.care-pathway__onward']
      .map(sel => document.querySelector(sel)?.textContent ?? '')
      .join(' ')
    expect(words(prose)).toBeGreaterThan(200)
    expect(words(prose)).toBeLessThanOrEqual(420)
  })

  it('never says "PlanDefinition" in its own prose and shows no FHIRPath — those belong to the protocol page', () => {
    renderPage()
    // §5 rule 5: "rendered from the published PlanDefinition" is said once, on
    // /guide/pathway/protocol — nowhere on this page, in any element. The
    // page's OWN prose never names the resource type at all; the tier table's
    // text is the artifact's and may (a realization is `PlanDefinition/…`),
    // and the JSON viewers' titles are collapsed FHIR affordances, not prose.
    expect(document.body.textContent).not.toMatch(/rendered from the published PlanDefinition/)
    const prose = ['.care-pathway__lede', '.care-pathway__story', '.care-pathway__onward', '.pathway-sim__lede', '.pathway-sim__note']
      .map(sel => document.querySelector(sel)?.textContent ?? '')
      .join(' ')
    expect(prose).not.toMatch(/PlanDefinition/)
    expect(document.body.textContent).not.toMatch(/%episode|%phq9Item9Observation/)
    expect(document.body.textContent).not.toMatch(/mapCSSRSScreener/)
  })

  it('links onward to the published protocol, as a route literal the gate can read', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /Read the published protocol/ })
    expect(link.getAttribute('href')).toBe('/guide/pathway/protocol')
  })

  it('draws the tier table from the artifact: three tiers, six obligations, spanning cells — and no notes', () => {
    renderPage()
    expect(screen.getByText('Low risk')).toBeDefined()
    expect(screen.getByText('Moderate risk')).toBeDefined()
    expect(screen.getByText('High risk')).toBeDefined()
    const rowHeaders = [...document.querySelectorAll('.pathway-matrix tbody th')].map(th =>
      th.querySelector('.pathway-obligation__title')?.textContent,
    )
    // The summary table: no gate row (the column headers name the tier), and
    // none of the implementer's notes — those stay on the protocol page.
    expect(rowHeaders).toEqual([
      'Share patient-facing crisis resources',
      'Complete a collaborative safety plan',
      'Reassess on the published cadence for this tier',
      'Ask the direct question at every contact',
      'STAT safety evaluation',
      'Missed-appointment outreach protocol',
    ])
    // The diagram's spanning row: crisis resources is ONE cell across all three.
    const crisis = matrix().getByText('Share patient-facing crisis resources').closest('tr')!
    const owed = crisis.querySelectorAll('td.pathway-matrix__cell--owed')
    expect(owed).toHaveLength(1)
    expect(owed[0].getAttribute('colspan')).toBe('3')
    // A span is a band, named by the tiers it covers; a single tier is a check
    // whose word ("Owed at this tier") is for a screen reader only.
    expect(owed[0].querySelector('.pathway-matrix__band')?.textContent).toBe('Owed: All tiers')
    const plan = matrix().getByText('Complete a collaborative safety plan').closest('tr')!
    expect(plan.querySelector('.pathway-matrix__band')?.textContent).toBe('Owed: Moderate and high risk')
    const stat = matrix().getByText('STAT safety evaluation').closest('tr')!
    expect(stat.querySelector('.pathway-matrix__band')).toBeNull()
    expect(stat.querySelector('.pathway-matrix__mark')?.textContent).toBe('Owed at this tier')
    expect(document.querySelector('.pathway-matrix .pathway-notes')).toBeNull()
    expect(document.querySelector('.pathway-matrix .pathway-stage-chip')).toBeNull()
  })
})

describe('CarePathway simulator', () => {
  it('takes its question wording from the Questionnaire, not from page copy', () => {
    renderPage()
    // The C-SSRS Screener's own text for q1. If the instrument is reworded, this
    // fails here rather than the page silently showing stale wording.
    expect(
      screen.getByText(/Have you wished you were dead or wished you could go to sleep and not wake up\?/),
    ).toBeDefined()
  })

  it('derives no-risk from an all-No screen, and the table stays at full strength', () => {
    renderPage()
    expect(derivedTier()).toBe('no-risk')
    // ...and says so beside the questions, matching the artifact's negative-assessment note.
    expect(resultPanel().title).toBe('Does not enter the pathway')
    expect(resultPanel().owed).toEqual([])
    expect(document.querySelector('.pathway-sim__exit')?.textContent).toMatch(/does not enter the pathway/)
    // No tier was chosen, so nothing is lit AND nothing is faded: the table
    // stays at full strength until an answer derives a tier.
    expect(document.querySelector('.pathway-matrix__cell--active')).toBeNull()
    expect(document.querySelector('.pathway-matrix__cell--dimmed')).toBeNull()
    expect(document.querySelector('th[aria-current="true"]')).toBeNull()
  })

  it('derives high from a single endorsed q5, through the shipped mapper, and lights that column', () => {
    renderPage()
    toggle('Q5')
    expect(derivedTier()).toBe('high')
    // The panel beside the questions names the tier and lists what it owes —
    // read off the same matrix the table draws, so all six rows apply at high.
    expect(resultPanel().title).toBe('High risk')
    expect(resultPanel().owed).toEqual([
      'Share patient-facing crisis resources',
      'Complete a collaborative safety plan',
      'Reassess on the published cadence for this tier',
      'Ask the direct question at every contact',
      'STAT safety evaluation',
      'Missed-appointment outreach protocol',
    ])
    // The high column header is the one flagged as the simulated result...
    const flagged = document.querySelector('th[aria-current="true"]')
    expect(flagged).not.toBeNull()
    expect(within(flagged as HTMLElement).getByText('High risk')).toBeDefined()
    expect(within(flagged as HTMLElement).getByText('simulated result')).toBeDefined()
    // ...the high-only protocol lights up, and the spanning crisis row does too,
    // because it covers the lit tier.
    const stat = matrix().getByText('STAT safety evaluation').closest('tr')!
    expect(stat.querySelector('td.pathway-matrix__cell--owed')?.classList.contains('pathway-matrix__cell--active')).toBe(true)
    const crisis = matrix().getByText('Share patient-facing crisis resources').closest('tr')!
    expect(crisis.querySelector('td.pathway-matrix__cell--owed')?.classList.contains('pathway-matrix__cell--active')).toBe(true)
    // The low tier's dash is dimmed on the safety-plan row: not owed, not selected.
    const plan = matrix().getByText('Complete a collaborative safety plan').closest('tr')!
    expect(plan.querySelector('td.pathway-matrix__cell--none')?.classList.contains('pathway-matrix__cell--dimmed')).toBe(true)
  })

  it('lists only what the lit tier owes: a wish to be dead is low, with no safety plan', () => {
    renderPage()
    toggle('Q1')
    expect(derivedTier()).toBe('low')
    expect(resultPanel().title).toBe('Low risk')
    expect(resultPanel().owed).toEqual([
      'Share patient-facing crisis resources',
      'Reassess on the published cadence for this tier',
    ])
  })

  it('builds a native-shaped response: the q6 follow-up appears only when q6 is Yes', () => {
    renderPage()
    // enableWhen on the Questionnaire says q6-recent is asked only after a Yes.
    expect(screen.queryByText('Q6a')).toBeNull()
    toggle('Q6')
    expect(screen.getByText('Q6a')).toBeDefined()
    expect(screen.getByText(/Was this within the past three months\?/)).toBeDefined()
    // Turning q6 back off retires the follow-up, as the form's enableWhen does.
    toggle('Q6')
    expect(screen.queryByText('Q6a')).toBeNull()
  })

  it('shows the QuestionnaireResponse it built, as a native choice answer', () => {
    renderPage()
    toggle('Q5')
    const toggleBtn = screen.getByRole('button', {
      name: /QuestionnaireResponse the simulator built/,
    })
    fireEvent.click(toggleBtn)
    const json = document.querySelector('.fhir-viewer-panel pre')?.textContent ?? ''
    // Nesting from the Questionnaire's own group, and SNOMED "Yes" — NOT a
    // hand-written valueBoolean. This is the assertion #327 needed.
    expect(json).toContain('ideation-section')
    expect(json).toContain('valueCoding')
    expect(json).toContain('373066001')
    expect(json).not.toContain('valueBoolean')
  })
})

/**
 * The phone's sticky result bar.
 *
 * What it shows, what tapping it does, and when it steps aside. Its stickiness
 * and its absence at desktop widths are CSS (`position: sticky`, a 1024px media
 * query), which jsdom does not lay out — those were checked in a browser.
 */
describe('CarePathway simulator — the sticky result bar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const bar = () => {
    const el = document.querySelector('.pathway-sim__bar')
    if (!el) throw new Error('the simulator rendered no result bar')
    return el as HTMLButtonElement
  }

  it('says what the panel says, and updates with it', () => {
    renderPage()
    expect(bar().querySelector('.pathway-sim__bar-tier')?.textContent).toBe('Does not enter the pathway')
    expect(bar().querySelector('.pathway-sim__bar-count')).toBeNull()
    toggle('Q1')
    expect(bar().querySelector('.pathway-sim__bar-tier')?.textContent).toBe(resultPanel().title)
    expect(bar().querySelector('.pathway-sim__bar-count')?.textContent).toBe(`${resultPanel().owed.length} owed`)
    toggle('Q5')
    expect(bar().querySelector('.pathway-sim__bar-tier')?.textContent).toBe('High risk')
    expect(bar().querySelector('.pathway-sim__bar-count')?.textContent).toBe('6 owed')
  })

  it('is not a second live region — the panel announces, once', () => {
    renderPage()
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
    expect(bar().getAttribute('aria-live')).toBeNull()
  })

  it('scrolls the full panel into view when tapped', () => {
    const scrolled: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this) }
    try {
      renderPage()
      fireEvent.click(bar())
      expect(scrolled).toEqual([document.querySelector('.pathway-sim__result')])
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('steps aside while the panel is on screen, and comes back when it leaves', () => {
    let report: (visible: boolean) => void = () => {
      throw new Error('nothing observed the result panel')
    }
    const observed: Element[] = []
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        report = visible => callback([{ isIntersecting: visible }])
      }
      observe(el: Element) { observed.push(el) }
      disconnect() {}
    })
    renderPage()
    expect(observed).toEqual([document.querySelector('.pathway-sim__result')])
    expect(bar().classList.contains('pathway-sim__bar--hidden')).toBe(false)

    act(() => report(true))
    expect(bar().classList.contains('pathway-sim__bar--hidden')).toBe(true)
    expect(bar().getAttribute('aria-hidden')).toBe('true')
    expect(bar().tabIndex).toBe(-1)

    act(() => report(false))
    expect(bar().classList.contains('pathway-sim__bar--hidden')).toBe(false)
    expect(bar().getAttribute('aria-hidden')).toBeNull()
  })
})
