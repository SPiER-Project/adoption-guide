import { createContext, useContext } from 'react'

/**
 * Who renders the page header above a shared form view: the view itself, or
 * the page that embeds it.
 *
 * ── The defect this was written from ────────────────────────────────────────
 *
 * The 18 fillers and 11 recorders each render their own `PageHeader` — the
 * eyebrow, the up-link back to the parent page, the title — because on the
 * clinician's `/patient/assessments/*` and `/patient/workflow/*` routes the
 * view IS the page, and `check:template` RULE 4 is right to insist that every
 * drill-in page states where it is and how to get back out.
 *
 * On the Adoption Guide, since 2026-09-20, a tool is a PAGE of its own
 * (`/guide/tools/TL-0NN`, `apps/guide/src/pages/ToolPage.tsx`): the tool's
 * name as the title, its purpose as the lede, the form in the foreground, and
 * the catalogue detail below. That page owns the header — it names the tool
 * the reader chose, where four tools share one recorder and one tool has three
 * forms — so a view rendering its own as well would put two page titles on one
 * page, which is the drift `check:template` exists to stop. Until then the
 * guide's try route (`/guide/tools/:slug/try`) sat OUTSIDE the guide layout
 * precisely so the view's header could be the page's; the tool page inverts
 * that, and this context is how the view learns it.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 *
 * **Default `'view'`, deliberately.** A route that says nothing gets the
 * clinician's answer — the view draws its header — so the clinical app is
 * unchanged by this file existing and a new surface that renders a view bare
 * is still a complete page. Only a page that has ALREADY rendered a
 * `PageHeader` sets `'page'`, and it does so in the same file as that header
 * so the two cannot drift apart.
 *
 * ⚠️ **A view under `'page'` still renders every word the header carried.** A
 * recorder's `lede` is the clinician's sentence about what the form records;
 * `WorkflowForm` moves it into the card rather than dropping it. The title is
 * the one thing that goes, because the page's title names the same tool.
 *
 * ⚠️ **A SIXTH axis, and not any of the other five.** Inspection
 * (`InspectContext`) says *may this subtree show raw FHIR*; `SurfaceLinks`
 * says *where do this subtree's links go*; chrome mode says *who owns the
 * surrounding UI*. Header ownership travels with none of them: the guide's tool
 * page inspects AND owns the header, while a future implementer surface could
 * inspect and let the view keep its header. Same argument each of those files
 * makes for its own axis.
 *
 * No provider component, for the reason `InspectContext.ts` gives: the value
 * is a literal on one route, so the page uses `<PageHeaderOwnerContext.Provider>`
 * directly and there is no second module to keep in step.
 */
export type PageHeaderOwner = 'view' | 'page'

export const PageHeaderOwnerContext = createContext<PageHeaderOwner>('view')

/** Does the calling view draw the page header, or has the page above it done so? */
export function usePageHeaderOwner(): PageHeaderOwner {
  return useContext(PageHeaderOwnerContext)
}
