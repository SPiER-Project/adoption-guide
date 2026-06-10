import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  STAGES,
  toolsByStage,
  triggersFromStage,
  elementsUsedByTool,
  type Tool,
} from '../data/catalog'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import '../css/PatientJourney.css'

const STATUS_LABELS: Record<Tool['inclusionStatus'], string> = {
  core: 'Core',
  optional: 'Optional',
  future: 'Future',
}

interface ToolDetailProps {
  tool: Tool
}

function ToolDetail({ tool }: ToolDetailProps) {
  const elements = elementsUsedByTool(tool.id)

  return (
    <div className="tool-detail">
      {tool.description && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Purpose & Settings</h4>
          <p className="tool-detail-body">{tool.description}</p>
          <div className="tool-detail-meta">
            <span className="tool-detail-meta-label">Settings:</span>
            {tool.settings.map(s => (
              <span key={s} className="tool-detail-chip">{s}</span>
            ))}
          </div>
          {tool.tags && tool.tags.length > 0 && (
            <div className="tool-detail-meta">
              <span className="tool-detail-meta-label">Tags:</span>
              {tool.tags.map(t => (
                <span key={t} className="tool-detail-chip tool-detail-chip--tag">{t}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {tool.recordingPattern && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Implementation</h4>
          <div className="tool-detail-table-scroll">
            <table className="tool-detail-table">
              <thead>
                <tr>
                  <th>FHIR Resource</th>
                  <th>Content</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {tool.recordingPattern.resources.map((r, idx) => (
                  <tr key={idx}>
                    <td><code>{r.type}</code></td>
                    <td>{r.description}</td>
                    <td className="tool-detail-when">{r.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tool.recordingPattern.workflowTrigger && (
            <p className="tool-detail-trigger">
              <strong>Workflow trigger:</strong> {tool.recordingPattern.workflowTrigger}
            </p>
          )}
        </section>
      )}

      {elements.length > 0 && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Data Elements ({elements.length})</h4>
          <ul className="tool-detail-elements">
            {elements.map(el => (
              <li key={el.id}>
                <span className="tool-detail-element-name">{el.name}</span>
                {el.code !== 'N/A' && el.code !== 'TBD' && (
                  <code className="tool-detail-element-code">{el.codeSystem}: {el.code}</code>
                )}
                <span className="tool-detail-element-path">{el.fhirResource}.{el.fhirPath}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tool.fhirExamples && tool.fhirExamples.length > 0 && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">FHIR Examples</h4>
          <div className="tool-detail-examples">
            {tool.fhirExamples.map(ex => (
              <FhirJsonViewer key={ex.title} title={ex.title} data={ex.resource} />
            ))}
          </div>
        </section>
      )}

      {tool.launchActions.length > 0 && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Launch</h4>
          <div className="tool-detail-launch">
            {tool.launchActions.map(action => (
              <Link
                key={action.path}
                to={action.path}
                className={`tool-detail-launch-btn tool-detail-launch-btn--${action.variant ?? 'primary'}`}
              >
                {action.label} &rarr;
              </Link>
            ))}
          </div>
        </section>
      )}

      {tool.pilotPlanSlug && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Pilot Plan</h4>
          <div className="tool-detail-launch">
            <Link
              to={`/implementation-guide/pathway/${tool.pilotPlanSlug}/plan`}
              className="tool-detail-launch-btn tool-detail-launch-btn--secondary"
            >
              View Pilot Plan &rarr;
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

export function PatientJourney() {
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null)

  const toggleTool = (toolId: string) => {
    setExpandedToolId(prev => (prev === toolId ? null : toolId))
  }

  return (
    <div className="patient-journey">
      <h2 className="page-title">Pathway</h2>
      <p className="journey-description">
        The suicide safer care pathway from flagging risk through measuring and sharing pathway activity.
        Tools are grouped by care stage. Click a tool to see its specification, implementation details, data elements, and launch options.
      </p>

      <aside className="journey-zs-callout">
        <strong>Aligned with Zero Suicide.</strong>{' '}
        SPiER's 8 technical stages are a FHIR-native instantiation of the workflow layers of the{' '}
        <a href="https://zerosuicide.edc.org/" target="_blank" rel="noopener noreferrer">Zero Suicide</a>{' '}
        framework. Stages 1&ndash;3 model <em>Identify</em>; stage 4 models <em>Engage</em>;
        stages 5&ndash;6 model <em>Transition</em>; stage 7 models <em>Treat</em>;
        stage 8 models <em>Improve</em>. The organizational layers (<em>Lead</em>, <em>Train</em>)
        are out of SPiER's EHR-pathway scope.
      </aside>

      {/* Horizontal progress bar */}
      <div className="journey-progress">
        {STAGES.map((stage, idx) => (
          <div key={stage.id} className="journey-progress-step">
            <a href={`#stage-${stage.id}`} className="journey-progress-dot">
              {idx + 1}
            </a>
            <span className="journey-progress-label">{stage.title}</span>
            {idx < STAGES.length - 1 && <div className="journey-progress-line" />}
          </div>
        ))}
      </div>

      {/* Stage detail sections */}
      <div className="journey-stages">
        {STAGES.map((stage, idx) => {
          const stageTools = toolsByStage(stage.id)
          const stageTriggers = triggersFromStage(stage.id)
          const nextStage = STAGES[idx + 1]
          const crossStageTriggers = stageTriggers.filter(t => t.toStageId && t.toStageId !== stage.id)
          const ongoingTriggers = stageTriggers.filter(t => !t.toStageId)

          return (
            <div key={stage.id} id={`stage-${stage.id}`} className="journey-stage">
              <div className="stage-header">
                <span className="stage-number">{idx + 1}</span>
                <div>
                  <h3 className="stage-title">{stage.title}</h3>
                  <p className="stage-description">{stage.description}</p>
                </div>
              </div>

              {stageTools.length > 0 && (
                <div className="stage-tools">
                  {stageTools.map(tool => {
                    const isExpanded = expandedToolId === tool.id
                    return (
                      <div
                        key={tool.id}
                        className={`stage-tool-card stage-tool-card--${tool.inclusionStatus} ${isExpanded ? 'stage-tool-card--expanded' : ''}`}
                      >
                        <button
                          type="button"
                          className="stage-tool-summary"
                          onClick={() => toggleTool(tool.id)}
                          aria-expanded={isExpanded}
                        >
                          <div className="stage-tool-header">
                            <span className="stage-tool-name">{tool.name}</span>
                            <span className={`stage-tool-badge stage-tool-badge--${tool.inclusionStatus}`}>
                              {STATUS_LABELS[tool.inclusionStatus]}
                            </span>
                          </div>
                          <p className="stage-tool-purpose">{tool.purpose}</p>
                          {tool.settings.length > 0 && (
                            <p className="stage-tool-settings">{tool.settings.join(', ')}</p>
                          )}
                          <span className="stage-tool-expand-hint">
                            {isExpanded ? 'Hide details \u2191' : 'Show details \u2193'}
                          </span>
                        </button>
                        {isExpanded && <ToolDetail tool={tool} />}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Triggers → next stage */}
              {crossStageTriggers.length > 0 && nextStage && (
                <div className="stage-triggers">
                  <div className="triggers-label">
                    Triggers &rarr; {nextStage.title}
                  </div>
                  {crossStageTriggers.map(trigger => (
                    <div key={trigger.id} className="trigger-item">
                      <span className="trigger-event">{trigger.event}</span>
                      <span className="trigger-condition">{trigger.condition}</span>
                      <span className="trigger-action">{trigger.action}</span>
                    </div>
                  ))}
                </div>
              )}

              {ongoingTriggers.length > 0 && (
                <div className="stage-triggers">
                  <div className="triggers-label">Ongoing Triggers</div>
                  {ongoingTriggers.map(trigger => (
                    <div key={trigger.id} className="trigger-item">
                      <span className="trigger-event">{trigger.event}</span>
                      <span className="trigger-condition">{trigger.condition}</span>
                      <span className="trigger-action">{trigger.action}</span>
                    </div>
                  ))}
                </div>
              )}

              {idx < STAGES.length - 1 && (
                <div className="stage-connector">
                  <div className="stage-connector-arrow">&darr;</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
