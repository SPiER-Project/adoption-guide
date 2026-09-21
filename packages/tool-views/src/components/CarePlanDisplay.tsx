import { useState } from 'react'
import { LOINC_SYSTEM, type GeneratedCarePlan } from '@spier/core/lib/carePlanMappers'
import { Notice } from '@spier/ui/Notice'
import { Pill } from '@spier/ui/Pill'
import { useInspect } from '../context/InspectContext'
import { usePatient } from '../context/PatientContext'
import { todayLocalIso } from '../lib/dates'

/**
 * The safety plan a recorder generated, shown back before it is saved.
 *
 * ⚠️ **Three things here are addressed to an implementer, not a clinician**, and
 * since 2026-09-17 they render only where inspection is on — inside the
 * Adoption Guide (see `context/InspectContext.ts`). They are the raw-JSON
 * toggle, the JSON download, and the `(FHIR CarePlan)` in the heading. A
 * clinician looking at a patient's safety plan has no use for the resource
 * behind it, and "Download CarePlan JSON" beside a safety plan is the clearest
 * tell that this is a demo.
 *
 * ⚠️ **The "Demo Only" line was false under a live launch**, and had been since
 * the writeback ladder landed (clinical-app audit §4.6, item 3). It read
 * "Nothing about this patient has been sent anywhere or saved to any server" —
 * asserted unconditionally, on a screen reached by submitting a form whose
 * CarePlan `addCarePlan` had just written to the connected EHR. A demo caveat
 * that is wrong in the one setting a site is evaluating is worse than no
 * caveat, so the claim is now made per session, and it is a claim about where
 * a completed plan GOES rather than about whether this particular write
 * landed — which is the data source's to report, not this component's.
 *
 * ⚠️ This component was NOT on the list in
 * `docs/plans/production-clinical-surface.md` — it renders its own `<pre>`
 * rather than going through `FhirJsonViewer`, so the plan's inventory (built
 * from the viewer's call sites) missed it. Anything new that dumps a resource
 * has to opt into `useInspect()` the same way; the leaf gate on `FhirJsonViewer`
 * cannot cover a component that does its own `JSON.stringify`.
 */
export function CarePlanDisplay({ carePlan }: { carePlan: GeneratedCarePlan }) {
  const inspect = useInspect()
  const { isSmartSession } = usePatient()
  const [showJson, setShowJson] = useState(false)

  // Derive filename from the resource id (e.g. "cams-stabilization-careplan-1234" → "cams-stabilization-careplan")
  const idSlug = carePlan.resource?.id?.replace(/-\d+$/, '') || 'careplan'

  function downloadJson() {
    const blob = new Blob([JSON.stringify(carePlan.resource, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${idSlug}-${todayLocalIso()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="careplan-container">
      <div className="careplan-header">
        <h3>Generated Safety Plan{inspect && ' (FHIR CarePlan)'}</h3>
        <Pill tone="warning">Generated</Pill>
      </div>

      {isSmartSession ? (
        <Notice tone="info">
          <strong>This is a live record</strong> — a safety plan completed here is written to the
          connected EHR rather than kept in this browser. Review it with the patient before it is
          relied on.
        </Notice>
      ) : (
        <Notice tone="warning">
          <strong>Demo only</strong> — this safety plan was built in your browser for demonstration
          purposes. Nothing about this patient has been sent anywhere; it stays on this device
          until you close the demo.
        </Notice>
      )}

      <div className="careplan-steps">
        {carePlan.activities.map((activity, idx) => (
          <div key={idx} className="careplan-step">
            <p className="careplan-step-title">
              {activity.stepTitle}
              {/* ⚠️ The fourth implementer-facing thing in this component, found
                  while fixing the third: the section's concept id, rendered
                  beside a safety-plan step as "LOINC: 96782-8". `check:jargon`
                  cannot see it — the code is a runtime value, and the literal
                  beside it is a bare system name with no digits — so it
                  survived §1.9's sweep. It joins the other three behind
                  `useInspect()` rather than being deleted, because in the
                  guide it is exactly what a reader came for. */}
              {inspect && activity.sectionCode && (
                <span className="careplan-step-code">
                  {activity.sectionCode.system === LOINC_SYSTEM ? 'LOINC' : 'SPiER'}: {activity.sectionCode.code}
                </span>
              )}
            </p>
            <p className={`careplan-step-description ${activity.description.includes('No ') && activity.description.includes('provided')
              ? 'careplan-step-empty' : ''
              }`}>
              {activity.description}
            </p>
          </div>
        ))}
      </div>

      {inspect && (
        <div className="careplan-actions">
          <button className="careplan-download-btn" onClick={downloadJson}>
            <span className="btn-icon">&#128229;</span> Download CarePlan JSON
          </button>
          <button className="careplan-json-toggle" onClick={() => setShowJson(!showJson)}>
            {showJson ? 'Hide' : 'View'} Raw FHIR JSON
          </button>
        </div>
      )}

      {inspect && showJson && (
        <div className="careplan-json-panel">
          <pre>{JSON.stringify(carePlan.resource, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
