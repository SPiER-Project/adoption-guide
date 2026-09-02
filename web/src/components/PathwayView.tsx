/**
 * The pathway, rendered from the PlanDefinition — the parts two surfaces share.
 *
 * Extracted in Phase 4 of docs/plans/suicide-safer-care-pathway.md, when the
 * protocol had to appear in a second place: the SMART panel embedded in a host
 * chart. The two surfaces frame it differently and deliberately so —
 *
 *  - `pages/CarePathway.tsx` (`/guide/pathway`) is the implementer's page: a
 *    lede, the C-SSRS simulator, the whole spine, the pending-definition strip,
 *    provenance last.
 *  - `pages/PathwayProtocol.tsx` (`/patient/pathway`) is the clinician's, and is
 *    what the embedded panel shows. **Provenance leads**, because in an EHR the
 *    claim being made is that the app carried a published artifact in with it.
 *
 * — but neither may re-implement the rendering. A second copy of the spine is
 * how the two would come to disagree about what the artifact says, which is the
 * one thing this whole feature exists to make impossible. So everything that
 * draws a step, a gate, an obligation, a tier column or the provenance facts
 * lives here, once, and each page composes it.
 *
 * ⚠️ **No patient data, in either direction.** The guide page's boundary is
 * gated (`npm run check:guide-boundary` walks its imports transitively, and it
 * reaches this file), and the embedded view holds to the same rule for a
 * different reason: the v1 embedded view renders the *definition*, exactly like
 * the guide page. "Where is this patient on the pathway" is the scenario phase's
 * job, and the panel already has the patient's own rail on the chart behind it.
 */
import { type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { FhirJsonViewer } from './FhirJsonViewer'
import {
  type PathwayAction,
  type PathwayDocumentation,
  type PathwayModel,
} from '@spier/core/lib/pathway'
import '../css/CarePathway.css'

/* ─── Loading ────────────────────────────────────────────────── */

// The artifact itself is loaded by `hooks/usePathway.ts` — a hook cannot live
// beside components without costing them Fast Refresh. What belongs here is how
// a failed load LOOKS, so both surfaces report it the same way.

export function PathwayLoadError({ error }: { error: string | null }) {
  return (
    <div className="pathway-load-error" role="alert">
      <h3 className="pathway-load-error__title">The pathway artifact could not be read</h3>
      <p>
        This page renders <code>PlanDefinition/SPiERSuicideSaferCarePathway</code> and has nothing to
        show without it. Run <code>npm run copy-fhir -- --force</code> in <code>web/</code>.
      </p>
      <pre className="pathway-load-error__detail">{error}</pre>
    </div>
  )
}

/* ─── Small presentational pieces ────────────────────────────── */

function DocumentationNotes({ docs }: { docs: PathwayDocumentation[] }) {
  if (docs.length === 0) return null
  return (
    <ul className="pathway-notes">
      {docs.map((doc, i) => (
        <li key={i} className="pathway-notes__item">
          {doc.label && <span className="pathway-notes__label">{doc.label}</span>}
          {doc.display && <span className="pathway-notes__text">{doc.display}</span>}
          {doc.url && (
            <a className="pathway-notes__link" href={doc.url} target="_blank" rel="noopener noreferrer">
              {doc.url}
            </a>
          )}
          {doc.resource && <code className="pathway-notes__canonical">{doc.resource}</code>}
        </li>
      ))}
    </ul>
  )
}

function Conditions({ action }: { action: PathwayAction }) {
  if (action.conditions.length === 0 && action.triggers.length === 0) return null
  return (
    <div className="pathway-gate">
      {action.triggers.map((trigger, i) => (
        <p key={`t${i}`} className="pathway-gate__row">
          <span className="pathway-gate__kind">on {trigger.type}</span>
          <code className="pathway-gate__expr">{trigger.data.join('  |  ')}</code>
        </p>
      ))}
      {action.conditions.map((condition, i) => (
        <p key={`c${i}`} className="pathway-gate__row">
          <span className="pathway-gate__kind">{condition.kind}</span>
          <code className="pathway-gate__expr">{condition.expression}</code>
        </p>
      ))}
    </div>
  )
}

function Realization({ action }: { action: PathwayAction }) {
  if (!action.definitionCanonical) {
    return <span className="pathway-obligation__protocol">Protocol only — no activity definition</span>
  }
  return (
    <span className="pathway-obligation__def" title={action.definitionCanonical}>
      {action.definitionLabel}
    </span>
  )
}

function Obligation({ action }: { action: PathwayAction }) {
  return (
    <li className="pathway-obligation">
      <p className="pathway-obligation__title">{action.title}</p>
      {action.description && <p className="pathway-obligation__desc">{action.description}</p>}
      <p className="pathway-obligation__meta">
        {action.stage && <span className="pathway-stage-chip">{action.stage.display ?? action.stage.code}</span>}
        <Realization action={action} />
      </p>
      <DocumentationNotes docs={action.documentation} />
    </li>
  )
}

/* ─── The spine ──────────────────────────────────────────────── */

export interface PathwaySpineProps {
  model: PathwayModel
  /**
   * The tier to light up, when a surface has one to show. The guide page passes
   * its simulator's derived tier; the embedded view passes nothing, because it
   * renders the definition and nothing about a patient (Phase 4's hard rule).
   *
   * `undefined` means "no tier is selected", and every column then renders at
   * full strength — a dimmed column implies a choice was made.
   */
  activeTierCode?: string
  /** Rendered under the branch when the active tier is the pathway's exit. */
  exitNote?: ReactNode
}

/**
 * The whole protocol: the ordered steps, with the tier branch expanded in place.
 *
 * Every tier at once, on purpose. The branch is the shape of the protocol, so
 * hiding two-thirds of it behind tabs would hide the thing the page exists to
 * show; wide content scrolls in its own container instead.
 */
export function PathwaySpine({ model, activeTierCode, exitNote }: PathwaySpineProps) {
  const { group: branch, tiers } = model.tierBranch
  const spine = model.steps.filter(step => step.id !== branch.id)
  const branchAt = model.steps.indexOf(branch)
  const before = spine.slice(0, branchAt)
  const after = spine.slice(branchAt)

  // Every step but the last carries a connector arrow to the one below it —
  // real DOM, replacing what used to be a `::after { content: '\2193' }` on
  // every non-last `.pathway-step`, so it now shows up in a screen reader's
  // and a browser extension's DOM the same way any other icon does.
  const renderStep = (step: PathwayAction, showConnector: boolean) => (
    <li key={step.id} id={`pathway-${step.id}`} className="pathway-step">
      <div className="pathway-step__head">
        {step.stage && <span className="pathway-stage-chip">{step.stage.display ?? step.stage.code}</span>}
        <h4 className="pathway-step__title">{step.title}</h4>
      </div>
      {step.description && <p className="pathway-step__desc">{step.description}</p>}
      <Conditions action={step} />
      <DocumentationNotes docs={step.documentation} />
      {step.children.length > 0 && (
        <ul className="pathway-obligations">
          {step.children.map(child => (
            <Obligation key={child.id} action={child} />
          ))}
        </ul>
      )}
      {showConnector && <ChevronDown className="pathway-step-connector" aria-hidden="true" size={20} />}
    </li>
  )

  return (
    <ol className="pathway-spine">
      {before.map(step => renderStep(step, true))}

      <li id={`pathway-${branch.id}`} className="pathway-step pathway-step--branch">
        <div className="pathway-step__head">
          {branch.stage && (
            <span className="pathway-stage-chip">{branch.stage.display ?? branch.stage.code}</span>
          )}
          <h4 className="pathway-step__title">{branch.title}</h4>
        </div>
        {branch.description && <p className="pathway-step__desc">{branch.description}</p>}
        <DocumentationNotes docs={branch.documentation} />

        <div className="pathway-branch__scroll">
          <div className="pathway-branch">
            {tiers.map(tier => {
              const code = tier.tier?.code ?? 'unknown'
              const active = activeTierCode !== undefined && code === activeTierCode
              const dimmed = activeTierCode !== undefined && !active
              return (
                <section
                  key={tier.id}
                  className={
                    `pathway-tier pathway-tier--${code}` +
                    (active ? ' pathway-tier--active' : '') +
                    (dimmed ? ' pathway-tier--dimmed' : '')
                  }
                  aria-current={active ? 'true' : undefined}
                >
                  <header className="pathway-tier__head">
                    <h5 className="pathway-tier__title">{tier.title}</h5>
                    {active && <span className="pathway-tier__flag">simulated result</span>}
                  </header>
                  {tier.description && <p className="pathway-tier__desc">{tier.description}</p>}
                  <Conditions action={tier} />
                  <ul className="pathway-obligations">
                    {tier.children.map(child => (
                      <Obligation key={child.id} action={child} />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>

        {exitNote}

        {after.length > 0 && (
          <ChevronDown className="pathway-step-connector" aria-hidden="true" size={20} />
        )}
      </li>

      {after.map((step, i) => renderStep(step, i < after.length - 1))}
    </ol>
  )
}

/* ─── Pending clinical definition (page copy, NOT the artifact) ── */

/**
 * The three things the source diagram states and the artifact deliberately does
 * not encode. Page copy rather than a render of anything, and labelled as such
 * on both surfaces — a published protocol must not encode what is not settled,
 * and a reader must not have to guess which parts came from the artifact.
 */
export function PathwayPending() {
  return (
    <section className="pathway-pending" aria-labelledby="pathway-pending-title">
      <h3 id="pathway-pending-title" className="pathway-section-title">Pending clinical definition</h3>
      <p className="pathway-pending__lede">
        Three things the source diagram states are deliberately <strong>absent from the published
        artifact</strong>, because a published protocol must not encode what is not settled. They are
        stated here as page copy, each with the question that blocks it.
      </p>
      <dl className="pathway-pending__list">
        <dt>Step-down criteria</dt>
        <dd>
          The diagram de-escalates a tier on a &ldquo;No&rdquo; streak plus a milestone-free window, a
          minimum time in tier and psychiatric-consultant agreement &mdash; with the streak asymmetric
          (30 days at Low and Moderate, 90 at High). <em>Open question:</em> is that the rule, and how hard
          is the gate? Until it is confirmed, publishing it would tell a site to de-escalate suicide risk
          on an unreviewed rule.
        </dd>
        <dt>Milestone events</dt>
        <dd>
          The step-down rule counts &ldquo;milestone events&rdquo;, and the diagram&rsquo;s list is
          explicitly open-ended &mdash; hospitalization, medication change, incarceration, geographic move,
          recent homelessness, a new DCF/CPS/APS case, an impactful SDOH change, psychotic features,
          substance reuse, &ldquo;but not limited to&rdquo;. <em>Open question:</em> what closes the list?
          A partial CodeSystem would read as complete.
        </dd>
        <dt>Historical risk</dt>
        <dd>
          The diagram carries a fourth tier for a lifetime history with no current ideation. The published
          C-SSRS scores that response pattern differently, and{' '}
          <code>SPiERSuicideRiskTier</code> has no <code>historical</code> code. <em>Open question:</em> is
          historical risk an orthogonal history flag rather than a fifth ordinal tier? The answer lands in
          the concept layer once, and this pathway&rsquo;s branch stays low / moderate / high until it does.
        </dd>
      </dl>
    </section>
  )
}

/* ─── Provenance ─────────────────────────────────────────────── */

export interface PathwayProvenanceProps {
  model: PathwayModel
  /**
   * `footer` — the guide page's closing section: "here is the artifact this page
   * was drawn from", after the thing it explains.
   *
   * `lead` — the embedded panel's opening claim, and the reason Phase 4 exists.
   * Inside an EHR, "the app carried this published artifact in with it" IS the
   * demonstration: the canonical URL and version are not a footnote about
   * sourcing, they are the headline, so they render first and large. Same facts,
   * same JSON, different weight.
   */
  variant?: 'footer' | 'lead'
  /** Lede paragraph. Each surface says why provenance matters *there*. */
  children?: ReactNode
}

export function PathwayProvenance({ model, variant = 'footer', children }: PathwayProvenanceProps) {
  const lead = variant === 'lead'
  return (
    <section
      className={`pathway-provenance${lead ? ' pathway-provenance--lead' : ''}`}
      aria-labelledby="pathway-provenance-title"
    >
      <h3 id="pathway-provenance-title" className="pathway-section-title">
        {lead ? 'Published artifact' : 'Provenance'}
      </h3>
      {children}

      {lead && (
        <p className="pathway-provenance__canonical">
          <code>{model.url}</code>
        </p>
      )}

      <dl className="pathway-provenance__facts">
        {!lead && (
          <div className="pathway-provenance__fact">
            <dt>Canonical</dt>
            <dd><code>{model.url}</code></dd>
          </div>
        )}
        <div className="pathway-provenance__fact">
          <dt>Version</dt>
          <dd>{model.version}</dd>
        </div>
        <div className="pathway-provenance__fact">
          <dt>Status</dt>
          <dd>{model.status}{model.experimental ? ' · experimental' : ''}</dd>
        </div>
        {model.typeDisplay && (
          <div className="pathway-provenance__fact">
            <dt>Type</dt>
            <dd>{model.typeDisplay}</dd>
          </div>
        )}
        {model.publisher && (
          <div className="pathway-provenance__fact">
            <dt>Publisher</dt>
            <dd>{model.publisher}</dd>
          </div>
        )}
      </dl>

      {model.relatedArtifacts.length > 0 && (
        <div className="pathway-provenance__related">
          <h4 className="pathway-provenance__subtitle">Measured by</h4>
          <ul className="pathway-notes">
            {model.relatedArtifacts.map((related, i) => (
              <li key={i} className="pathway-notes__item">
                {related.label && <span className="pathway-notes__label">{related.label}</span>}
                {related.display && <span className="pathway-notes__text">{related.display}</span>}
                {related.resource && <code className="pathway-notes__canonical">{related.resource}</code>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FhirJsonViewer title="PlanDefinition/SPiERSuicideSaferCarePathway" data={model.raw} />
    </section>
  )
}
