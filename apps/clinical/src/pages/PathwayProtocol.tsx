/**
 * The published care pathway, as the embedded SMART panel shows it.
 *
 * Phase 4 of docs/plans/suicide-safer-care-pathway.md, and deliberately small:
 * Pattern A (decision 2) means the artifact is *already* in the bundle, so
 * putting the protocol in front of a clinician inside a host chart is a route
 * and a reframing rather than a build. There is no second renderer — the spine,
 * the tier table and the provenance block are `components/PathwayView.tsx`,
 * the same ones the guide's `/guide/pathway/protocol` composes.
 *
 * ── What the clinician does NOT see here (2026-09-20) ─────────
 *
 * The tier branch is one table, obligation × tier, with no column lit: nothing
 * on this page derives a tier, so nothing may be highlighted as though it did.
 * The FHIRPath gates, triggers and canonical URLs render only in the guide's
 * `PathwayCodeDrawer`, which returns null without inspection — the protocol is
 * in words here, and the test beside this file asserts no expression leaks.
 *
 * ── Why provenance no longer leads here (2026-09-21) ──────────
 *
 * It did, and the argument was good: the panel runs inside someone else's
 * chart, talking to someone else's FHIR server, and the claim being made is
 * *this protocol did not come from your system — the app carried the published
 * artifact in with it, and here is its canonical URL, its version and its
 * JSON.* Pattern A, stated in a form an integration lead can check.
 *
 * ⚠️ **The integration lead is not the person holding this panel.** Clinical-app
 * audit §1.9 measured what a clinician meets on this page: a canonical URL in
 * monospace, `0.1.0`, `draft · experimental`, `clinical-protocol`, and only
 * then a sentence about build-time bundling. So the page leads with the claim
 * in words, and the strip that makes it checkable renders under `useInspect()`
 * — which is on inside `/guide`, where that reader is, and off here. The
 * artifact is unchanged and the guide's `/guide/pathway/protocol` still opens
 * on it.
 *
 * ⚠️ **No patient data on this page, and that is a rule rather than an
 * oversight.** The embedded surface has patient context available — the panel
 * knows whose chart it is in — and this view still renders the *definition*,
 * exactly like the guide page. "Where is this patient on the pathway" is the
 * scenario phase's job (plan, Phase 4); the patient's own progress is the rail
 * on the chart one level up, which is where the link below points. Rendering a
 * patient's position from a definition view would also quietly change what the
 * provenance strip above it is claiming.
 *
 * ⚠️ **No mock EHR involvement.** Nothing here reads a definitional artifact
 * over the wire, and `services/mock-ehr` serves none — the plan records that so
 * a later session does not "helpfully" add Pattern B.
 *
 * ── Not the simulator ─────────────────────────────────────────
 *
 * `/guide/pathway`'s "try a C-SSRS result" toggles are deliberately left out of
 * this view. They are a teaching device for an implementer reading about the
 * ladder; beside a real patient's chart, a synthetic screener that derives a
 * risk tier is one glance away from being mistaken for a screening the clinician
 * just performed — and the panel has the real C-SSRS Screener one tap away on
 * the chart. Vertical budget is the lesser reason; that one is the reason.
 */
import { Link } from 'react-router-dom'
import { PageHeader } from '@spier/ui/PageHeader'
import {
  PathwayLoadError,
  PathwayPending,
  PathwayProvenance,
  PathwaySpine,
} from '@spier/app-shell/components/PathwayView'
import { usePathway } from '@spier/app-shell/hooks/usePathway'
import { useInspect } from '@spier/tool-views/context/InspectContext'
import '@spier/app-shell/css/CarePathway.css'

export function PathwayProtocol() {
  const loaded = usePathway()
  const inspect = useInspect()

  return (
    <div className="pathway-protocol">
      <PageHeader
        eyebrow="Patient Chart"
        up="/patient/record"
        eyebrowStyle="pill"
        title="Published Care Pathway"
        lede="The Suicide Safer Care protocol SPiER carries, rendered from the artifact it publishes."
      />

      {!loaded.model ? (
        <PathwayLoadError error={loaded.error} />
      ) : (
        <>
          <p className="pathway-protocol__scope">
            <strong>This is what the protocol says for anyone, not where this patient
            is.</strong> SPiER brings this protocol with it rather than reading it from this
            EHR, so it is the same here as it is anywhere else SPiER runs. For what has been
            recorded for the patient in front of you, and what is due next, go back to{' '}
            <Link to="/patient/record">where this patient is</Link>.
          </p>

          <PathwaySpine model={loaded.model} />

          <PathwayPending />

          {/* The checkable half — canonical URL, version, status and the raw
              artifact. Under inspection only: `/guide/pathway/protocol` leads
              with it for the integration lead, and a clinician in a host chart
              met it before the protocol itself (audit §1.9). */}
          {inspect && (
            <PathwayProvenance model={loaded.model} variant="lead">
              <p className="pathway-provenance__lede">
                SPiER does not fetch this protocol from the EHR it is connected to. It bundles the
                compiled Implementation Guide at build time and carries it wherever it runs, so what
                is above is a rendering of the published artifact named here &mdash; inspectable,
                versioned, and the same in a host chart as in the Adoption Guide.
              </p>
            </PathwayProvenance>
          )}
        </>
      )}
    </div>
  )
}
