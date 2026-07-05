/**
 * Pure CDS Hooks service logic — no Hono, no Workers APIs (only the ambient
 * `crypto.randomUUID` that buildCdsCards already guards). Everything here is
 * a straight reuse of the SPiER app's browser-free derivation code so the
 * hosted endpoint and the in-app Patient Chart produce identical cards:
 *
 *   QuestionnaireResponse(s) → observationMappers → RiskAlert[]
 *                            → derivePathwayStatus → activeStageId
 *                            → buildCdsCards → CDS Hooks 2.0 Card[]
 *
 * Two input paths:
 *   1. Live path — the CDS client prefetched the patient's QuestionnaireResponses.
 *      We run them through the same mappers the app uses on submitted forms.
 *   2. Fallback path — no prefetch (e.g. testing from sandbox.cds-hooks.org with
 *      a bundled patient id). We serve one of the app's population scenarios so
 *      the service is demonstrable without a connected FHIR server.
 */
import { buildCdsCards } from '../../../web/src/lib/cdsHooks'
import type { Card, CdsServiceResponse } from '../../../web/src/lib/cdsHooks/types'
import {
  derivePathwayStatus,
  type PatientArtifacts,
  type QuestionnaireResponseLike,
  type StoredResponseLike,
} from '../../../web/src/lib/patientPathway'
import { mapResponseToObservations, type RiskAlert } from '../../../web/src/lib/observationMappers'
import { POPULATION_SCENARIOS } from '../../../web/src/data/population/scenarios'
import patientsJson from '../../../web/src/data/population/patients.json'
import type { QuestionnaireResponseResource } from '../../../web/src/types/fhir'
import type { CdsHookRequest, CdsServiceDefinition } from './types'

/** Machine id — the patient-view invocation path is `/cds-services/{SERVICE_ID}`. */
export const SERVICE_ID = 'spier-patient-view'

/**
 * Discovery entry for the one hook we implement. The prefetch template asks the
 * CDS client to hand us the patient's completed QuestionnaireResponses so we can
 * derive risk without a follow-up FHIR round-trip.
 */
export const PATIENT_VIEW_SERVICE: CdsServiceDefinition = {
  hook: 'patient-view',
  id: SERVICE_ID,
  title: 'SPiER Suicide-Safer Pathway',
  description:
    "Surfaces the patient's next suicide-safer-care step and any active risk alerts as CDS Hooks cards, derived from their suicide-risk assessments (ASQ, PHQ-9, C-SSRS, SBQ-R, CAMS).",
  prefetch: {
    questionnaireResponses:
      'QuestionnaireResponse?patient={{context.patientId}}&status=completed&_sort=-authored',
  },
}

interface RecommendedNextStep {
  stageId: string
  label: string
  rationale: string
}

const RECOMMENDED_BY_PATIENT: Record<string, RecommendedNextStep> = Object.fromEntries(
  (patientsJson as Array<{ id: string; recommendedNextStep?: RecommendedNextStep }>)
    .filter((p) => p.recommendedNextStep)
    .map((p) => [p.id, p.recommendedNextStep as RecommendedNextStep]),
)

/**
 * Pull every QuestionnaireResponse out of a prefetch value. CDS clients return
 * a searchset Bundle for a query prefetch, but we also tolerate a bare resource
 * or an array so hand-built test payloads work.
 */
function collectQuestionnaireResponses(prefetchValue: unknown): QuestionnaireResponseResource[] {
  if (!prefetchValue || typeof prefetchValue !== 'object') return []
  const value = prefetchValue as {
    resourceType?: string
    entry?: Array<{ resource?: { resourceType?: string } }>
  }

  const isQr = (r: unknown): r is QuestionnaireResponseResource =>
    !!r && typeof r === 'object' && (r as { resourceType?: string }).resourceType === 'QuestionnaireResponse'

  if (value.resourceType === 'Bundle') {
    return (value.entry ?? []).map((e) => e.resource).filter(isQr)
  }
  if (Array.isArray(prefetchValue)) {
    return prefetchValue.filter(isQr)
  }
  if (isQr(prefetchValue)) return [prefetchValue]
  return []
}

/** Find the prefetched QuestionnaireResponses regardless of the prefetch key. */
function questionnaireResponsesFromPrefetch(
  prefetch: Record<string, unknown> | undefined,
): QuestionnaireResponseResource[] {
  if (!prefetch) return []
  return Object.values(prefetch).flatMap(collectQuestionnaireResponses)
}

/** Risk alerts derived from a set of QuestionnaireResponses (mappers that fire). */
function riskAlertsFor(responses: QuestionnaireResponseResource[]): RiskAlert[] {
  return responses
    .map((qr) => mapResponseToObservations(qr)?.riskAlert)
    .filter((a): a is RiskAlert => !!a)
}

/**
 * Build the patient-view CDS response for a hook request.
 *
 * Live path (prefetch has QuestionnaireResponses): derive risk + stage from
 * them, and behave like a connected EHR (`isSmartConnected: true`) so the
 * curated narrative fallback is suppressed — a real EHR patient has no SPiER
 * editorial recommendation.
 *
 * Fallback path (no prefetch): serve the bundled population scenario for
 * `context.patientId`. These slices carry pre-computed `riskAlerts`, and the
 * patient's curated `recommendedNextStep` is allowed to surface. Unknown ids
 * yield an empty (spec-valid) card list.
 */
export function buildPatientViewResponse(request: CdsHookRequest): CdsServiceResponse {
  const patientId = request.context?.patientId
  const prefetched = questionnaireResponsesFromPrefetch(request.prefetch)

  let cards: Card[]
  if (prefetched.length > 0) {
    const responses: StoredResponseLike[] = prefetched.map((resource) => ({
      resource: resource as QuestionnaireResponseLike,
    }))
    const artifacts: PatientArtifacts = { responses }
    cards = buildCdsCards({
      activeStageId: derivePathwayStatus(artifacts).activeStageId,
      riskAlerts: riskAlertsFor(prefetched),
      isToolEnabled: () => true,
      recommendedNextStep: null,
      isSmartConnected: true,
    })
  } else {
    const scenario = patientId ? POPULATION_SCENARIOS[patientId] : undefined
    if (!scenario) return { cards: [] }
    const artifacts: PatientArtifacts = {
      responses: scenario.responses,
      carePlans: scenario.carePlans,
      observations: scenario.observations,
      communications: scenario.communications ?? [],
    }
    cards = buildCdsCards({
      activeStageId: derivePathwayStatus(artifacts).activeStageId,
      riskAlerts: scenario.riskAlerts,
      isToolEnabled: () => true,
      recommendedNextStep: (patientId && RECOMMENDED_BY_PATIENT[patientId]) || null,
      isSmartConnected: false,
    })
  }

  return { cards }
}
