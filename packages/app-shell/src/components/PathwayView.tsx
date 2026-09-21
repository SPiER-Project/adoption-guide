/**
 * The pathway, rendered from the PlanDefinition — the parts two surfaces share.
 *
 * Extracted in Phase 4 of docs/plans/suicide-safer-care-pathway.md, when the
 * protocol had to appear in a second place: the SMART panel embedded in a host
 * chart. Three pages compose it now, and frame it differently on purpose —
 *
 *  - `apps/guide` `/guide/pathway` (pages/CarePathway.tsx) is the explainer: what
 *    a suicide-safer care pathway does, the C-SSRS simulator, and the tier
 *    TABLE lit by the simulator's result. No spine, no provenance.
 *  - `apps/guide` `/guide/pathway/protocol` (pages/CarePathwayProtocol.tsx) is
 *    the implementer's page: the whole spine, the pending-definition strip, the
 *    gates and canonicals in a drawer, provenance and the JSON last.
 *  - `apps/clinical` `/patient/pathway` (pages/PathwayProtocol.tsx) is the
 *    clinician's, and is what the embedded panel shows. **Provenance leads**,
 *    because in an EHR the claim being made is that the app carried a published
 *    artifact in with it.
 *
 * — but none may re-implement the rendering. A second copy of the spine is how
 * two of them would come to disagree about what the artifact says, which is the
 * one thing this whole feature exists to make impossible. So everything that
 * draws a step, an obligation, the tier table or the provenance facts lives
 * here, once, and each page composes it.
 *
 * ── The tier branch is a TABLE, not three columns (2026-09-20) ────
 *
 * The branch used to render one column per tier, each listing that tier's
 * obligations in full — so "share crisis resources" and "reassess on cadence"
 * appeared three times, and the FHIRPath gate three times under them. The
 * source diagram draws the same thing as a matrix, obligation × tier, with a
 * row spanning every tier it applies to. `PathwayTierTable` draws that, from
 * `@spier/core/lib/pathwayMatrix`, on every surface; the guide's explainer
 * lights the column its simulator produced.
 *
 * ── No FHIRPath and no canonical URL in the spine ─────────────────
 *
 * The applicability expressions, the triggers and the `documentation.resource`
 * canonicals are the implementer's half. They render in `PathwayCodeDrawer`,
 * which returns null without inspection — so the clinician's panel shows the
 * protocol in words, and the guide's protocol page shows the words with the
 * wire format one disclosure away. A step's `definitionCanonical` keeps its
 * short label (`ActivityDefinition/AdministerPHQ9`) here, because that names
 * the realization rather than quoting a URL.
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
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import {
  type PathwayAction,
  type PathwayDocumentation,
  type PathwayModel,
} from '@spier/core/lib/pathway'
import { buildTierMatrix } from '@spier/core/lib/pathwayMatrix'
import '../css/CarePathway.css'
import { cx } from '@spier/ui/cx'
import { Notice } from '@spier/ui/Notice'
import { Card } from '@spier/ui/Card'
import { DataTable } from '@spier/ui/DataTable'

/* ─── Loading ────────────────────────────────────────────────── */

// The artifact itself is loaded by `hooks/usePathway.ts` — a hook cannot live
// beside components without costing them Fast Refresh. What belongs here is how
// a failed load LOOKS, so both surfaces report it the same way.

export function PathwayLoadError({ error }: { error: string | null }) {
  return (
    <Notice tone="warning" title="The pathway artifact could not be read">
      <p>
        This page renders <code>PlanDefinition/SPiERSuicideSaferCarePathway</code> and has nothing to
        show without it. Run <code>npm run copy-fhir -- --force</code> at the repo root.
      </p>
      <pre>{error}</pre>
    </Notice>
  )
}

/* ─── Small presentational pieces ────────────────────────────── */

/**
 * The notes the artifact attaches to a step, in words: label, text and an
 * external link. A note's `resource` — a canonical URL of another SPiER
 * artifact — is not drawn here; it is listed in `PathwayCodeDrawer`. A note
 * that carries only a resource is therefore skipped, since it would render as
 * a label over nothing.
 */
function DocumentationNotes({ docs }: { docs: PathwayDocumentation[] }) {
  const shown = docs.filter(doc => doc.display || doc.url)
  if (shown.length === 0) return null
  return (
    <ul className="pathway-notes">
      {shown.map((doc, i) => (
        <li key={i} className="pathway-notes__item">
          {doc.label && <span className="pathway-notes__label">{doc.label}</span>}
          {doc.display && <span className="pathway-notes__text">{doc.display}</span>}
          {doc.url && (
            <a className="pathway-notes__link" href={doc.url} target="_blank" rel="noopener noreferrer">
              {doc.url}
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

function Realization({ canonical, label }: { canonical?: string; label?: string }) {
  if (!canonical) {
    return <span className="pathway-obligation__protocol">Protocol only — no activity definition</span>
  }
  return (
    <span className="pathway-obligation__def" title={canonical}>
      {label}
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
        <Realization canonical={action.definitionCanonical} label={action.definitionLabel} />
      </p>
      <DocumentationNotes docs={action.documentation} />
    </li>
  )
}

/* ─── The tier table ─────────────────────────────────────────── */

export interface PathwayTierTableProps {
  /** The tier groups, in the order the artifact states them. */
  tiers: PathwayAction[]
  /**
   * The tier to light up, when a surface has one to show. The guide's
   * explainer passes its simulator's derived tier; the protocol pages pass
   * nothing, because they render the definition and nothing about a patient
   * (Phase 4's hard rule).
   *
   * `undefined` means "no tier is selected", and every column then renders at
   * full strength — a dimmed column implies a choice was made.
   */
  activeTierCode?: string
  /** Draw the table in its own frame (outside a Card) rather than bare (inside one). */
  framed?: boolean
}

/**
 * Obligation × tier. A cell spanning several tiers is one obligation those
 * tiers state identically; a dash is a tier that does not owe it. The first
 * body row is each tier's gate, in the artifact's own words.
 */
export function PathwayTierTable({ tiers, activeTierCode, framed }: PathwayTierTableProps) {
  const rows = buildTierMatrix(tiers)
  const selecting = activeTierCode !== undefined
  const state = (tierCodes: string[]) =>
    !selecting ? undefined
      : tierCodes.includes(activeTierCode) ? 'pathway-matrix__cell--active'
      : 'pathway-matrix__cell--dimmed'

  return (
    <DataTable framed={framed} tableClassName="pathway-matrix">
      <thead>
        <tr>
          <th scope="col" className="pathway-matrix__corner">Obligation</th>
          {tiers.map(tier => {
            const code = tier.tier?.code ?? 'unknown'
            const active = selecting && code === activeTierCode
            return (
              <th
                key={tier.id}
                scope="col"
                className={cx('pathway-matrix__tier', `pathway-matrix__tier--${code}`, state([code]))}
                aria-current={active ? 'true' : undefined}
              >
                <span className="pathway-matrix__swatch" aria-hidden="true" />
                {tier.title}
                {active && <span className="pathway-matrix__flag">simulated result</span>}
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {/* The gate row: what puts a patient in each column, from the tier
            group's own description. The FHIRPath that a CDS engine evaluates
            for the same question is in the code drawer. */}
        <tr className="pathway-matrix__gate">
          <th scope="row" className="pathway-matrix__obligation">
            <p className="pathway-obligation__title">Applies when</p>
          </th>
          {tiers.map(tier => (
            <td key={tier.id} className={cx('pathway-matrix__cell', state([tier.tier?.code ?? 'unknown']))}>
              <p className="pathway-matrix__desc">{tier.description}</p>
            </td>
          ))}
        </tr>
        {rows.map(row => (
          <tr key={row.title}>
            <th scope="row" className="pathway-matrix__obligation">
              <p className="pathway-obligation__title">{row.title}</p>
              {row.description && <p className="pathway-obligation__desc">{row.description}</p>}
              <p className="pathway-obligation__meta">
                {row.stage && <span className="pathway-stage-chip">{row.stage.display ?? row.stage.code}</span>}
                <Realization canonical={row.definitionCanonical} label={row.definitionLabel} />
              </p>
            </th>
            {row.cells.map(cell =>
              cell.kind === 'owed' ? (
                <td
                  key={cell.tierCodes.join('+')}
                  colSpan={cell.span}
                  className={cx('pathway-matrix__cell', 'pathway-matrix__cell--owed', state(cell.tierCodes))}
                >
                  <span className="pathway-matrix__mark">Owed</span>
                  <DocumentationNotes docs={cell.action.documentation} />
                </td>
              ) : (
                <td
                  key={cell.tierCode}
                  className={cx('pathway-matrix__cell', 'pathway-matrix__cell--none', state([cell.tierCode]))}
                >
                  <span aria-hidden="true">—</span>
                  <span className="pathway-matrix__hidden">Not owed at this tier</span>
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}

/* ─── The spine ──────────────────────────────────────────────── */

export interface PathwaySpineProps {
  model: PathwayModel
  /** Passed through to the tier table — see `PathwayTierTableProps`. */
  activeTierCode?: string
  /** Rendered under the tier table when the active tier is the pathway's exit. */
  exitNote?: ReactNode
}

/**
 * The whole protocol: the ordered steps, with the tier branch expanded in place
 * as the tier table.
 *
 * Every tier at once, on purpose. The branch is the shape of the protocol, so
 * hiding two-thirds of it behind tabs would hide the thing the page exists to
 * show; the table scrolls in its own container where it is wider than the page.
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
    <Card as="li" accent key={step.id} id={`pathway-${step.id}`} className="pathway-step">
      <div className="pathway-step__head">
        {step.stage && <span className="pathway-stage-chip">{step.stage.display ?? step.stage.code}</span>}
        <h4 className="pathway-step__title">{step.title}</h4>
      </div>
      {step.description && <p className="pathway-step__desc">{step.description}</p>}
      <DocumentationNotes docs={step.documentation} />
      {step.children.length > 0 && (
        <ul className="pathway-obligations">
          {step.children.map(child => (
            <Obligation key={child.id} action={child} />
          ))}
        </ul>
      )}
      {showConnector && <ChevronDown className="pathway-step-connector" aria-hidden="true" size={20} />}
    </Card>
  )

  return (
    <ol className="pathway-spine">
      {before.map(step => renderStep(step, true))}

      <Card as="li" accent id={`pathway-${branch.id}`} className="pathway-step pathway-step--branch">
        <div className="pathway-step__head">
          {branch.stage && (
            <span className="pathway-stage-chip">{branch.stage.display ?? branch.stage.code}</span>
          )}
          <h4 className="pathway-step__title">{branch.title}</h4>
        </div>
        {branch.description && <p className="pathway-step__desc">{branch.description}</p>}
        <DocumentationNotes docs={branch.documentation} />

        <div className="pathway-branch">
          <PathwayTierTable tiers={tiers} activeTierCode={activeTierCode} />
        </div>

        {exitNote}

        {after.length > 0 && (
          <ChevronDown className="pathway-step-connector" aria-hidden="true" size={20} />
        )}
      </Card>

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
   * `footer` — the guide's protocol page's closing section: "here is the
   * artifact this page was drawn from", after the thing it explains.
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
    <Card
      as="section"
      tone="muted"
      className={cx('pathway-provenance', lead && 'pathway-provenance--lead')}
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
    </Card>
  )
}
