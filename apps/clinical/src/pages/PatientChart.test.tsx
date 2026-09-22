/**
 * @vitest-environment jsdom
 *
 * What a clinician meets on arrival at a patient's chart, in both chromes.
 *
 * ⚠️ **EXACTLY ONE page header, in BOTH chromes** (Brad, 2026-09-22). The panel
 * drew none at all until then — the measurement behind that was real (the panel
 * once drew the host's header, SPiER's identity strip, a page title, a rail
 * title and a progress sentence: five bands before the first instruction,
 * clinical-app audit §3) but the answer overshot, and a reader who has navigated
 * into a stage or a form had nothing saying where they are. `PageHeader.css`
 * collapses it to one line under `.panel-shell`, and the count is what these
 * tests hold: one, never two. The template gate counts header IMPLEMENTATIONS by
 * reading source text (`scripts/check-page-template.mjs`); it cannot count the
 * headers a route actually renders, which is the property that goes wrong.
 *
 * ⚠️ **The pathway IS this page** (Brad, 2026-09-22). The audit made the chart
 * one instruction and moved the eight-stage list to `/patient/where` (§4.3);
 * the list is the landing screen again, with the act drawn INSIDE the stage it
 * satisfies rather than in a card above it. So the assertions below are about
 * the act being *in the open stage* and *stated once* — the §4.1 property that
 * still holds — rather than about the list being absent.
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

describe('the chart opens on the pathway, at what is due', () => {
  it('draws exactly one page header, in both chromes', () => {
    for (const mode of ['ehr', 'panel'] as const) {
      const { container } = renderChart(mode)
      expect(container.querySelectorAll('.page-header'), mode).toHaveLength(1)
      expect(container.querySelectorAll('h2'), mode).toHaveLength(1)
      cleanup()
    }
  })

  it('renders the eight-stage list, with the act inside one of its stages', () => {
    const { container } = renderChart('panel')
    const rail = container.querySelector('.pathway')
    expect(rail).not.toBeNull()
    const action = container.querySelector('.next-action')
    expect(action).not.toBeNull()
    // Inside a stage node, not a sibling of the list: "where am I" and "what do
    // I do" are one screen only if the act is drawn at the stage it satisfies.
    expect(action?.closest('.pathway-node')).not.toBeNull()
  })

  it('names one act, and it is the only one on the page', () => {
    const { container } = renderChart('panel')
    expect(container.querySelectorAll('.next-action__act')).toHaveLength(1)
  })

  it('opens the stage the act sits at', () => {
    const { container } = renderChart('panel')
    const node = container.querySelector('.next-action')?.closest('.pathway-node')
    // An open node renders its body; a collapsed one renders the readout only.
    expect(node?.querySelector('.pathway-node-body')).not.toBeNull()
  })

  it('states what is due ONCE — no guidance card repeats the obligation', () => {
    // ⚠️ The §1.5 defect ("three answers to what do I do"), one layer down. The
    // list draws guidance cards; an obligation card drawn there too would be a
    // second copy of the act a few pixels below the first.
    const { container } = renderChart('ehr')
    const act = container.querySelector('.next-action__act')?.textContent ?? ''
    expect(act).not.toBe('')
    const cardTitles = [...container.querySelectorAll('.cds-card-title')].map(t => t.textContent)
    expect(cardTitles).not.toContain(act)
  })

  it('keeps the record a page, linked once', () => {
    const { container } = renderChart('ehr')
    expect(container.querySelector('#on-file')).toBeNull()
    expect(container.querySelector('.episode-record-section')).toBeNull()
    expect(container.querySelectorAll('a[href="/patient/on-file"]')).toHaveLength(1)
    const fact = container.querySelector('.patient-chart__fact')?.textContent
    expect(fact).toMatch(/^\d+ records?$/)
  })

  it('no longer links to the page it replaced', () => {
    const { container } = renderChart('panel')
    expect(container.querySelector('a[href="/patient/where"]')).toBeNull()
  })

  it('carries no scenario walkthrough — it is demo narration, not a chart', () => {
    // ⚠️ It rendered under a LIVE launch against a server that has no such
    // thing (§4.4). The presenter's copy is the mock EHR's own chart page.
    const { container } = renderChart('ehr')
    expect(container.querySelector('.encounters-timeline-section')).toBeNull()
    expect(container.textContent).not.toContain('Scenario walkthrough')
  })
})
