import type { SurfaceLinks } from '@spier/tool-views/context/SurfaceLinksContext'
import { isToolViewSlug } from '@spier/tool-views/data/toolViews'
import { launchSlug } from '@spier/tool-views/lib/launchSlug'
import { guideHref } from './guideSections'

/**
 * Where the shared form views link on the guide.
 *
 * The guide has no chart and no caseload — it explains and hosts; the mock EHR
 * holds and launches (CLAUDE.md) — so both are `null` and the views render no
 * "View in chart" and no registry link here. A tool view's route is the guide's
 * own `/guide/tools/<slug>/try`, and its parent is the Tools catalogue.
 *
 * `isToolViewSlug` is what keeps this from minting a link to a slug nothing
 * renders: a launch path the view map does not cover gets `null`, and the
 * caller shows text rather than a dead link.
 */
export const GUIDE_SURFACE_LINKS: SurfaceLinks = {
  parent: { label: 'Tools', href: guideHref('tools') },
  chartHref: null,
  registryHref: null,
  launchHref: (slug) => (isToolViewSlug(slug) ? `/guide/tools/${slug}/try` : null),
}

/**
 * The guide's route for a catalog launch path, or `null` when the guide
 * renders nothing under that path's slug (`/population/measures` is the one
 * case today). Used by the Tools catalogue and Adoption Readiness, which hold
 * launch paths rather than slugs.
 */
export function guideTryHref(launchPath: string): string | null {
  const slug = launchSlug(launchPath)
  return slug ? GUIDE_SURFACE_LINKS.launchHref(slug) : null
}
