// Single source of truth for the Adoption Guide's sections. The sidebar's
// /guide children, the AdoptionGuide page header/title, and its prev/next pager
// all derive from this ordered list, so they can never drift out of sync.
//
// The matching routes are declared in App.tsx (each section maps to its own
// lazy-loaded page component); keep the `path` values here aligned with those
// route paths under /guide.

export interface GuideSection {
  /** Route segment under /guide, e.g. 'pathway' → /guide/pathway. */
  path: string
  /** Label shown in the sidebar, the page title, and the pager. */
  label: string
}

/**
 * Reading order of the guide, top to bottom.
 *
 * 'overview' is deliberately absent: it merged with the old standalone front
 * door and moved up to the top-level /overview lens, so it is no longer a
 * section of the guide. /guide and /guide/overview both still resolve — see
 * the routes in App.tsx.
 */
export const GUIDE_SECTIONS: GuideSection[] = [
  { path: 'pathway', label: 'Pathway' },
  { path: 'tool-configuration', label: 'Tool Configuration' },
  { path: 'data-dictionary', label: 'Data Dictionary' },
  { path: 'measures', label: 'Measures' },
  { path: 'cds-service', label: 'CDS Service' },
  { path: 'adoption-readiness', label: 'Adoption Readiness' },
  { path: 'adoption-rubric', label: 'Adoption Rubric' },
  { path: 'roadmap', label: 'Roadmap' },
]

export const GUIDE_BASE = '/guide'

/** Absolute HashRouter path for a guide section. */
export function guideHref(path: string): string {
  return `${GUIDE_BASE}/${path}`
}
