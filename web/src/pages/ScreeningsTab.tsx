import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import type { RiskAlert } from '../observationMappers'
import { STAGES, launchableTools, type BadgeVariant } from '../data/catalog'

const LEVEL_CONFIG: Record<string, { className: string; label: string }> = {
  acute:    { className: 'alert--acute',    label: 'ACUTE' },
  high:     { className: 'alert--high',     label: 'HIGH' },
  moderate: { className: 'alert--moderate', label: 'MODERATE' },
  low:      { className: 'alert--low',      label: 'LOW' },
  none:     { className: 'alert--none',     label: 'NONE' },
}

const BADGE_CLASS: Record<BadgeVariant, string> = {
  screening: 'screening-badge--screening',
  assessment: 'screening-badge--assessment',
  safety: 'screening-badge--safety',
  cams: 'screening-badge--cams',
  handoff: 'screening-badge--assessment',
  followup: 'screening-badge--screening',
  monitoring: 'screening-badge--cams',
}

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

  // Group launchable tools by stage for the "Available Tools" section.
  const launchablesByStage = useMemo(() => {
    const tools = launchableTools()
    return STAGES
      .map(stage => ({
        stage,
        tools: tools.filter(t => t.stageId === stage.id),
      }))
      .filter(g => g.tools.length > 0)
  }, [])

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

      {/* Available Tools — grouped by care stage, sourced from the catalog */}
      <section className="screenings-section">
        <h3 className="section-title">Available Tools</h3>
        {launchablesByStage.map(({ stage, tools }) => (
          <div key={stage.id} className="tool-stage-group">
            <div className="tool-stage-header">
              <h4 className="tool-stage-title">{stage.title}</h4>
              <p className="tool-stage-desc">{stage.description}</p>
            </div>
            <div className="available-grid">
              {tools.flatMap(tool =>
                tool.launchActions.map(action => (
                  <div key={action.path} className="available-card">
                    <span className={`screening-badge ${BADGE_CLASS[tool.badge.variant]}`}>
                      {tool.badge.label}
                    </span>
                    <h4 className="available-card-title">
                      {tool.name}
                      {tool.launchActions.length > 1 && ` — ${action.label}`}
                    </h4>
                    <p className="available-card-desc">{tool.description ?? tool.purpose}</p>
                    <Link to={action.path} className="available-card-btn">Start</Link>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
