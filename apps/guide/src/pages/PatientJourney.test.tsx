/**
 * @vitest-environment jsdom
 *
 * Tools — the catalogue as a list (adoption-guide UX audit §4.3, 2026-09-20).
 *
 * What a later edit could quietly undo, pinned:
 *
 *  1. **One link per catalogued tool, to that tool's page.** The forty links
 *     are computed from the catalog, so `check:surface-links` cannot read them
 *     (it walks route literals); this is what stands in for it.
 *  2. **No accordion.** The page was forty expandable cards; a control with
 *     `aria-expanded` here is the accordion coming back.
 *  3. **The stage anchors survive.** `/guide/pathway` forwards `#stage-<id>`
 *     deep links here, so every stage keeps its id.
 *  4. **The copy rules.** The reader is named first; the prose before the
 *     first stage stays short (§5 rule 4); the two section links are literals.
 *  5. **The triggers are kept, closed.** The hand-off drawers exist and start
 *     closed — the mock-EHR rule, not deleted and not in the way.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { STAGES, TOOLS } from '@spier/core/data/catalog'
import { PatientJourney } from './PatientJourney'
import { toolForms } from '../data/toolForms'

afterEach(cleanup)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/guide/tools']}>
      <PatientJourney />
    </MemoryRouter>,
  )
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

describe('Tools — the list', () => {
  it('links every catalogued tool to its own page, exactly once', () => {
    renderPage()
    const hrefs = [...document.querySelectorAll('a.tools-index__name')].map((a) => a.getAttribute('href'))
    expect(hrefs).toHaveLength(TOOLS.length)
    for (const tool of TOOLS) {
      expect(hrefs.filter((h) => h === `/guide/tools/${tool.id}`)).toHaveLength(1)
    }
  })

  it('is a list, not an accordion', () => {
    renderPage()
    expect(document.querySelectorAll('[aria-expanded]')).toHaveLength(0)
    expect(document.querySelector('.stage-tool-summary')).toBeNull()
  })

  it('marks the rows that have a form to fill in', () => {
    renderPage()
    const withForm = TOOLS.filter((t) => toolForms(t).length > 0).length
    expect(withForm).toBeGreaterThan(20)
    expect(screen.getAllByText('Form')).toHaveLength(withForm)
  })

  it('keeps every stage anchor, with a section heading under it', () => {
    renderPage()
    for (const stage of STAGES) {
      const section = document.getElementById(`stage-${stage.id}`)
      expect(section, `no element with id stage-${stage.id}`).not.toBeNull()
      expect(section!.querySelector('h3')?.textContent).toBe(stage.title)
    }
    // …and the jump list at the top points at each of them.
    const jumps = [...document.querySelectorAll('a.tools-index__stage-link')].map((a) => a.getAttribute('href'))
    expect(jumps).toEqual(STAGES.map((s) => `#/guide/tools#stage-${s.id}`))
  })

  it('names its reader first and keeps the prose before the first stage short', () => {
    renderPage()
    const lede = document.querySelector('.tools-index__lede')?.textContent ?? ''
    expect(lede.startsWith('If you are wiring SPiER into an EHR')).toBe(true)
    const before = ['.tools-index__lede', '.tools-index__aside']
      .map((sel) => document.querySelector(sel)?.textContent ?? '')
      .join(' ')
    expect(words(before)).toBeLessThanOrEqual(120)
    // The heading of the first stage is the first h3 on the page: nothing
    // sits between the intro and the catalogue.
    expect(document.querySelector('h3')?.textContent).toBe(STAGES[0].title)
  })

  it('links the two related sections as route literals', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Adoption Readiness' }).getAttribute('href')).toBe('/guide/tools/readiness')
    expect(screen.getByRole('link', { name: 'Care Pathway' }).getAttribute('href')).toBe('/guide/pathway')
  })

  it('keeps the stage triggers in drawers that start closed', () => {
    renderPage()
    const drawers = [...document.querySelectorAll('details.tools-index__handoff')]
    expect(drawers.length).toBeGreaterThan(0)
    for (const d of drawers) expect(d.hasAttribute('open')).toBe(false)
    expect(document.querySelectorAll('.tools-index__trigger').length).toBeGreaterThan(5)
  })

  it('renders no page header of its own — the guide layout draws it', () => {
    renderPage()
    expect(document.querySelector('.page-header')).toBeNull()
    expect(document.querySelector('h2')).toBeNull()
  })
})
