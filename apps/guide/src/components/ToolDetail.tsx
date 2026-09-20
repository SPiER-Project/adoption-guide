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
import { bindingsUsedByTool, systemLabel, type Tool } from '@spier/core/data/catalog'
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import { Pill } from '@spier/ui/Pill'
import { DataTable } from '@spier/ui/DataTable'
import '../css/ToolDetail.css'
import { Button } from '@spier/ui/Button'
import { guideTryHref } from '../data/surfaceLinks'
import { MOCK_EHR_LABEL, MOCK_EHR_URL } from '../data/surfaces'

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
          <h4 className="tool-detail-heading">Try it</h4>
          {/* ⚠️ The catalog's launch path is the CLINICIAN's route — what a CDS
              card's `type: "smart"` link and a SMART `intent` resolve to — and
              it is a route of apps/clinical, not of this app. Until 2026-09-20
              the first button here linked it directly, and since the apps split
              every one of those 33 buttons fell to the guide's catch-all and
              landed on the Overview. The guide explains and hosts; the mock EHR
              holds and launches (CLAUDE.md) — so the form opens on the guide's
              own try route, and the clinician's launch is the Demo EHR's to
              offer. `guideTryHref` returns null for a launch path nothing here
              renders (the measures dashboard), and that tool gets only the
              outbound button rather than a dead one. */}
          <div className="tool-detail-launch">
            {tool.launchActions.map(action => {
              const tryIt = guideTryHref(action.path)
              return tryIt ? (
                <Button key={action.path} to={tryIt} variant={action.variant ?? 'primary'} size="sm" arrow>
                  {/* The catalog's label is the clinician's verb; here the
                      button opens a form on this page's origin, so it says so. */}
                  {action.label.replace(/^Launch\s+/, 'Try ')}
                </Button>
              ) : null
            })}
            <Button href={MOCK_EHR_URL} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
              Launch from the {MOCK_EHR_LABEL}
            </Button>
          </div>
          <p className="tool-detail-body">
            The form opens here with the FHIR view on: the Questionnaire it is built from, the response
            your answers produce, and what SPiER would write back. A clinician meets the same form from a
            patient&rsquo;s chart, with none of that showing &mdash; open the {MOCK_EHR_LABEL} and press{' '}
            <strong>Launch SPiER</strong> to see it that way.
          </p>
        </section>
      )}

    </div>
  )
}
