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
import { mapResponseToObservations, type DispatchOptions } from './observationMappers'
import type { RiskAlert } from './observationMappers'
import { stageForArtifact, PATHWAY_STAGE_SYSTEM, type FhirResourceLike } from './patientPathway'
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
 * the source response's own resolved stage: an explicit `meta.tag` on the QR
 * (stamped from the launching tool) wins, else it falls back to the
 * questionnaire canonical → tool → stageId.
 *
 * `storedResource` must already carry the final `id` used for the persisted QR,
 * so the `derivedFrom` references point at the same resource.
 *
 * When the QR was matched by the code/shape fallback (its `questionnaire`
 * canonical didn't match a SPiER Questionnaire), the derived Observations get a
 * provenance note and the risk alert `detail` gains an "inferred mapping"
 * caveat, so nothing silently presents a code-recognized result as if it came
 * from a conformant submission.
 */
export function deriveFromResponse(
  storedResource: QuestionnaireResponseResource,
  opts: DispatchOptions = {},
): DerivedArtifacts | null {
  const result = mapResponseToObservations(storedResource, opts)
  if (!result) return null

  const via = result.dispatch?.via
  const inferred = via === 'code' || via === 'shape'
  const provenanceNote = inferred
    ? `Instrument recognized via ${via === 'code' ? 'standardized item codes' : 'an answer-shape heuristic'} — the submitted QuestionnaireResponse.questionnaire canonical did not match a SPiER Questionnaire. Mapping to SPiER was inferred from the response data.`
    : undefined

  const id = storedResource.id
  // Prefer an explicit pathway-stage tag already on the QR (stamped at
  // submission from the launching tool — see QuestionnaireView.stampLaunchStage)
  // over resolving the questionnaire canonical, which for a questionnaire
  // shared by tools at different stages always picks the first-owner tool.
  // stageForArtifact reads meta.tag first (tier 1) and falls back to canonical
  // resolution (tier 3).
  const stageId = stageForArtifact(storedResource as FhirResourceLike)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observations: ObservationResource[] = result.observations.map((obs: any) => ({
    ...obs,
    derivedFrom: [...(obs.derivedFrom ?? []), { reference: `QuestionnaireResponse/${id}` }],
    ...(provenanceNote ? { note: [...(obs.note ?? []), { text: provenanceNote }] } : {}),
    meta: {
      ...(obs.meta ?? {}),
      tag: [
        ...(obs.meta?.tag ?? []),
        ...(stageId ? [{ system: PATHWAY_STAGE_SYSTEM, code: stageId }] : []),
      ],
    },
  }))

  const riskAlert: RiskAlert = inferred
    ? {
        ...result.riskAlert,
        detail: `${result.riskAlert.detail} (Instrument recognized from ${via === 'code' ? 'standardized item codes' : 'answer shape'}; the submitted questionnaire canonical did not match a SPiER Questionnaire.)`,
      }
    : result.riskAlert

  return { observations, riskAlert }
}
