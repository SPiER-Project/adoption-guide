import { createContext, useContext } from 'react'

/**
 * Whether this subtree may show raw FHIR.
 *
 * ── What this is for ────────────────────────────────────────────────────────
 *
 * The clinician-facing app should read as something a health system would adopt
 * into its own SMART on FHIR application. Raw FHIR JSON beside an instrument is
 * a developer affordance: a clinician filling in a C-SSRS has no use for it, and
 * its presence is the clearest signal that the app is a demo rather than a
 * product. The wire format belongs in the Adoption Guide, which is where an
 * implementer reads — and which already shows it on the Data Dictionary, Tools,
 * Care Pathway and CDS Service pages.
 *
 * ── The rule, stated as one invariant ───────────────────────────────────────
 *
 * **Inspection is ON inside `/guide`, and OFF everywhere else.** The default is
 * `false`, so a surface that says nothing gets the production view; only the
 * guide layout turns it on (see `App.tsx`), and the guide's "try it" routes
 * inherit it by sitting under that layout.
 *
 * That is why this is a context rather than a prop on the views. Seven
 * components render FHIR — `CodeDrawer` and `FhirJsonViewer` plus the five that
 * call the viewer directly — and four of them are rendered by BOTH surfaces
 * (`QuestionnaireView`, `StanleyBrownView`, `WorkflowForm` and `PathwayView` are
 * one implementation each, reached from the guide and from the app). A prop
 * would have to be threaded through every page that renders any of them, and
 * the one page that forgot would be a clinician looking at JSON.
 *
 * ⚠️ **A FOURTH axis, and deliberately not any of the other three.**
 *
 * - Not `chromeMode` (`PresentationContext`). Panel chrome says *the host owns
 *   the surrounding UI*. A standalone `/patient/record` browse with no host is
 *   still the clinician's app and should still be clean.
 * - Not `SURFACE` (`lib/surface.ts`). That says what a build *contains*. The
 *   public demo site is the `demo` surface and is exactly where the app most
 *   needs to look production-grade.
 * - Not the data source. A connected server says nothing about who is reading.
 *
 * Conflating any two of these is what `PresentationContext`'s own note warns
 * against, and this axis is a fourth entry on that list rather than an exception
 * to it.
 *
 * ── Why there is no `InspectProvider` component ─────────────────────────────
 *
 * The repo splits a context into `*Context.ts` (object + hook) and
 * `*Provider.tsx` (component) so the provider module stays component-only and
 * Fast Refresh preserves its state on edit. There is no state here — the value
 * is the literal `true` on one route — so `App.tsx` uses
 * `<InspectContext.Provider value>` directly and there is no second module to
 * keep in step.
 */
export const InspectContext = createContext(false)

/**
 * May the calling component render raw FHIR?
 *
 * Returns `false` outside a provider, which is the whole point: a new surface
 * that renders `FhirJsonViewer` without thinking about it gets the clinician's
 * answer, not the implementer's.
 */
export function useInspect(): boolean {
  return useContext(InspectContext)
}
