import { TOOLS } from '@spier/core/data/catalog'
import type { SurfaceLinks } from '@spier/tool-views/context/SurfaceLinksContext'
import { launchSlug } from '@spier/tool-views/lib/launchSlug'

/**
 * Where the shared form views link on the clinical surface.
 *
 * The chart and the caseload are this app's own routes. A tool view's route is
 * its **catalog launch path** — the published path every CDS card's
 * `type: "smart"` link and every SMART `intent` resolve to — read from the
 * catalog rather than restated, so a renamed launch path moves these links
 * with it. `check:catalog` already asserts every launch path resolves here.
 *
 * ⚠️ The three literals below are what `check:surface-links` checks against
 * THIS app's route table (its RULE 1 reads `…Href: '/…'` properties for that
 * reason). They used to live in `packages/tool-views`, where the gate could
 * not tell which surface they were meant for — see `SurfaceLinksContext`.
 */
const LAUNCH_PATH_BY_SLUG = new Map<string, string>()
for (const tool of TOOLS) {
  for (const action of tool.launchActions) {
    const slug = launchSlug(action.path)
    // First declaration wins: `cams-section-a` is launched with and without a
    // `?tool=` query, and a view linking to it by slug wants the plain one.
    if (slug && !LAUNCH_PATH_BY_SLUG.has(slug)) LAUNCH_PATH_BY_SLUG.set(slug, action.path)
  }
}

export const CLINICAL_SURFACE_LINKS: SurfaceLinks = {
  parent: { label: 'Patient Chart', href: '/patient/record' },
  // "Back to chart", the second half of a form's confirmation beat. It has
  // pointed at three things in two days and the third is the settled one:
  // `/patient/record#activity` (an anchor on the rail, which is where the
  // thing just recorded was NOT), then *What's on file* in PR 5, and now the
  // LANDING SCREEN — because what a clinician wants after recording something
  // is not the row proving it saved but the next instruction, with the pathway
  // visibly advanced past the step they just satisfied (audit §4.6). *What's
  // on file* is one tap from there, which is what it is for.
  chartHref: '/patient/record',
  registryHref: '/population/caseload',
  launchHref: (slug) => LAUNCH_PATH_BY_SLUG.get(slug) ?? null,
}
