/**
 * @vitest-environment jsdom
 *
 * Submit stopped meaning save (Brad, 2026-09-22), and these are the properties
 * a later edit could quietly undo.
 *
 * The flow is: fill in → **Submit** → a screen carrying the results and the
 * recommendation → **Save to the chart**, or start the form again. The risk in
 * that shape is entirely in the seam: a submit that silently keeps writing
 * makes the review screen decorative, and a review screen that offers a way off
 * itself discards a completed suicide-risk instrument without saying so.
 *
 * ⚠️ **`@formbox/renderer` does not load under vitest** — its bundle imports a
 * `fhirpath/fhir-context/r4` DIRECTORY, which Node's ESM resolver refuses, and
 * no test in this repo renders a filler for that reason (see
 * `apps/guide/src/pages/ToolPage.test.tsx`). It is mocked here to the ONE thing
 * these tests need from it: a control that calls `onSubmit` with a response.
 *
 * ⚠️ **The response is built by `nativeQr` from the real Questionnaire JSON**,
 * never hand-written. Issue #327 is the standing reason: six mapper suites once
 * certified the C-SSRS mappers against `valueBoolean` items that no SPiER
 * Questionnaire declares, so the tests passed and the app derived `none` for
 * every screen. A test that hand-writes the app's data shape proves the shape
 * it wrote.
 */
import { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'

/** What the mocked renderer hands to `onSubmit`, and how many times it has mounted. */
const form = vi.hoisted(() => ({ submitted: null as unknown, mounts: 0 }))

/**
 * ⚠️ **It reports its mount, and that is load-bearing for the *Start over*
 * test.** The real renderer keeps the answers in a store it builds on mount, so
 * "a blank form" is not a property of any DOM this test can read — it is
 * "a different instance". A stateless stub would make that test pass whatever
 * the view did with it.
 */
vi.mock('@formbox/renderer', () => {
  function MockRenderer({ onSubmit }: { onSubmit?: (response: unknown) => void }) {
    const [mount] = useState(() => ++form.mounts)
    return (
      <button
        type="button"
        data-testid="formbox-submit"
        data-mount={mount}
        onClick={() => onSubmit?.(form.submitted)}
      >
        Submit
      </button>
    )
  }
  return { default: MockRenderer }
})
vi.mock('@formbox/hs-theme', () => ({ theme: {} }))

const { nativeQr } = await import('@spier/core/lib/observationMappers/__fixtures__/nativeQr')
const { PatientContext } = await import('../context/PatientContext')
const { SurfaceLinksContext } = await import('../context/SurfaceLinksContext')
const { PresentationProvider } = await import('../context/PresentationProvider')
const { QuestionnaireView } = await import('./QuestionnaireView')
const { QUESTIONNAIRE_URLS } = await import('@spier/fhir-artifacts/generated/questionnaire-urls.generated')
import type { PatientContextType } from '../context/PatientContext'
import type { SurfaceLinks } from '../context/SurfaceLinksContext'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// jsdom implements neither, and both the beat and the results screen call them.
Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

const LINKS: SurfaceLinks = {
  parent: { label: 'Patient Chart', href: '/patient/record' },
  chartHref: '/patient/record',
  registryHref: '/population/caseload',
  launchHref: () => '/patient/assessments/stanley-and-brown',
}

const addResponse = vi.fn()
const addCarePlan = vi.fn()

/** An empty chart with a patient in context — the ordinary clinical session. */
function patientValue(): PatientContextType {
  return {
    addResponse,
    addCarePlan,
    responses: [],
    observations: [],
    carePlans: [],
    communications: [],
    procedures: [],
    episodes: [],
    riskAlerts: [],
    activePatientId: 'patient-001',
    isSmartConnected: false,
    isSmartSession: false,
    writebackReport: null,
  } as unknown as PatientContextType
}

/**
 * ⚠️ **`url`/`name` are parameters because the instrument CHANGES under this
 * component.** `TOOL_VIEWS` holds one element per slug and both apps render
 * them from the same position, so React reconciles the 18 fillers as one
 * instance — which is what the last test here is about. A rerender with
 * different props is exactly what walking from one tool page to the next does.
 */
function filler(url: string, name: string) {
  return (
    <MemoryRouter initialEntries={['/patient/assessments/cssrs-screener']}>
      <PresentationProvider initialMode="ehr">
        <PatientContext.Provider value={patientValue()}>
          <SurfaceLinksContext.Provider value={LINKS}>
            <QuestionnaireView title={name} questionnaireUrl={url} persistName={name} />
          </SurfaceLinksContext.Provider>
        </PatientContext.Provider>
      </PresentationProvider>
    </MemoryRouter>
  )
}

function renderScreener() {
  return render(filler(QUESTIONNAIRE_URLS['C-SSRS-Screener'], 'C-SSRS Screener'))
}

/** A screen that endorses a specific plan with intent — the published ladder's high tier. */
function highRiskScreen(): QuestionnaireResponseResource {
  return nativeQr(QUESTIONNAIRE_URLS['C-SSRS-Screener'], {
    q1: true, q2: true, q3: true, q4: true, q5: true, q6: false,
  })
}

/**
 * The words a reader meets on arrival — a closed `<details>` costs its
 * `summary` and nothing else.
 *
 * ⚠️ The same rule as `apps/clinical/src/pages/pageLength.test.tsx` and the
 * guide's copy of it, deliberately: the companion rule across this repo is
 * *task first, detail demoted into a drawer, never deleted*, and a count over
 * `textContent` would score demoting the same as leaving it in the way.
 */
function arrivalWords(root: Element): number {
  const visible = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return ''
    if (el.hasAttribute('hidden')) return ''
    if (el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open) {
      const summary = el.querySelector('summary')
      return summary ? visible(summary) : ''
    }
    return [...el.childNodes].map(visible).join(' ')
  }
  return visible(root).trim().split(/\s+/).filter(Boolean).length
}

const submit = () => screen.getByTestId('formbox-submit').click()
const saveButton = () => screen.getByRole('button', { name: /Save to the chart/ })

describe('QuestionnaireView — submit shows the results, it does not write them', () => {
  it('writes nothing on submit, and says so on the screen it lands on', async () => {
    form.submitted = highRiskScreen()
    renderScreener()

    submit()

    await waitFor(() => expect(document.querySelector('.submit-review')).not.toBeNull())
    expect(addResponse).not.toHaveBeenCalled()
    expect(addCarePlan).not.toHaveBeenCalled()
    expect(screen.getByText('Not in the chart yet')).toBeDefined()
  })

  it('replaces the form with the results — the clinician cannot still be filling it in', async () => {
    form.submitted = highRiskScreen()
    renderScreener()

    expect(screen.getByTestId('formbox-submit')).toBeDefined()
    submit()

    await waitFor(() => expect(screen.queryByTestId('formbox-submit')).toBeNull())
  })

  /**
   * ⚠️ **The review screen is a DECISION, and this is what stops it growing
   * back into a report.** Measured in the 470×900 panel: the six C-SSRS item
   * values were an open list of 315px, all of it the clinician's own answers
   * restated in the concepts' published names, sitting between the risk level
   * and *Save to the chart* — which landed 470px below the fold on a HIGH
   * screen. Counted the way `pageLength.test.tsx` counts, so a closed
   * `<details>` costs its summary and demoting is the cheap fix rather than
   * deleting.
   */
  it('keeps the decision at the top of the screen — the answers are one tap away, not in the way', async () => {
    form.submitted = highRiskScreen()
    renderScreener()
    submit()
    await waitFor(() => expect(document.querySelector('.submit-review')).not.toBeNull())

    const drawer = document.querySelector('.submit-review details')
    expect(drawer, 'the per-item values render outside a drawer').not.toBeNull()
    expect(drawer!.hasAttribute('open'), 'the answers drawer starts open').toBe(false)

    const words = arrivalWords(document.querySelector('.submit-review')!)
    expect(
      words,
      `${words} words on arrival. This screen is the moment a clinician decides whether a ` +
        'suicide-risk screen goes in the chart; anything longer than the result, the next step ' +
        'and the choice belongs behind the drawer.',
    ).toBeLessThanOrEqual(90)
  })

  it('shows the derived risk level, which the form itself never asked for', async () => {
    form.submitted = highRiskScreen()
    renderScreener()
    submit()

    await waitFor(() => expect(document.querySelector('.submit-result-summary')).not.toBeNull())
    const summary = document.querySelector('.submit-result-summary')!
    expect(summary.className).toContain('alert--high')
    expect(summary.querySelector('.submit-result-title')?.textContent).toMatch(/HIGH/)
  })

  /**
   * ⚠️ The whole reason `NextStep` grew a `preview` mode. The response exists
   * only in component state until the save, so a link out of this screen loses
   * a completed C-SSRS with no warning.
   */
  it('recommends the next step in words, and offers no way to leave without deciding', async () => {
    form.submitted = highRiskScreen()
    renderScreener()
    submit()

    await waitFor(() => expect(document.querySelector('.next-step')).not.toBeNull())
    expect(document.querySelector('.next-step__act')?.textContent?.length).toBeGreaterThan(5)
    expect(document.querySelector('.next-step__actions')).toBeNull()
    // The two buttons are the only controls, and neither navigates.
    expect(document.querySelectorAll('.submit-review a')).toHaveLength(0)
    expect(saveButton()).toBeDefined()
    expect(screen.getByRole('button', { name: /Start over/ })).toBeDefined()
  })
})

describe('QuestionnaireView — the two exits from the results screen', () => {
  it('Save to the chart writes the response once, then offers the pathway’s next step', async () => {
    form.submitted = highRiskScreen()
    renderScreener()
    submit()

    await waitFor(() => expect(document.querySelector('.submit-review')).not.toBeNull())
    saveButton().click()

    await waitFor(() => expect(addResponse).toHaveBeenCalledTimes(1))
    const [name, written] = addResponse.mock.calls[0] as [string, QuestionnaireResponseResource]
    expect(name).toBe('C-SSRS Screener')
    // Stamped with the source Questionnaire's canonical, as it always was —
    // the downstream mapper dispatch is keyed on it.
    expect(written.questionnaire).toContain(QUESTIONNAIRE_URLS['C-SSRS-Screener'])

    // The decision is spent: the beat offers the way onward it withheld before.
    await waitFor(() => expect(screen.getByText('Saved to the chart.')).toBeDefined())
    expect(document.querySelector('.next-step__actions')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Save to the chart/ })).toBeNull()
    // The results stay on screen — this is the record of what was just written.
    expect(document.querySelector('.submit-result-summary')).not.toBeNull()
  })

  it('Start over returns to a blank form and keeps the results out of the chart', async () => {
    form.submitted = highRiskScreen()
    renderScreener()
    const before = screen.getByTestId('formbox-submit').getAttribute('data-mount')
    submit()

    await waitFor(() => expect(document.querySelector('.submit-review')).not.toBeNull())
    screen.getByRole('button', { name: /Start over/ }).click()

    await waitFor(() => expect(screen.getByTestId('formbox-submit')).toBeDefined())
    // A different instance: the answers went with the one that unmounted.
    expect(screen.getByTestId('formbox-submit').getAttribute('data-mount')).not.toBe(before)
    expect(document.querySelector('.submit-review')).toBeNull()
    expect(document.querySelector('.submit-result-summary')).toBeNull()
    expect(addResponse).not.toHaveBeenCalled()
  })
})

describe('QuestionnaireView — the instrument changes under one component instance', () => {
  it('drops a previous instrument’s results when the next one is opened', async () => {
    form.submitted = highRiskScreen()
    const { rerender } = renderScreener()
    submit()
    await waitFor(() => expect(document.querySelector('.submit-result-summary')).not.toBeNull())

    // Walking to another tool's page: same component, different props.
    rerender(filler(QUESTIONNAIRE_URLS['PHQ-9'], 'PHQ-9'))

    await waitFor(() => expect(screen.getByTestId('formbox-submit')).toBeDefined())
    expect(
      document.querySelector('.submit-review'),
      'the C-SSRS results survived into the PHQ-9’s page, which renders one instrument’s ' +
        'answers under another instrument’s name',
    ).toBeNull()
  })
})
