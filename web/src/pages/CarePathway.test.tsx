/**
 * @vitest-environment jsdom
 *
 * The Care Pathway page's C-SSRS simulator.
 *
 * ⚠️ **What this gates is zero drift, not a rendering.** The simulator's whole
 * justification is that it builds a native-shaped QuestionnaireResponse — item
 * nesting and every `value[x]` derived from the C-SSRS Screener Questionnaire —
 * and runs it through the *shipped* `mapCSSRSScreener`. Nothing here asserts a
 * tier the page invented; each case asserts that the page shows what the mapper
 * says, and the mapper is asserted separately in
 * `packages/core/src/lib/observationMappers/cssrsScreener.test.ts`.
 *
 * That is #327 turned into a test. The bug there was a suite that hand-built
 * `valueBoolean` answers no SPiER Questionnaire declares, certifying mappers
 * against input the app never produces. A demo page that hand-rolled its own
 * ladder would be the same mistake in front of an audience — so the two cases
 * below are the ends of the ladder (all-No, and a single endorsed q5), and
 * each is read off the page's own output.
 *
 * NOT asserted: how it looks. Layout and the dimming of the two non-selected
 * tier columns are computed styles, invisible to jsdom.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CarePathway } from './CarePathway'

afterEach(cleanup)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/guide/pathway']}>
      <CarePathway />
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

describe('CarePathway simulator', () => {
  it('renders the pathway from the artifact, with its provenance', () => {
    renderPage()
    // The steps are the artifact's, not the page's.
    expect(screen.getByText('Screen for suicide risk')).toBeDefined()
    expect(screen.getByText('Assess suicide risk after a positive screen')).toBeDefined()
    expect(screen.getByText(/Apply the obligations for the patient.s current risk tier/)).toBeDefined()
    // All three tiers are visible at once — no tab hides a branch.
    expect(screen.getByText('Low risk')).toBeDefined()
    expect(screen.getByText('Moderate risk')).toBeDefined()
    expect(screen.getByText('High risk')).toBeDefined()
    // Provenance, read off the loaded PlanDefinition.
    expect(
      screen.getByText('http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway'),
    ).toBeDefined()
  })

  it('takes its question wording from the Questionnaire, not from page copy', () => {
    renderPage()
    // The C-SSRS Screener's own text for q1. If the instrument is reworded, this
    // fails here rather than the page silently showing stale wording.
    expect(
      screen.getByText(/Have you wished you were dead or wished you could go to sleep and not wake up\?/),
    ).toBeDefined()
  })

  it('derives no-risk from an all-No screen', () => {
    renderPage()
    expect(derivedTier()).toBe('no-risk')
    // ...and says so on the branch, matching the artifact's negative-assessment note.
    expect(screen.getByText(/does not enter the pathway/)).toBeDefined()
  })

  it('derives high from a single endorsed q5, through the shipped mapper', () => {
    renderPage()
    toggle('Q5')
    expect(derivedTier()).toBe('high')
    // The high column is the one flagged as the simulated result.
    const flag = document.querySelector('.pathway-tier--active')
    expect(flag).not.toBeNull()
    expect(within(flag as HTMLElement).getByText('High risk')).toBeDefined()
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
