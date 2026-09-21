/**
 * @vitest-environment jsdom
 *
 * "Why this?" — the discoverable half.
 *
 * ⚠️ **The page exists so the landing screen can stay one instruction**, which
 * makes two of its properties load-bearing rather than cosmetic: it says the
 * same thing the card said (a second reading of the record here would be a
 * fourth answer to "what do I do"), and it has a way back, because in panel
 * chrome the header's `up` is the only one.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { evaluatePathway, type PathwayRecord } from '@spier/core/lib/pathwayEvaluation'

const active = { id: 'patient-001' }

vi.mock('@spier/tool-views/context/PresentationContext', () => ({
  usePresentation: () => ({ chromeMode: 'panel' }),
}))
vi.mock('../context/ToolConfigContext', () => ({
  useToolConfig: () => ({ isToolEnabled: () => true }),
}))
vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => {
    const s = POPULATION_SCENARIOS[active.id]
    return {
      responses: s.responses,
      observations: s.observations,
      carePlans: s.carePlans,
      communications: s.communications ?? [],
      procedures: s.procedures ?? [],
      episodes: s.episodes ?? [],
      riskAlerts: s.riskAlerts,
    }
  },
}))

const { WhyThis } = await import('./WhyThis')

afterEach(() => {
  cleanup()
  active.id = 'patient-001'
})

function recordFor(id: string): PathwayRecord {
  const s = POPULATION_SCENARIOS[id]
  return {
    responses: s.responses,
    observations: s.observations,
    carePlans: s.carePlans,
    communications: s.communications ?? [],
    procedures: s.procedures ?? [],
    episodes: s.episodes ?? [],
    riskAlerts: s.riskAlerts,
  }
}

function renderWhy(id: string) {
  active.id = id
  return render(
    <MemoryRouter initialEntries={['/patient/why']}>
      <Routes>
        <Route path="/patient/why" element={<WhyThis />} />
        <Route path="/patient/record" element={<p>the chart</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the page behind the landing card', () => {
  it('draws exactly one page header, and its way back is the chart', () => {
    const { container } = renderWhy('patient-001')
    expect(container.querySelectorAll('.page-header')).toHaveLength(1)
    expect(container.querySelectorAll('h2')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Patient Chart/ }).getAttribute('href')).toBe(
      '/patient/record',
    )
  })

  it('explains the recommendation the chart made, word for word', () => {
    const { primary } = evaluatePathway(recordFor('patient-001'))
    expect(primary, 'patient-001 owes nothing — this test would check nothing').toBeTruthy()
    const { container } = renderWhy('patient-001')
    // The act, as the header's lede, and the trigger and the protocol's words
    // under it. Compared against the evaluator rather than against a literal:
    // the page must not be a second reading of the same record.
    expect(container.querySelector('.page-header__lede')!.textContent).toBe(primary!.title)
    // The trigger first, then what the protocol asks for — audit §4.2's order.
    const prose = [...container.querySelectorAll('.why-this__prose')].map(p => p.textContent)
    expect(prose[0]).toBe(primary!.reason)
    expect(prose[1]).toBe(primary!.description)
  })

  it('offers the alternatives and the protocol, in that order', () => {
    const { container } = renderWhy('patient-001')
    expect(container.querySelector('.pathway-stage__alternatives-summary')!.textContent).toBe(
      'Use a different instrument for this step',
    )
    // Closed on arrival — the page is the drawer the panel could not afford,
    // and the alternatives are a drawer inside it.
    expect(container.querySelector('details.pathway-stage__alternatives')!.hasAttribute('open')).toBe(
      false,
    )
    const protocol = screen.getByRole('link', { name: /Read the published protocol/ })
    expect(protocol.getAttribute('href')).toBe('/patient/pathway')
  })

  it('returns to the chart when there is nothing to explain', () => {
    const clear = Object.keys(POPULATION_SCENARIOS).find(id => !evaluatePathway(recordFor(id)).primary)
    expect(clear, 'no demo chart is clear — the redirect would be unchecked').toBeDefined()
    renderWhy(clear!)
    expect(screen.getByText('the chart')).toBeDefined()
    expect(document.querySelector('.why-this')).toBeNull()
  })
})
