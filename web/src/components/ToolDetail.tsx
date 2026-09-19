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
import { isToolViewSlug } from '@spier/tool-views/data/toolViews'

/**
 * The guide's own route for a tool's recorder: the same view the clinician's
 * launch path renders, with the FHIR opened up.
 *
 * ⚠️ Derived from the launch path's LAST SEGMENT rather than from a second
 * hand-kept list. `TOOL_VIEWS` is keyed by that segment, and `isToolViewSlug`
 * is what stops this offering a link to a slug with no view — a tool whose
 * launch path points somewhere `TOOL_VIEWS` does not cover simply gets no
 * "try it" button rather than a dead one.
 */
function tryItHref(launchPath: string): string | null {
  const slug = launchPath.split(/[?#]/)[0].split('/').filter(Boolean).pop()
  return isToolViewSlug(slug) ? `/guide/tools/${slug}/try` : null
}

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
          {/* Two buttons per action, and they are two different claims. The
              first is the CLINICIAN's path — the one the catalog publishes, the
              one a CDS card's `type: "smart"` link and a SMART `intent` both
              resolve to — and it renders the recorder exactly as a clinician
              meets it, with no FHIR anywhere. The second is this guide's own
              route, which renders the same element with the wire format opened
              up. Before 2026-09-17 there was one button and one route serving
              both readers, which is why a clinician saw JSON. */}
          <div className="tool-detail-launch">
            {tool.launchActions.map(action => {
              const tryIt = tryItHref(action.path)
              return (
                <span key={action.path} className="tool-detail-launch-pair">
                  <Button to={action.path} variant={action.variant ?? 'primary'} size="sm" arrow>
                    {action.label}
                  </Button>
                  {tryIt && (
                    <Button to={tryIt} variant="secondary" size="sm">
                      Try it with the FHIR view
                    </Button>
                  )}
                </span>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
