import { useState } from 'react'
import type { GeneratedCarePlan } from '../carePlanMapper'

export function CarePlanDisplay({ carePlan }: { carePlan: GeneratedCarePlan }) {
  const [showJson, setShowJson] = useState(false)

  // Derive filename from the resource id (e.g. "cams-stabilization-careplan-1234" → "cams-stabilization-careplan")
  const idSlug = carePlan.resource?.id?.replace(/-\d+$/, '') || 'careplan'

  function downloadJson() {
    const blob = new Blob([JSON.stringify(carePlan.resource, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${idSlug}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="careplan-container">
      <div className="careplan-header">
        <h3>Generated Safety Plan (FHIR CarePlan)</h3>
        <span className="careplan-badge">Generated</span>
      </div>

      <div className="careplan-demo-notice">
        <span className="notice-icon">&#9888;&#65039;</span>
        <span>
          <strong>Demo Only</strong> — This CarePlan was generated client-side for demonstration purposes.
          No patient data has been stored, transmitted, or persisted to any server. All data remains in your browser's localStorage.
        </span>
      </div>

      <div className="careplan-steps">
        {carePlan.activities.map((activity, idx) => (
          <div key={idx} className="careplan-step">
            <p className="careplan-step-title">
              {activity.stepTitle}
              {activity.loincCode && <span className="careplan-step-loinc">LOINC: {activity.loincCode}</span>}
            </p>
            <p className={`careplan-step-description ${activity.description.includes('No ') && activity.description.includes('provided')
              ? 'careplan-step-empty' : ''
              }`}>
              {activity.description}
            </p>
          </div>
        ))}
      </div>

      <div className="careplan-actions">
        <button className="careplan-download-btn" onClick={downloadJson}>
          <span className="btn-icon">&#128229;</span> Download CarePlan JSON
        </button>
        <button className="careplan-json-toggle" onClick={() => setShowJson(!showJson)}>
          {showJson ? 'Hide' : 'View'} Raw FHIR JSON
        </button>
      </div>

      {showJson && (
        <div className="careplan-json-panel">
          <pre>{JSON.stringify(carePlan.resource, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
