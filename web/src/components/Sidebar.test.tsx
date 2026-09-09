/**
 * @vitest-environment jsdom
 *
 * The sidebar's two zones — what the guide explains, and what you can go and try.
 *
 * ⚠️ **These assert decisions, not renderings.** The outbound links used to be
 * pills in `AppShell`'s header, with a `HeaderMenu` disclosure taking over below
 * 640px; a fourth (the mock EHR demo) did not fit at any width, so they moved
 * here and `HeaderMenu` was deleted. The property worth gating is that they are
 * in **exactly one place** and that the demo host is one of them — the mock EHR
 * is the only surface that shows SPiER as a panel inside someone else's chart.
 * A tidy-up that drops it, or re-adds a header cluster "for prominence", fails
 * here.
 *
 * ⚠️ **And since 2026-09-09, that the nav does not say the same thing twice.**
 * The sidebar listed four top-level lenses, two of which duplicated guide
 * sections: `Patient View` beside the `Patient App` page that explains it, and
 * `Population View` beside `Population Dashboard`. Four entries for two things,
 * named inconsistently, with no way to tell which of a pair you were opening.
 * The de-duplication is what the tests below pin, along with the ordering
 * decision that the mock EHR comes FIRST in the "Try it" zone — it is where the
 * product actually runs, and it spent a release in a footer called "Elsewhere",
 * below the app's own copies of the screens it launches.
 *
 * ⚠️ **GitHub and thespierproject.org are NOT here.** They used to sit below
 * these in the same `.sidebar-footer`, as quieter project metadata alongside
 * the version stamp — but that put them at the bottom of a box whose height is
 * pinned to the viewport, so on a short page the sidebar's own sticky box
 * visually covered the real page footer sitting right below it. They now live
 * in `.app-shell__footer` (see `AppShell.test.tsx`), which runs full width below the
 * sidebar and can't be obscured by it.
 *
 * What is NOT asserted: that they look right. The contrast bug this change
 * fixed (`--text-body` on the dark sidebar is 1.48:1, well under AA) is a
 * computed style, invisible to jsdom, and was caught in a browser. The
 * measurement is recorded in `Sidebar.css` beside the rule instead.
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

  it('does not carry the project links or version stamp — those are in the page footer now', () => {
    renderSidebar()
    expect(screen.queryByRole('link', { name: /GitHub/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /thespierproject\.org/ })).toBeNull()
    expect(screen.queryByText(/SPiER v\d/)).toBeNull()
  })

  it('opens every outbound link in a new tab, and says so in the name', () => {
    renderSidebar()
    for (const name of [/Implementation Guide/, /Mock EHR demo/]) {
      const link = screen.getByRole('link', { name })
      expect(link.getAttribute('target')).toBe('_blank')
      // noreferrer as well as noopener: these are third-party origins.
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(link.getAttribute('aria-label')).toContain('opens in a new tab')
    }
  })
})

/**
 * The de-duplication, and the ordering it made room for.
 *
 * ⚠️ Derived from `GUIDE_SECTIONS` rather than a hand-typed list, for the reason
 * the sidebar itself derives from it: a hand-typed copy is the drift this repo
 * keeps writing gates against, and a test carrying one would pin the copy rather
 * than the rule.
 */
describe('the sidebar says each thing once', () => {
  afterEach(() => cleanup())

  const renderSidebar = () =>
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <Sidebar isOpen={false} onClose={() => {}} />
      </MemoryRouter>,
    )

  it('lists every guide section exactly once, and no lens wrapper above them', async () => {
    const { GUIDE_SECTIONS } = await import('../data/guideSections')
    renderSidebar()
    for (const section of GUIDE_SECTIONS) {
      expect(screen.getAllByRole('link', { name: section.label })).toHaveLength(1)
    }
    // The collapsible "Adoption Guide" row is gone: it was always expanded on
    // every guide page, so it cost a row and a click-target to say nothing.
    expect(screen.queryByRole('link', { name: 'Adoption Guide' })).toBeNull()
  })

  it('has ONE entry per app, not a lens beside its explainer', () => {
    renderSidebar()
    // The explainers are guide sections; the demos are in "Try it". Neither
    // name may appear twice, and the old lens labels must not come back.
    expect(screen.getAllByRole('link', { name: 'Patient App' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Population Dashboard' })).toHaveLength(1)
    for (const gone of ['Patient View', 'Population View']) {
      expect(screen.queryByRole('link', { name: gone })).toBeNull()
    }
  })

  it('drops the chart-section anchors, which were dead with no patient loaded', () => {
    // `#activity`, `#recommendations`, `#encounters`, `#documents` are sections
    // of a LOADED chart. With no patient — the state a first visit is in — they
    // navigated to a page rendering none of them. The chart's own pathway rail
    // jumps between its sections, so the nav does not need to.
    renderSidebar()
    const anchors = screen
      .getAllByRole('link')
      .map(a => a.getAttribute('href') ?? '')
      .filter(href => /#(activity|recommendations|encounters|documents)$/.test(href))
    expect(anchors).toEqual([])
  })

  it('puts the mock EHR FIRST in "Try it", above the app’s own demo screens', () => {
    // The ordering decision. SPiER is launched from a host; the demo screens are
    // the same app without one. The old sidebar had this backwards.
    renderSidebar()
    const order = screen.getAllByRole('link').map(a => a.textContent ?? '')
    const host = order.findIndex(t => t.includes('Mock EHR demo'))
    const chart = order.findIndex(t => t.includes('Demo chart'))
    expect(host).toBeGreaterThan(-1)
    expect(chart).toBeGreaterThan(-1)
    expect(host).toBeLessThan(chart)
  })
})
