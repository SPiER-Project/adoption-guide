import type { SurfaceLinks } from '@spier/tool-views/context/SurfaceLinksContext'
import { guideFormHref } from './toolForms'

/**
 * Where the shared form views link on the guide.
 *
 * The guide has no chart and no caseload — it explains and hosts; the mock EHR
 * holds and launches (CLAUDE.md) — so both are `null` and the views render no
 * "View in chart" and no registry link here. A tool view's route is the page
 * of the tool that launches it, `/guide/tools/TL-0NN` (`data/toolForms.ts`
 * says which tool that is when several share a form), and its parent is the
 * Tools catalogue.
 *
 * ⚠️ `parent` is read by a view only when the view draws its own header. On
 * the guide every view renders inside a tool page that has drawn one
 * (`PageHeaderOwnerContext`), so it is declared for the type and for the day a
 * guide route renders a view bare — which would be a page saying "← Tools".
 *
 * `guideFormHref` returns `null` for a slug no tool's page renders, and the
 * caller shows text rather than a dead link.
 */
export const GUIDE_SURFACE_LINKS: SurfaceLinks = {
  parent: { label: 'Tools', href: '/guide/tools' },
  chartHref: null,
  registryHref: null,
  launchHref: guideFormHref,
}
