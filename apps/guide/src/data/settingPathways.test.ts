import { describe, expect, it } from 'vitest'
import { loadPathway } from '@spier/core/lib/pathway'
import { GUIDE_SECTIONS } from './guideSections'
import { SETTING_PATHWAY_PAGES } from './settingPathways'

/**
 * Which settings exist is the core protocol's (`relatedArtifact #composed-of`);
 * where each one's page lives is settingPathways.ts; the sidebar's subsection
 * labels are guideSections.ts; the route is App.tsx. Four places, so each pair
 * that can drift is asserted, both ways where both ways can go wrong — except
 * the route, which `check:guide-boundary` already holds: it reads every
 * guideSections subsection's route element off App.tsx and fails one it cannot
 * find.
 */
const core = loadPathway()
const pathwaySection = GUIDE_SECTIONS.find(s => s.path === 'pathway')!

describe('the guide has a page for exactly the settings the core protocol names', () => {
  it('reads some settings at all', () => {
    expect(core.settingPathways.length).toBeGreaterThan(0)
  })

  it.each(core.settingPathways.map(s => [s.label, s.resource] as const))(
    'the artifact names %s, and the guide has its page',
    (_label, url) => {
      expect(SETTING_PATHWAY_PAGES.map(p => p.canonical)).toContain(url)
    },
  )

  it.each(SETTING_PATHWAY_PAGES.map(p => [p.path, p.canonical] as const))(
    'the guide has a page at %s, and the artifact names its setting',
    (_path, url) => {
      expect(core.settingPathways.map(s => s.resource)).toContain(url)
    },
  )
})

describe('each page is wired', () => {
  it.each(SETTING_PATHWAY_PAGES.map(p => [p.path, p] as const))('%s', (_path, page) => {
    expect(page.href).toBe(`/guide/${page.path}`)
    // The sidebar's subsection carries the same label — it is the page's title.
    expect(pathwaySection.subsections).toContainEqual(expect.objectContaining({ path: page.path, label: page.label }))
    // And it is in the sidebar, nested under Care Pathway.
    expect(pathwaySection.subsections?.find(s => s.path === page.path)?.nav).toBeTruthy()
  })
})
