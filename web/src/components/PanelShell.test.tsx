/**
 * @vitest-environment jsdom
 *
 * PanelShell's identity strip, and the one launch parameter that removes it.
 *
 * ⚠️ **The default matters more than the feature.** A panel that stops naming
 * whose chart it is showing is a safety problem, not a layout preference, so the
 * strip is drawn unless a host *explicitly* says `need_patient_banner: false`.
 * Both directions are asserted here, because a bug in either is invisible in the
 * one case anybody checks by hand: absent → still drawn, and `false` → gone.
 *
 * This is also a test that could not exist before step 5. Honoring
 * `need_patient_banner` is only meaningful when something else draws a banner,
 * and until the mock EHR had chart chrome there was nothing to defer to.
 */
import { useEffect } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PresentationProvider } from '../context/PresentationProvider'
import { usePresentation } from '../context/PresentationContext'

// Stubbed rather than provided: PatientProvider drags in the tool-config, SMART
// and data-source providers, and none of them are what this asserts.
vi.mock('../context/PatientContext', () => ({
  usePatient: () => ({
    patientDisplay: { fullName: 'Maria Alvarez', dob: '1997-10-12', mrn: '11011' },
    activePatientId: 'patient-011',
    isSmartConnected: true,
    riskAlerts: [{ level: 'high' }],
  }),
}))

const { PanelShell } = await import('./PanelShell')

afterEach(cleanup)

/**
 * Sets the flag through the context's own setter — the way `SmartRedirect` sets
 * it from the token response — rather than through a prop, so this exercises the
 * real seam instead of a test-only door.
 */
function BannerSetter({ hostDrawsBanner }: { hostDrawsBanner: boolean }) {
  const { setHostDrawsPatientBanner } = usePresentation()
  useEffect(() => {
    if (hostDrawsBanner) setHostDrawsPatientBanner(true)
  }, [hostDrawsBanner, setHostDrawsPatientBanner])
  return null
}

function renderPanel(hostDrawsBanner: boolean) {
  return render(
    <MemoryRouter>
      <PresentationProvider initialMode="panel">
        <BannerSetter hostDrawsBanner={hostDrawsBanner} />
        <PanelShell />
      </PresentationProvider>
    </MemoryRouter>,
  )
}

describe('PanelShell — the identity strip', () => {
  it('names the patient by default', () => {
    const { container } = renderPanel(false)
    expect(container.querySelector('.panel-shell__patient')).not.toBeNull()
    expect(screen.getByText('Maria Alvarez')).toBeDefined()
    // The MRN is part of identifying the patient, not decoration — the deployed
    // chart showed "MRN patient-011" against a patient whose MRN is 11011 (#369).
    expect(screen.getByText(/MRN 11011/)).toBeDefined()
  })

  it('yields the strip when the host says it draws the banner', () => {
    const { container } = renderPanel(true)
    expect(container.querySelector('.panel-shell__patient')).toBeNull()
    // The body still renders: this removes a strip, not the panel.
    expect(container.querySelector('.panel-shell__body')).not.toBeNull()
  })
})
