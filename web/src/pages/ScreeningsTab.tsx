import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'

const AVAILABLE_SCREENINGS = [
  {
    name: 'Stanley-Brown Safety Plan',
    description: 'A brief intervention to help individuals manage suicidal crises and reduce access to lethal means.',
    path: '/chart/screenings/stanley-and-brown',
    badge: 'Safety Plan',
    badgeClass: 'screening-badge--safety',
  },
  {
    name: 'CAMS SSF-5: Section A',
    description: 'Patient self-report of psychological pain, stress, agitation, hopelessness, self-hate, and overall risk.',
    path: '/chart/screenings/cams-section-a',
    badge: 'CAMS',
    badgeClass: 'screening-badge--cams',
  },
  {
    name: 'CAMS SSF-5: Section B',
    description: 'Clinician assessment of suicidal ideation, plan, preparation, history, and risk factors.',
    path: '/chart/screenings/cams-section-b',
    badge: 'CAMS',
    badgeClass: 'screening-badge--cams',
  },
  {
    name: 'CAMS Stabilization Plan',
    description: 'Collaborative safety and stabilization plan including lethal means counseling and coping strategies.',
    path: '/chart/screenings/cams-stabilization-plan',
    badge: 'CAMS',
    badgeClass: 'screening-badge--cams',
  },
  {
    name: 'CAMS Therapeutic Worksheet',
    description: 'Exploration of suicide drivers and development of a working crisis model.',
    path: '/chart/screenings/cams-therapeutic-worksheet',
    badge: 'CAMS',
    badgeClass: 'screening-badge--cams',
  },
]

export function ScreeningsTab() {
  const { responses } = usePatient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const reversedResponses = [...responses].reverse()

  return (
    <div className="screenings-tab">
      <h2 className="page-title">Screenings</h2>

      {/* Completed Screenings */}
      <section className="screenings-section">
        <h3 className="section-title">Completed ({responses.length})</h3>
        {reversedResponses.length > 0 ? (
          <div className="completed-list">
            {reversedResponses.map(r => (
              <div key={r.id} className="completed-item">
                <div
                  className="completed-item-header"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="completed-item-name">{r.questionnaireName}</span>
                  <span className="completed-item-date">
                    {new Date(r.completedAt).toLocaleDateString()}{' '}
                    {new Date(r.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="completed-item-toggle">{expandedId === r.id ? '\u25BC' : '\u25B6'}</span>
                </div>
                {expandedId === r.id && (
                  <div className="completed-item-body">
                    <FhirJsonViewer data={r.resource} title="QuestionnaireResponse" defaultOpen />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="screenings-empty">No screenings completed yet. Start one below.</p>
        )}
      </section>

      {/* Available Screenings */}
      <section className="screenings-section">
        <h3 className="section-title">Available Screenings</h3>
        <div className="available-grid">
          {AVAILABLE_SCREENINGS.map(s => (
            <div key={s.path} className="available-card">
              <span className={`screening-badge ${s.badgeClass}`}>{s.badge}</span>
              <h4 className="available-card-title">{s.name}</h4>
              <p className="available-card-desc">{s.description}</p>
              <Link to={s.path} className="available-card-btn">Start</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
