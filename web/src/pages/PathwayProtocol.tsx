/**
 * The published care pathway, as the embedded SMART panel shows it.
 *
 * Phase 4 of docs/plans/suicide-safer-care-pathway.md, and deliberately small:
 * Pattern A (decision 2) means the artifact is *already* in the bundle, so
 * putting the protocol in front of a clinician inside a host chart is a route
 * and a reframing rather than a build. There is no second renderer — the spine,
 * the tier columns and the provenance block are `components/PathwayView.tsx`,
 * the same ones `/guide/pathway` composes.
 *
 * ── Why provenance LEADS here ─────────────────────────────────
 *
 * On the guide page provenance is a footnote about sourcing, and it closes the
 * page. In an EHR it is the demonstration itself. The panel is running inside
 * someone else's chart, talking to someone else's FHIR server, and the claim
 * being made is: *this protocol did not come from your system — the app carried
 * the published artifact in with it, and here is its canonical URL, its version
 * and its JSON.* That is Pattern A stated in a form an integration lead can
 * check, so it renders first and large.
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
import { PageHeader } from '../components/PageHeader'
import {
  PathwayLoadError,
  PathwayPending,
  PathwayProvenance,
  PathwaySpine,
} from '../components/PathwayView'
import { usePathway } from '../hooks/usePathway'
import '../css/CarePathway.css'

export function PathwayProtocol() {
  const loaded = usePathway()

  return (
    <div className="pathway-protocol">
      <PageHeader
        eyebrow="Patient View"
        up="/patient/chart"
        title="Published Care Pathway"
        lede="The Suicide Safer Care protocol SPiER carries, rendered from the artifact it publishes."
      />

      {!loaded.model ? (
        <PathwayLoadError error={loaded.error} />
      ) : (
        <>
          <PathwayProvenance model={loaded.model} variant="lead">
            <p className="pathway-provenance__lede">
              SPiER does not fetch this protocol from the EHR it is connected to. It bundles the compiled
              Implementation Guide at build time and carries it wherever it runs, so what follows is a
              rendering of the published artifact named here &mdash; inspectable, versioned, and the same
              in a host chart as in the Adoption Guide.
            </p>
          </PathwayProvenance>

          <p className="pathway-protocol__scope">
            <strong>This is the definition, not this patient&rsquo;s position on it.</strong> Every step,
            gate and tier obligation below is what the protocol says for anyone; for what has been recorded
            for the patient in context, and what the rules recommend next, go back to the{' '}
            <Link to="/patient/chart#activity">pathway rail on the chart</Link>.
          </p>

          <PathwaySpine model={loaded.model} />

          <PathwayPending />
        </>
      )}
    </div>
  )
}
