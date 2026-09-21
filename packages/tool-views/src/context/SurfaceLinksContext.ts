import { createContext, useContext } from 'react'

/**
 * Where the shared form views may send the reader on THIS surface.
 *
 * ── The defect this was written from ────────────────────────────────────────
 *
 * The 18 fillers and 11 recorders are one element definition rendered by two
 * apps: the clinician's `/patient/assessments/*` and `/patient/workflow/*`
 * routes in `apps/clinical`, and the implementer's tool pages
 * (`/guide/tools/TL-0NN`) in `apps/guide`. Until 2026-09-20 the views hardcoded the clinician's routes —
 * "View in chart" was `to="/patient/record#activity"`, a recorder's hint linked
 * `to="/patient/workflow/outreach"`, and the page header's up-link went to the
 * chart. On the guide none of those routes exist, so every one of them fell to
 * the `*` catch-all and landed the reader on the Overview. Silently: no 404,
 * no console error, a page that plausibly could have been meant.
 *
 * `check:surface-links` exists for exactly that failure and did not see it,
 * because it walked only the clinical app. The literal in a shared module is
 * correct on one surface and wrong on the other by construction, and no gate
 * over the module can tell which.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 *
 * **A shared view holds no route literal. The app that owns the route provides
 * it.** `apps/clinical/src/surfaceLinks.ts` says the chart is `/patient/record`
 * and a tool view lives at its catalog launch path; `apps/guide/src/data/surfaceLinks.ts`
 * says there is no chart and a tool view lives on the page of the tool that
 * launches it (`/guide/tools/TL-0NN`, `data/toolForms.ts`).
 * Each literal then sits in the tree of the app whose route table it must
 * resolve against, which is where `check:surface-links` (now walking both
 * apps) can check it.
 *
 * ⚠️ **No default value, deliberately.** A default would have to name one
 * surface's routes, and that is the defect again in a different file: right on
 * that surface, silently wrong on the other. So `useSurfaceLinks()` throws
 * outside a provider, and a new route that renders a shared view without one
 * fails on first render rather than on the first click of a dead link.
 *
 * ⚠️ **A fifth axis, and not `InspectContext`.** Inspection says *may this
 * subtree show raw FHIR*; this says *where do this subtree's links go*. They
 * happen to travel together today (the guide is the only surface with
 * inspection on), and conflating them would make "a clinician's surface that
 * inspects" or "an implementer's surface with a chart" impossible to express.
 * Same argument `PresentationContext` and `InspectContext` each make for their
 * own axis — and `PageHeaderOwnerContext` for a sixth: whether the view or the
 * page above it draws the header those links sit in.
 */
export interface SurfaceLinks {
  /**
   * The page these forms sit under: the eyebrow's first segment and the
   * header's up-link. "Patient Chart" → `/patient/record` on the clinical
   * surface; "Tools" → `/guide/tools` on the guide.
   */
  parent: { label: string; href: string }
  /** Where a saved response can be seen afterwards, or `null` when this surface has no chart. */
  chartHref: string | null
  /** The caseload / risk registry, or `null` when this surface has none. */
  registryHref: string | null
  /**
   * This surface's route for the tool view keyed `slug` in `TOOL_VIEWS`, or
   * `null` when the surface renders nothing under that slug. Callers render
   * plain text for `null` rather than a link to nowhere.
   */
  launchHref: (slug: string) => string | null
}

export const SurfaceLinksContext = createContext<SurfaceLinks | undefined>(undefined)

/** The current surface's routes for the shared views. Throws outside a provider — see above. */
export function useSurfaceLinks(): SurfaceLinks {
  const links = useContext(SurfaceLinksContext)
  if (links === undefined) {
    throw new Error(
      'useSurfaceLinks must be used within a SurfaceLinksContext.Provider — ' +
        'the app that renders a shared view declares where its links go',
    )
  }
  return links
}
