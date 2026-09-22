/**
 * "Recorded here" — the artifact rows inside a pathway stage node.
 *
 * ⚠️ **Every row said its resource type, and that is what changed on
 * 2026-09-21** (clinical-app audit §1.9, §4.4). A clinician read
 * `QuestionnaireResponse · Sep 3, 2026, 11:18 AM`, `Observation · Sep 3, 2026`
 * and `CarePlan · active`, each behind an emoji standing in for the same fact.
 * The type is the implementer's word for the row and it appears on the Adoption
 * Guide; here the row says **what was recorded, how it stands, and when** —
 * which is everything a clinician was reading it for, three words shorter.
 *
 * `lifecycleWord` is where "how it stands" comes from: a lifecycle code is a
 * real clinical fact (a referral still open is not a referral completed) and
 * only its spelling was the wire's.
 *
 * ⚠️ **Every row's name is a LINK since 2026-09-22**, to the record it names.
 * Three columns and no way in was the gap: a clinician could read that a PHQ-9
 * was completed and not one answer to it. The destination is built by
 * `lib/recordKeys.ts` — the SAME function *What's on file* uses, so a record
 * has one address however a reader reached it — and a row whose artifact
 * carries no id stays plain text rather than linking nowhere.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { outreachOutcome, OUTREACH_OUTCOMES } from '@spier/core/lib/followUp'
import { displayFor } from '@spier/core/lib/codedOption'
import {
  carePlanDisplayName,
  lifecycleWord,
  workflowArtifactDisplay,
  type ArtifactBuckets,
  type RenderableResource,
} from '../lib/chartDisplay'
import type { FhirResourceLike } from '@spier/core/lib/patientPathway'
import type { CommunicationResource, StoredResponse } from '@spier/core/types/fhir'
import { formatDate, formatDateTime } from '@spier/tool-views/lib/dates'
import { recordPath } from '../lib/recordKeys'

/** The row's name, linked to the record when the artifact has an address. */
function ArtifactName({ resource, children }: { resource: unknown; children: ReactNode }) {
  const to = recordPath(resource as FhirResourceLike)
  return (
    <span className="stage-artifact-name">
      {to ? <Link to={to}>{children}</Link> : children}
    </span>
  )
}

/** The meta line: how it stands, then when — either half may be missing. */
function ArtifactMeta({ state, when }: { state?: string | null; when?: string | null }) {
  const parts = [state, when].filter(Boolean)
  if (parts.length === 0) return null
  return <span className="stage-artifact-meta">{parts.join(' · ')}</span>
}

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
            <div className="stage-artifact-body">
              <ArtifactName resource={r.resource}>{r.questionnaireName}</ArtifactName>
              <ArtifactMeta when={formatDateTime(r.completedAt)} />
            </div>
          </div>
        )
      })}
      {carePlans.map((rawCp, idx) => {
        const cp = rawCp as RenderableResource
        const written = cp.created ?? cp._savedAt
        return (
          <div key={`${cp.id}-${idx}`} className="stage-artifact stage-artifact--careplan">
            <div className="stage-artifact-body">
              <ArtifactName resource={rawCp}>{carePlanDisplayName(cp)}</ArtifactName>
              <ArtifactMeta
                state={lifecycleWord(cp.status ?? 'active')}
                when={written ? formatDate(written) : null}
              />
            </div>
          </div>
        )
      })}
      {observations.map((rawObs, idx) => {
        const obs = rawObs as RenderableResource
        const name = obs.code?.text || obs.code?.coding?.[0]?.display || 'Recorded result'
        const when = obs.effectiveDateTime ?? obs._savedAt
        return (
          <div key={obs.id ?? `obs-${idx}`} className="stage-artifact stage-artifact--observation">
            <div className="stage-artifact-body">
              <ArtifactName resource={rawObs}>{name}</ArtifactName>
              <ArtifactMeta when={when ? formatDate(when) : null} />
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
          'Contact with the patient'
        const when = c.sent ?? c._savedAt
        // For a Stage-6 outreach attempt the outcome is the defining fact —
        // without it two attempts on the same day read as duplicates.
        const outcome = outreachOutcome(rawComm as CommunicationResource)
        return (
          <div key={c.id ?? `comm-${idx}`} className="stage-artifact stage-artifact--communication">
            <div className="stage-artifact-body">
              <ArtifactName resource={rawComm}>
                {name}
                {outcome && ` — ${displayFor(OUTREACH_OUTCOMES, outcome)}`}
              </ArtifactName>
              <ArtifactMeta
                state={lifecycleWord(c.status ?? 'completed')}
                when={when ? formatDateTime(when) : null}
              />
            </div>
          </div>
        )
      })}
      {workflowArtifacts.map((raw, idx) => {
        const w = raw as RenderableResource
        const { name, state, when } = workflowArtifactDisplay(raw)
        return (
          <div key={w.id ?? `workflow-${idx}`} className="stage-artifact stage-artifact--workflow">
            <div className="stage-artifact-body">
              <ArtifactName resource={raw}>{name}</ArtifactName>
              <ArtifactMeta state={state} when={when} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
