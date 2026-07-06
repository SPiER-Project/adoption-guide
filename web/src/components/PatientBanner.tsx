import { Link, useNavigate } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import '../css/PatientBanner.css'

type RiskLevel = 'acute' | 'high' | 'moderate' | 'low' | 'none' | 'unknown'

const RISK_LABEL: Record<RiskLevel, string> = {
  acute: 'Acute',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  none: 'None',
  unknown: 'Unknown',
}

// "Unknown" means no risk-bearing data has been captured yet (no screening on
// file). Once any alert reports a level — even 'none' — we surface the
// highest one.
function highestRiskLevel(alertLevels: string[]): RiskLevel {
  if (alertLevels.length === 0) return 'unknown'
  const order: RiskLevel[] = ['acute', 'high', 'moderate', 'low', 'none']
  return order.find(l => alertLevels.includes(l)) ?? 'none'
}

export function PatientBanner() {
  const {
    patientDisplay,
    isSmartConnected,
    riskAlerts,
    activePatientId,
    populationPatients,
  } = usePatient()
  const navigate = useNavigate()

  // Unassigned (blank) state — no patient selected.
  if (activePatientId === null && !isSmartConnected) {
    return (
      <div className="patient-banner patient-banner--unassigned">
        <div className="patient-banner-content">
          <span className="patient-banner-name patient-banner-name--unassigned">
            No patient selected
          </span>
          <span className="patient-banner-divider">|</span>
          <span className="patient-banner-unassigned-hint">
            Launch an assessment from the recommendation below to try the forms, or pick a patient.
          </span>
          <Link to="/population" className="patient-banner-population-link">
            Choose from population →
          </Link>
        </div>
      </div>
    )
  }

  const risk = highestRiskLevel(riskAlerts.map(a => a.level))

  return (
    <div className="patient-banner">
      <div className="patient-banner-content">
        <span className="patient-banner-name">{patientDisplay.fullName}</span>
        <span className="patient-banner-divider">|</span>
        <span className="patient-banner-field">
          <span className="patient-banner-label">DOB</span>
          <span className="patient-banner-value">{patientDisplay.dob}</span>
        </span>
        <span className="patient-banner-divider">|</span>
        <span className="patient-banner-field">
          <span className="patient-banner-label">MRN</span>
          <span className="patient-banner-value patient-banner-mrn">{patientDisplay.mrn}</span>
        </span>
        <span className="patient-banner-divider">|</span>
        <span className="patient-banner-field">
          <span className="patient-banner-label">Sex</span>
          <span className="patient-banner-value">{patientDisplay.gender}</span>
        </span>
        <span className="patient-banner-divider">|</span>
        <span className="patient-banner-field">
          <span className="patient-banner-label">Risk</span>
          <span
            className={`risk-pill risk-pill--${risk}`}
            title={
              risk === 'unknown'
                ? 'No suicide-risk screening on file'
                : `Highest active risk level: ${RISK_LABEL[risk]}`
            }
          >
            {RISK_LABEL[risk]}
          </span>
        </span>
        {isSmartConnected ? (
          <span className="patient-banner-smart" title="Connected via SMART on FHIR">
            SMART
          </span>
        ) : (
          // Patient-context controls. Hidden under SMART, where the connected
          // EHR owns the patient in context. Switching navigates to the
          // patient's chart URL, which broadcasts patient-open over FHIRcast.
          <div className="patient-banner-actions">
            <label className="patient-banner-switcher-label">
              <span className="patient-banner-label">Switch</span>
              <select
                className="patient-banner-switcher"
                aria-label="Switch patient"
                value={activePatientId ?? ''}
                onChange={e => navigate(`/patient/chart/${e.target.value}`)}
              >
                {populationPatients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="patient-banner-close"
              onClick={() => navigate('/patient/chart?new=1')}
              title="Close this patient and return to the blank chart"
            >
              Close patient ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
