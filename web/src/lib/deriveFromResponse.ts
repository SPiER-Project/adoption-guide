/**
 * deriveFromResponse — the QuestionnaireResponse → derived-artifacts business
 * logic, extracted from PatientContext so it can be reused by any write path
 * (the local store today, the SMART write-back path in a later task).
 *
 * This is deliberately NOT part of `FhirDataSource`: a data source persists
 * what it's handed, it doesn't compute Observations. The caller mints the QR's
 * id, builds the `StoredResponse` entry, then calls this to produce the derived
 * artifacts to persist alongside it.
 */
import { mapResponseToObservations } from './observationMappers'
import { stageForResponse, PATHWAY_STAGE_SYSTEM } from './patientPathway'
import type { DerivedArtifacts } from './dataSource/types'
import type { ObservationResource, QuestionnaireResponseResource } from '../types/fhir'

/**
 * Derive Observations + a risk alert from a stored QuestionnaireResponse.
 *
 * Dispatch is by `resource.questionnaire` (canonical URL) — see
 * observationMappers/index.ts. Returns `null` when the QR has no mapper (e.g.
 * Stanley-Brown / CAMS Stabilization / CAMS Therapeutic, which produce
 * CarePlans instead), in which case only the response itself should be stored.
 *
 * Each derived Observation is stamped so it (a) links back to its source QR via
 * `Observation.derivedFrom` — what an SDC `$extract` would emit — and (b)
 * resolves to a pathway stage via the `meta.tag` channel in `stageForArtifact`,
 * so it groups under the right stage instead of being orphaned. The stage is
 * the source response's stage (questionnaire → tool → stageId).
 *
 * `storedResource` must already carry the final `id` used for the persisted QR,
 * so the `derivedFrom` references point at the same resource.
 */
export function deriveFromResponse(
  storedResource: QuestionnaireResponseResource,
): DerivedArtifacts | null {
  const result = mapResponseToObservations(storedResource)
  if (!result) return null

  const id = storedResource.id
  const stageId = stageForResponse(storedResource)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observations: ObservationResource[] = result.observations.map((obs: any) => ({
    ...obs,
    derivedFrom: [...(obs.derivedFrom ?? []), { reference: `QuestionnaireResponse/${id}` }],
    meta: {
      ...(obs.meta ?? {}),
      tag: [
        ...(obs.meta?.tag ?? []),
        ...(stageId ? [{ system: PATHWAY_STAGE_SYSTEM, code: stageId }] : []),
      ],
    },
  }))

  return { observations, riskAlert: result.riskAlert }
}
