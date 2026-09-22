import { STAGES, TOOLS } from '@spier/core/data/catalog'
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

/**
 * Launch path → the pathway stage the tool it launches sits at.
 *
 * Derived from the catalog, which derives it from the FSH — the same chain
 * `check:catalog` already holds. A hand map here would be 29 chances to state a
 * stage that the published protocol does not agree with.
 */
const STAGE_BY_LAUNCH_PATH = new Map<string, string>()
for (const tool of TOOLS) {
  for (const action of tool.launchActions) {
    if (!STAGE_BY_LAUNCH_PATH.has(action.path)) STAGE_BY_LAUNCH_PATH.set(action.path, tool.stageId)
  }
}

/**
 * The trail above a form on the clinician's surface: `Care pathway / Step 4`.
 *
 * ⚠️ **This replaced `← PATIENT CHART`** (Brad, 2026-09-22), which was a back
 * button rather than a trail: on a recorder four levels down it named the chart
 * and said nothing about the levels between. The step is a link to the stage's
 * own page, so the trail is navigable rather than decorative.
 *
 * ⚠️ **A path this cannot place gets the chart alone**, not a guessed step. A
 * form reached from somewhere the catalog does not describe is exactly the case
 * where an invented breadcrumb misleads.
 *
 * ⚠️ The two hrefs are literals `check:surface-links` reads (RULE 1), which is
 * why the stage page's path is written out here rather than assembled from
 * `STAGES`.
 */
function clinicalTrail(pathname: string): Array<{ label: string; to: string }> {
  const trail = [{ label: 'Care pathway', to: '/patient/record' }]
  // The launch path may carry a query (`cams-section-a?tool=…`); match the path.
  const stageId = STAGE_BY_LAUNCH_PATH.get(pathname)
  const index = STAGES.findIndex(s => s.id === stageId)
  if (index >= 0) {
    trail.push({ label: `Step ${index + 1}`, to: `/patient/pathway/${STAGES[index].id}` })
  }
  return trail
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
  trailFor: clinicalTrail,
}
