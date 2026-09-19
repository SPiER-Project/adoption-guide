/**
 * ── #263 phase 4: the correlation hinge at runtime ──────────
 *
 * Every artifact the app records is filed against an Encounter, and that
 * Encounter names the episode. Extracted from `PatientProvider` (#126): this is
 * the provider's only real business logic, and the only part of it that decides
 * anything clinical.
 *
 * Two things make this less trivial than it looks:
 *
 *  * `slice` is React state, so two saves in the same tick would both read the
 *    same (encounter-less) slice and each mint an Encounter. The ref below is
 *    the within-tick memory that prevents that; `slice.encounters` is the
 *    across-render source of truth.
 *  * The Encounter is created lazily and does not claim the SPiEREncounter
 *    profile until an episode exists — see the note in lib/encounters.ts.
 *
 * All four branches here are covered by `PatientProvider.encounter.test.tsx`,
 * at provider level rather than as unit tests over the helpers: every one of
 * them is a property of how the pieces are *connected*, and none would fail if
 * a helper were correct but never called. Each was verified against a planted
 * defect before this was extracted.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { makeId } from '@spier/core/lib/id'
import { describeError } from '../lib/describeError'
import { deriveFromResponse } from '@spier/core/lib/deriveFromResponse'
import {
  buildEpisode,
  findOpenEpisode,
  isPositiveScreen,
  pickEpisodeTrigger,
} from '@spier/core/lib/riskEpisode'
import {
  attachAppointment,
  attachEpisode,
  buildEncounter,
  findOpenEncounter,
  stampEncounter,
} from '@spier/core/lib/encounters'
import type { FhirDataSource } from '@spier/core/lib/dataSource/types'
import type {
  CarePlanResource,
  EncounterResource,
  EpisodeOfCareResource,
  FhirResource,
  ObservationResource,
  PatientSlice,
  QuestionnaireResponseResource,
  StoredResponse,
} from '@spier/core/types/fhir'

export interface CorrelatedSave {
  addCarePlan: (carePlan: CarePlanResource) => void
  addResponse: (questionnaireName: string, resource: QuestionnaireResponseResource) => void
  addArtifact: (resource: FhirResource) => void
  /** Null unless the most recent write failed. */
  saveError: string | null
}

export function useCorrelatedSave({
  activeSource,
  sliceKey,
  slice,
}: {
  activeSource: FhirDataSource
  sliceKey: string | null
  slice: PatientSlice
}): CorrelatedSave {
  // Write failures surface to the UI (the SMART server may reject a POST —
  // scope issues, validation); there is deliberately no silent fallback to
  // local storage. Cleared by the next successful write.
  const [saveError, setSaveError] = useState<string | null>(null)
  const trackSave = useCallback((op: Promise<void>) => {
    op.then(
      () => setSaveError(null),
      (err: unknown) => setSaveError(describeError(err)),
    )
  }, [])

  const openEncounterRef = useRef<EncounterResource | null>(null)

  // A cached Encounter belongs to one patient. Clearing on key change stops an
  // artifact for patient B being filed against patient A's contact. Three lines,
  // and the only thing standing between a patient switch and a cross-patient
  // write: the cached Encounter is still open and still same-day, so
  // findOpenEncounter would accept it without complaint.
  useEffect(() => {
    openEncounterRef.current = null
  }, [sliceKey])

  const ensureEncounter = useCallback(async (): Promise<EncounterResource> => {
    const nowIso = new Date().toISOString()

    const cached = openEncounterRef.current
    if (cached && findOpenEncounter([cached], nowIso)) return cached

    const existing = findOpenEncounter(slice.encounters ?? [], nowIso)
    if (existing) {
      openEncounterRef.current = existing
      return existing
    }

    const created = buildEncounter({ patientId: sliceKey, startIso: nowIso })
    openEncounterRef.current = created
    await activeSource.saveArtifact(sliceKey, created)
    return created
  }, [activeSource, sliceKey, slice.encounters])

  /**
   * Save one artifact against the active Encounter, handling the two types that
   * need something other than a plain `.encounter`:
   *
   *  * `Appointment` has no `.encounter` in R4, so the Encounter names it back.
   *  * `EpisodeOfCare` is what the Encounter points at, so saving one attaches
   *    it to the Encounter — which is also when the Encounter starts claiming
   *    the SPiER profile. This covers the manual recorder (RiskEpisodeView) and
   *    the automatic positive-screen path with one piece of code.
   */
  const saveAgainstEncounter = useCallback(
    async (resource: FhirResource) => {
      // An Encounter is not filed against itself.
      if (resource.resourceType === 'Encounter') {
        await activeSource.saveArtifact(sliceKey, resource)
        return
      }

      const encounter = await ensureEncounter()
      const encounterId = String(encounter.id)
      await activeSource.saveArtifact(sliceKey, stampEncounter(resource, encounterId))

      let updated = encounter
      if (resource.resourceType === 'Appointment' && typeof resource.id === 'string') {
        updated = attachAppointment(updated, resource.id)
      }
      if (resource.resourceType === 'EpisodeOfCare') {
        updated = attachEpisode(updated, resource as EpisodeOfCareResource)
      }
      if (updated !== encounter) {
        openEncounterRef.current = updated
        await activeSource.saveArtifact(sliceKey, updated)
      }
    },
    [activeSource, ensureEncounter, sliceKey],
  )

  const addCarePlan = useCallback(
    (carePlan: CarePlanResource) => {
      // CarePlans are non-QR artifacts — the source routes them into the
      // carePlans array and stamps _savedAt, same as any other artifact.
      trackSave(saveAgainstEncounter(carePlan))
    },
    [saveAgainstEncounter, trackSave],
  )

  const addResponse = useCallback(
    (questionnaireName: string, resource: QuestionnaireResponseResource) => {
      // Resolve a single id up front — prefer the resource's own id, otherwise
      // mint one — and use it for the stored resource, the entry, AND the
      // derived Observations' Observation.derivedFrom reference, so they all
      // point at the same QuestionnaireResponse. (The SMART source swaps in
      // the server-assigned id on create.)
      const id = (resource as { id?: string }).id ?? `response-${makeId()}`
      const storedResource = { ...resource, id }
      const entry: StoredResponse = {
        id,
        questionnaireName,
        completedAt: new Date().toISOString(),
        resource: storedResource,
      }
      // Derivation (QR → Observations + risk alert) is business logic, not the
      // source's job. deriveFromResponse returns null when the QR has no mapper
      // (e.g. Stanley-Brown / CAMS plans), in which case only the response is
      // persisted.
      const derived = deriveFromResponse(storedResource)
      trackSave(
        (async () => {
          // The QR and everything derived from it happened at the same contact,
          // so they share one Encounter (#263). The QR is stamped too — it is the
          // artifact that most often triggers the episode, and
          // `QuestionnaireResponse.encounter` is a native R4 element.
          const encounter = await ensureEncounter()
          const encounterId = String(encounter.id)
          const stampedEntry: StoredResponse = {
            ...entry,
            resource: stampEncounter(entry.resource, encounterId),
          }
          const stampedDerived = derived
            ? {
                ...derived,
                observations: derived.observations.map(o =>
                  stampEncounter(o as ObservationResource, encounterId),
                ),
              }
            : null
          await activeSource.saveResponse(sliceKey, stampedEntry, stampedDerived)

          // Decision 1 (#263): a positive screen opens the episode, and the
          // episode names the screen that opened it. Only when none is already
          // open — a second positive screen belongs to the episode already
          // running, not to a new one.
          if (!stampedDerived || !isPositiveScreen(stampedDerived.riskAlert.level)) return
          if (findOpenEpisode(slice.episodes ?? [])) return

          const triggerRef = pickEpisodeTrigger(stampedDerived.observations, stampedEntry.id)
          if (!triggerRef) return // nothing to evidence it with; do not claim a positive screen

          const episode = buildEpisode({
            id: `episode-${makeId()}`,
            patientId: sliceKey,
            entryReason: 'positive-screen',
            startDate: new Date().toISOString(),
            triggerRef,
          })
          // Routed through saveAgainstEncounter so the Encounter gains the episode
          // reference — and with it the SPiER profile claim — in one place.
          await saveAgainstEncounter(episode)
        })(),
      )
    },
    [activeSource, ensureEncounter, saveAgainstEncounter, slice.episodes, sliceKey, trackSave],
  )

  // Generic adder for non-Questionnaire workflow artifacts. The source routes
  // by resourceType into the matching slice array and stamps _savedAt.
  // QuestionnaireResponses are NOT handled here — use addResponse, which
  // additionally derives Observations.
  const addArtifact = useCallback(
    (resource: FhirResource) => {
      trackSave(saveAgainstEncounter(resource))
    },
    [saveAgainstEncounter, trackSave],
  )

  return { addCarePlan, addResponse, addArtifact, saveError }
}
