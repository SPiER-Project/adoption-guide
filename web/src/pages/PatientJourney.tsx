import { Link } from 'react-router-dom'
import { CARE_STAGES } from '../data/patientJourneyData'
import '../css/PatientJourney.css'

const STATUS_LABELS: Record<string, string> = {
  core: 'Core',
  optional: 'Optional',
  future: 'Future',
}

export function PatientJourney() {
  return (
    <div className="patient-journey">
      <h2 className="page-title">Patient Journey</h2>
      <p className="journey-description">
        The suicide safer care pathway from screening through monitoring.
        Tools are grouped by care stage. Triggers show what moves a patient between stages.
      </p>

      {/* Horizontal progress bar */}
      <div className="journey-progress">
        {CARE_STAGES.map((stage, idx) => (
          <div key={stage.id} className="journey-progress-step">
            <a href={`#stage-${stage.id}`} className="journey-progress-dot">
              {idx + 1}
            </a>
            <span className="journey-progress-label">{stage.title}</span>
            {idx < CARE_STAGES.length - 1 && <div className="journey-progress-line" />}
          </div>
        ))}
      </div>

      {/* Stage detail sections */}
      <div className="journey-stages">
        {CARE_STAGES.map((stage, idx) => (
          <div key={stage.id} id={`stage-${stage.id}`} className="journey-stage">
            <div className="stage-header">
              <span className="stage-number">{idx + 1}</span>
              <div>
                <h3 className="stage-title">{stage.title}</h3>
                <p className="stage-description">{stage.description}</p>
              </div>
            </div>

            <div className="stage-tools">
              {stage.tools.map(tool => (
                <div key={tool.toolId} className={`stage-tool-card stage-tool-card--${tool.inclusionStatus}`}>
                  <div className="stage-tool-header">
                    <span className="stage-tool-name">{tool.name}</span>
                    <span className={`stage-tool-badge stage-tool-badge--${tool.inclusionStatus}`}>
                      {STATUS_LABELS[tool.inclusionStatus]}
                    </span>
                  </div>
                  <p className="stage-tool-purpose">{tool.purpose}</p>
                  {tool.settings && (
                    <p className="stage-tool-settings">{tool.settings}</p>
                  )}
                  {tool.path && (
                    <Link to={tool.path} className="stage-tool-link">
                      Launch Tool &rarr;
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Triggers → next stage */}
            {stage.triggers.length > 0 && idx < CARE_STAGES.length - 1 && (
              <div className="stage-triggers">
                <div className="triggers-label">
                  Triggers &rarr; {CARE_STAGES[idx + 1]?.title}
                </div>
                {stage.triggers.map(trigger => (
                  <div key={trigger.triggerId} className="trigger-item">
                    <span className="trigger-event">{trigger.event}</span>
                    <span className="trigger-condition">{trigger.condition}</span>
                    <span className="trigger-action">{trigger.action}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Show triggers even for last stage (Monitor) as completion triggers */}
            {stage.triggers.length > 0 && idx === CARE_STAGES.length - 1 && (
              <div className="stage-triggers">
                <div className="triggers-label">Ongoing Triggers</div>
                {stage.triggers.map(trigger => (
                  <div key={trigger.triggerId} className="trigger-item">
                    <span className="trigger-event">{trigger.event}</span>
                    <span className="trigger-condition">{trigger.condition}</span>
                    <span className="trigger-action">{trigger.action}</span>
                  </div>
                ))}
              </div>
            )}

            {idx < CARE_STAGES.length - 1 && (
              <div className="stage-connector">
                <div className="stage-connector-arrow">&darr;</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
