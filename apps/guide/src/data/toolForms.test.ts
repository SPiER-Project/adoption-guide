import { describe, it, expect } from 'vitest'
import { TOOLS, toolById } from '@spier/core/data/catalog'
import { TOOL_VIEWS, isToolViewSlug } from '@spier/tool-views/data/toolViews'
import { guideFormHref, guideToolHref, toolForFormSlug, toolForms, toolsSharingForm } from './toolForms'

/**
 * The tool ↔ form relation the guide's tool pages are built on.
 *
 * ⚠️ **The property worth gating is that folding the try route into the tool
 * pages left no form unreachable.** `/guide/tools/:slug/try` rendered any of
 * the 29 `TOOL_VIEWS` by slug; a tool page renders the forms its catalog launch
 * actions name. If a view's slug appeared in no tool's launch path, that form
 * would have been reachable yesterday and reachable nowhere on the guide today
 * — and nothing else compares the two lists on this axis (`check:tool-view-routes`
 * compares the map to the CLINICAL route table).
 *
 * The many-to-many cases are pinned by shape rather than by count, so adding a
 * tool does not fail here while collapsing a relation does.
 */
describe('toolForms', () => {
  it('names only forms the shared view map renders, each once per tool', () => {
    for (const tool of TOOLS) {
      const slugs = toolForms(tool).map((f) => f.slug)
      for (const slug of slugs) expect(isToolViewSlug(slug)).toBe(true)
      expect(new Set(slugs).size).toBe(slugs.length)
    }
  })

  it('reaches every shared view from some tool page — nothing the try route showed is orphaned', () => {
    for (const slug of Object.keys(TOOL_VIEWS)) {
      const owner = toolForFormSlug(slug)
      expect(owner, `no tool's launch actions name the form "${slug}"`).toBeDefined()
      expect(toolForms(owner!).some((f) => f.slug === slug)).toBe(true)
    }
  })

  it('gives the CAMS SSF-5 several forms and most tools one', () => {
    expect(toolForms(toolById('TL-020')!).map((f) => f.slug)).toEqual([
      'cams-section-a',
      'cams-section-b',
      'cams-outcome-disposition',
    ])
    expect(toolForms(toolById('TL-001')!).map((f) => f.slug)).toEqual(['asq'])
  })

  it('has no form for a tool with no launch action, or whose launch path the guide does not render', () => {
    // The registry is a query, not a form; the dashboard runs over a caseload.
    expect(toolForms(toolById('TL-037')!)).toEqual([])
    expect(toolForms(toolById('TL-043')!)).toEqual([])
  })
})

describe('a form shared by several tools', () => {
  it('is owned by the first of them in catalog order, and every sharer is listed', () => {
    const sharers = toolsSharingForm('safety-tasks')
    expect(sharers.map((t) => t.id)).toEqual(['TL-036', 'TL-039', 'TL-040', 'TL-041'])
    expect(toolForFormSlug('safety-tasks')?.id).toBe(sharers[0].id)
    // Catalog order is stage, then core before optional, then id — so the
    // outreach recorder's "escalate this case" lands on the follow-up
    // escalation workflow, which is the tool that sentence is about.
    expect(toolForFormSlug('safety-tasks')?.id).toBe('TL-036')
  })
})

describe('guide hrefs', () => {
  it('addresses a tool by its published id', () => {
    expect(guideToolHref('TL-001')).toBe('/guide/tools/TL-001')
  })

  it('selects a form with ?form= only where the tool has more than one', () => {
    expect(guideFormHref('asq')).toBe('/guide/tools/TL-001')
    expect(guideFormHref('cams-section-b')).toBe('/guide/tools/TL-020?form=cams-section-b')
    expect(guideFormHref('not-a-form')).toBeNull()
  })
})
