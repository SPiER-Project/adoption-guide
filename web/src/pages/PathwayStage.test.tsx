/**
 * @vitest-environment jsdom
 *
 * The stage page: what a clinician is told to do here, and what else they can
 * reach.
 *
 * ⚠️ **The load-bearing test is "the lead does not follow the preset".** The
 * whole reason `pathwaySelection.ts` is a module of its own is that the page and
 * the guided preset ask different questions with the same answer — what CARE
 * says to do, versus what this DEPLOYMENT turned on. Wiring the page to the
 * preset would look identical on a default install and would change what a
 * clinician is told to do every time an operator ticked a box on /settings.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { stageLeadTools, stageAlternativeTools } from '@spier/core/lib/pathwaySelection'

const config = { enabled: (id: string) => Boolean(id) }
const presentation = { chromeMode: 'ehr' as 'ehr' | 'panel' }

vi.mock('../context/ToolConfigContext', () => ({
  useToolConfig: () => ({ isToolEnabled: (id: string) => config.enabled(id) }),
}))
vi.mock('@spier/tool-views/context/PresentationContext', () => ({
  usePresentation: () => presentation,
}))

const { PathwayStage } = await import('./PathwayStage')

afterEach(() => {
  cleanup()
  config.enabled = () => true
  presentation.chromeMode = 'ehr'
})

const renderStage = (stageId: string) =>
  render(
    <MemoryRouter initialEntries={[`/patient/pathway/${stageId}`]}>
      <Routes>
        <Route path="/patient/pathway/:stageId" element={<PathwayStage />} />
        <Route path="/patient/record" element={<p>the chart</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('what to do here', () => {
  it('leads with the instrument the published pathway names', () => {
    const lead = stageLeadTools('identify-possible-risk')
    expect(lead.length).toBeGreaterThan(0)
    renderStage('identify-possible-risk')
    for (const tool of lead) {
      expect(screen.getAllByText(tool.name).length, tool.name).toBeGreaterThan(0)
    }
  })

  it('shows both obligations where the pathway names two', () => {
    // Document Safety Actions is named twice — share crisis resources AND
    // complete a safety plan. Neither may be dropped for a tidier page.
    const lead = stageLeadTools('document-safety-actions')
    expect(lead.length).toBe(2)
    renderStage('document-safety-actions')
    for (const tool of lead) expect(screen.getAllByText(tool.name).length).toBeGreaterThan(0)
  })

  it('names the stage and says what it is for', () => {
    renderStage('clarify-risk')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBeTruthy()
    expect(screen.getByText('What to do here')).toBeTruthy()
  })

  it('sends an unknown stage back to the chart rather than rendering a blank page', () => {
    renderStage('not-a-real-stage')
    expect(screen.getByText('the chart')).toBeTruthy()
  })
})

describe('the lead is the PATHWAY’s choice, not the deployment’s', () => {
  it('does not change when the deployment enables nothing at all', () => {
    // A site with an empty toolset still gets told what the pathway says to do.
    // If this ever starts returning nothing, the page has been wired to the
    // preset and "guided" has quietly become "whatever is ticked".
    const lead = stageLeadTools('identify-possible-risk')
    config.enabled = () => false
    renderStage('identify-possible-risk')
    for (const tool of lead) {
      expect(screen.getAllByText(tool.name).length, tool.name).toBeGreaterThan(0)
    }
  })

  it('still offers its launch actions with everything disabled', () => {
    config.enabled = () => false
    renderStage('identify-possible-risk')
    const lead = stageLeadTools('identify-possible-risk')
    for (const action of lead[0].launchActions) {
      expect(screen.getByRole('link', { name: action.label }).getAttribute('href')).toBe(action.path)
    }
  })
})

describe('the escape', () => {
  const stageWithAlternatives = 'clarify-risk'

  it('exists, and never repeats the lead inside it', () => {
    expect(stageAlternativeTools(stageWithAlternatives).length).toBeGreaterThan(0)
    renderStage(stageWithAlternatives)
    const disclosure = screen.getByText('Use a different instrument for this stage').closest('details')
    expect(disclosure).toBeTruthy()
    for (const tool of stageLeadTools(stageWithAlternatives)) {
      expect(within(disclosure as HTMLElement).queryByText(tool.name), tool.name).toBeNull()
    }
  })

  it('lists what the deployment has enabled', () => {
    renderStage(stageWithAlternatives)
    const disclosure = screen.getByText('Use a different instrument for this stage').closest('details')
    for (const tool of stageAlternativeTools(stageWithAlternatives)) {
      expect(within(disclosure as HTMLElement).getAllByText(tool.name).length, tool.name).toBeGreaterThan(0)
    }
  })

  it('counts what it has NOT enabled rather than hiding it', () => {
    const alternatives = stageAlternativeTools(stageWithAlternatives)
    config.enabled = () => false
    renderStage(stageWithAlternatives)
    expect(screen.getByText(new RegExp(`${alternatives.length} other tools? (is|are) catalogued`))).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Configure tools' })).toBeTruthy()
  })

  it('offers everything in panel chrome, matching the chart and the CDS service', () => {
    // toolEnablement.ts: the host's own cards cannot read this browser's
    // storage, so a panel honouring the preset would contradict the host chart
    // two inches away about the same patient.
    config.enabled = () => false
    presentation.chromeMode = 'panel'
    renderStage(stageWithAlternatives)
    expect(screen.queryByRole('link', { name: 'Configure tools' })).toBeNull()
    const disclosure = screen.getByText('Use a different instrument for this stage').closest('details')
    for (const tool of stageAlternativeTools(stageWithAlternatives)) {
      expect(within(disclosure as HTMLElement).getAllByText(tool.name).length, tool.name).toBeGreaterThan(0)
    }
  })
})
