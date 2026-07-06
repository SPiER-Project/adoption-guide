// Single source of truth for the Adoption Guide's sections. The sidebar's
// /guide children, the AdoptionGuide page header/title, and its prev/next pager
// all derive from this ordered list, so they can never drift out of sync.
//
// The matching routes are declared in App.tsx (each section maps to its own
// lazy-loaded page component); keep the `path` values here aligned with those
// route paths under /guide.

export interface GuideSection {
  /** Route segment under /guide, e.g. 'overview' → /guide/overview. */
  path: string
  /** Label shown in the sidebar, the page title, and the pager. */
  label: string
}

/** Reading order of the guide, top to bottom. */
export const GUIDE_SECTIONS: GuideSection[] = [
  { path: 'overview', label: 'Overview' },
  { path: 'pathway', label: 'Pathway' },
  { path: 'tool-configuration', label: 'Tool Configuration' },
  { path: 'data-dictionary', label: 'Data Dictionary' },
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
