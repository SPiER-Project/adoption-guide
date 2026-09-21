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
 *
 * ⚠️ **A third case since 2026-09-21: the panel is narrow** (clinical-app audit
 * §1.7, rule 5, decision §7.3). Below the phone breakpoint the strip is drawn
 * whatever the launch said, because the host's banner is not on screen there —
 * it is hundreds of pixels up a stacked layout, and since #574 it is covered by
 * the takeover outright. jsdom computes no layout, so the width arrives through
 * a stubbed `ResizeObserver`; the stub is what lets the rule be exercised in
 * both directions instead of only in the one a browser happens to show.
 */
import { useEffect } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'

// Stubbed rather than provided: PatientProvider drags in the tool-config, SMART
// and data-source providers, and none of them are what this asserts.
vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => ({
    patientDisplay: { fullName: 'Maria Alvarez', dob: '1997-10-12', mrn: '11011' },
    activePatientId: 'patient-011',
    isSmartConnected: true,
    riskAlerts: [{ level: 'high' }],
  }),
}))

/**
 * A `ResizeObserver` that reports whatever width the test asks for.
 *
 * jsdom implements neither `ResizeObserver` nor `getBoundingClientRect`, so
 * both are stubbed: the rect is what `useIsNarrow`'s first, synchronous
 * measurement reads, and the observer is what it subscribes to afterwards.
 * `panelWidth` is read at measurement time rather than captured, so setting it
 * before `render` is enough.
 */
let panelWidth = 0
const rect = Element.prototype.getBoundingClientRect
Element.prototype.getBoundingClientRect = function boundingRect(this: Element) {
  return { ...rect.call(this), width: panelWidth } as DOMRect
}
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver

const { PanelShell } = await import('./PanelShell')

afterEach(() => {
  cleanup()
  panelWidth = 0
})

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

function renderPanel(hostDrawsBanner: boolean, width = 0) {
  panelWidth = width
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
    const { container } = renderPanel(true, 900)
    expect(container.querySelector('.panel-shell__patient')).toBeNull()
    // The body still renders: this removes a strip, not the panel.
    expect(container.querySelector('.panel-shell__body')).not.toBeNull()
  })

  it('names the patient anyway on a narrow panel', () => {
    // The safety case: a phone-width panel, a host that said it draws the
    // banner, and a banner that is off screen because the panel took the screen
    // over. Filling in a suicide-risk screener with no name on it is the defect
    // this branch exists to stop.
    const { container } = renderPanel(true, 375)
    expect(container.querySelector('.panel-shell__patient')).not.toBeNull()
    expect(screen.getByText('Maria Alvarez')).toBeDefined()
  })

  it('treats an unmeasured panel as wide, not as narrow', () => {
    // ⚠️ The direction that fails silently. A width of 0 is what every element
    // reports before layout — and what jsdom reports forever — so a rule
    // written as `width < 640` makes the narrow branch the default and the
    // wide branch something nobody ever sees. Here that would look like the
    // app ignoring `need_patient_banner` altogether.
    const { container } = renderPanel(true, 0)
    expect(container.querySelector('.panel-shell__patient')).toBeNull()
  })
})
