import { Link } from 'react-router-dom'
import { WORKFLOW_PHASES } from '../data/workflowData'
import '../css/ClinicalWorkflow.css'

export function ClinicalWorkflow() {
  return (
    <div className="clinical-workflow">
      <h2 className="page-title">Clinical Workflow</h2>
      <p className="workflow-description">
        The suicide prevention clinical pathway from screening through follow-up.
        Active tools link to their FHIR questionnaires. CDS Hook examples show how
        each transition could be triggered in an EHR.
      </p>

      <div className="workflow-swimlane">
        {WORKFLOW_PHASES.map((phase, idx) => (
          <div key={phase.id} className="workflow-phase">
            {/* Phase header */}
            <div className="phase-header">
              <span className="phase-number">{idx + 1}</span>
              <div>
                <h3 className="phase-title">{phase.title}</h3>
                <p className="phase-description">{phase.description}</p>
              </div>
            </div>

            {/* Tool cards */}
            <div className="phase-tools">
              {phase.tools.map(tool => (
                <div key={tool.name} className={`phase-tool-card phase-tool-card--${tool.status}`}>
                  <div className="phase-tool-header">
                    <span className="phase-tool-name">{tool.name}</span>
                    <span className={`phase-tool-status phase-tool-status--${tool.status}`}>
                      {tool.status === 'active' ? 'Active' : 'Coming Soon'}
                    </span>
                  </div>
                  <p className="phase-tool-desc">{tool.description}</p>
                  {tool.status === 'active' && tool.path && (
                    <Link to={tool.path} className="phase-tool-link">
                      Launch Tool &rarr;
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* CDS Hook trigger */}
            {phase.cdsHook && (
              <details className="cds-hook-details">
                <summary className="cds-hook-summary">
                  <span className="cds-hook-icon">&#9889;</span>
                  CDS Hook: <code>{phase.cdsHook.title}</code>
                </summary>
                <div className="cds-hook-body">
                  <p className="cds-hook-desc">{phase.cdsHook.description}</p>
                  <div className="cds-hook-json">
                    <pre>{JSON.stringify(phase.cdsHook.hookJson, null, 2)}</pre>
                  </div>
                </div>
              </details>
            )}

            {/* Arrow connector */}
            {idx < WORKFLOW_PHASES.length - 1 && (
              <div className="phase-connector">
                <div className="phase-connector-arrow">&darr;</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
