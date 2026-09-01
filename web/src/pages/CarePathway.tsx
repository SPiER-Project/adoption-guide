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
 * ⚠️ The rendering itself is NOT here. Phase 4 put the same protocol in the
 * embedded SMART panel, and both surfaces draw it from
 * `components/PathwayView.tsx` — one spine, one set of tier columns, one
 * provenance block. What stays on this page is what makes it the *implementer's*
 * view: the lede, the simulator, and provenance in the closing position.
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
import {
  PathwayLoadError,
  PathwayPending,
  PathwayProvenance,
  PathwaySpine,
} from '../components/PathwayView'
import { usePathway } from '../hooks/usePathway'
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

/* ─── The page ───────────────────────────────────────────────── */

export function CarePathway() {
  const location = useLocation()

  const [answers, setAnswers] = useState<SimAnswers>({
    q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, [Q6_RECENT]: false,
  })

  const loaded = usePathway()

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
        <PathwayLoadError error={loaded.error} />
      </div>
    )
  }

  const model = loaded.model

  const toggle = (linkId: string) =>
    setAnswers(prev => {
      const next = { ...prev, [linkId]: !prev[linkId] }
      // Turning q6 off retires its follow-up, the way the form's enableWhen does.
      if (linkId === 'q6' && !next.q6) next[Q6_RECENT] = false
      return next
    })

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
        <PathwaySpine
          model={model}
          activeTierCode={simulation.tierCode}
          exitNote={
            simulation.tierCode === 'no-risk' ? (
              <p className="pathway-branch__exit">
                Every screener item is negative, so the simulated patient does not enter the pathway and none
                of the tier obligations apply &mdash; the artifact states this on the assessment step above.
              </p>
            ) : null
          }
        />
      </section>

      {/* ── Pending clinical definition (page copy, NOT the artifact) ── */}
      <PathwayPending />

      {/* ── Provenance ────────────────────────────────────────── */}
      <PathwayProvenance model={model}>
        <p className="pathway-provenance__lede">
          This screen is a rendering of a published artifact, and here it is. The app bundles the compiled
          IG at build time and carries it wherever it runs &mdash; including into an EHR as a SMART app,
          where the same renderer draws the same protocol under{' '}
          <Link to="/patient/pathway">Published Care Pathway</Link>, with these facts leading rather than
          closing.
        </p>
      </PathwayProvenance>
    </div>
  )
}
