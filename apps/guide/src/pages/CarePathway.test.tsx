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
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
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

/** The simulator's live region: "Derived tier · <code> · <mapper detail>". */
function derivedTier(): string {
  const region = document.querySelector('.pathway-sim__result-tier')
  if (!region) throw new Error('the simulator rendered no derived tier')
  return region.textContent ?? ''
}

/** Toggle one C-SSRS item by its question number label ("Q5"). */
function toggle(label: string) {
  const marker = screen.getByText(label)
  const checkbox = marker.closest('label')?.querySelector('input[type="checkbox"]')
  if (!checkbox) throw new Error(`no toggle found for ${label}`)
  fireEvent.click(checkbox)
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

  it('draws the tier table from the artifact: three tiers, six obligations, spanning cells', () => {
    renderPage()
    expect(screen.getByText('Low risk')).toBeDefined()
    expect(screen.getByText('Moderate risk')).toBeDefined()
    expect(screen.getByText('High risk')).toBeDefined()
    const rowHeaders = [...document.querySelectorAll('.pathway-matrix tbody th')].map(th =>
      th.querySelector('.pathway-obligation__title')?.textContent,
    )
    expect(rowHeaders).toEqual([
      'Applies when',
      'Share patient-facing crisis resources',
      'Complete a collaborative safety plan',
      'Reassess on the published cadence for this tier',
      'Ask the direct question at every contact',
      'STAT safety evaluation',
      'Missed-appointment outreach protocol',
    ])
    // The diagram's spanning row: crisis resources is ONE cell across all three.
    const crisis = screen.getByText('Share patient-facing crisis resources').closest('tr')!
    const owed = crisis.querySelectorAll('td.pathway-matrix__cell--owed')
    expect(owed).toHaveLength(1)
    expect(owed[0].getAttribute('colspan')).toBe('3')
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

  it('derives no-risk from an all-No screen, and every column stays unlit', () => {
    renderPage()
    expect(derivedTier()).toBe('no-risk')
    // ...and says so under the table, matching the artifact's negative-assessment note.
    expect(document.querySelector('.pathway-branch__exit')?.textContent).toMatch(/does not enter the pathway/)
    expect(document.querySelector('.pathway-matrix__cell--active')).toBeNull()
    expect(document.querySelectorAll('.pathway-matrix__cell--dimmed').length).toBeGreaterThan(0)
  })

  it('derives high from a single endorsed q5, through the shipped mapper, and lights that column', () => {
    renderPage()
    toggle('Q5')
    expect(derivedTier()).toBe('high')
    // The high column header is the one flagged as the simulated result...
    const flagged = document.querySelector('th[aria-current="true"]')
    expect(flagged).not.toBeNull()
    expect(within(flagged as HTMLElement).getByText('High risk')).toBeDefined()
    expect(within(flagged as HTMLElement).getByText('simulated result')).toBeDefined()
    // ...the high-only protocol lights up, and the spanning crisis row does too,
    // because it covers the lit tier.
    const stat = screen.getByText('STAT safety evaluation').closest('tr')!
    expect(stat.querySelector('td.pathway-matrix__cell--owed')?.classList.contains('pathway-matrix__cell--active')).toBe(true)
    const crisis = screen.getByText('Share patient-facing crisis resources').closest('tr')!
    expect(crisis.querySelector('td.pathway-matrix__cell--owed')?.classList.contains('pathway-matrix__cell--active')).toBe(true)
    // The low tier's dash is dimmed on the safety-plan row: not owed, not selected.
    const plan = screen.getByText('Complete a collaborative safety plan').closest('tr')!
    expect(plan.querySelector('td.pathway-matrix__cell--none')?.classList.contains('pathway-matrix__cell--dimmed')).toBe(true)
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
