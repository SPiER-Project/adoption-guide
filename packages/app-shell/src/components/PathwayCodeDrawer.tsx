/**
 * The pathway's gates and references, as written in the artifact.
 *
 * Every applicability expression, trigger, `definitionCanonical` and
 * `documentation.resource` in the PlanDefinition, listed once per action in a
 * closed disclosure. This is the implementer's half of the protocol: the
 * FHIRPath a CDS engine evaluates to put a patient in a tier column, the
 * profile and code a trigger fires on, and the canonical URL a step resolves
 * to. `PathwaySpine` and `PathwayTierTable` used to print these inline, three
 * times each for the tier gates, in front of every reader (adoption-guide UX
 * audit §1.3, 2026-09-20); they now say the same thing in words, and this is
 * where the wire format went.
 *
 * ⚠️ **Renders NOTHING outside the Adoption Guide, and asks for itself.**
 * Inspection is on inside `/guide` and off everywhere else — see
 * `@spier/tool-views/context/InspectContext`. A clinician's panel composes the
 * same spine and never sees a FHIRPath expression; the guide's protocol page
 * composes this beside it. The gate is here rather than only on the `<pre>`
 * leaves because the disclosure is chrome of its own — a Card holding an empty
 * `<details>` reads worse than either outcome (the same reason `CodeDrawer`
 * checks), which is also why the Card is inside this component and not around
 * it. `npm run check:fhir-render` reads this file's `<pre>` and requires the
 * `useInspect()` call below.
 */
import { useInspect } from '@spier/tool-views/context/InspectContext'
import { flattenActions, type PathwayAction, type PathwayModel } from '@spier/core/lib/pathway'
import '../css/CarePathway.css'
import { Card } from '@spier/ui/Card'

/** The machine-readable facts one action carries, or none. */
function wireFacts(action: PathwayAction) {
  const resources = action.documentation.map(d => d.resource).filter((r): r is string => Boolean(r))
  const count =
    action.triggers.length + action.conditions.length + resources.length + (action.definitionCanonical ? 1 : 0)
  return { resources, count }
}

export function PathwayCodeDrawer({ model }: { model: PathwayModel }) {
  const inspect = useInspect()
  if (!inspect) return null

  const entries = flattenActions(model.steps)
    .map(action => ({ action, ...wireFacts(action) }))
    .filter(e => e.count > 0)
  const total = entries.reduce((n, e) => n + e.count, 0)

  return (
    <Card as="section" tone="muted" aria-label="The gates and references, as written">
      <details>
        <summary className="pathway-code__summary">
          <span className="pathway-code__label">The gates and references, as written</span>
          <span className="pathway-code__hint">
            {total} FHIRPath conditions, triggers and canonical URLs across {entries.length} steps
          </span>
        </summary>
        <p className="pathway-code__lede">
          What a CDS engine evaluates and what a step resolves to, exactly as the artifact states it. The
          protocol above says each of these in words; this is the same fact in its machine-readable form.
        </p>
        <dl className="pathway-code__list">
          {entries.map(({ action, resources }) => (
            <div key={action.id} className="pathway-code__entry">
              <dt className="pathway-code__step">
                {action.title}
                <span className="pathway-code__id">{action.id}</span>
              </dt>
              <dd className="pathway-code__facts">
                {action.triggers.map((trigger, i) => (
                  <div key={`t${i}`} className="pathway-code__fact">
                    <span className="pathway-code__kind">
                      trigger · {trigger.type}{trigger.name ? ` · %${trigger.name}` : ''}
                    </span>
                    <pre className="pathway-code__expr">{trigger.data.join('\n')}</pre>
                  </div>
                ))}
                {action.conditions.map((condition, i) => (
                  <div key={`c${i}`} className="pathway-code__fact">
                    <span className="pathway-code__kind">
                      condition · {condition.kind}{condition.language ? ` · ${condition.language}` : ''}
                    </span>
                    <pre className="pathway-code__expr">{condition.expression}</pre>
                  </div>
                ))}
                {action.definitionCanonical && (
                  <div className="pathway-code__fact">
                    <span className="pathway-code__kind">definitionCanonical</span>
                    <pre className="pathway-code__expr">{action.definitionCanonical}</pre>
                  </div>
                )}
                {resources.map((resource, i) => (
                  <div key={`r${i}`} className="pathway-code__fact">
                    <span className="pathway-code__kind">documentation.resource</span>
                    <pre className="pathway-code__expr">{resource}</pre>
                  </div>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </Card>
  )
}
