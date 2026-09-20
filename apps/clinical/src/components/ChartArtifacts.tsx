/**
 * Artifact card rendering shared by the patient chart's pathway rail and its
 * unstaged "Other activity" bucket.
 */
import { outreachOutcome, OUTREACH_OUTCOMES } from '@spier/core/lib/followUp'
import { displayFor } from '@spier/core/lib/codedOption'
import {
  carePlanDisplayName,
  workflowArtifactDisplay,
  type ArtifactBuckets,
  type RenderableResource,
} from '../lib/chartDisplay'
import type { CommunicationResource, StoredResponse } from '@spier/core/types/fhir'
import { formatDate, formatDateTime } from '@spier/tool-views/lib/dates'

/** The artifact-card lists shared by pathway stage nodes and the unstaged
 *  "Other activity" bucket. */
export function ArtifactCards({
  responses,
  carePlans,
  observations,
  communications,
  workflowArtifacts,
}: ArtifactBuckets) {
  return (
    <div className="stage-section-artifacts">
      {responses.map(rawR => {
        const r = rawR as StoredResponse
        return (
          <div key={r.id} className="stage-artifact stage-artifact--response">
            <span className="stage-artifact-icon" aria-hidden>{'\u{1F4DD}'}</span>
            <div className="stage-artifact-body">
              <span className="stage-artifact-name">{r.questionnaireName}</span>
              <span className="stage-artifact-meta">
                QuestionnaireResponse &middot; {formatDateTime(r.completedAt)}
              </span>
            </div>
          </div>
        )
      })}
      {carePlans.map((rawCp, idx) => {
        const cp = rawCp as RenderableResource
        const written = cp.created ?? cp._savedAt
        const savedAt = written ? formatDate(written) : null
        return (
          <div key={`${cp.id}-${idx}`} className="stage-artifact stage-artifact--careplan">
            <span className="stage-artifact-icon" aria-hidden>{'\u{1F4CB}'}</span>
            <div className="stage-artifact-body">
              <span className="stage-artifact-name">{carePlanDisplayName(cp)}</span>
              <span className="stage-artifact-meta">
                CarePlan &middot; {cp.status ?? 'active'}
                {savedAt && ` · ${savedAt}`}
              </span>
            </div>
          </div>
        )
      })}
      {observations.map((rawObs, idx) => {
        const obs = rawObs as RenderableResource
        const name = obs.code?.text || obs.code?.coding?.[0]?.display || 'Observation'
        const when = obs.effectiveDateTime ?? obs._savedAt
        return (
          <div key={obs.id ?? `obs-${idx}`} className="stage-artifact stage-artifact--observation">
            <span className="stage-artifact-icon" aria-hidden>{'\u{1F4CA}'}</span>
            <div className="stage-artifact-body">
              <span className="stage-artifact-name">{name}</span>
              <span className="stage-artifact-meta">
                Observation
                {when && ` · ${formatDate(when)}`}
              </span>
            </div>
          </div>
        )
      })}
      {communications.map((rawComm, idx) => {
        const c = rawComm as RenderableResource
        const name =
          c.reasonCode?.[0]?.text ||
          c.category?.[0]?.text ||
          c.category?.[0]?.coding?.[0]?.display ||
          'Communication'
        const when = c.sent ?? c._savedAt
        // For a Stage-6 outreach attempt the outcome is the defining fact —
        // without it two attempts on the same day read as duplicates.
        const outcome = outreachOutcome(rawComm as CommunicationResource)
        return (
          <div key={c.id ?? `comm-${idx}`} className="stage-artifact stage-artifact--communication">
            <span className="stage-artifact-icon" aria-hidden>{'\u{1F4DE}'}</span>
            <div className="stage-artifact-body">
              <span className="stage-artifact-name">
                {name}
                {outcome && ` — ${displayFor(OUTREACH_OUTCOMES, outcome)}`}
              </span>
              <span className="stage-artifact-meta">
                Communication &middot; {c.status ?? 'completed'}
                {when &&
                  ` · ${formatDateTime(when)}`}
              </span>
            </div>
          </div>
        )
      })}
      {workflowArtifacts.map((raw, idx) => {
        const w = raw as RenderableResource
        const { icon, name, meta } = workflowArtifactDisplay(raw)
        return (
          <div key={w.id ?? `workflow-${idx}`} className="stage-artifact stage-artifact--workflow">
            <span className="stage-artifact-icon" aria-hidden>{icon}</span>
            <div className="stage-artifact-body">
              <span className="stage-artifact-name">{name}</span>
              <span className="stage-artifact-meta">{meta}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
