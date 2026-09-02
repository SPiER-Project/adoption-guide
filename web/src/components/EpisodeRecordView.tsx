import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ChartSectionHeader } from './ChartSectionHeader'
import { groupByEpisode, type EpisodeRecord } from '@spier/core/lib/episodeRecord'
import { artifactLabel, formatDateTime } from '../lib/chartDisplay'
import { displayFor, ENTRY_REASONS, episodeCurrentTier, RISK_TIERS } from '@spier/core/lib/riskEpisode'
import type { FhirResourceLike } from '@spier/core/lib/patientPathway'
import '../css/EpisodeRecord.css'

/**
 * "Everything that happened in this risk episode" — the question #263 opens with,
 * and the one the demo could not answer until the correlation had a consumer.
 *
 * Membership is resolved by `groupByEpisode`, which follows the same references
 * the IG tells a partner to follow (`artifact.encounter →
 * Encounter.episodeOfCare`). Nothing here infers membership from an id, a name or
 * a date, and an artifact that cannot be reached by reference is shown as
 * unassigned rather than guessed into an episode.
 */

function entryReasonOf(episode: FhirResourceLike): string | undefined {
  const exts = (episode as {
    extension?: { url?: string; valueCodeableConcept?: { coding?: { code?: string }[] } }[]
  }).extension
  const code = exts?.find(e => e?.url?.endsWith('/episode-entry-reason'))?.valueCodeableConcept
    ?.coding?.[0]?.code
  return code ? displayFor(ENTRY_REASONS, code) : undefined
}

function periodOf(resource: FhirResourceLike): { start?: string; end?: string } {
  return (resource as { period?: { start?: string; end?: string } }).period ?? {}
}

function encounterClassOf(encounter: FhirResourceLike): string | undefined {
  return (encounter as { class?: { display?: string; code?: string } }).class?.display
}

function ArtifactRow({ resource, isTrigger }: { resource: FhirResourceLike; isTrigger: boolean }) {
  return (
    <li className="episode-artifact">
      <span className="episode-artifact-name">{artifactLabel(resource)}</span>
      <span className="episode-artifact-type">{resource.resourceType}</span>
      {isTrigger && (
        <span className="episode-trigger-tag" title="The artifact whose result opened this episode">
          opened the episode
        </span>
      )}
    </li>
  )
}

function EpisodeCard({ record }: { record: EpisodeRecord }) {
  const { episode, encounters, artifacts, trigger } = record
  const period = periodOf(episode)
  const status = String((episode as { status?: string }).status ?? 'unknown')
  const tier = episodeCurrentTier(episode as never)
  const reason = entryReasonOf(episode)

  // Artifacts reached through a contact, keyed by that contact. The trigger may
  // not belong to any of them — it predates the episode — so it is listed
  // separately rather than forced under a contact it did not happen at.
  const byEncounter = useMemo(() => {
    const map = new Map<string, FhirResourceLike[]>()
    for (const enc of encounters) map.set(String(enc.id), [])
    for (const a of artifacts) {
      if (a === trigger) continue
      const encId =
        a.resourceType === 'DocumentReference'
          ? (a as { context?: { encounter?: { reference?: string }[] } }).context?.encounter?.[0]
              ?.reference?.replace('Encounter/', '')
          : (a as { encounter?: { reference?: string } }).encounter?.reference?.replace(
              'Encounter/',
              '',
            )
      // An Appointment is named BY its Encounter, so it has no pointer of its own.
      if (encId && map.has(encId)) map.get(encId)!.push(a)
      else if (a.resourceType === 'Appointment') {
        const owner = encounters.find(e =>
          ((e as { appointment?: { reference?: string }[] }).appointment ?? []).some(
            r => r?.reference === `Appointment/${a.id}`,
          ),
        )
        if (owner) map.get(String(owner.id))!.push(a)
      }
    }
    return map
  }, [encounters, artifacts, trigger])

  const triggerOutsideContacts =
    trigger !== undefined && ![...byEncounter.values()].flat().includes(trigger)

  return (
    <article className={`episode-card episode-card--${status}`}>
      <header className="episode-card-header">
        <h4 className="episode-card-title">Suicide-safer care episode</h4>
        <span className={`episode-status episode-status--${status}`}>{status}</span>
      </header>

      <dl className="episode-meta">
        <div>
          <dt>Opened</dt>
          <dd>{period.start ? formatDateTime(period.start) : '—'}</dd>
        </div>
        {period.end && (
          <div>
            <dt>Closed</dt>
            <dd>{formatDateTime(period.end)}</dd>
          </div>
        )}
        {reason && (
          <div>
            <dt>Reason for entry</dt>
            <dd>{reason}</dd>
          </div>
        )}
        {tier && (
          <div>
            <dt>Current tier</dt>
            <dd>{displayFor(RISK_TIERS, tier)}</dd>
          </div>
        )}
        <div>
          <dt>Artifacts</dt>
          <dd>
            {artifacts.length} across {encounters.length}{' '}
            {encounters.length === 1 ? 'contact' : 'contacts'}
          </dd>
        </div>
      </dl>

      {triggerOutsideContacts && trigger && (
        <div className="episode-encounter">
          <h5 className="episode-encounter-title">Before the episode opened</h5>
          <ul className="episode-artifact-list">
            <ArtifactRow resource={trigger} isTrigger />
          </ul>
        </div>
      )}

      {encounters.map(enc => {
        const items = byEncounter.get(String(enc.id)) ?? []
        const encPeriod = periodOf(enc)
        return (
          <div className="episode-encounter" key={String(enc.id)}>
            <h5 className="episode-encounter-title">
              {encounterClassOf(enc) ?? 'Contact'}
              <span className="episode-encounter-when">
                {encPeriod.start ? formatDateTime(encPeriod.start) : ''}
              </span>
            </h5>
            {items.length === 0 ? (
              <p className="episode-encounter-empty">No artifacts recorded at this contact.</p>
            ) : (
              <ul className="episode-artifact-list">
                {items.map(a => (
                  <ArtifactRow
                    key={`${a.resourceType}/${a.id}`}
                    resource={a}
                    isTrigger={a === trigger}
                  />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </article>
  )
}

export function EpisodeRecordView({
  defaultCollapsed = false,
  ...input
}: Parameters<typeof groupByEpisode>[0] & {
  /** Start closed — the embedded panel does, the full shell does not. */
  defaultCollapsed?: boolean
}) {
  const [showUnassigned, setShowUnassigned] = useState(false)
  const [open, setOpen] = useState(!defaultCollapsed)
  const { records, unassigned } = useMemo(() => groupByEpisode(input), [input])

  // A patient with no episode has no record to show. The pathway and documents
  // sections already cover the artifacts.
  if (records.length === 0) return null

  const noRoute = unassigned.filter(u => u.reason === 'no-r4-route')
  const noLink = unassigned.filter(u => u.reason === 'no-encounter')
  const notYet = unassigned.filter(u => u.reason === 'not-yet-occurred')

  return (
    <section id="episode-record" className="episode-record-section">
      <ChartSectionHeader
        title="Episode record"
        count={`${records.length} ${records.length === 1 ? 'episode' : 'episodes'}`}
        collapsible={{ open, onToggle: () => setOpen(o => !o), controls: 'episode-record-body' }}
      />
      {open && (
        <div id="episode-record-body">
      <p className="episode-record-note">
        Assembled by following references — each artifact names the contact it was
        recorded at, and each contact names its episode. This is the same path a
        partner system would take; see the IG&apos;s Quick Starts.
      </p>

      {records.map(record => (
        <EpisodeCard key={String(record.episode.id)} record={record} />
      ))}

      {unassigned.length > 0 && (
        <div className="episode-unassigned">
          <button
            type="button"
            className="episode-unassigned-toggle"
            onClick={() => setShowUnassigned(!showUnassigned)}
            aria-expanded={showUnassigned}
          >
            {unassigned.length} artifact{unassigned.length === 1 ? '' : 's'} not tied to an episode
            <span className="episode-unassigned-caret">
              {showUnassigned ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>
          {showUnassigned && (
            <div className="episode-unassigned-body">
              {noRoute.length > 0 && (
                <>
                  <p className="episode-unassigned-reason">
                    <strong>No route in FHIR R4.</strong> These types have no{' '}
                    <code>.encounter</code> element and no indirect path, so SPiER does not
                    claim episode membership for them.
                  </p>
                  <ul className="episode-artifact-list">
                    {noRoute.map(({ resource }) => (
                      <ArtifactRow
                        key={`${resource.resourceType}/${resource.id}`}
                        resource={resource}
                        isTrigger={false}
                      />
                    ))}
                  </ul>
                </>
              )}
              {notYet.length > 0 && (
                <>
                  <p className="episode-unassigned-reason">
                    <strong>Scheduled, not yet occurred.</strong> A booked appointment has no
                    contact to belong to yet — an <code>Encounter</code> records a visit that
                    happened, so inventing one would fabricate a contact.
                  </p>
                  <ul className="episode-artifact-list">
                    {notYet.map(({ resource }) => (
                      <ArtifactRow
                        key={`${resource.resourceType}/${resource.id}`}
                        resource={resource}
                        isTrigger={false}
                      />
                    ))}
                  </ul>
                </>
              )}
              {noLink.length > 0 && (
                <>
                  <p className="episode-unassigned-reason">
                    <strong>Not linked to a contact.</strong> Recorded outside an episode — a
                    negative screen, or an artifact captured before the correlation existed.
                  </p>
                  <ul className="episode-artifact-list">
                    {noLink.map(({ resource }) => (
                      <ArtifactRow
                        key={`${resource.resourceType}/${resource.id}`}
                        resource={resource}
                        isTrigger={false}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </section>
  )
}
