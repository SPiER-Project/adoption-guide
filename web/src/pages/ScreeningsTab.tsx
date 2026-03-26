import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import type { RiskAlert } from '../observationMappers'

const LEVEL_CONFIG: Record<string, { className: string; label: string }> = {
  acute:    { className: 'alert--acute',    label: 'ACUTE' },
  high:     { className: 'alert--high',     label: 'HIGH' },
  moderate: { className: 'alert--moderate', label: 'MODERATE' },
  low:      { className: 'alert--low',      label: 'LOW' },
  none:     { className: 'alert--none',     label: 'NONE' },
}

interface ToolEntry {
  name: string
  description: string
  path: string
  badge: string
  badgeClass: string
}

interface ToolStage {
  stage: string
  description: string
  tools: ToolEntry[]
}

const TOOL_STAGES: ToolStage[] = [
  {
    stage: 'Screen',
    description: 'Universal or targeted screening to identify patients who may be at risk.',
    tools: [
      {
        name: 'PHQ-9 Depression Screening',
        description: '9-item depression screening (0-27). Item 9 screens for suicidal ideation — the primary gateway for suicide risk assessment in most EHR workflows.',
        path: '/chart/screenings/phq-9',
        badge: 'Screening',
        badgeClass: 'screening-badge--screening',
      },
      {
        name: 'ASQ — Suicide Risk Screening',
        description: 'NIMH 4-question screening tool (~20 seconds) with acuity question. Validated for youth (8+) and adults across all care settings.',
        path: '/chart/screenings/asq',
        badge: 'Screening',
        badgeClass: 'screening-badge--screening',
      },
      {
        name: 'SBQ-R — Suicide Behaviors Questionnaire',
        description: '4-item self-report covering lifetime ideation, past-year frequency, threat disclosure, and future likelihood. Score range 3-18.',
        path: '/chart/screenings/sbq-r',
        badge: 'Screening',
        badgeClass: 'screening-badge--screening',
      },
    ],
  },
  {
    stage: 'Assess',
    description: 'Comprehensive risk assessment for patients who screen positive.',
    tools: [
      {
        name: 'C-SSRS Screener (Recent)',
        description: 'Columbia 6-item suicide risk assessment with three-tier stratification (Low/Moderate/High). The gold-standard brief assessment tool.',
        path: '/chart/screenings/cssrs-screener',
        badge: 'Assessment',
        badgeClass: 'screening-badge--assessment',
      },
      {
        name: 'C-SSRS Full (Lifetime/Recent)',
        description: 'Comprehensive Columbia assessment: 5-level ideation hierarchy, intensity ratings (frequency, duration, controllability, deterrents, reasons), and full behavior section with lethality scoring.',
        path: '/chart/screenings/cssrs-full',
        badge: 'Assessment',
        badgeClass: 'screening-badge--assessment',
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
    ],
  },
  {
    stage: 'Formulate',
    description: 'Structured clinical formulation of risk level, rationale, and disposition.',
    tools: [
      {
        name: 'CAMS Therapeutic Worksheet',
        description: 'Exploration of suicide drivers and development of a working crisis model.',
        path: '/chart/screenings/cams-therapeutic-worksheet',
        badge: 'CAMS',
        badgeClass: 'screening-badge--cams',
      },
    ],
  },
  {
    stage: 'Plan',
    description: 'Collaborative safety planning, means safety counseling, and stabilization strategies.',
    tools: [
      {
        name: 'Stanley-Brown Safety Plan',
        description: 'A brief intervention to help individuals manage suicidal crises and reduce access to lethal means.',
        path: '/chart/screenings/stanley-and-brown',
        badge: 'Safety Plan',
        badgeClass: 'screening-badge--safety',
      },
      {
        name: 'CAMS Stabilization Plan',
        description: 'Collaborative safety and stabilization plan including lethal means counseling and coping strategies.',
        path: '/chart/screenings/cams-stabilization-plan',
        badge: 'CAMS',
        badgeClass: 'screening-badge--cams',
      },
    ],
  },
]

function findAlertForResponse(riskAlerts: RiskAlert[], questionnaireName: string): RiskAlert | undefined {
  return riskAlerts.find(a => a.tool === questionnaireName)
}

function findObservationsForResponse(observations: any[], completedAt: string): any[] {
  const responseTime = new Date(completedAt).getTime()
  return observations.filter(obs => {
    const obsTime = new Date(obs.effectiveDateTime).getTime()
    return Math.abs(obsTime - responseTime) < 2000
  })
}

export function ScreeningsTab() {
  const { responses, riskAlerts, observations } = usePatient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const reversedResponses = [...responses].reverse()

  return (
    <div className="screenings-tab">
      <h2 className="page-title">Clinical Tools</h2>

      {/* Completed Results */}
      <section className="screenings-section">
        <h3 className="section-title">Completed ({responses.length})</h3>
        {reversedResponses.length > 0 ? (
          <div className="completed-list">
            {reversedResponses.map(r => {
              const alert = findAlertForResponse(riskAlerts, r.questionnaireName)
              const relatedObs = findObservationsForResponse(observations, r.completedAt)

              return (
                <div key={r.id} className="completed-item">
                  <div
                    className="completed-item-header"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="completed-item-name">{r.questionnaireName}</span>
                    {alert && alert.level !== 'none' && (
                      <span className={`completed-item-risk-badge risk-alert-level ${LEVEL_CONFIG[alert.level].className}`}>
                        {LEVEL_CONFIG[alert.level].label}
                      </span>
                    )}
                    {alert && (
                      <span className="completed-item-summary">{alert.summary}</span>
                    )}
                    <span className="completed-item-date">
                      {new Date(r.completedAt).toLocaleDateString()}{' '}
                      {new Date(r.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="completed-item-toggle">{expandedId === r.id ? '\u25BC' : '\u25B6'}</span>
                  </div>
                  {expandedId === r.id && (
                    <div className="completed-item-body">
                      {(alert || relatedObs.length > 0) && (
                        <div className="completed-item-results">
                          {alert && (
                            <div className={`completed-item-alert ${LEVEL_CONFIG[alert.level].className}`}>
                              <span className={`risk-alert-level ${LEVEL_CONFIG[alert.level].className}`}>
                                {LEVEL_CONFIG[alert.level].label}
                              </span>
                              <span className="completed-alert-summary">{alert.summary}</span>
                              <p className="completed-alert-detail">{alert.detail}</p>
                              {alert.suggestedAction && (
                                <Link to={alert.suggestedAction.path} className="completed-alert-action">
                                  {alert.suggestedAction.label} &rarr;
                                </Link>
                              )}
                            </div>
                          )}
                          {relatedObs.length > 0 && (
                            <div className="completed-item-observations">
                              <h5 className="completed-obs-title">Generated Observations ({relatedObs.length})</h5>
                              <div className="completed-obs-list">
                                {relatedObs.map((obs, idx) => (
                                  <div key={idx} className="completed-obs-row">
                                    <span className="completed-obs-code">{obs.code?.text || obs.code?.coding?.[0]?.display || 'Observation'}</span>
                                    <span className="completed-obs-value">
                                      {obs.valueInteger !== undefined && obs.valueInteger}
                                      {obs.valueBoolean !== undefined && (obs.valueBoolean ? 'Yes' : 'No')}
                                      {obs.valueString !== undefined && obs.valueString}
                                      {obs.valueCodeableConcept && (obs.valueCodeableConcept.text || obs.valueCodeableConcept.coding?.[0]?.display)}
                                    </span>
                                    {obs.interpretation?.[0]?.coding?.[0] && (
                                      <span className={`completed-obs-interp interp--${obs.interpretation[0].coding[0].code?.toLowerCase()}`}>
                                        {obs.interpretation[0].coding[0].display}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <FhirJsonViewer data={r.resource} title="QuestionnaireResponse" defaultOpen />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="screenings-empty">No assessments completed yet. Start one below.</p>
        )}
      </section>

      {/* Available Tools — grouped by care stage */}
      <section className="screenings-section">
        <h3 className="section-title">Available Tools</h3>
        {TOOL_STAGES.map(stageGroup => (
          <div key={stageGroup.stage} className="tool-stage-group">
            <div className="tool-stage-header">
              <h4 className="tool-stage-title">{stageGroup.stage}</h4>
              <p className="tool-stage-desc">{stageGroup.description}</p>
            </div>
            <div className="available-grid">
              {stageGroup.tools.map(s => (
                <div key={s.path} className="available-card">
                  <span className={`screening-badge ${s.badgeClass}`}>{s.badge}</span>
                  <h4 className="available-card-title">{s.name}</h4>
                  <p className="available-card-desc">{s.description}</p>
                  <Link to={s.path} className="available-card-btn">Start</Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
