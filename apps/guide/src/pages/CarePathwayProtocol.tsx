/**
 * The published protocol — /guide/pathway/protocol, the implementer's page.
 *
 * A SUBSECTION of Care Pathway (data/guideSections.ts), reached by one link
 * from the explainer and not a sidebar row or a pager step. `/guide/pathway`
 * says what a suicide-safer care pathway does; this page is the artifact that
 * says it, in full: the spine of steps with the tier table in place, the
 * three things the artifact deliberately does not encode, the FHIRPath gates
 * and canonical URLs in a drawer, and provenance with the JSON last. Split out
 * by the adoption-guide UX audit (docs/plans/adoption-guide-ux-audit-2026-09-20.md
 * §4.2), which measured the two pages as one 2,445-word page that put the
 * artifact in front of every reader.
 *
 * ⚠️ **This is the ONE page in the guide that says "rendered from the published
 * PlanDefinition"** (audit §5 rule 5). It used to be a preface on three pages;
 * the explainer and Adoption Readiness now describe the protocol without
 * naming its resource type, and the sentence lives here, where a reader who
 * followed the link is asking exactly that question.
 *
 * ⚠️ The rendering is NOT here. The clinician's embedded panel
 * (apps/clinical/src/pages/PathwayProtocol.tsx) composes the same spine and
 * pending strip from `@spier/app-shell/components/PathwayView`; what differs is
 * the framing — provenance CLOSES here and LEADS there, for the reason that
 * file's header gives — and the drawer, which renders only under inspection
 * and so only on this surface.
 *
 * ⚠️ A GUIDE SUB-PAGE: no page header of its own (AdoptionGuide renders
 * "← Care Pathway / The published protocol"), no padding on the root, no width
 * on the root — `npm run check:template`. And no patient data: it renders a
 * definition, and `npm run check:guide-boundary` walks its imports.
 */
import { PathwayCodeDrawer } from '@spier/app-shell/components/PathwayCodeDrawer'
import {
  PathwayLoadError,
  PathwayPending,
  PathwayProvenance,
  PathwaySpine,
} from '@spier/app-shell/components/PathwayView'
import { usePathway } from '@spier/app-shell/hooks/usePathway'
import '@spier/app-shell/css/CarePathway.css'

export function CarePathwayProtocol() {
  const loaded = usePathway()

  if (!loaded.model) {
    return (
      <div className="care-pathway">
        <PathwayLoadError error={loaded.error} />
      </div>
    )
  }

  const model = loaded.model

  return (
    <div className="care-pathway">
      <p className="care-pathway__lede">
        If you are wiring this into an EHR, this page is the protocol as published. Everything below is{' '}
        <strong>rendered from the published PlanDefinition</strong> &mdash; the steps, their gates, the tier
        table and every note are read from the artifact rather than restated here. The one exception is
        labelled: the pending-definition strip is page copy, because the artifact deliberately leaves those
        three things out.
      </p>

      {/* ── The spine ─────────────────────────────────────────── */}
      <section aria-labelledby="pathway-spine-title">
        <h3 id="pathway-spine-title" className="pathway-section-title">The protocol</h3>
        <PathwaySpine model={model} />
      </section>

      {/* ── Pending clinical definition (page copy, NOT the artifact) ── */}
      <PathwayPending />

      {/* ── The gates and references, as written (inspection only) ── */}
      <PathwayCodeDrawer model={model} />

      {/* ── Provenance ────────────────────────────────────────── */}
      <PathwayProvenance model={model}>
        <p className="pathway-provenance__lede">
          The artifact this page was drawn from. The app bundles the compiled Implementation Guide at
          build time and carries it wherever it runs &mdash; including into an EHR as a SMART app, where
          the same renderer draws the same protocol with these facts leading rather than closing.
        </p>
      </PathwayProvenance>
    </div>
  )
}
