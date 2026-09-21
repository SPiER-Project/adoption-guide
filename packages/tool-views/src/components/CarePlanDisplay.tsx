import { useState } from 'react'
import { LOINC_SYSTEM, type GeneratedCarePlan } from '@spier/core/lib/carePlanMappers'
import { Notice } from '@spier/ui/Notice'
import { Pill } from '@spier/ui/Pill'
import { useInspect } from '../context/InspectContext'
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
 * ⚠️ This component was NOT on the list in
 * `docs/plans/production-clinical-surface.md` — it renders its own `<pre>`
 * rather than going through `FhirJsonViewer`, so the plan's inventory (built
 * from the viewer's call sites) missed it. Anything new that dumps a resource
 * has to opt into `useInspect()` the same way; the leaf gate on `FhirJsonViewer`
 * cannot cover a component that does its own `JSON.stringify`.
 */
export function CarePlanDisplay({ carePlan }: { carePlan: GeneratedCarePlan }) {
  const inspect = useInspect()
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

      <Notice tone="warning">
        <strong>Demo Only</strong> — This safety plan was built in your browser for demonstration
        purposes. Nothing about this patient has been sent anywhere or saved to any server; it
        stays on this device until you close the demo.
      </Notice>

      <div className="careplan-steps">
        {carePlan.activities.map((activity, idx) => (
          <div key={idx} className="careplan-step">
            <p className="careplan-step-title">
              {activity.stepTitle}
              {activity.sectionCode && (
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
