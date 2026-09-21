/**
 * "Why this?" — the reasoning behind the chart's one recommendation.
 *
 * ── Why the reasoning is a page and not a drawer ───────────────────────────
 *
 * The adoption-guide audit settled *task first, caveats in a closed drawer,
 * never deleted*. The clinical-app audit sharpens it for this surface (§2): on
 * a 900px panel a closed drawer still costs a line, and the panel's vertical
 * budget is the whole reason the panel chrome exists — so here the caveat's
 * drawer is a DIFFERENT PAGE. A clinician who wants the reasoning has it in one
 * tap; one who does not never meets it.
 *
 * It holds, in the order audit §4.2 states (Brad, 2026-09-21):
 *
 *   1. what on the record triggered it — the artifact, its date, its result
 *   2. the rule that turned that trigger into this action, in the published
 *      protocol's own words
 *   3. the alternatives — every other instrument this deployment offers at the
 *      step, because the pathway does not know this patient
 *   4. one link to the protocol itself
 *
 * ⚠️ **Reached from the landing card and from nowhere else.** That is the
 * design (§4.2) and it is also why the route is declared in `App.tsx` and
 * linked from `ChartLanding`: `check:catalog` validates declared navigation
 * targets, so a route nothing links to is dead code no gate would notice.
 *
 * ⚠️ **It decides nothing either.** Like the landing card, every sentence comes
 * from `evaluatePathway` — including the published step's `description`, which
 * the evaluator carries for exactly this page. A patient with nothing due has
 * no recommendation to explain, so the page returns to the chart rather than
 * rendering an empty argument.
 *
 * ⚠️ **The trigger link lands on the chart's record anchor, not on a record
 * PAGE.** *What's on file* becomes a page in PR 5 (§4.4); until then the honest
 * destination is the section it is made from.
 */
import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageHeader } from '@spier/ui/PageHeader'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { Card } from '@spier/ui/Card'
import { Button } from '@spier/ui/Button'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { evaluatePathway } from '@spier/core/lib/pathwayEvaluation'
import { reassessmentStatusLabel } from '@spier/core/lib/reassessment'
import { useToolConfig } from '../context/ToolConfigContext'
import { toolEnablementFor } from '../lib/toolEnablement'
import { StageAlternatives } from '../components/StageAlternatives'
import { ON_FILE_ANCHOR } from '../components/ChartLanding'
import '../css/WhyThis.css'

export function WhyThis() {
  const { responses, observations, carePlans, communications, procedures, episodes, riskAlerts } =
    usePatient()
  const { isToolEnabled: siteToolEnabled } = useToolConfig()
  const { chromeMode } = usePresentation()
  const isToolEnabled = useMemo(
    () => toolEnablementFor(chromeMode, siteToolEnabled),
    [chromeMode, siteToolEnabled],
  )

  const evaluation = useMemo(
    () =>
      evaluatePathway({
        responses,
        observations,
        carePlans,
        communications,
        procedures,
        episodes,
        riskAlerts,
      }),
    [responses, observations, carePlans, communications, procedures, episodes, riskAlerts],
  )

  const primary = evaluation.primary
  // Nothing is due, so there is nothing to explain. The chart says so in its
  // own words; a page arguing for an absent recommendation would not.
  if (!primary) return <Navigate to="/patient/record" replace />

  const { reassessment } = evaluation

  return (
    <div className="why-this">
      <PageHeader
        eyebrow="Patient Chart"
        up="/patient/record"
        eyebrowStyle="pill"
        title="Why this?"
        lede={primary.title}
      />

      <SectionHeader title="What triggered it" />
      <Card>
        <p className="why-this__prose">{primary.reason}</p>
        <p className="why-this__more">
          <Link to={`/patient/record#${ON_FILE_ANCHOR}`}>See it in what&rsquo;s on file</Link>
        </p>
      </Card>

      <SectionHeader title="What the protocol asks for" />
      <Card>
        <p className="why-this__prose">{primary.description}</p>
        {reassessment?.kind === 'scheduled' && (
          <p className="why-this__prose">
            At this level of risk the protocol also asks for another look every{' '}
            {reassessment.intervalDays} days — {reassessmentStatusLabel(reassessment).toLowerCase()}
            .
          </p>
        )}
        {reassessment?.kind === 'no-cadence' && (
          <p className="why-this__prose">{reassessment.reason}</p>
        )}
      </Card>

      <SectionHeader title="If this instrument is not the right one" />
      <StageAlternatives
        stageId={primary.stageId}
        isToolEnabled={isToolEnabled}
        summary="Use a different instrument for this step"
      />

      <p className="why-this__protocol">
        <Button to="/patient/pathway" variant="secondary" arrow>
          Read the published protocol
        </Button>
      </p>
    </div>
  )
}
