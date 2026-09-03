/**
 * Pure CDS Hooks service logic — no Hono, no Workers APIs (only the ambient
 * `crypto.randomUUID` that buildCdsCards already guards). Everything here is
 * a straight reuse of the SPiER app's browser-free derivation code, so the
 * hosted endpoint and the in-app Patient Chart derive the same cards from the
 * same pipeline:
 *
 *   QuestionnaireResponse(s) → observationMappers → RiskAlert[] + Observation[]
 *                            → derivePathwayStatus → activeStageId
 *                            → buildCdsCards → CDS Hooks 2.0 Card[]
 *
 * The Observations are what the tier-driven guidance cards read (the harmonized
 * concept, LOINC 93374-7) — see packages/core/src/lib/cdsHooks/problemListCard.ts.
 *
 * Two input paths:
 *   1. Live path — the CDS client prefetched the patient's QuestionnaireResponses.
 *      We run them through the same mappers the app uses on submitted forms.
 *   2. Fallback path — no prefetch (e.g. testing from sandbox.cds-hooks.org with
 *      a bundled patient id). We serve one of the app's population scenarios so
 *      the service is demonstrable without a connected FHIR server.
 *
 * ⚠️ One thing differs between here and the app on purpose: with
 * `smartLaunchUrl` set, this endpoint emits `type: "smart"` card links so a host
 * EHR can launch the panel with context, where the app emits deep links it can
 * route itself. Same cards, different link form — and the difference is in who
 * is able to act on them, not in what was derived.
 */
import { buildCdsCards } from '@spier/core/lib/cdsHooks'
import type { Card, CdsServiceResponse } from '@spier/core/lib/cdsHooks/types'
import {
  derivePathwayStatus,
  type PatientArtifacts,
  type QuestionnaireResponseLike,
  type StoredResponseLike,
} from '@spier/core/lib/patientPathway'
import { mapResponseToObservations, type RiskAlert } from '@spier/core/lib/observationMappers'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import patientsJson from '@spier/demo-population/patients.json'
import type { ObservationResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'
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

/**
 * Risk alerts derived from a set of QuestionnaireResponses (mappers that fire).
 *
 * Uses the default dispatch policy: Tier 1 (SPiER canonical) + Tier 2 (LOINC
 * item-code recognition of foreign QRs) fire, but the Tier-3 shape heuristic
 * does NOT (`allowHeuristic` left false). A real EHR firing `patient-view`
 * often prefetches PHQ-9 QRs under its own canonical; Tier 2 lets us still
 * surface a card, while staying conservative — we won't fabricate a risk tier
 * from a QR we can only guess at by shape.
 */
function riskAlertsFor(responses: QuestionnaireResponseResource[]): RiskAlert[] {
  return responses
    .map((qr) => mapResponseToObservations(qr)?.riskAlert)
    .filter((a): a is RiskAlert => !!a)
}

/**
 * The Observations the mappers derive from a prefetched set of responses.
 *
 * The live path has no Observation prefetch — the CDS client hands us
 * QuestionnaireResponses — so the concept-layer Observations the tier-driven
 * guidance cards read are the ones SPiER derives here, exactly as the app does
 * on submission. Only the instruments that land *directly* on the harmonized
 * tier (SAFE-T, PSS-Full) therefore reach the problem-list card via this path;
 * see `problemListCard.ts` for why nothing translates a native result into a
 * tier on the way past.
 */
function derivedObservationsFor(
  responses: QuestionnaireResponseResource[],
): ObservationResource[] {
  return responses.flatMap((qr) => mapResponseToObservations(qr)?.observations ?? [])
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
export interface PatientViewOptions {
  /**
   * The app's SMART `launch_uri`. When given, card links are emitted as
   * `type: "smart"` launches carrying the tool in `appContext` instead of deep
   * links — see `SmartLaunchLinks` in packages/core/src/lib/cdsHooks/cards.ts for why that
   * is the right form for a host EHR and the wrong one for the app itself.
   *
   * Optional so a caller that does not know its own public URL still gets valid
   * cards. Omitted, the links stay `type: "absolute"`.
   */
  smartLaunchUrl?: string
}

export function buildPatientViewResponse(
  request: CdsHookRequest,
  options: PatientViewOptions = {},
): CdsServiceResponse {
  const patientId = request.context?.patientId
  const prefetched = questionnaireResponsesFromPrefetch(request.prefetch)
  const smartLaunch = options.smartLaunchUrl ? { launchUrl: options.smartLaunchUrl } : undefined

  let cards: Card[]
  if (prefetched.length > 0) {
    const responses: StoredResponseLike[] = prefetched.map((resource) => ({
      resource: resource as QuestionnaireResponseLike,
    }))
    const artifacts: PatientArtifacts = { responses }
    cards = buildCdsCards({
      activeStageId: derivePathwayStatus(artifacts).activeStageId,
      riskAlerts: riskAlertsFor(prefetched),
      // Every catalogued tool. The embedded panel applies the SAME rule in panel
      // chrome (web/src/lib/toolEnablement.ts) — it used to apply the adoption
      // guide's default preset instead, and the host page and the panel then
      // disagreed about patient-006's cards. Change one, change both.
      isToolEnabled: () => true,
      recommendedNextStep: null,
      isSmartConnected: true,
      smartLaunch,
      observations: derivedObservationsFor(prefetched),
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
      isToolEnabled: () => true, // see the live path above — must match the panel
      recommendedNextStep: (patientId && RECOMMENDED_BY_PATIENT[patientId]) || null,
      isSmartConnected: false,
      smartLaunch,
      observations: scenario.observations,
    })
  }

  return { cards }
}
