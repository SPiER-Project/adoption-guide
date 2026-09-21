/**
 * @vitest-environment jsdom
 *
 * What a clinician meets on arrival at a patient's chart, in both chromes.
 *
 * ⚠️ **One page header per page, and in the panel none at all.** The template
 * gate counts header IMPLEMENTATIONS by reading source text
 * (`scripts/check-page-template.mjs`); it cannot count the headers a route
 * actually renders, which is the property that goes wrong — the panel drew the
 * host's header, SPiER's identity strip, a page title, a rail title and a
 * progress sentence, five bands before the first instruction (clinical-app
 * audit §3). `ToolPage.test.tsx` counts them the same way on the guide.
 *
 * ⚠️ **And the order.** "The landing screen answers one question" (§4.1) is a
 * claim about what is FIRST, so the test asserts document order rather than
 * mere presence: a landing card rendered under the rail would satisfy every
 * other assertion in this repo.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { SurfaceLinksContext } from '@spier/tool-views/context/SurfaceLinksContext'
import { CLINICAL_SURFACE_LINKS } from '../surfaceLinks'

const scenario = POPULATION_SCENARIOS['patient-001']
const presentation = { chromeMode: 'ehr' as 'ehr' | 'panel', hostDrawsPatientBanner: false }

vi.mock('@spier/tool-views/context/PresentationContext', () => ({
  usePresentation: () => presentation,
}))
vi.mock('../context/ToolConfigContext', () => ({
  useToolConfig: () => ({ isToolEnabled: () => true }),
}))
vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => ({
    patientDisplay: { fullName: 'Sarah Patel', dob: '1998-03-02', age: '27', mrn: '10012', gender: 'Female' },
    responses: scenario.responses,
    carePlans: scenario.carePlans,
    observations: scenario.observations,
    communications: scenario.communications ?? [],
    riskAlerts: scenario.riskAlerts,
    procedures: scenario.procedures ?? [],
    episodes: scenario.episodes ?? [],
    encounters: scenario.encounters ?? [],
    documentReferences: scenario.documentReferences ?? [],
    serviceRequests: scenario.serviceRequests ?? [],
    appointments: scenario.appointments ?? [],
    consents: scenario.consents ?? [],
    flags: scenario.flags ?? [],
    tasks: scenario.tasks ?? [],
    activePatientId: 'patient-001',
    isSmartConnected: false,
    isSmartSession: false,
    walkthrough: scenario.walkthrough ?? [],
    isSliceLoading: false,
    dataSourceError: null,
    writebackReport: null,
  }),
}))

// jsdom implements neither, and the chart's scroll hook calls both on mount.
Element.prototype.scrollTo = () => {}
window.scrollTo = () => {}

const { PatientChart } = await import('./PatientChart')

afterEach(() => {
  cleanup()
  presentation.chromeMode = 'ehr'
})

function renderChart(mode: 'ehr' | 'panel') {
  presentation.chromeMode = mode
  return render(
    <MemoryRouter initialEntries={['/patient/record']}>
      <SurfaceLinksContext.Provider value={CLINICAL_SURFACE_LINKS}>
        <PatientChart />
      </SurfaceLinksContext.Provider>
    </MemoryRouter>,
  )
}

/** True when `a` precedes `b` in document order. */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

describe('the chart opens on one instruction', () => {
  it('draws no page header in the panel, and the landing card is the first thing', () => {
    const { container } = renderChart('panel')
    expect(container.querySelectorAll('.page-header')).toHaveLength(0)
    expect(container.querySelectorAll('h2')).toHaveLength(0)
    const landing = container.querySelector('.chart-landing')!
    expect(landing).not.toBeNull()
    expect(precedes(landing, container.querySelector('.pathway')!)).toBe(true)
  })

  it('draws exactly one page header in a standalone tab, above the landing card', () => {
    const { container } = renderChart('ehr')
    expect(container.querySelectorAll('.page-header')).toHaveLength(1)
    expect(container.querySelectorAll('h2')).toHaveLength(1)
    const header = container.querySelector('.page-header')!
    const landing = container.querySelector('.chart-landing')!
    expect(precedes(header, landing)).toBe(true)
    expect(precedes(landing, container.querySelector('.pathway')!)).toBe(true)
  })

  it('names one act, and it is the only one on the page', () => {
    const { container } = renderChart('panel')
    expect(container.querySelectorAll('.chart-landing__act')).toHaveLength(1)
  })

  it('leaves the pathway’s obligations off the rail entirely', () => {
    // ⚠️ The duplicate this PR exists to stop. Every card the rail still draws
    // is GUIDANCE — audit §4.5's own rule — so none of them may carry the
    // primary marker, and none may repeat the act above.
    const { container } = renderChart('panel')
    const act = container.querySelector('.chart-landing__act')!.textContent
    for (const title of container.querySelectorAll('.cds-card-title')) {
      expect(title.textContent).not.toBe(act)
    }
    expect(container.querySelectorAll('.pathway-node-actions .cds-card').length).toBeLessThan(
      container.querySelectorAll('.pathway-node').length,
    )
  })

  it('puts everything on file under one anchor, below the rail', () => {
    const { container } = renderChart('ehr')
    const onFile = container.querySelector('#on-file')!
    expect(onFile).not.toBeNull()
    expect(precedes(container.querySelector('.pathway')!, onFile)).toBe(true)
  })
})
