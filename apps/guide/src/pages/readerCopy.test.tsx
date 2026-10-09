/**
 * @vitest-environment jsdom
 *
 * What a guide reader is SHOWN carries no repo vocabulary — measured on the
 * rendered page, not on the source.
 *
 * `check:jargon` reads the guide's source strings, core's catalogue values and
 * the published documentation. None of those answers whether a page renders
 * the value it should: `ToolPage` printing `tool.copyright` raw instead of
 * `readerCopyright(tool.copyright)` changes no string anywhere, and put
 * `docs/instruments/ASQ/licensing/MEMO.md (issue #64)` in front of every
 * reader of a tool page until the 2026-10 gate audit. So this mounts the pages
 * whose prose comes from somewhere else — every catalogued tool’s page, the
 * Data Dictionary, the readiness table (whose tooltips carry each notice), the
 * two pathway pages — and runs the SAME rule list
 * (`scripts/lib/reader-jargon.mjs`) over everything they render, closed
 * drawers included: a reader can open a drawer.
 *
 * Excluded: `<pre>` and the FHIR JSON panel, which are the wire format shown
 * on purpose (a timestamp in a resource is not a repo date), and form controls.
 *
 * `check:jargon` runs this file, so that gate goes red when a page regresses.
 */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

vi.mock('@formbox/renderer', () => ({ default: () => <div data-testid="formbox-renderer" /> }))
vi.mock('@formbox/hs-theme', () => ({ theme: {} }))

import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TOOLS } from '@spier/core/data/catalog'
import { PatientProvider } from '@spier/app-shell/context/PatientProvider'
import { SmartContext } from '@spier/app-shell/context/SmartContext'
import { InspectContext } from '@spier/tool-views/context/InspectContext'
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import { repoJargonIn } from '../../../../scripts/lib/reader-jargon.mjs'
import { ToolPage } from './ToolPage'
import { DataDictionary } from './DataDictionary'
import { AdoptionReadiness } from './AdoptionReadiness'
import { CarePathway } from './CarePathway'
import { CarePathwayProtocol } from './CarePathwayProtocol'
import { EmergencyDepartmentPathway } from './EmergencyDepartmentPathway'
import { InpatientPathway } from './InpatientPathway'

afterEach(cleanup)

const realFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = realFetch
})

const SMART_STUB = {
  client: null,
  patient: null,
  error: null,
  setSmartData: () => {},
  setError: () => {},
}

/** Every text node a reader can reach, as runs, minus the wire-format panels. */
function readerRuns(root: Element): string[] {
  const runs: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim()
      if (t) runs.push(t)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (['SCRIPT', 'STYLE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT'].includes(el.tagName)) return
    if (el.classList.contains('fhir-viewer-panel')) return
    // A tooltip is read too — the readiness table puts a tool's notice in one.
    const title = el.getAttribute('title')
    if (title) runs.push(title)
    el.childNodes.forEach(walk)
  }
  walk(root)
  return runs
}

function hitsIn(root: Element): string[] {
  return readerRuns(root)
    .map((run) => ({ run, hit: repoJargonIn(run) }))
    .filter(({ hit }) => hit)
    .map(({ run, hit }) => `${hit!.rule} "${hit!.match}" in: ${run.slice(0, 140)}`)
}

function renderToolPage(ref: string) {
  return render(
    <MemoryRouter initialEntries={[`/guide/tools/${ref}`]}>
      <PresentationProvider initialMode="ehr">
        <SmartContext.Provider value={SMART_STUB}>
          <PatientProvider>
            <Routes>
              <Route path="/guide/tools/:toolRef" element={<ToolPage />} />
            </Routes>
          </PatientProvider>
        </SmartContext.Provider>
      </PresentationProvider>
    </MemoryRouter>,
  )
}

describe('what a tool page renders', () => {
  it('covers the catalogue', () => {
    expect(TOOLS.length).toBeGreaterThan(30)
    expect(TOOLS.filter((t) => t.copyright).length).toBeGreaterThan(10)
  })

  it.each(TOOLS.map((t) => [t.id] as const))('%s names none of this repo', async (id) => {
    const { container } = renderToolPage(id)
    await waitFor(() => expect(container.querySelector('.page-header')).not.toBeNull())
    // Liveness: the licensing drawer, where a notice is, did render.
    const tool = TOOLS.find((t) => t.id === id)!
    if (tool.copyright) expect(container.querySelector('.tool-page__licence')?.textContent?.length).toBeGreaterThan(40)
    expect(hitsIn(container)).toEqual([])
  })
})

const PAGES: [string, string, () => ReactElement][] = [
  ['data-dictionary', '/guide/data-dictionary', DataDictionary],
  // Each tool's licensing notice is this table's tooltip.
  ['tools/readiness', '/guide/tools/readiness', AdoptionReadiness],
  ['pathway', '/guide/pathway', CarePathway],
  ['pathway/protocol', '/guide/pathway/protocol', CarePathwayProtocol],
  // The setting pathways render their PlanDefinition's prose, like the protocol page.
  ['pathway/emergency-department', '/guide/pathway/emergency-department', EmergencyDepartmentPathway],
  ['pathway/inpatient', '/guide/pathway/inpatient', InpatientPathway],
]

describe('what the pages that render core prose show', () => {
  it.each(PAGES)('%s names none of this repo', (_name, path, Page) => {
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <InspectContext.Provider value>
          <Page />
        </InspectContext.Provider>
      </MemoryRouter>,
    )
    expect(readerRuns(container).length, 'the page rendered nothing').toBeGreaterThan(50)
    expect(hitsIn(container)).toEqual([])
  })
})
