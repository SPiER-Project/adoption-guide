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
 * mere presence: a landing card rendered under anything else would satisfy
 * every other assertion in this repo.
 *
 * ⚠️ **The rail and the record are not on this page at all since 2026-09-21**
 * (audit §4.3, §4.4) — they are `/patient/where` and `/patient/on-file`, and
 * this page carries the two links to them. Three assertions here used to name
 * `.pathway` and `#on-file`; they name the links now, because "the rail is
 * below the card" and "the rail is a page" are different claims and only the
 * second one is true.
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
    expect(landing).toBe(container.querySelector('.patient-chart > *'))
  })

  it('draws exactly one page header in a standalone tab, above the landing card', () => {
    const { container } = renderChart('ehr')
    expect(container.querySelectorAll('.page-header')).toHaveLength(1)
    expect(container.querySelectorAll('h2')).toHaveLength(1)
    const header = container.querySelector('.page-header')!
    const landing = container.querySelector('.chart-landing')!
    expect(precedes(header, landing)).toBe(true)
  })

  it('names one act, and it is the only one on the page', () => {
    const { container } = renderChart('panel')
    expect(container.querySelectorAll('.chart-landing__act')).toHaveLength(1)
  })

  it('holds neither the rail nor the record — they are pages', () => {
    // ⚠️ The measured half of §4.3/§4.4. The chart carried the rail, three
    // record sections and the landing card; what is left is the card and two
    // links, so "what do I do" is the whole screen rather than its first inch.
    const { container } = renderChart('ehr')
    expect(container.querySelector('.pathway')).toBeNull()
    expect(container.querySelector('#on-file')).toBeNull()
    expect(container.querySelector('.episode-record-section')).toBeNull()
    expect(container.querySelector('.documents-section')).toBeNull()
  })

  it('links to both of them, with the fact each carries', () => {
    const { container } = renderChart('panel')
    const where = container.querySelector('a[href="/patient/where"]')
    const onFile = container.querySelector('a[href="/patient/on-file"]')
    expect(where?.textContent).toBe('Where this patient is')
    expect(onFile?.textContent).toBe('What\u2019s on file')
    const facts = [...container.querySelectorAll('.chart-landing__fact')].map(f => f.textContent)
    expect(facts[0]).toMatch(/^Step \d of 8$/)
    expect(facts[1]).toMatch(/^\d+ records?$/)
  })

  it('carries no scenario walkthrough — it is demo narration, not a chart', () => {
    // ⚠️ It rendered under a LIVE launch against a server that has no such
    // thing (§4.4). The presenter's copy is the mock EHR's own chart page.
    const { container } = renderChart('ehr')
    expect(container.querySelector('.encounters-timeline-section')).toBeNull()
    expect(container.textContent).not.toContain('Scenario walkthrough')
  })
})
