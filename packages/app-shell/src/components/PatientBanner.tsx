import { useLayoutEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { PatientIdentityStrip } from './PatientIdentityStrip'
import '../css/PatientBanner.css'

/**
 * Publishes the banner's live height as `--patient-banner-height`, which
 * `--anchor-scroll-offset` folds into every anchor target's
 * `scroll-margin-top`. Without it a scrolled-to section lands underneath the
 * sticky banner.
 *
 * Measured rather than hard-coded because the banner wraps to two lines on
 * narrow screens. Held in state rather than a ref so the effect re-runs when
 * the node itself changes — the unassigned and assigned states render
 * different root elements.
 */
function useBannerHeightVar() {
  const [bannerEl, setBannerEl] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!bannerEl) return
    const publish = () =>
      document.documentElement.style.setProperty(
        '--patient-banner-height',
        `${Math.round(bannerEl.getBoundingClientRect().height)}px`,
      )
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(bannerEl)
    return () => {
      observer.disconnect()
      // The banner renders only on patient routes; elsewhere the offset must
      // fall back to 0 rather than to a stale height.
      document.documentElement.style.removeProperty('--patient-banner-height')
    }
  }, [bannerEl])

  return setBannerEl
}

export function PatientBanner() {
  const { isSmartConnected, activePatientId, populationPatients } = usePatient()
  const navigate = useNavigate()
  const bannerRef = useBannerHeightVar()

  // Unassigned (blank) state — no patient selected.
  if (activePatientId === null && !isSmartConnected) {
    return (
      <div ref={bannerRef} className="patient-banner patient-banner--unassigned">
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

  return (
    <div ref={bannerRef} className="patient-banner">
      <div className="patient-banner-content">
        <PatientIdentityStrip />
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
                onChange={e => navigate(`/patient/record/${e.target.value}`)}
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
              onClick={() => navigate('/patient/record?new=1')}
              title="Close this patient and return to the blank chart"
            >
              Close patient
              <X aria-hidden="true" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
