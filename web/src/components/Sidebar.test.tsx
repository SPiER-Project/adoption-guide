/**
 * @vitest-environment jsdom
 *
 * The sidebar footer — where SPiER's outbound links live, having been moved back
 * into the sidebar from the app bar.
 *
 * ⚠️ **This asserts a decision, not a rendering.** Three of these links used to
 * be pills in `EhrShell`'s header, with a `HeaderMenu` disclosure taking over
 * below 640px; a fourth did not fit at any width, so all of them moved here and
 * `HeaderMenu` was deleted. The property worth gating is that they are in
 * **exactly one place** and that the demo host is one of them — the mock EHR is
 * the only surface that shows SPiER as a panel inside someone else's chart,
 * which is the mental model the standalone lenses quietly contradict. A tidy-up
 * that drops it, or that re-adds a header cluster "for prominence", should fail
 * here.
 *
 * What is NOT asserted: that they look right. The contrast bug this change fixed
 * (`--text-body` on the dark sidebar is 1.48:1, well under AA) is a computed
 * style, invisible to jsdom, and was caught in a browser. The measurement is
 * recorded in `Sidebar.css` beside the rule instead.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Stubbed rather than provided: PatientProvider drags in the tool-config, SMART
// and data-source providers, and the footer depends on none of them.
vi.mock('../context/PatientContext', () => ({
  usePatient: () => ({ activePatientId: null }),
}))

const { Sidebar } = await import('./Sidebar')

afterEach(cleanup)

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <Sidebar isOpen={false} onClose={() => {}} />
    </MemoryRouter>,
  )
}

describe('Sidebar footer — outbound links', () => {
  it('offers the mock EHR demo, which is the only place SPiER appears as a panel', () => {
    renderSidebar()
    const demo = screen.getByRole('link', { name: /Mock EHR demo/ })
    expect(demo.getAttribute('href')).toBe('https://spier-mock-ehr.bbthorson.workers.dev/')
    // ⚠️ "Mock" is load-bearing: that host is controlled by the project it
    // demonstrates and says so on every page. A label reading "EHR demo" would
    // drop the word that keeps the claim honest.
    expect(demo.textContent).toContain('Mock')
  })

  it('links the IG through the Vite base path, not a hardcoded /ig/', () => {
    renderSidebar()
    const ig = screen.getByRole('link', { name: /Implementation Guide/ })
    // The published IG is a sibling static site, and the base differs between
    // Cloudflare (`/`) and the legacy Pages deploy (`/adoption-guide/`).
    expect(ig.getAttribute('href')).toBe(`${import.meta.env.BASE_URL}ig/`)
  })

  it('keeps project metadata as a separate, quieter group', () => {
    renderSidebar()
    // Two navs, not one list: the IG and the demo are destinations, GitHub and
    // the project site are metadata. Collapsing them reads the normative spec as
    // being on a par with a repo link.
    expect(screen.getByRole('navigation', { name: 'SPiER elsewhere' })).toBeTruthy()
    const meta = screen.getByRole('navigation', { name: 'Project links' })
    expect(meta.textContent).toContain('GitHub')
    expect(meta.textContent).toContain('thespierproject.org')
    expect(meta.textContent).not.toContain('Implementation Guide')
  })

  it('opens every outbound link in a new tab, and says so in the name', () => {
    renderSidebar()
    for (const name of [/Implementation Guide/, /Mock EHR demo/, /GitHub/, /thespierproject\.org/]) {
      const link = screen.getByRole('link', { name })
      expect(link.getAttribute('target')).toBe('_blank')
      // noreferrer as well as noopener: these are third-party origins.
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(link.getAttribute('aria-label')).toContain('opens in a new tab')
    }
  })
})
