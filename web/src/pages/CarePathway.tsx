/**
 * Care Pathway — the Suicide Safer Care protocol, rendered from the artifact.
 *
 * Phase 3 of docs/plans/suicide-safer-care-pathway.md. Two claims this page
 * makes, both of which are meant to be literally true rather than rhetorical:
 *
 *  1. **Everything in the spine comes from the PlanDefinition.** Step titles,
 *     descriptions, stage codes, tier gates, FHIRPath conditions, documentation
 *     notes and the artifacts each step is realized by are all read out of
 *     `PlanDefinition-SPiERSuicideSaferCarePathway` by `@spier/core/lib/pathway`.
 *     The provenance strip at the bottom shows the same JSON the page drew
 *     itself from, so the claim is inspectable. The one exception is labelled:
 *     the "Pending clinical definition" strip is page copy, precisely because
 *     the artifact deliberately does not encode those three things.
 *
 *  2. **The simulator runs the shipped mapper.** Toggling a C-SSRS answer
 *     builds a *native-shaped* QuestionnaireResponse — item nesting and every
 *     `value[x]` derived from the C-SSRS Screener Questionnaire itself, via
 *     `buildNativeQuestionnaireResponse` — and feeds it to `mapCSSRSScreener`,
 *     the same function the app runs on a real submission. So the demo cannot
 *     drift from the shipped derivation. That is #327 applied as a design
 *     choice: the bug there was a test fixture that asserted a shape the app
 *     never produced, and a demo that hand-rolled its own ladder would be the
 *     same mistake with a bigger audience.
 *
 * ⚠️ A GUIDE SUB-PAGE. It renders inside AdoptionGuide's header, so it must not
 * render a page header of its own and must not pad its own root — `npm run
 * check:template` gates both, the header rule in the reverse direction (a page
 * outside its LENSES allowlist may not grow one). And it holds no patient data:
 * the simulator's input is synthetic
 * and the page imports mappers, never fixtures (`npm run check:guide-boundary`
 * walks these imports transitively).
 */
import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { cssrsScreener } from '@spier/core/data/questionnaires'
import { buildNativeQuestionnaireResponse } from '@spier/core/lib/nativeQuestionnaireResponse'
import { mapCSSRSScreener } from '@spier/core/lib/observationMappers/cssrsScreener'
import { tierCodeForLevel } from '@spier/core/lib/reassessment'
import { loadPathway, type PathwayAction, type PathwayDocumentation } from '@spier/core/lib/pathway'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import { guideHref } from '../data/guideSections'
import '../css/CarePathway.css'

/* ─── The simulator's questions, derived from the Questionnaire ─── */

/** The C-SSRS items the simulator offers, in the order the instrument asks them. */
const SIM_LINK_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const
const Q6_RECENT = 'q6-recent'

type SimAnswers = Record<string, boolean>

interface QItemLike {
  linkId?: string
  text?: string
  type?: string
  item?: QItemLike[]
}

/**
 * The Questionnaire's own wording for one item.
 *
 * Throws on a linkId the instrument does not declare — the same discipline the
 * response builder applies to answer shapes. A renamed item should break this
 * page loudly rather than render a blank toggle.
 */
function questionText(linkId: string): string {
  const find = (items: QItemLike[] | undefined): QItemLike | undefined => {
    for (const item of items ?? []) {
      if (item.linkId === linkId) return item
      const nested = find(item.item)
      if (nested) return nested
    }
    return undefined
  }
  const item = find((cssrsScreener as unknown as QItemLike).item)
  if (!item?.text) {
    throw new Error(`CarePathway: the C-SSRS Screener Questionnaire declares no item "${linkId}" with text`)
  }
  return item.text
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

/* ─── The page ───────────────────────────────────────────────── */

export function CarePathway() {
  const location = useLocation()

  const [answers, setAnswers] = useState<SimAnswers>({
    q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, [Q6_RECENT]: false,
  })

  const loaded = useMemo(() => {
    try {
      return { model: loadPathway(), error: null as string | null }
    } catch (e) {
      return { model: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [])

  const simulation = useMemo(() => {
    // Mirror the form: `q6-recent` is `enableWhen` q6 = Yes, so an unanswered
    // follow-up is *absent* rather than answered "No".
    const supplied: SimAnswers = { ...answers }
    if (!answers.q6) delete supplied[Q6_RECENT]
    const response = buildNativeQuestionnaireResponse(cssrsScreener, supplied)
    const result = mapCSSRSScreener(response)
    const riskObservation = result.observations.find(
      o => o.code?.coding?.some(c => c.code === '93374-7'),
    )
    return {
      response,
      result,
      riskObservation,
      tierCode: tierCodeForLevel(result.riskAlert.level),
    }
  }, [answers])

  // ⚠️ Route migration, not a feature. /guide/pathway served the stage-organized
  // tool catalogue until this page took the path over; its anchors were
  // `#stage-<stage id>` and were linked from the catalogue's own progress bar.
  // Same reasoning as the /guide/measures redirect: a path that was published
  // keeps working. Only the catalogue's anchor scheme is forwarded — this page's
  // own anchors are `#pathway-…`, so they cannot collide.
  if (/^#stage-[a-z0-9-]+$/.test(location.hash)) {
    return <Navigate to={`${guideHref('tools')}${location.hash}`} replace />
  }

  if (!loaded.model) {
    return (
      <div className="care-pathway">
        <div className="pathway-load-error" role="alert">
          <h3 className="pathway-load-error__title">The pathway artifact could not be read</h3>
          <p>
            This page renders <code>PlanDefinition/SPiERSuicideSaferCarePathway</code> and has nothing to
            show without it. Run <code>npm run copy-fhir -- --force</code> in <code>web/</code>.
          </p>
          <pre className="pathway-load-error__detail">{loaded.error}</pre>
        </div>
      </div>
    )
  }

  const model = loaded.model
  const { group: branch, tiers } = model.tierBranch
  const spine = model.steps.filter(step => step.id !== branch.id)
  const before = spine.slice(0, model.steps.indexOf(branch))
  const after = spine.slice(model.steps.indexOf(branch))

  const toggle = (linkId: string) =>
    setAnswers(prev => {
      const next = { ...prev, [linkId]: !prev[linkId] }
      // Turning q6 off retires its follow-up, the way the form's enableWhen does.
      if (linkId === 'q6' && !next.q6) next[Q6_RECENT] = false
      return next
    })

  const renderStep = (step: PathwayAction) => (
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
    </li>
  )

  return (
    <div className="care-pathway">
      <p className="care-pathway__lede">
        One ordered course of suicide-safer care: screen, gate on the result, clarify the risk, then apply
        the obligations that risk tier carries. Everything below the simulator is <strong>rendered from
        the published PlanDefinition</strong> &mdash; the steps, their gates, the tier branch and every
        note are read from the artifact rather than restated here. The instruments named are the
        realization SPiER demonstrates end to end; the steps themselves are coded by what they accomplish,
        so a site using different instruments satisfies the same protocol. For the instruments and
        recorders themselves, see the <Link to={guideHref('tools')}>Tools</Link> catalog.
      </p>

      {/* ── Simulator ─────────────────────────────────────────── */}
      <section className="pathway-sim" aria-labelledby="pathway-sim-title">
        <h3 id="pathway-sim-title" className="pathway-sim__title">Try a C-SSRS result</h3>
        <p className="pathway-sim__lede">
          Answer the C-SSRS Screener below and watch the branch light up. The answers are built into a
          QuestionnaireResponse shaped the way SPiER&rsquo;s own form builds one &mdash; item nesting and the
          SNOMED Yes/No codings read off the Questionnaire &mdash; and run through the same
          <code> mapCSSRSScreener </code> the app runs on a real submission. Synthetic input only; no
          patient data is involved.
        </p>

        <ul className="pathway-sim__questions">
          {SIM_LINK_IDS.map((linkId, idx) => (
            <li key={linkId} className="pathway-sim__question">
              <label className="pathway-sim__label">
                <input
                  type="checkbox"
                  className="pathway-sim__toggle"
                  checked={answers[linkId]}
                  onChange={() => toggle(linkId)}
                />
                <span className="pathway-sim__q">Q{idx + 1}</span>
                <span className="pathway-sim__text">{questionText(linkId)}</span>
              </label>
              {linkId === 'q6' && answers.q6 && (
                <label className="pathway-sim__label pathway-sim__label--nested">
                  <input
                    type="checkbox"
                    className="pathway-sim__toggle"
                    checked={answers[Q6_RECENT]}
                    onChange={() => toggle(Q6_RECENT)}
                  />
                  <span className="pathway-sim__q">Q6a</span>
                  <span className="pathway-sim__text">{questionText(Q6_RECENT)}</span>
                </label>
              )}
            </li>
          ))}
        </ul>

        <div className={`pathway-sim__result pathway-sim__result--${simulation.tierCode}`} aria-live="polite">
          <span className="pathway-sim__result-label">Derived tier</span>
          <span className="pathway-sim__result-tier">{simulation.tierCode}</span>
          <span className="pathway-sim__result-detail">{simulation.result.riskAlert.detail}</span>
        </div>

        <div className="pathway-sim__json">
          <FhirJsonViewer
            title="QuestionnaireResponse the simulator built (Capture)"
            data={simulation.response}
          />
          {simulation.riskObservation && (
            <FhirJsonViewer
              title="Risk-tier Observation the mapper derived (Translate)"
              data={simulation.riskObservation}
            />
          )}
        </div>
      </section>

      {/* ── The spine ─────────────────────────────────────────── */}
      <section className="pathway-spine-section" aria-labelledby="pathway-spine-title">
        <h3 id="pathway-spine-title" className="pathway-section-title">The pathway</h3>
        <ol className="pathway-spine">
          {before.map(renderStep)}

          <li id={`pathway-${branch.id}`} className="pathway-step pathway-step--branch">
            <div className="pathway-step__head">
              {branch.stage && (
                <span className="pathway-stage-chip">{branch.stage.display ?? branch.stage.code}</span>
              )}
              <h4 className="pathway-step__title">{branch.title}</h4>
            </div>
            {branch.description && <p className="pathway-step__desc">{branch.description}</p>}
            <DocumentationNotes docs={branch.documentation} />

            {/* Every tier at once. The branch is the shape of the protocol, so
                hiding two-thirds of it behind tabs would hide the thing the page
                exists to show; wide content scrolls in its own container instead. */}
            <div className="pathway-branch__scroll">
              <div className="pathway-branch">
                {tiers.map(tier => {
                  const code = tier.tier?.code ?? 'unknown'
                  const active = code === simulation.tierCode
                  return (
                    <section
                      key={tier.id}
                      className={
                        `pathway-tier pathway-tier--${code}` +
                        (active ? ' pathway-tier--active' : ' pathway-tier--dimmed')
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

            {simulation.tierCode === 'no-risk' && (
              <p className="pathway-branch__exit">
                Every screener item is negative, so the simulated patient does not enter the pathway and none
                of the tier obligations apply &mdash; the artifact states this on the assessment step above.
              </p>
            )}
          </li>

          {after.map(renderStep)}
        </ol>
      </section>

      {/* ── Pending clinical definition (page copy, NOT the artifact) ── */}
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

      {/* ── Provenance ────────────────────────────────────────── */}
      <section className="pathway-provenance" aria-labelledby="pathway-provenance-title">
        <h3 id="pathway-provenance-title" className="pathway-section-title">Provenance</h3>
        <p className="pathway-provenance__lede">
          This screen is a rendering of a published artifact, and here it is. The app bundles the compiled
          IG at build time and carries it wherever it runs &mdash; including into an EHR as a SMART app.
        </p>
        <dl className="pathway-provenance__facts">
          <div className="pathway-provenance__fact">
            <dt>Canonical</dt>
            <dd><code>{model.url}</code></dd>
          </div>
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
    </div>
  )
}
