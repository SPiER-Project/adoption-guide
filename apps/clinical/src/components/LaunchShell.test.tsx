/**
 * @vitest-environment jsdom
 *
 * The clinical surface's chrome — what a clinician launched from their EHR sees
 * around the page, and what they deliberately do not.
 *
 * ⚠️ **`IS_DEMO` is folded at BUILD time, so these tests mock the module.**
 * Vitest runs with `VITE_SURFACE` unset, which means `surface.ts` reports
 * `demo`; without the mock every assertion below would be exercising the guide's
 * chrome while reading as though it had checked the clinical one. That is the
 * vacuous-pass shape this repo keeps rediscovering, so `Sidebar.clinical` here
 * asserts the demo-only pieces are ABSENT *and* `Sidebar.test.tsx` asserts the
 * same pieces are PRESENT on the demo surface — the two files together are the
 * both-ways check that `check:surface` performs on the bundles.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/surface', () => ({ SURFACE: 'clinical', IS_DEMO: false }))

const smart = { isSmartSession: false, isSmartConnected: false, activePatientId: null as string | null }
vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => ({
    activePatientId: smart.activePatientId,
    isSmartConnected: smart.isSmartConnected,
    isSmartSession: smart.isSmartSession,
    riskAlerts: [],
    populationPatients: [],
  }),
}))

// jsdom has no scroll implementation; useScrollToTopOnNavigate calls it on mount.
Element.prototype.scrollTo = () => {}

const { LaunchShell } = await import('./LaunchShell')

afterEach(() => {
  cleanup()
  smart.isSmartSession = false
  smart.isSmartConnected = false
  smart.activePatientId = null
})

const renderShell = (path = '/population/caseload') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<LaunchShell />}>
          <Route path={path} element={<p>page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

describe('what the clinical chrome does NOT carry', () => {
  it('has no Implementation Guide link — it 404s on this Worker', () => {
    // The defect: `${BASE_URL}ig/` is served by services/guide and not held
    // by services/clinical, so it fell through to the SPA fallback and opened
    // SPiER again in a new tab. Verified against both deploys 2026-09-18.
    renderShell()
    expect(screen.queryByRole('link', { name: /Implementation Guide/ })).toBeNull()
    expect(screen.queryByText(/normative FHIR spec/)).toBeNull()
  })

  it('has no project footer — that is how a product introduces itself, not chart furniture', () => {
    renderShell()
    expect(screen.queryByRole('navigation', { name: 'Project links' })).toBeNull()
    expect(screen.queryByRole('link', { name: /GitHub/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /thespierproject\.org/ })).toBeNull()
    expect(
      screen.queryByText('SPiER — Setting priorities for technology-enabled suicide-safer care'),
    ).toBeNull()
  })

  it('offers no guide navigation and no demo host', () => {
    renderShell()
    expect(screen.queryByRole('link', { name: /Adoption Rubric/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Demo EHR/ })).toBeNull()
  })
})

describe('what it does carry', () => {
  it('keeps the four clinical destinations when there is a patient', () => {
    smart.activePatientId = 'patient-003'
    renderShell()
    for (const label of ['Patient record', 'Caseload', 'Measures', 'Settings']) {
      expect(screen.getByRole('link', { name: label }), label).toBeTruthy()
    }
  })

  /**
   * ⚠️ A worklist launch is CONNECTED and has no patient, and *Patient record*
   * was an error page with a launch button under it — for nobody, against a
   * session the server refuses every write from (clinical-app audit §8.6).
   */
  it('drops Patient record on a launch that has no patient, and keeps the other three', () => {
    smart.isSmartSession = true
    renderShell()
    expect(screen.queryByRole('link', { name: 'Patient record' })).toBeNull()
    for (const label of ['Caseload', 'Measures', 'Settings']) {
      expect(screen.getByRole('link', { name: label }), label).toBeTruthy()
    }
  })

  it('still renders the page', () => {
    renderShell()
    expect(screen.getByText('page')).toBeTruthy()
  })

  it('points the brand at the clinical front door, not at /', () => {
    // `/` redirects to /patient/record on this surface, so linking it would work
    // — but it is a redirect, and the guide's `/` is an Overview that does not
    // exist here.
    smart.activePatientId = 'patient-003'
    renderShell()
    const brand = screen.getAllByRole('link').find(a => a.className.includes('app-shell__brand'))
    expect(brand?.getAttribute('href')).toBe('/patient/record')
  })

  it('points the brand at the caseload when the session has no patient', () => {
    smart.isSmartSession = true
    renderShell()
    const brand = screen.getAllByRole('link').find(a => a.className.includes('app-shell__brand'))
    expect(brand?.getAttribute('href')).toBe('/population/caseload')
  })
})

describe('the connection status line', () => {
  // The one fact a clinician cannot afford to be wrong about on this surface:
  // the clinical build compiles in NO synthetic patient, so disconnected means
  // there is no data at all rather than demo data.
  it('says how to connect when there is no session', () => {
    renderShell()
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Not connected to an EHR')
    expect(status.textContent).toContain('launch SPiER from a patient')
  })

  it('says writes reach the chart when there is one', () => {
    smart.isSmartSession = true
    renderShell()
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Connected to your EHR')
    expect(status.textContent).not.toContain('Not connected')
  })

  it('reads isSmartSession, not isSmartConnected', () => {
    // ⚠️ A user-scoped worklist launch (#401) is connected with NO patient in
    // context, so `isSmartConnected` is false while the session is live. Keying
    // this line on it would tell a clinician with a working caseload that they
    // are not connected.
    smart.isSmartSession = true
    renderShell()
    expect(screen.getByRole('status').textContent).toContain('Connected to your EHR')
  })
})
