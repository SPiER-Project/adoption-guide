import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'

export function CarePlanTab() {
  const { carePlans } = usePatient()
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const reversedPlans = [...carePlans].reverse()

  return (
    <div className="careplan-tab">
      <h2 className="page-title">Care Plans</h2>

      {reversedPlans.length > 0 ? (
        <div className="careplan-list">
          {reversedPlans.map((cp: any, idx: number) => {
            const savedAt = cp._savedAt ? new Date(cp._savedAt) : null
            const source = cp.id?.includes('stanley-brown') ? 'Stanley-Brown Safety Plan' : 'CAMS Stabilization Plan'

            return (
              <div key={idx} className="careplan-list-item">
                <div
                  className="careplan-list-header"
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="careplan-list-info">
                    <span className="careplan-list-name">{source}</span>
                    <span className={`careplan-list-status careplan-list-status--${cp.status || 'active'}`}>
                      {cp.status || 'active'}
                    </span>
                  </div>
                  <div className="careplan-list-meta">
                    {savedAt && (
                      <span className="careplan-list-date">
                        {savedAt.toLocaleDateString()} {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <span className="careplan-list-toggle">{expandedIdx === idx ? '\u25BC' : '\u25B6'}</span>
                  </div>
                </div>

                {expandedIdx === idx && (
                  <div className="careplan-list-body">
                    {/* Show activities */}
                    {cp.activity && (
                      <div className="careplan-list-activities">
                        {cp.activity.map((act: any, aIdx: number) => (
                          <div key={aIdx} className="careplan-activity-item">
                            <span className="careplan-activity-title">
                              {act.detail?.code?.text || `Activity ${aIdx + 1}`}
                            </span>
                            <span className="careplan-activity-loinc">
                              {act.detail?.code?.coding?.[0]?.code && `LOINC: ${act.detail.code.coding[0].code}`}
                            </span>
                            <p className="careplan-activity-desc">{act.detail?.description || 'No description'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <FhirJsonViewer data={cp} title="Full FHIR CarePlan Resource" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="careplan-empty">
          <p>No care plans have been generated yet.</p>
          <p>
            Complete a{' '}
            <Link to="/chart/screenings/stanley-and-brown">Stanley-Brown Safety Plan</Link>{' '}
            or{' '}
            <Link to="/chart/screenings/cams-stabilization-plan">CAMS Stabilization Plan</Link>{' '}
            to generate one.
          </p>
        </div>
      )}
    </div>
  )
}
