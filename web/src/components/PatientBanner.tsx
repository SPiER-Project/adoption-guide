import { Link } from 'react-router-dom'
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
  } = usePatient()

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
            Submit assessments here to try forms, or pick a patient from the population.
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
        {isSmartConnected && (
          <span className="patient-banner-smart" title="Connected via SMART on FHIR">
            SMART
          </span>
        )}
      </div>
    </div>
  )
}
