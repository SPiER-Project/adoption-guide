/**
 * The expanded drill-in for one catalogue tool on the Tools page: what it is
 * for, how it is recorded (the implementation table), the data elements it
 * binds, its FHIR examples, and how to launch it.
 *
 * Lived inside PatientJourney.tsx as a 118-line private function — the
 * expanded content of a different view rendered inline in the page that
 * lists the tools. Extracted so the page is the list and this is the detail
 * (maintainability audit 2026-09-15, §2.5).
 */
import { Link } from 'react-router-dom'
import { bindingsUsedByTool, systemLabel, type Tool } from '@spier/core/data/catalog'
import { FhirJsonViewer } from './FhirJsonViewer'
import { Pill } from './Pill'
import { DataTable } from './DataTable'
import '../css/ToolDetail.css'

interface ToolDetailProps {
  tool: Tool
}

export function ToolDetail({ tool }: ToolDetailProps) {
  const bindings = bindingsUsedByTool(tool.id)

  return (
    <div className="tool-detail">
      {tool.description && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Purpose & Settings</h4>
          <p className="tool-detail-body">{tool.description}</p>
          <div className="tool-detail-meta">
            <span className="tool-detail-meta-label">Settings:</span>
            {tool.settings.map(s => (
              <Pill key={s} variant="label">{s}</Pill>
            ))}
          </div>
          {tool.tags && tool.tags.length > 0 && (
            <div className="tool-detail-meta">
              <span className="tool-detail-meta-label">Tags:</span>
              {tool.tags.map(t => (
                <Pill key={t} variant="label" tone="warning">{t}</Pill>
              ))}
            </div>
          )}
        </section>
      )}

      {tool.recordingPattern && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Implementation</h4>
          <DataTable tableClassName="tool-detail-table">
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
          </DataTable>
          {tool.recordingPattern.workflowTrigger && (
            <p className="tool-detail-trigger">
              <strong>Workflow trigger:</strong> {tool.recordingPattern.workflowTrigger}
            </p>
          )}
        </section>
      )}

      {bindings.length > 0 && (
        <section className="tool-detail-section">
          <h4 className="tool-detail-heading">Data Elements ({bindings.length})</h4>
          <ul className="tool-detail-elements">
            {bindings.map(b => (
              <li key={b.id}>
                <span className="tool-detail-element-name">{b.name}</span>
                {b.code ? (
                  <code className="tool-detail-element-code">
                    {systemLabel(b.code.system)}: {b.code.code}
                  </code>
                ) : b.value ? (
                  /*
                    No code of its own, but the value is coded — name the value
                    vocabulary rather than showing nothing. Before #260 these rows
                    had nowhere to put this and appeared bare here.
                  */
                  <code className="tool-detail-element-code">
                    {systemLabel(b.value.system)} (values)
                  </code>
                ) : null}
                {/* fhirPath is resource-qualified already — don't prefix it again. */}
                <span className="tool-detail-element-path">{b.fhirPath}</span>
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

    </div>
  )
}
