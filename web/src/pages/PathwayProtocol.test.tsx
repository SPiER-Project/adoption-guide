/**
 * @vitest-environment jsdom
 *
 * The embedded view of the published pathway (Phase 4 of
 * docs/plans/suicide-safer-care-pathway.md).
 *
 * What is worth gating here is not "does it render" — the shared renderer is
 * already exercised by `CarePathway.test.tsx` — but the three properties that
 * make this a *different page* rather than a duplicate, each of which is a rule
 * from the plan that a later edit could quietly undo:
 *
 *  1. **Provenance leads.** The demo claim inside an EHR is that the app carried
 *     a published artifact in with it, so the canonical URL and version have to
 *     be the first thing on the page, not a closing footnote.
 *  2. **No patient-contextual rendering.** The embedded surface has patient
 *     context available and this view deliberately does not use it. Asserted
 *     from the outside — the page renders with no patient provider at all, so a
 *     future `usePatient()` in this graph fails here rather than in a demo.
 *  3. **No simulator.** Beside a real chart, a synthetic screener that derives a
 *     risk tier is one glance from being read as a screening just performed.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PathwayProtocol } from './PathwayProtocol'

afterEach(cleanup)

/**
 * No PatientProvider, no SmartProvider, no ToolConfigProvider — deliberately.
 * A definition view needs none of them, and rendering it bare is what turns
 * "holds no patient data" from a comment into a failing test.
 */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/patient/pathway']}>
      <PathwayProtocol />
    </MemoryRouter>,
  )
}

const CANONICAL = 'http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway'

describe('PathwayProtocol — the pathway in the embedded panel', () => {
  it('renders the same protocol the guide does, from the artifact', () => {
    renderPage()
    expect(screen.getByText('Screen for suicide risk')).toBeDefined()
    expect(screen.getByText('Assess suicide risk after a positive screen')).toBeDefined()
    expect(screen.getByText(/Apply the obligations for the patient.s current risk tier/)).toBeDefined()
    // All three tier columns, none of them selected: nothing here derives a
    // tier, so nothing may be highlighted as though something did.
    expect(screen.getByText('Low risk')).toBeDefined()
    expect(screen.getByText('Moderate risk')).toBeDefined()
    expect(screen.getByText('High risk')).toBeDefined()
    expect(document.querySelector('.pathway-tier--active')).toBeNull()
    expect(document.querySelector('.pathway-tier--dimmed')).toBeNull()
  })

  it('leads with the provenance strip — the canonical URL before the protocol', () => {
    renderPage()
    const canonical = screen.getByText(CANONICAL)
    expect(canonical).toBeDefined()
    expect(canonical.closest('.pathway-provenance--lead')).not.toBeNull()

    // "Before" as the DOM sees it, not as a comment claims: the provenance
    // section must precede the spine in document order.
    const provenance = document.querySelector('.pathway-provenance')
    const spine = document.querySelector('.pathway-spine')
    expect(provenance).not.toBeNull()
    expect(spine).not.toBeNull()
    expect(
      provenance!.compareDocumentPosition(spine!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // The version is stated, not implied — it is half of what makes a canonical
    // URL checkable.
    expect(screen.getByText('Version')).toBeDefined()
  })

  it('says it is the definition and points at the chart for the patient', () => {
    renderPage()
    expect(screen.getByText(/This is the definition, not this patient/)).toBeDefined()
    const back = screen.getByRole('link', { name: /pathway rail on the chart/ })
    expect(back.getAttribute('href')).toBe('/patient/chart#activity')
  })

  it('offers a way back out — the only one the panel has', () => {
    renderPage()
    // PageHeader `up`: in panel chrome there is no sidebar, so this is the exit.
    const up = screen.getByRole('link', { name: /Patient View/ })
    expect(up.getAttribute('href')).toBe('/patient/chart')
  })

  it('does not carry the C-SSRS simulator', () => {
    renderPage()
    expect(screen.queryByText('Try a C-SSRS result')).toBeNull()
    expect(document.querySelector('.pathway-sim')).toBeNull()
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0)
  })

  it('still labels what the artifact deliberately does not encode', () => {
    renderPage()
    expect(screen.getByText('Pending clinical definition')).toBeDefined()
    expect(screen.getByText('Step-down criteria')).toBeDefined()
  })
})
