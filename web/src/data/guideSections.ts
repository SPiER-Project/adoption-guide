// Single source of truth for the Adoption Guide's sections. The sidebar's
// /guide children, the AdoptionGuide page header/title, and its prev/next pager
// all derive from this ordered list, so they can never drift out of sync.
//
// The matching routes are declared in App.tsx (each section maps to its own
// lazy-loaded page component); keep the `path` values here aligned with those
// route paths under /guide.
//
// Sections are additionally bucketed into three GUIDE_GROUPS, because the nine
// sections are not nine of the same kind of thing: some explain concepts, two
// carry live state that changes what *another lens* does, and the rest score an
// organization's readiness. The sidebar renders a heading per group and the page
// header names the active section's group.
//
// ⚠️ The flat order below must stay grouped-contiguous — all of one group's
// sections together, in GUIDE_GROUPS order. The pager walks this list linearly,
// so an out-of-place section would make prev/next bounce between groups.

/** Ordered categories the sections fall into. */
export type GuideGroupId = 'learn' | 'configure' | 'evaluate'

export interface GuideGroup {
  id: GuideGroupId
  /** Heading shown above the group's sections in the sidebar. */
  label: string
}

/** Reading order of the groups, top to bottom. */
export const GUIDE_GROUPS: GuideGroup[] = [
  { id: 'learn', label: 'Learn' },
  { id: 'configure', label: 'Configure' },
  { id: 'evaluate', label: 'Evaluate' },
]

export interface GuideSection {
  /** Route segment under /guide, e.g. 'overview' → /guide/overview. */
  path: string
  /** Label shown in the sidebar, the page title, and the pager. */
  label: string
  /** Which GUIDE_GROUPS bucket this section belongs to. */
  group: GuideGroupId
}

/** Reading order of the guide, top to bottom. Grouped-contiguous — see above. */
export const GUIDE_SECTIONS: GuideSection[] = [
  // Learn — read-only concepts and reference. Nothing here has side effects.
  { path: 'overview', label: 'Overview', group: 'learn' },
  { path: 'pathway', label: 'Pathway', group: 'learn' },
  { path: 'data-dictionary', label: 'Data Dictionary', group: 'learn' },
  { path: 'measures', label: 'Measures', group: 'learn' },
  // Configure — the two sections that wire an implementation up. Tool
  // Configuration writes ToolConfigContext, which gates the Patient View's
  // launch actions; CDS Service probes the live hosted endpoint.
  { path: 'tool-configuration', label: 'Tool Configuration', group: 'configure' },
  { path: 'cds-service', label: 'CDS Service', group: 'configure' },
  // Evaluate — scoring where an adopter (or SPiER itself) actually stands.
  { path: 'adoption-readiness', label: 'Adoption Readiness', group: 'evaluate' },
  { path: 'adoption-rubric', label: 'Adoption Rubric', group: 'evaluate' },
  { path: 'roadmap', label: 'Roadmap', group: 'evaluate' },
]

export const GUIDE_BASE = '/guide'

/** Absolute HashRouter path for a guide section. */
export function guideHref(path: string): string {
  return `${GUIDE_BASE}/${path}`
}

/** Display label for a group id, for the page header's eyebrow. */
export function guideGroupLabel(id: GuideGroupId): string {
  return GUIDE_GROUPS.find(g => g.id === id)?.label ?? id
}
