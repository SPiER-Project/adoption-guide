/**
 * @vitest-environment jsdom
 *
 * The embeddable caseload summary — the thing the mock EHR's front door frames.
 *
 * ⚠️ **Every property here is about what this route does NOT render.** That is
 * the point of it: the host page used to frame the whole Population lens, which
 * put two patient lists on one page — the host's demographics table and SPiER's
 * sortable caseload inside the iframe — and the framed one's row clicks
 * navigated within the frame rather than opening a chart in the host. So a
 * "helpful" future edit that adds the table back, or gives this a page header,
 * silently reintroduces the defect on a page that lives in another repo's
 * Worker and would look fine in a screenshot.
 *
 * The positive claims are covered by the full lens, which shares the derivation:
 * both read `useCaseloadSummary`, so a summary that disagreed with the caseload
 * table would need two implementations, and there is one.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PatientProvider } from '../context/PatientProvider'
import { SmartContext } from '../context/SmartContext'
import { LocalDataSource } from '../lib/dataSource/localDataSource'
import { PopulationSummaryEmbed } from './PopulationSummaryEmbed'

const SMART_STUB = {
  client: null,
  patient: null,
  error: null,
  setSmartData: () => {},
  setError: () => {},
}

/**
 * A FRESH `LocalDataSource` per render, injected through the provider.
 * `localDataSource` is a module singleton that reads `localStorage` only in its
 * constructor, so clearing storage leaves its in-memory store intact — the #371
 * trap.
 */
function renderEmbed(smart: Partial<typeof SMART_STUB> = {}) {
  return render(
    <MemoryRouter initialEntries={['/population/summary']}>
      <SmartContext.Provider value={{ ...SMART_STUB, ...smart } as never}>
        <PatientProvider dataSource={new LocalDataSource()}>
          <PopulationSummaryEmbed />
        </PatientProvider>
      </SmartContext.Provider>
    </MemoryRouter>,
  )
}

describe('PopulationSummaryEmbed', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('renders the summary and the alerts, and no caseload table', async () => {
    renderEmbed()
    expect(screen.getByLabelText('Caseload summary')).toBeTruthy()
    expect(screen.getByLabelText('Alerts')).toBeTruthy()
    // The regression: the whole lens embedded here duplicated the host's list.
    expect(screen.queryByRole('table')).toBeNull()
    // …and none of the table's controls came along either.
    expect(screen.queryByRole('group', { name: 'Caseload view' })).toBeNull()
  })

  it('draws no page header — the host owns the section heading', () => {
    const { container } = renderEmbed()
    // Same rule PanelShell follows for the patient banner: do not draw a title
    // two inches from the host's own. `check-page-template.mjs` enforces the
    // allowlist; this asserts the rendered result.
    expect(container.querySelector('.page-header')).toBeNull()
    expect(container.querySelector('h2')).toBeNull()
  })

  it('reports a real caseload from a registry-scoped source', async () => {
    renderEmbed()
    // A non-zero census is what distinguishes "read the registry" from "rendered
    // an empty widget", which is the failure a screenshot cannot tell apart.
    await waitFor(() =>
      expect(screen.getByLabelText('Caseload summary').textContent).toMatch(/[1-9]/),
    )
    expect(screen.queryByText(/Showing the patient in context only/)).toBeNull()
  })

  it('says so when the connection is bound to one patient', async () => {
    // Under SMART the cohort is the launch patient and nothing else, so a census
    // drawn from it is a census of one. The notice is the honesty, not the data.
    renderEmbed({
      client: { patient: { id: 'patient-011' } },
      patient: { id: 'patient-011', name: [{ family: 'Alvarez', given: ['Maria'] }] },
    } as never)
    await waitFor(() =>
      expect(screen.getByText(/Showing the patient in context only/)).toBeTruthy(),
    )
  })
})
