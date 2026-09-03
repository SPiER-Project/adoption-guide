/**
 * @vitest-environment jsdom
 *
 * The page footer — where SPiER's project metadata (GitHub, the project site,
 * the version stamp) lives now, having moved out of `.sidebar-footer`. See the
 * note on `PROJECT_LINKS` in `EhrShell.tsx` for why it moved: the sidebar's
 * height was pinned to the viewport, so on a page short enough to fit inside
 * it, the sidebar's sticky box visually covered whatever sat at the bottom of
 * `.sidebar-footer`.
 *
 * The shell is a fixed frame now, so that overlap is gone and this footer is
 * visible without scrolling at all — which is what makes it worth asserting the
 * contents of. jsdom computes no layout, so nothing here can test the frame
 * itself; these are content assertions only.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Stubbed rather than provided: PatientProvider drags in the tool-config, SMART
// and data-source providers, and the footer depends on none of them.
vi.mock('../context/PatientContext', () => ({
  usePatient: () => ({ activePatientId: null, isSmartConnected: false, riskAlerts: [], populationPatients: [] }),
}))

// jsdom has no scroll implementation; useScrollToTopOnNavigate calls this on
// every route (mount included) and the shell renders on a real route here,
// unlike Sidebar.test.tsx's isolated render.
Element.prototype.scrollTo = () => {}

const { EhrShell } = await import('./EhrShell')

afterEach(cleanup)

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <EhrShell />
    </MemoryRouter>,
  )
}

describe('EhrShell footer — project metadata', () => {
  it('still carries the SPiER tagline', () => {
    renderShell()
    expect(
      screen.getByText('SPiER — Setting priorities for technology-enabled suicide-safer care'),
    ).toBeTruthy()
  })

  it('links to GitHub and the project site, and shows the version stamp', () => {
    renderShell()
    const footer = screen.getByRole('navigation', { name: 'Project links' })
    const gitHub = screen.getByRole('link', { name: /GitHub/ })
    const site = screen.getByRole('link', { name: /thespierproject\.org/ })
    expect(footer.contains(gitHub)).toBe(true)
    expect(footer.contains(site)).toBe(true)
    expect(gitHub.getAttribute('href')).toBe('https://github.com/SPiER-Project/adoption-guide')
    expect(site.getAttribute('href')).toBe('https://thespierproject.org')
    expect(screen.getByText(/SPiER v\d/)).toBeTruthy()
  })

  it('opens both links in a new tab, and says so in the name', () => {
    renderShell()
    for (const name of [/GitHub/, /thespierproject\.org/]) {
      const link = screen.getByRole('link', { name })
      expect(link.getAttribute('target')).toBe('_blank')
      // noreferrer as well as noopener: these are third-party origins.
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(link.getAttribute('aria-label')).toContain('opens in a new tab')
    }
  })
})
