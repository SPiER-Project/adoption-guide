/**
 * The runtime half of the #263 correlation hinge.
 *
 * Phases 1–3 established the shape: artifacts reference their `Encounter`, the
 * Encounter references the `EpisodeOfCare`, and the episode references the
 * artifact that opened it. Nothing at runtime produced any of that — the
 * Encounters existed only as scenario fixtures. This module is what makes the
 * demo emit the same shape it documents.
 *
 * Two decisions worth reading before changing anything here.
 *
 * **The Encounter is created lazily, on first write.** Opening a chart is not a
 * clinical contact, and an Encounter containing nothing is noise that would
 * accumulate on every page view. So nothing exists until an artifact is actually
 * recorded, at which point a same-day Encounter is found or created.
 *
 * **A fresh Encounter does NOT claim the SPiEREncounter profile.** That profile
 * requires `episodeOfCare 1..*`, and at first write there may be no episode: the
 * first artifact is usually the screen, and the episode opens only if that screen
 * comes back positive (#263 Decision 1). Claiming the profile before the episode
 * exists would assert conformance the resource does not have. The profile and the
 * episode reference are added together, by `attachEpisode`, once there is an
 * episode to name — which is also the moment the claim becomes true.
 */
import { makeId } from './id'
import type { EncounterResource, EpisodeOfCareResource } from '../types/fhir'

export const ENCOUNTER_PROFILE = 'http://thespierproject.org/fhir/StructureDefinition/spier-encounter'

const ACT_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActCode'

/**
 * `class` is 1..1 in base R4, so a runtime Encounter has to pick one. `AMB`
 * (ambulatory) is the honest default for a demo that has no admission context —
 * the scenario fixtures use EMER/IMP/VR where the narrative justifies it, and
 * those are authored, not inferred.
 */
export const DEFAULT_ENCOUNTER_CLASS = { code: 'AMB', display: 'ambulatory' } as const

/**
 * An Encounter still accepting new artifacts.
 *
 * The resource types here are deliberately loose (`FhirResource` has an index
 * signature), so fields are read through a local cast — the same convention as
 * `isEpisodeOpen` in riskEpisode.ts.
 */
export function isEncounterOpen(encounter: EncounterResource): boolean {
  return (encounter as { status?: string }).status === 'in-progress'
}

/** The calendar day of an ISO instant, in UTC — the grouping key for a contact. */
function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * The Encounter new artifacts should attach to: an open one from the same day.
 *
 * Same-day rather than "any open one" so a demo left open overnight does not
 * silently file tomorrow's work under yesterday's contact. Same-day rather than
 * per-submission so one sitting produces one Encounter, matching how the scenario
 * fixtures are authored.
 */
export function findOpenEncounter(
  encounters: EncounterResource[],
  nowIso: string,
): EncounterResource | undefined {
  const today = dayOf(nowIso)
  return encounters.find((e) => {
    const period = (e as { period?: { start?: string } }).period
    return isEncounterOpen(e) && dayOf(String(period?.start ?? '')) === today
  })
}

export function buildEncounter(params: {
  patientId: string | null
  startIso: string
  id?: string
}): EncounterResource {
  return {
    resourceType: 'Encounter',
    id: params.id ?? `encounter-${makeId()}`,
    // No meta.profile — see the module note. It is added by attachEpisode.
    status: 'in-progress',
    class: {
      system: ACT_CODE_SYSTEM,
      code: DEFAULT_ENCOUNTER_CLASS.code,
      display: DEFAULT_ENCOUNTER_CLASS.display,
    },
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    period: { start: params.startIso },
  }
}

/**
 * Name the episode on an Encounter, and only then claim the profile.
 *
 * Idempotent: re-attaching the same episode is a no-op, so a second positive
 * screen in the same contact does not duplicate the reference.
 */
export function attachEpisode(
  encounter: EncounterResource,
  episode: EpisodeOfCareResource,
): EncounterResource {
  const ref = `EpisodeOfCare/${episode.id}`
  const enc = encounter as EncounterResource & {
    episodeOfCare?: { reference?: string }[]
    meta?: { profile?: string[] }
  }
  const existing = enc.episodeOfCare ?? []
  if (existing.some((e) => e?.reference === ref)) return encounter

  const profiles = enc.meta?.profile ?? []
  return {
    ...encounter,
    meta: {
      ...(enc.meta ?? {}),
      profile: profiles.includes(ENCOUNTER_PROFILE) ? profiles : [...profiles, ENCOUNTER_PROFILE],
    },
    episodeOfCare: [...existing, { reference: ref }],
  }
}

/**
 * Record an Appointment on its Encounter. `Appointment` has no `.encounter` in
 * R4, so this reverse reference is how it joins the chain — the same mechanism
 * the scenario fixtures and the offline gate use.
 */
export function attachAppointment(
  encounter: EncounterResource,
  appointmentId: string,
): EncounterResource {
  const ref = `Appointment/${appointmentId}`
  const existing =
    (encounter as EncounterResource & { appointment?: { reference?: string }[] }).appointment ?? []
  if (existing.some((a) => a?.reference === ref)) return encounter
  return { ...encounter, appointment: [...existing, { reference: ref }] }
}

/**
 * Types that must NOT be given an `.encounter`, and why. Kept beside the stamper
 * so the exclusions are visible rather than implied by a missing branch — the
 * same discipline as CORRELATION_EXEMPT in check-scenario-resources.mjs.
 */
export const ENCOUNTER_STAMP_SKIP = {
  // Structural: these ARE the correlation, not things correlated by it.
  Encounter: 'is the hinge itself',
  EpisodeOfCare: 'is what the Encounter points at',
  // No `.encounter` element in R4.
  Appointment: 'linked in reverse via Encounter.appointment',
  Consent: 'no .encounter and no indirect route; scopes to patient, not episode',
} as const

/**
 * Put the Encounter reference in whichever element the type actually has.
 * DocumentReference is the odd one: `context.encounter`, and it is the one slot
 * in R4 that also accepts an EpisodeOfCare directly.
 */
export function stampEncounter<T extends { resourceType?: string }>(
  resource: T,
  encounterId: string,
): T {
  const rt = resource.resourceType ?? ''
  if (rt in ENCOUNTER_STAMP_SKIP) return resource

  const ref = { reference: `Encounter/${encounterId}` }
  if (rt === 'DocumentReference') {
    const withCtx = resource as T & { context?: { encounter?: unknown[] } }
    return { ...resource, context: { ...(withCtx.context ?? {}), encounter: [ref] } }
  }
  return { ...resource, encounter: ref }
}
