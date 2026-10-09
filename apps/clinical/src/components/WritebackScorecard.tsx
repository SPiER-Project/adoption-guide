/**
 * WritebackScorecard — renders the outcome of the most recent SMART writeback
 * (#350) as a site-readiness diagnostic.
 *
 * The governing decision (from the lost plan, recorded in #348): an INCOMPLETE
 * writeback is shown deliberately rather than hidden or retried into looking
 * complete. A tier that did not land is the useful signal — it says what this
 * EHR cannot yet accept, which is what an adoption conversation needs.
 *
 * So this component is built around explaining ABSENCES, and it cannot do that
 * from `WritebackResult.steps` alone: `buildWritePlan` omits Tier 2 when the
 * instrument produced no Observations, which is a property of the instrument,
 * not a failure of the server, and would otherwise render as an unexplained
 * gap. See `WritebackReport`.
 *
 * There is no problem-list rung. The ladder had a Tier-3 "Condition proposal"
 * until #639 retired it — a screen never becomes a Condition — so the scorecard
 * no longer offers one, even as "off by design".
 */
import type { WritebackReport, WriteStepResult, WriteTier } from '@spier/core/lib/writeback/types'
import '../css/WritebackScorecard.css'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { Notice } from '@spier/ui/Notice'
import { Card } from '@spier/ui/Card'

/**
 * What a completed form can leave behind on the EHR, in the order it is tried.
 *
 * ── The copy rule this is written to (2026-09-21) ─────────────────────────
 *
 * `label` and `blurb` say what was, or was not, saved, in words a clinician
 * uses. The tier number and the resource type are **gone**, not gated
 * (clinical-app audit §1.9's fourth row).
 *
 * "Tier 0 — Document" was the label once, and it was already recognised then
 * that "tier", "rung" and "floor" are SPiER's own words. What survived that
 * pass was the row underneath — `Tier 0 · DocumentReference` — on the argument
 * that the scorecard also feeds the adoption rubric, where the tier is the
 * point. It does not: the rubric reads `WritebackReport`, not this component,
 * and this component renders on the clinical surface only, where `useInspect()`
 * is always false.
 *
 * ⚠️ **So the first fix was to put it behind `useInspect()`, and that was
 * wrong** — inspection is never on here, so the gated branch was dead code that
 * existed only to be excused by an exemption in the gate that would otherwise
 * have failed it. Deleted instead. The tier lives in `WritebackReport`, which
 * is what the rubric reads.
 */
const RUNGS: Array<{ tier: WriteTier; label: string; blurb: string }> = [
  {
    tier: 0,
    label: 'A readable copy of the completed form',
    blurb: 'Every EHR can hold this one: the form as it was filled in, readable in the chart.',
  },
  {
    tier: 1,
    label: 'The completed form itself',
    blurb: 'Each answer as its own field, so the EHR can search and report on them.',
  },
  {
    tier: 2,
    label: 'Its scores and risk level',
    blurb: 'The total, the item scores and the risk level, as numbers the EHR can act on.',
  },
]

/** Display label + modifier class for a step outcome. */
function outcomeLabel(outcome: WriteStepResult['outcome']): string {
  return outcome === 'written' ? 'Written' : outcome === 'failed' ? 'Failed' : 'Not written'
}

/**
 * What happened to a rung that has a step, in a clinician's words.
 *
 * ⚠️ **It never prints the step's `reason` or `error`.** Those are core's
 * diagnostics, in the wire's own vocabulary — "2 Observations written", "Failed
 * to create Observation — HTTP 422: …", "Tier not enabled", "floor not needed" —
 * and this component renders on the clinical surface only, where inspection is
 * never on. They printed here verbatim until 2026-10-07, past both its test
 * (`Observation\b` does not match a plural) and the jargon gate (which
 * reads this app's string literals; these are built in core). The raw detail
 * stays in `WritebackReport`, which the guide's tool pages show under
 * `useInspect()`. The rung's label already names what it is, so a count is
 * enough here.
 */
function stepDetail(step: WriteStepResult): string {
  const { count } = step
  if (step.outcome === 'written') {
    return count && count.of > 1
      ? `Saved to this patient’s chart — all ${count.of}.`
      : 'Saved to this patient’s chart.'
  }
  if (step.outcome === 'failed') {
    return count && count.written > 0
      ? `${count.written} of ${count.of} saved — the EHR did not accept the rest.`
      : 'The EHR did not accept it.'
  }
  switch (step.skip) {
    case 'disabled':
      return 'Turned off in this site’s settings.'
    case 'unsupported':
      return 'This EHR does not accept it yet.'
    case 'not-needed':
      return 'Not needed — the parts above saved everything in it.'
    default:
      return 'Not written.'
  }
}

/**
 * Why a rung has no step at all. A missing row is never left unexplained: each
 * case here is a different statement about the site, the instrument, or SPiER's
 * own governance policy, and collapsing them would make the scorecard useless
 * for the adoption rubric it feeds.
 */
function absenceReason(tier: WriteTier): string {
  if (tier === 2) {
    return 'This form has no score of its own to save — some record a plan instead.'
  }
  return 'Not attempted.'
}

export function WritebackScorecard({ report }: { report: WritebackReport | null }) {
  if (!report) return null

  const byTier = new Map<WriteTier, WriteStepResult>()
  for (const step of report.result.steps) byTier.set(step.tier, step)

  const written = report.result.steps.filter(s => s.outcome === 'written')
  const failed = report.result.steps.filter(s => s.outcome === 'failed')

  return (
    <Card as="section" className="writeback-scorecard" aria-labelledby="writeback-scorecard-heading">
      <SectionHeader
        id="writeback-scorecard-heading"
        title="Saved to the EHR"
        meta={
          <>
            {written.length} of {report.result.steps.length}{' '}
            {report.result.steps.length === 1 ? 'part' : 'parts'} saved
            {failed.length > 0 ? `, ${failed.length} failed` : ''}.
          </>
        }
      />

      {!report.capabilitiesKnown && (
        <Notice tone="warning" role="status">
          <strong>Could not ask this EHR what it accepts.</strong> The parts below were tried
          anyway, so one it &ldquo;does not accept&rdquo; may simply not have said so.
        </Notice>
      )}

      <ol className="writeback-scorecard__rungs">
        {RUNGS.map(rung => {
          const step = byTier.get(rung.tier)
          const state = step ? step.outcome : 'absent'
          return (
            <li
              className={`writeback-scorecard__rung writeback-scorecard__rung--${state}`}
              key={rung.tier}
            >
              <div className="writeback-scorecard__rung-head">
                <span className="writeback-scorecard__rung-label">{rung.label}</span>
                <span className="writeback-scorecard__badge">
                  {step ? outcomeLabel(step.outcome) : 'Not applicable'}
                </span>
              </div>
              <p className="writeback-scorecard__blurb">{rung.blurb}</p>
              {step ? (
                <p className="writeback-scorecard__detail">{stepDetail(step)}</p>
              ) : (
                <p className="writeback-scorecard__detail">{absenceReason(rung.tier)}</p>
              )}
            </li>
          )
        })}
      </ol>

      <p className="writeback-scorecard__foot">
        Saved straight from this browser to the EHR &mdash; SPiER&rsquo;s own servers never receive
        this patient&rsquo;s data. A part that did not save is shown on purpose: it says what this
        EHR cannot yet accept.
      </p>
    </Card>
  )
}
