/**
 * The read side of #263: assemble one episode's record from the correlation the
 * data now carries.
 *
 * Phases 1–6 built the links and documented the query; nothing consumed them, so
 * the demo still could not answer the question the issue opens with — "show me
 * everything that happened in this patient's risk episode". This module is that
 * answer, and it deliberately resolves membership the same way the IG tells a
 * partner to:
 *
 *   artifact.encounter → Encounter.episodeOfCare → EpisodeOfCare
 *
 * No id parsing, no name matching, no date guessing. If an artifact is not
 * reachable by reference it lands in `unassigned` rather than being inferred into
 * an episode — the whole point of retiring the heuristics was to stop pretending
 * we know things we do not.
 */
import { TRIGGER_EXT } from './riskEpisode'
import type { FhirResourceLike } from './patientPathway'

/** The buckets this reads. Loose on purpose, matching the rest of the chart. */
export interface EpisodeRecordInput {
  episodes?: FhirResourceLike[]
  encounters?: FhirResourceLike[]
  responses?: { id?: string; questionnaireName?: string; resource: FhirResourceLike }[]
  observations?: FhirResourceLike[]
  carePlans?: FhirResourceLike[]
  communications?: FhirResourceLike[]
  serviceRequests?: FhirResourceLike[]
  procedures?: FhirResourceLike[]
  documentReferences?: FhirResourceLike[]
  appointments?: FhirResourceLike[]
  consents?: FhirResourceLike[]
  flags?: FhirResourceLike[]
  tasks?: FhirResourceLike[]
}

export interface EpisodeRecord {
  episode: FhirResourceLike
  /** Contacts belonging to this episode, in period order. */
  encounters: FhirResourceLike[]
  /** Everything reached through those contacts, plus the triggering artifact. */
  artifacts: FhirResourceLike[]
  /**
   * The artifact that OPENED the episode, from the `episode-trigger` extension.
   * Reached from the episode rather than the other way round: at screening time
   * the episode does not exist, so the screen cannot reference it (#263 Decision 1).
   */
  trigger?: FhirResourceLike
}

export interface EpisodeGrouping {
  records: EpisodeRecord[]
  /**
   * Artifacts with no route to an episode. Two honest reasons, and they are
   * different — `reason` distinguishes them so the UI can too:
   *  - `no-encounter`: the artifact simply is not linked (older fixture, or a
   *    resource recorded outside an episode, e.g. a negative screen).
   *  - `no-r4-route`: the resource type has no `.encounter` and no indirect
   *    route. `Consent` is the only one; see the IG's Quick Starts.
   *  - `not-yet-occurred`: a booked or cancelled Appointment. There is no
   *    Encounter because the contact has not happened — inventing one would
   *    fabricate a visit. Correctly linked; just not to a past contact.
   */
  unassigned: {
    resource: FhirResourceLike
    reason: 'no-encounter' | 'no-r4-route' | 'not-yet-occurred'
  }[]
}

/** Types with no way to reach an episode in R4 — see ENCOUNTER_STAMP_SKIP. */
const NO_R4_ROUTE = new Set(['Consent'])

/**
 * Appointment statuses meaning the contact has not happened, so no Encounter
 * exists to name it. Enumerated rather than inverted, so a new status has to be
 * classified deliberately.
 *
 * ⚠️ Duplicated from `APPOINTMENT_NOT_YET_HELD` in
 * `web/scripts/check-scenario-resources.mjs`. The gate is plain Node and cannot
 * import TypeScript, the same constraint that makes `scripts/lib/careplan-parity.mjs`
 * a hand-kept twin of its test. Change one, change the other.
 */
const APPOINTMENT_NOT_YET_HELD = new Set([
  'proposed',
  'pending',
  'booked',
  'waitlist',
  'cancelled',
  'entered-in-error',
])

function refIdOf(reference: unknown, type: string): string | undefined {
  if (typeof reference !== 'string') return undefined
  const prefix = `${type}/`
  return reference.startsWith(prefix) ? reference.slice(prefix.length) : undefined
}

/** The Encounter an artifact was recorded at, whichever element holds it. */
function encounterIdOf(resource: FhirResourceLike): string | undefined {
  if (resource.resourceType === 'DocumentReference') {
    const ctx = (resource as { context?: { encounter?: { reference?: string }[] } }).context
    for (const e of ctx?.encounter ?? []) {
      const id = refIdOf(e?.reference, 'Encounter')
      if (id) return id
    }
    return undefined
  }
  const enc = (resource as { encounter?: { reference?: string } }).encounter
  return refIdOf(enc?.reference, 'Encounter')
}

function periodStartOf(resource: FhirResourceLike): string {
  return String((resource as { period?: { start?: string } }).period?.start ?? '')
}

function triggerRefOf(episode: FhirResourceLike): string | undefined {
  const exts = (episode as { extension?: { url?: string; valueReference?: { reference?: string } }[] })
    .extension
  for (const ext of exts ?? []) {
    if (ext?.url === TRIGGER_EXT && typeof ext.valueReference?.reference === 'string') {
      return ext.valueReference.reference
    }
  }
  return undefined
}

/**
 * Every artifact in the slice, flattened. QuestionnaireResponses are unwrapped
 * from their `StoredResponse` so they group like any other resource.
 */
function allArtifacts(input: EpisodeRecordInput): FhirResourceLike[] {
  const out: FhirResourceLike[] = []
  for (const sr of input.responses ?? []) {
    if (sr?.resource?.resourceType) out.push(sr.resource)
  }
  for (const bucket of [
    input.observations,
    input.carePlans,
    input.communications,
    input.serviceRequests,
    input.procedures,
    input.documentReferences,
    input.appointments,
    input.consents,
    input.flags,
    input.tasks,
  ]) {
    for (const r of bucket ?? []) if (r?.resourceType) out.push(r)
  }
  return out
}

/**
 * Group a patient's artifacts by the episode they belong to.
 *
 * An artifact can in principle belong to more than one episode (an Encounter may
 * name several), so records are built by iterating episodes rather than by
 * assigning each artifact once.
 */
export function groupByEpisode(input: EpisodeRecordInput): EpisodeGrouping {
  const episodes = (input.episodes ?? []).filter(e => e?.resourceType === 'EpisodeOfCare')
  const encounters = (input.encounters ?? []).filter(e => e?.resourceType === 'Encounter')
  const artifacts = allArtifacts(input)

  // Encounter id → the episodes it belongs to.
  const encounterEpisodes = new Map<string, Set<string>>()
  for (const enc of encounters) {
    if (typeof enc.id !== 'string') continue
    const refs = (enc as { episodeOfCare?: { reference?: string }[] }).episodeOfCare ?? []
    const ids = new Set<string>()
    for (const r of refs) {
      const id = refIdOf(r?.reference, 'EpisodeOfCare')
      if (id) ids.add(id)
    }
    encounterEpisodes.set(enc.id, ids)
  }

  // Appointment has no `.encounter`; the Encounter names it. Invert that.
  const appointmentEncounter = new Map<string, string>()
  for (const enc of encounters) {
    if (typeof enc.id !== 'string') continue
    const appts = (enc as { appointment?: { reference?: string }[] }).appointment ?? []
    for (const a of appts) {
      const id = refIdOf(a?.reference, 'Appointment')
      if (id) appointmentEncounter.set(id, enc.id)
    }
  }

  const encounterOf = (resource: FhirResourceLike): string | undefined =>
    resource.resourceType === 'Appointment' && typeof resource.id === 'string'
      ? appointmentEncounter.get(resource.id)
      : encounterIdOf(resource)

  const records: EpisodeRecord[] = episodes.map(episode => {
    const episodeId = String(episode.id ?? '')
    const own = encounters
      .filter(enc => encounterEpisodes.get(String(enc.id))?.has(episodeId))
      .sort((a, b) => periodStartOf(a).localeCompare(periodStartOf(b)))
    const ownIds = new Set(own.map(e => String(e.id)))

    const reached = artifacts.filter(r => {
      const encId = encounterOf(r)
      return encId !== undefined && ownIds.has(encId)
    })

    // The trigger belongs to the record even if it is not reachable through one
    // of this episode's contacts — it predates the episode by construction.
    const triggerRef = triggerRefOf(episode)
    const trigger = triggerRef
      ? artifacts.find(r => `${r.resourceType}/${r.id}` === triggerRef)
      : undefined
    if (trigger && !reached.includes(trigger)) reached.push(trigger)

    return { episode, encounters: own, artifacts: reached, trigger }
  })

  const assigned = new Set(records.flatMap(r => r.artifacts))
  const unassigned = artifacts
    .filter(r => !assigned.has(r))
    .map(resource => {
      const status = String((resource as { status?: string }).status ?? '')
      if (resource.resourceType === 'Appointment' && APPOINTMENT_NOT_YET_HELD.has(status)) {
        return { resource, reason: 'not-yet-occurred' as const }
      }
      return {
        resource,
        reason: NO_R4_ROUTE.has(String(resource.resourceType))
          ? ('no-r4-route' as const)
          : ('no-encounter' as const),
      }
    })

  return { records, unassigned }
}
