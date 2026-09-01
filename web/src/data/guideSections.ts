// Single source of truth for the Adoption Guide's sections. The sidebar's
// /guide children, the AdoptionGuide page header/title, and its prev/next pager
// all derive from this ordered list, so they can never drift out of sync.
//
// The matching routes are declared in App.tsx (each section maps to its own
// lazy-loaded page component); keep the `path` values here aligned with those
// route paths under /guide.
//
// Sections are additionally bucketed into three GUIDE_GROUPS, because the eight
// sections are not eight of the same kind of thing: some explain concepts, two
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
  /** Route segment under /guide, e.g. 'tools' → /guide/tools. */
  path: string
  /** Label shown in the sidebar, the page title, and the pager. */
  label: string
  /** Which GUIDE_GROUPS bucket this section belongs to. */
  group: GuideGroupId
}

/**
 * Reading order of the guide, top to bottom. Grouped-contiguous — see above.
 *
 * 'overview' is deliberately absent. It used to open the Learn group, but it
 * merged with the old standalone front door and moved up to the top-level
 * /overview lens, so it is no longer a section of the guide. /guide and
 * /guide/overview both still resolve — see the routes in App.tsx.
 */
export const GUIDE_SECTIONS: GuideSection[] = [
  // Learn — read-only concepts and reference. Nothing here has side effects.
  //
  // Care Pathway and Tools are two surfaces because they answer two questions
  // that were previously answered by one page. Care Pathway is the *protocol*:
  // it renders PlanDefinition/SPiERSuicideSaferCarePathway — screen, gate,
  // assess, branch by tier — from the published artifact, so what the page says
  // and what SPiER publishes cannot drift. Tools is the *catalogue*: which
  // instruments and recorders exist, grouped by the eight pathway stages, with
  // launch paths into the Patient View.
  //
  // ⚠️ `pathway` is a REPURPOSED path, not a new one. It served the tool
  // catalogue until Phase 3 of docs/plans/suicide-safer-care-pathway.md; the
  // catalogue moved to `tools` and `/guide/pathway#stage-…` deep links are
  // forwarded there by CarePathway.tsx.
  { path: 'pathway', label: 'Care Pathway', group: 'learn' },
  { path: 'tools', label: 'Tools', group: 'learn' },
  { path: 'data-dictionary', label: 'Data Dictionary', group: 'learn' },
  // 'measures' is deliberately absent. It moved to the EHR side as
  // /population/measures (step D, #391): it was the one guide section that read
  // patient data, and measures over a caseload belong beside the caseload —
  // which is also where they would sit in a real deployment. /guide/measures
  // still redirects, because it is a published tool launch path.
  // Configure — the two sections that wire an implementation up. Tool
  // Configuration writes ToolConfigContext, which gates the Patient View's
  // launch actions; CDS Service probes the live hosted endpoint.
  { path: 'tool-configuration', label: 'Tool Configuration', group: 'configure' },
  { path: 'cds-service', label: 'CDS Service', group: 'configure' },
  // Evaluate — scoring where an adopter (or SPiER itself) actually stands.
  { path: 'adoption-readiness', label: 'Adoption Readiness', group: 'evaluate' },
  { path: 'adoption-rubric', label: 'Adoption Rubric', group: 'evaluate' },
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
