/**
 * @vitest-environment jsdom
 *
 * One catalogued tool as a page (adoption-guide UX audit §4.3, 2026-09-20).
 *
 * The properties a later edit could quietly undo, pinned:
 *
 *  1. **One header, the page's.** The shared views draw their own on the
 *     clinician's routes; here the page draws it and the view must not, or
 *     the page has two titles. Asserted as a count over the rendered DOM,
 *     which is the thing `check:template`'s text scan cannot see.
 *  2. **The form is first, with the FHIR beside it.** The recorder's lede
 *     survives the move into the card; the code drawer renders because the
 *     page provides inspection itself.
 *  3. **The three kinds of tool.** A recorder, a tool with no form, and the
 *     CAMS SSF-5 with three forms and a picker.
 *  4. **One tool, one address.** A form slug in the URL — the retired try
 *     route's key — redirects to the owning tool's page.
 *  5. **The shared form is honest about it.** A tool whose recorder four tools
 *     share names the other three.
 *
 * ⚠️ **The instrument fillers render `@formbox/renderer`, which does not load
 * under vitest** — its bundle imports a `fhirpath/fhir-context/r4` DIRECTORY,
 * which Node's ESM resolver refuses, and no test in this repo renders a filler
 * for that reason. The renderer is mocked to an empty element here, so the
 * CAMS case can assert the picker and wait for the form FRAME (`.form-view`,
 * which is `QuestionnaireView`'s and not the renderer's) without ever loading
 * the vendor component. A recorder needs no mock; the caring-contact cases
 * render the real one.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('@formbox/renderer', () => ({ default: () => <div data-testid="formbox-renderer" /> }))
vi.mock('@formbox/hs-theme', () => ({ theme: {} }))

import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { stageById, toolById } from '@spier/core/data/catalog'
import { PatientProvider } from '@spier/app-shell/context/PatientProvider'
import { SmartContext } from '@spier/app-shell/context/SmartContext'
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import { ToolPage } from './ToolPage'
import { MOCK_EHR_URL } from '../data/surfaces'
import { toolsSharingForm } from '../data/toolForms'

afterEach(cleanup)

/** No SMART session, which is the guide's state: the provider reads it, nothing here launches one. */
const SMART_STUB = {
  client: null,
  patient: null,
  error: null,
  setSmartData: () => {},
  setError: () => {},
}

/** Where the router is now, for the redirect cases. */
function LocationProbe() {
  const { pathname, search } = useLocation()
  return <span data-testid="location">{pathname + search}</span>
}

/**
 * The page under the providers the app gives it. `PatientProvider` unseeded,
 * as the guide's is, over a stub SMART context (no launch); `PresentationProvider`
 * in EHR chrome, so the code drawer is the aside beside the form. The page
 * provides inspection, the surface links and header ownership itself — that
 * is the thing under test.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PresentationProvider initialMode="ehr">
        <SmartContext.Provider value={SMART_STUB}>
          <PatientProvider>
            <Routes>
              <Route path="/guide/tools/:toolRef" element={<ToolPage />} />
              <Route path="/guide/tools" element={<p>the Tools list</p>} />
            </Routes>
            <LocationProbe />
          </PatientProvider>
        </SmartContext.Provider>
      </PresentationProvider>
    </MemoryRouter>,
  )
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
const location = () => screen.getByTestId('location').textContent

describe('ToolPage — a recorder (TL-010, caring contact)', () => {
  const tool = toolById('TL-010')!

  it('draws exactly one page header, and it names the tool', async () => {
    renderAt('/guide/tools/TL-010')
    await waitFor(() => expect(document.querySelector('.form-view')).not.toBeNull())
    expect(document.querySelectorAll('h2')).toHaveLength(1)
    expect(document.querySelectorAll('.page-header')).toHaveLength(1)
    expect(document.querySelector('h2')?.textContent).toBe(tool.name)
    expect(document.querySelector('.page-header__lede')?.textContent).toBe(tool.purpose)
    // The trail: "← Tools / <stage>", with Tools the way back.
    const up = screen.getByRole('link', { name: /Tools/ })
    expect(up.getAttribute('href')).toBe('/guide/tools')
    expect(document.querySelector('.page-header__eyebrow')?.textContent).toContain(stageById(tool.stageId)!.title)
  })

  it('puts the form first, keeps the recorder’s lede inside the card, and shows the FHIR beside it', async () => {
    renderAt('/guide/tools/TL-010')
    await waitFor(() => expect(document.querySelector('.form-view')).not.toBeNull())
    // The view drew no header of its own — its lede moved into the card.
    expect(document.querySelector('.form-view .page-header')).toBeNull()
    expect(document.querySelector('.form-card .workflow-form__lede')?.textContent?.length).toBeGreaterThan(20)
    // Inspection is on: the code drawer renders as the aside, with the draft.
    expect(document.querySelector('.debug-sidebar')).not.toBeNull()
    // The form section precedes the detail in document order.
    const form = document.querySelector('.tool-page__form')!
    const about = document.querySelector('.tool-page__about')!
    expect(form.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the catalogue detail in closed drawers, and says little above the form', async () => {
    renderAt('/guide/tools/TL-010')
    await waitFor(() => expect(document.querySelector('.form-view')).not.toBeNull())
    const summaries = [...document.querySelectorAll('.disclosure__label')].map((s) => s.textContent)
    expect(summaries[0]).toBe('What it is for')
    if (tool.recordingPattern) expect(summaries).toContain('What it records')
    if (tool.licensing) expect(summaries).toContain('Licensing')
    for (const d of document.querySelectorAll('details.disclosure')) expect(d.hasAttribute('open')).toBe(false)
    // §5 rule 4: a tool page's prose above the form is ≤ 150 words.
    const above = ['.page-header', '.tool-page__meta']
      .map((sel) => document.querySelector(sel)?.textContent ?? '')
      .join(' ')
    expect(words(above)).toBeLessThanOrEqual(150)
  })

  it('offers the Demo EHR as the one way onward, in a new tab', async () => {
    renderAt('/guide/tools/TL-010')
    await waitFor(() => expect(document.querySelector('.form-view')).not.toBeNull())
    const cta = screen.getByRole('link', { name: /Open the Demo EHR/ })
    expect(cta.getAttribute('href')).toBe(MOCK_EHR_URL)
    expect(cta.getAttribute('target')).toBe('_blank')
  })
})

describe('ToolPage — a tool with no form', () => {
  it('says so for a step that is not built, and still shows what it will record (TL-037)', () => {
    renderAt('/guide/tools/TL-037')
    expect(document.querySelectorAll('h2')).toHaveLength(1)
    expect(screen.getByText(/No form to try yet/)).toBeDefined()
    expect(document.querySelector('.form-view')).toBeNull()
    expect(screen.getByText('What it records')).toBeDefined()
    // With nothing to try here, the Demo EHR is the page's lead action.
    expect(screen.getByRole('link', { name: /Open the Demo EHR/ }).className).toContain('button--primary')
  })

  it('says where a caseload-reading step runs (TL-043, the dashboard)', () => {
    renderAt('/guide/tools/TL-043')
    expect(screen.getByText(/reads a caseload/)).toBeDefined()
    expect(document.querySelector('.form-view')).toBeNull()
  })
})

describe('ToolPage — the CAMS SSF-5 (TL-020), three forms', () => {
  it('offers a picker and shows the first form by default', async () => {
    renderAt('/guide/tools/TL-020')
    const picker = screen.getByRole('navigation', { name: 'Forms of this tool' })
    const buttons = [...picker.querySelectorAll('a')]
    expect(buttons.map((b) => b.getAttribute('href'))).toEqual([
      '/guide/tools/TL-020?form=cams-section-a',
      '/guide/tools/TL-020?form=cams-section-b',
      '/guide/tools/TL-020?form=cams-outcome-disposition',
    ])
    expect(buttons[0].className).toContain('button--primary')
    expect(buttons[1].className).toContain('button--secondary')
    await waitFor(() => expect(document.querySelector('.form-view')).not.toBeNull())
    expect(document.querySelectorAll('h2')).toHaveLength(1)
  })

  it('selects the form ?form= asks for', () => {
    renderAt('/guide/tools/TL-020?form=cams-section-b')
    const picker = screen.getByRole('navigation', { name: 'Forms of this tool' })
    const buttons = [...picker.querySelectorAll('a')]
    expect(buttons[1].className).toContain('button--primary')
    expect(buttons[0].className).toContain('button--secondary')
  })
})

describe('ToolPage — one tool, one address', () => {
  it('redirects a form slug to the owning tool’s page', () => {
    renderAt('/guide/tools/asq')
    expect(location()).toBe('/guide/tools/TL-001')
  })

  it('carries a CAMS form slug across as the selected form', () => {
    renderAt('/guide/tools/cams-section-b')
    expect(location()).toBe('/guide/tools/TL-020?form=cams-section-b')
  })

  it('accepts a lower-case tool id', () => {
    renderAt('/guide/tools/tl-037')
    expect(screen.getByText(/No form to try yet/)).toBeDefined()
  })

  it('says where to go for a name that is not a tool', () => {
    renderAt('/guide/tools/not-a-tool')
    expect(screen.getByText(/Nothing is catalogued under that name/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Back to Tools' }).getAttribute('href')).toBe('/guide/tools')
  })
})

describe('ToolPage — a form four tools share (TL-039, safety tasks)', () => {
  it('names the other three, each a link to its own page', async () => {
    renderAt('/guide/tools/TL-039')
    await waitFor(() => expect(document.querySelector('.form-view')).not.toBeNull())
    const others = toolsSharingForm('safety-tasks').filter((t) => t.id !== 'TL-039')
    expect(others).toHaveLength(3)
    const para = document.querySelector('.tool-page__siblings')!
    expect(para.textContent).toMatch(/^The same form records /)
    const hrefs = [...para.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(others.map((t) => `/guide/tools/${t.id}`))
  })
})
