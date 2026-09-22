/**
 * The confirmation beat: what a form says after it has been submitted.
 *
 * ── The defect this was written from ────────────────────────────────────────
 *
 * Clinical-app audit §4.6. A filler's post-submit summary offered TWO controls
 * side by side — the observation mapper's `suggestedAction` ("Start C-SSRS
 * Screener") and "View in chart" — and a recorder's success notice offered
 * "View in chart" plus, on one of them, a second link. So a clinician who had
 * just recorded something was handed two or three answers to "and now what",
 * one of which came from a per-instrument hint that knows nothing about the
 * rest of the chart. §1.5 is the same finding one screen over: the surfaces
 * answered "what do I do" three times and disagreed twice.
 *
 * ⚠️ **The one action here is the SAME one the chart shows**, because it comes
 * from the same place: `evaluatePathway` over the record as it now stands — the
 * first step of the published pathway this chart has not satisfied (audit §4.5,
 * decisions §7.1 and §7.2). The mapper's `suggestedAction` is not deleted and
 * is not rendered: it travels on the `RiskAlert`, which is part of the record
 * the evaluator reads, so it still *informs* the answer without being a second
 * button beside it.
 *
 * ⚠️ **`pending` is not a nicety.** A save is asynchronous — against a SMART
 * server it is a round trip — and this beat renders the instant the submit
 * lands. Evaluating the context's buckets alone would answer from the chart as
 * it was BEFORE the submit, so a clinician who had just completed the screen
 * would be told, for as long as the write took, to complete the screen. So the
 * caller passes what it just wrote and the record is evaluated with it folded
 * in; once the slice echoes the write, the fold is a no-op.
 *
 * ⚠️ **It renders on the guide too**, where `chartHref` is null and a tool view
 * lives at its tool's page. Both links resolve through `SurfaceLinksContext`,
 * so the surface decides what exists; a step whose tool this surface does not
 * render reads as words with no button, exactly as the chart's landing card
 * does for a tool a site has turned off.
 *
 * ⚠️ **`preview` drops the buttons and keeps the sentence**, for the one screen
 * where the act has happened and the write has not: a filler's results screen,
 * where the clinician has submitted and is deciding whether to save
 * (`QuestionnaireView`). Leaving that screen by a button here would discard a
 * completed screen silently, which on a suicide-risk instrument is the worst
 * outcome available. The sentence still comes from `evaluatePathway` over the
 * record WITH `pending` folded in, so it is the same answer the chart will give
 * once the save lands — and is typeset as the same claim rather than as a
 * second, quieter one.
 */
import { useEffect, useMemo, useRef } from 'react'
import { evaluatePathway, type PathwayRecord } from '@spier/core/lib/pathwayEvaluation'
import type { StoredResponse } from '@spier/core/types/fhir'
import { Button } from '@spier/ui/Button'
import { usePatient } from '../context/PatientContext'
import { useSurfaceLinks } from '../context/SurfaceLinksContext'
import { launchSlug } from '../lib/launchSlug'
import '../css/NextStep.css'

/** Fold what was just recorded into a bucket, without duplicating an echoed id. */
function fold<T extends { id?: string }>(saved: T[] | undefined, pending: T[] | undefined): T[] {
  if (!pending || pending.length === 0) return saved ?? []
  const known = new Set((saved ?? []).map(r => r.id).filter(Boolean))
  return [...(saved ?? []), ...pending.filter(r => !r.id || !known.has(r.id))]
}

export function NextStep({
  pending,
  preview,
}: {
  pending?: PathwayRecord
  /** Say what is next; offer no way there. See the header. */
  preview?: boolean
}) {
  const {
    responses,
    observations,
    carePlans,
    communications,
    procedures,
    episodes,
    riskAlerts,
  } = usePatient()
  const links = useSurfaceLinks()

  const record = useMemo<PathwayRecord>(
    () => ({
      // StoredResponse's own id is the response's, so the same fold works on it.
      responses: fold<StoredResponse>(responses, pending?.responses),
      observations: fold(observations, pending?.observations),
      carePlans: fold(carePlans, pending?.carePlans),
      communications: fold(communications, pending?.communications),
      procedures: fold(procedures, pending?.procedures),
      episodes: fold(episodes, pending?.episodes),
      riskAlerts: [...riskAlerts, ...(pending?.riskAlerts ?? [])],
    }),
    [responses, observations, carePlans, communications, procedures, episodes, riskAlerts, pending],
  )
  const { primary } = useMemo(() => evaluatePathway(record), [record])

  // The tool's route on THIS surface. `primary.tool.path` is the catalog's
  // clinician path; the guide renders the same view somewhere else, and where
  // it renders it nowhere the button is absent rather than dead.
  const slug = primary?.tool ? launchSlug(primary.tool.path) : undefined
  const href = slug ? links.launchHref(slug) : null
  const launch = primary?.tool && href ? { href, label: primary.tool.label } : null

  // Scrolled into view because a form long enough to scroll puts its own ending
  // below the fold, and a submit that appears to do nothing is the worst
  // outcome on a suicide-safer-care form (the same reason the success notice
  // has always done this). `nearest` rather than `start`: the risk summary
  // above has usually already been scrolled to, and this must not push it off.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [])

  return (
    <div className="next-step" ref={ref}>
      {primary ? (
        <p className="next-step__act">
          <span className="next-step__label">Next</span> {primary.title}
        </p>
      ) : (
        <p className="next-step__act">Nothing else is due for this patient.</p>
      )}

      {/* A step with no launch is a standing instruction — "at every contact,
          ask" — and its published description IS the act, so a heading with
          nothing under it would be the whole of what the clinician got. The
          chart's landing card makes the same call in the same words. */}
      {primary && !primary.tool && <p className="next-step__instruction">{primary.description}</p>}

      {!preview && (
        <p className="next-step__actions">
          {launch && (
            <Button to={launch.href} variant="primary" size="sm" arrow>
              {launch.label}
            </Button>
          )}
          {links.chartHref && (
            <Button to={links.chartHref} variant="link" size="sm">
              Back to chart
            </Button>
          )}
        </p>
      )}
    </div>
  )
}
