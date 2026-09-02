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
 * from `WritebackResult.steps` alone:
 *  - `buildWritePlan` omits the Tier-3 step entirely when the Condition proposal
 *    is disabled (the default), so "off by design" has to come from the resolved
 *    config, not from a missing row;
 *  - it also omits Tier 2 when the instrument produced no Observations, which is
 *    a property of the instrument, not a failure of the server.
 * Both would otherwise render as unexplained gaps. See `WritebackReport`.
 */
import type { WritebackReport, WriteStepResult, WriteTier } from '@spier/core/lib/writeback/types'
import '../css/WritebackScorecard.css'

/**
 * The ladder's rungs, in ascending tier order (see writeback/types.ts).
 *
 * `label` says what the rung IS in plain words — what was, or was not, saved to
 * the EHR; `tierLabel` carries the tier number and resource type underneath it.
 * "Tier 0 — Document" was the label, and "tier", "rung" and "floor" are
 * SPiER-internal words: a clinician reading the panel after submitting a form
 * needs to know their form was saved and its score was not, not which rung of
 * which ladder that corresponds to. The tier stays visible because the
 * scorecard also feeds the adoption rubric, where the tier is the point.
 */
const RUNGS: Array<{
  tier: WriteTier
  resourceType: string
  label: string
  tierLabel: string
  blurb: string
}> = [
  {
    tier: 0,
    resourceType: 'DocumentReference',
    label: 'A readable copy of the completed form',
    tierLabel: 'Tier 0 · DocumentReference',
    blurb: 'The universal floor: a readable rendering plus the raw QuestionnaireResponse as recoverable FHIR JSON.',
  },
  {
    tier: 1,
    resourceType: 'QuestionnaireResponse',
    label: 'The completed form itself',
    tierLabel: 'Tier 1 · QuestionnaireResponse',
    blurb: 'The discrete capture, and the resource every higher rung references.',
  },
  {
    tier: 2,
    resourceType: 'Observation',
    label: 'Its scores and risk level',
    tierLabel: 'Tier 2 · Observation',
    blurb: 'Scored and harmonized results, immediately computable by the EHR.',
  },
  {
    tier: 3,
    resourceType: 'Condition',
    label: 'A problem-list proposal',
    tierLabel: 'Tier 3 · Condition',
    blurb: 'Opt-in only. A screening-derived Condition is never written without explicit clinician confirmation.',
  },
]

/** Display label + modifier class for a step outcome. */
function outcomeLabel(outcome: WriteStepResult['outcome']): string {
  return outcome === 'written' ? 'Written' : outcome === 'failed' ? 'Failed' : 'Not written'
}

/**
 * Why a rung has no step at all. A missing row is never left unexplained: each
 * case here is a different statement about the site, the instrument, or SPiER's
 * own governance policy, and collapsing them would make the scorecard useless
 * for the adoption rubric it feeds.
 */
function absenceReason(tier: WriteTier, report: WritebackReport): string {
  if (tier === 3) {
    return report.config.enableConditionProposal
      ? 'Enabled, but no proposal was warranted — a negative screen does not propose a problem.'
      : 'Off by design. Enabling it requires an explicit clinician confirmation step.'
  }
  if (tier === 2) {
    return 'This instrument produced no Observations to write (some tools produce a care plan instead).'
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
    <section className="writeback-scorecard" aria-labelledby="writeback-scorecard-heading">
      <div className="writeback-scorecard__head">
        <h3 className="writeback-scorecard__title" id="writeback-scorecard-heading">
          Saved to the EHR
        </h3>
        <p className="writeback-scorecard__summary">
          {written.length} of {report.result.steps.length} attempted{' '}
          {report.result.steps.length === 1 ? 'tier' : 'tiers'} written back
          {failed.length > 0 ? `, ${failed.length} failed` : ''}.
        </p>
      </div>

      {!report.capabilitiesKnown && (
        <p className="writeback-scorecard__probe" role="status">
          <strong>Could not read this server&rsquo;s CapabilityStatement.</strong> The tiers below
          were attempted without knowing what the server accepts — a skipped tier here means
          &ldquo;not advertised&rdquo;, not &ldquo;refused&rdquo;.
        </p>
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
                <span className="writeback-scorecard__rung-label">
                  {rung.label}
                  <span className="writeback-scorecard__rung-tier">{rung.tierLabel}</span>
                </span>
                <span className="writeback-scorecard__badge">
                  {step ? outcomeLabel(step.outcome) : 'Not applicable'}
                </span>
              </div>
              <p className="writeback-scorecard__blurb">{rung.blurb}</p>
              {step ? (
                <p className="writeback-scorecard__detail">
                  {step.outcome === 'written' ? (
                    <>
                      Created as <code>{rung.resourceType}</code>
                      {step.id ? <> / <code>{step.id}</code></> : null}
                      {step.reason ? ` — ${step.reason}` : ''}
                    </>
                  ) : (
                    step.error ?? step.reason ?? '—'
                  )}
                </p>
              ) : (
                <p className="writeback-scorecard__detail">{absenceReason(rung.tier, report)}</p>
              )}
            </li>
          )
        })}
      </ol>

      <p className="writeback-scorecard__foot">
        Written back browser-direct to the connected EHR — SPiER&rsquo;s own infrastructure never
        receives this data. An incomplete ladder is shown on purpose: it is the readiness signal.
      </p>
    </section>
  )
}
