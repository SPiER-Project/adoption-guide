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
 * reader of a tool page until the 2026-10 gate audit. So this runs the SAME
 * rule list AND the same repo-identifier index (`scripts/lib/reader-jargon.mjs`)
 * over everything a page renders, closed drawers included: a reader can open a
 * drawer.
 *
 * ⚠️ **Every guide page, through the real app — not a list of the pages whose
 * prose comes from somewhere else.** Until 2026-10-09 this mounted five pages
 * and the tool pages, each on its own, chosen because they render core's
 * values. A name a page ASSEMBLES at runtime (`['Smart', 'DataSource'].join('')`)
 * is invisible to the source scan, which reads it as two harmless halves, so on
 * the other seven pages it passed both halves of the gate. Now the guide's own
 * `App` — its route table, its `AdoptionGuide` layout, the shell's chrome — is
 * mounted at every path `GUIDE_SECTIONS` declares, at `/overview`, and at every
 * catalogued tool's page, and a probe asserts each one LANDED there: a route
 * that redirected to the front door would otherwise be read as the front door
 * and pass.
 *
 * ⚠️ **The page list is derived, and that is the point.** `GUIDE_SECTIONS` is
 * the file `check:catalog` holds to the route table and `pageLength.test.tsx`
 * holds to a budget; a page that is not in it is checked by nothing, and this
 * adds no hand list of its own for a new page to be left off.
 *
 * Excluded: `<pre>` and the FHIR JSON panel, which are the wire format shown
 * on purpose (a timestamp in a resource is not a repo date), and form controls.
 *
 * What it still cannot see: text a page renders only after an INTERACTION — a
 * submitted form's result, a simulator state other than the initial one, an
 * error a reader triggers. Those get the source scan, and the source scan reads
 * a computed string in its literal halves.
 *
 * `check:jargon` runs this file, so that gate goes red when a page regresses.
 */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

vi.mock('@formbox/renderer', () => ({ default: () => <div data-testid="formbox-renderer" /> }))
vi.mock('@formbox/hs-theme', () => ({ theme: {} }))

import { MemoryRouter, useLocation } from 'react-router-dom'
import { TOOLS } from '@spier/core/data/catalog'
import { indexRepoIdentifiers, repoJargonIn } from '../../../../scripts/lib/reader-jargon.mjs'
import { GUIDE_SECTIONS } from '../data/guideSections'
import App from '../App'

afterEach(cleanup)

// jsdom implements neither; the shell's scroll-to-hash hook calls both on every
// route change (AppShell.test.tsx stubs them the same way).
Element.prototype.scrollTo = () => {}
window.scrollTo = () => {}

/** Built once: the same index check:jargon builds, FHIR and artifact names subtracted. */
const IDENTIFIERS = indexRepoIdentifiers()

const realFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = realFetch
})

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
    .map((run) => ({ run, hit: repoJargonIn(run, IDENTIFIERS.all) }))
    .filter(({ hit }) => hit)
    .map(({ run, hit }) => `${hit!.rule} "${hit!.match}" in: ${run.slice(0, 140)}`)
}

/** Where the router ended up — a redirect is a page this did not read. No text, so no reader run. */
function LocationProbe() {
  return <span data-testid="landed-on" data-path={useLocation().pathname} hidden />
}

/** The guide app, mounted at `path` exactly as a reader's browser would reach it. */
async function mountGuide(path: string) {
  const { container, getByTestId } = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
  // ⚠️ Settled means the page header is up AND no Suspense fallback is left.
  // The pages are lazy, and a tool's form is a second lazy chunk inside the
  // page; reading at the first header races it, which is how two Questionnaire
  // descriptions citing an issue number and a licensing memo went unread.
  await waitFor(
    () => {
      expect(container.querySelector('.app-shell__body .page-header')).not.toBeNull()
      expect(container.querySelector('.route-loading')).toBeNull()
    },
    { timeout: 5000 },
  )
  const landedOn = getByTestId('landed-on').dataset.path
  expect(landedOn, `${path} redirected to ${landedOn} — this read a different page`).toBe(path)
  return container
}

/**
 * Every page a reader can reach, from the section list: `/overview`, each
 * section and subsection, and `tools/:toolRef` once per catalogued tool.
 */
const TOOL_ROUTE = 'tools/:toolRef'

/** Half the 16 tool pages that rendered an instrument header on the day this landed (2026-10-09). */
const INSTRUMENT_HEADER_FLOOR = 8
const SECTION_PATHS = GUIDE_SECTIONS.flatMap((s) => [s.path, ...(s.subsections ?? []).map((x) => x.path)])
const PAGE_PATHS = ['/overview', ...SECTION_PATHS.filter((p) => p !== TOOL_ROUTE).map((p) => `/guide/${p}`)]

describe('the repo-identifier index and the page list', () => {
  // Liveness: an empty index would make every page below pass the identifier
  // rule. Halved from check:jargon's live counts (541 camelCase, 370 PascalCase).
  it('the index was built', () => {
    expect(IDENTIFIERS.camel.size).toBeGreaterThan(270)
    expect(IDENTIFIERS.pascal.size).toBeGreaterThan(185)
    expect(IDENTIFIERS.fhirTypeNames.size).toBeGreaterThan(94)
  })

  // Halved from the day this landed: 12 pages and 39 tools.
  it('covers every section, and the tool route', () => {
    expect(PAGE_PATHS.length).toBeGreaterThan(6)
    expect(SECTION_PATHS).toContain(TOOL_ROUTE)
    expect(TOOLS.length).toBeGreaterThan(19)
    expect(TOOLS.filter((t) => t.copyright).length).toBeGreaterThan(10)
  })
})

describe('what every guide page renders', () => {
  it.each(PAGE_PATHS)('%s names none of this repo', async (path) => {
    const container = await mountGuide(path)
    expect(readerRuns(container).length, 'the page rendered nothing').toBeGreaterThan(50)
    expect(hitsIn(container)).toEqual([])
  })
})

describe('what every tool page renders', () => {
  /** Tool pages whose form loaded far enough to show the instrument's header. */
  let instrumentHeaders = 0

  it.each(TOOLS.map((t) => [t.id] as const))('%s names none of this repo', async (id) => {
    const container = await mountGuide(`/guide/tools/${id}`)
    if (container.querySelector('.instrument-header')) instrumentHeaders++
    // Liveness: the licensing drawer, where a notice is, did render.
    const tool = TOOLS.find((t) => t.id === id)!
    if (tool.copyright) expect(container.querySelector('.tool-page__licence')?.textContent?.length).toBeGreaterThan(40)
    expect(hitsIn(container)).toEqual([])
  })

  // Liveness for the lazy form: a Questionnaire filler renders an instrument
  // header, with the published description in its drawer. Halved from the
  // count on the day this landed; a form that never left its fallback would
  // otherwise pass every assertion above by showing nothing.
  it('read the Questionnaire fillers, not their loading fallback', () => {
    expect(instrumentHeaders).toBeGreaterThanOrEqual(INSTRUMENT_HEADER_FLOOR)
  })
})
