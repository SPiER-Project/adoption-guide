import { usePatient } from '../context/PatientContext'
import '../css/PatientBanner.css'

export function PatientBanner() {
  const { patientDisplay, isSmartConnected } = usePatient()

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
        {isSmartConnected && (
          <span className="patient-banner-smart" title="Connected via SMART on FHIR">
            SMART
          </span>
        )}
      </div>
    </div>
  )
}
