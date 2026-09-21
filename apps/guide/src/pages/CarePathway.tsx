/**
 * Care Pathway — what a suicide-safer care pathway does, and a way to try one.
 *
 * The explainer. Until 2026-09-20 this page rendered the whole published
 * protocol — every step, gate, FHIRPath condition, canonical URL and note, in
 * 2,445 words — under a simulator, and answered nowhere the question a reader
 * deciding whether to adopt actually has: what does a good pathway DO? The
 * adoption-guide UX audit (docs/plans/archive/adoption-guide-ux-audit-2026-09-20.md
 * §3, §4.2) split it. This page is the five things a pathway does, in prose a
 * decision-maker can read, the C-SSRS simulator as the centrepiece, and the
 * tier table it lights up. The full artifact — spine, gates, provenance, the
 * JSON — is one link away at `/guide/pathway/protocol` (CarePathwayProtocol.tsx),
 * which is also the ONE place in the guide that says "rendered from the
 * published PlanDefinition" (audit §5 rule 5; it used to be said on three).
 *
 * Two claims this page makes, both meant to be literally true:
 *
 *  1. **The tier table is the artifact's.** Rows, tiers, obligations and notes
 *     are read out of `PlanDefinition-SPiERSuicideSaferCarePathway` by
 *     `@spier/core/lib/pathway` and folded by `@spier/core/lib/pathwayMatrix`;
 *     nothing about the branch is typed here. The protocol page shows the same
 *     JSON the table drew itself from.
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
 * ⚠️ The eight-stage list is deliberately NOT here. The audit's sketch had it;
 * the page answers "what does a pathway do" in the protocol's own five steps,
 * and the stage vocabulary is the catalogue's axis — explained once on
 * `/guide/why-spier`, and worn by every step on the protocol page as a chip.
 * A second vocabulary in 400 words is the kind of thing the audit removed.
 *
 * ⚠️ Copy rules this page is written against (audit §5): the reader is named
 * in the first sentence; the task comes first and the one caveat after it,
 * quieter; no script, gate, function, package or file name reaches the page —
 * the simulator's lede used to name the mapper function. The test beside this
 * file pins the word cap and the absence of "PlanDefinition" from the prose.
 *
 * ⚠️ A GUIDE SUB-PAGE. It renders inside AdoptionGuide's header, so it must not
 * render a page header of its own and must not pad its own root — `npm run
 * check:template` gates both, the header rule in the reverse direction (a page
 * outside its LENSES allowlist may not grow one). The section is `wide` for
 * the table's sake, so every run of prose caps itself at the reading measure
 * (data/guideSections.ts says why that is the choice). And it holds no patient
 * data: the simulator's input is synthetic and the page imports mappers, never
 * fixtures (`npm run check:guide-boundary` walks these imports transitively).
 *
 * ⚠️ The two links below are route LITERALS, not `guideHref(...)`, so that
 * `npm run check:surface-links` can read them; a computed target is the one
 * form that gate cannot see.
 */
import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { cssrsScreener } from '@spier/core/data/questionnaires'
import { buildNativeQuestionnaireResponse } from '@spier/core/lib/nativeQuestionnaireResponse'
import { mapCSSRSScreener } from '@spier/core/lib/observationMappers/cssrsScreener'
import { tierCodeForLevel } from '@spier/core/lib/reassessment'
import { PathwayLoadError, PathwayTierTable } from '@spier/app-shell/components/PathwayView'
import { usePathway } from '@spier/app-shell/hooks/usePathway'
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import { guideHref } from '../data/guideSections'
import '@spier/app-shell/css/CarePathway.css'
import { Button } from '@spier/ui/Button'
import { Card } from '@spier/ui/Card'

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
        If you are deciding whether to adopt SPiER, this is the protocol it implements, in plain words,
        with a way to try it. A suicide-safer care pathway does five things.
      </p>

      {/* ── The five things, in the protocol's own order ──────────── */}
      <section className="care-pathway__story" aria-label="What a suicide-safer care pathway does">
        <p className="care-pathway__para">
          <strong>Screen everyone.</strong> Every patient gets a screen that carries a suicidality item
          &mdash; in primary care, usually the PHQ-9 as part of routine depression screening &mdash; so
          that risk is found by design rather than by chance. Suicidal thoughts disclosed at any point in
          care, or a clinician&rsquo;s own concern, enter the same pathway.
        </p>
        <p className="care-pathway__para">
          <strong>Gate on a positive.</strong> A positive item is a gate, not a diagnosis. Item 9 of the
          PHQ-9 scored 1 or more opens the next step, and a score of 0 closes it, unless clinical judgment
          says otherwise. Nothing is written to the record on the strength of a screen alone.
        </p>
        <p className="care-pathway__para">
          <strong>Clarify with a validated assessment.</strong> The positive screen is clarified with a
          validated assessment. SPiER demonstrates the C-SSRS Screener with Triage Points, whose six
          questions each map to a published risk level. If every answer is no, the patient does not enter
          the pathway. Otherwise the assessment yields one of three tiers: low, moderate or high.
        </p>
        <p className="care-pathway__para">
          <strong>Tier the response.</strong> The tier decides what the patient is owed. Crisis resources
          are owed at every tier. From moderate upward, a collaborative safety plan is completed and
          reviewed at each contact. At high risk the protocol adds a direct question at every contact, an
          immediate safety evaluation with lethal-means counselling, and an outreach protocol for a missed
          appointment. The table under the simulator is that matrix.
        </p>
        <p className="care-pathway__para">
          <strong>Keep asking, and step down only by rule.</strong> Risk is reassessed on a cadence the
          tier sets &mdash; more often when judgment says so &mdash; so a tier is a current fact rather
          than a label. The source protocol steps a patient down only by rule: a sustained run of negative
          reassessments, no destabilising event, and a psychiatric consultant&rsquo;s agreement. SPiER has
          not yet published that rule; the protocol page says why.
        </p>
        <p className="care-pathway__para">
          The instruments are the demonstration, not the requirement. Each step is defined by what it
          accomplishes, so a site that screens with the ASQ or assesses with another validated tool
          satisfies the same protocol. The instruments themselves are in <Link to="/guide/tools">Tools</Link>.
        </p>
      </section>

      {/* ── Simulator ─────────────────────────────────────────── */}
      <Card as="section" tone="brand" className="pathway-sim" aria-labelledby="pathway-sim-title">
        <h3 id="pathway-sim-title" className="pathway-sim__title">Try a C-SSRS result</h3>
        <p className="pathway-sim__lede">
          Answer the screener as a patient might and watch the tier change. The answers run through the
          same derivation the app applies to a real submission, so what lights up below is what the app
          would do.
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

        <p className="pathway-sim__note">
          The answers exist only on this page. Nothing is recorded, and no patient is involved.
        </p>

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
      </Card>

      {/* ── The tier table, lit by the simulator ──────────────── */}
      <section aria-labelledby="pathway-tiers-title">
        <h3 id="pathway-tiers-title" className="pathway-section-title">What each tier is owed</h3>
        <PathwayTierTable tiers={model.tierBranch.tiers} activeTierCode={simulation.tierCode} framed />
        {simulation.tierCode === 'no-risk' && (
          <p className="pathway-branch__exit">
            Every screener item is negative, so the simulated patient does not enter the pathway and none
            of the tier obligations apply.
          </p>
        )}
      </section>

      {/* ── One link onward: the implementer's page ────────────── */}
      <Card as="section" tone="muted" className="care-pathway__onward" aria-labelledby="pathway-onward-title">
        <h3 id="pathway-onward-title" className="pathway-section-title">The published protocol</h3>
        <p className="care-pathway__para">
          Everything above is published as one machine-readable protocol: each step, gate and note as
          written, what is deliberately left undefined, and the form a decision-support engine reads.
        </p>
        <Button to="/guide/pathway/protocol" variant="secondary" arrow>
          Read the published protocol
        </Button>
      </Card>
    </div>
  )
}
