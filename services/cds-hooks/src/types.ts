/**
 * CDS Hooks 2.0 request/discovery wire types.
 *
 * Only the fields this service reads or emits are modeled. The Card/response
 * shapes are NOT redefined here — they are imported verbatim from the app's
 * single source of truth (web/src/lib/cdsHooks/types.ts) so the hosted endpoint
 * and the in-app Patient Chart emit byte-identical cards.
 *
 * Spec: https://cds-hooks.org/specification/current/
 */

/** One entry in the Discovery response (`GET /cds-services`). */
export interface CdsServiceDefinition {
  /** The hook this service should be invoked on. */
  hook: string
  /** Machine-readable id — the invocation path is `/cds-services/{id}`. */
  id: string
  title?: string
  description: string
  /**
   * FHIR queries the CDS client should resolve and pass back in `prefetch`.
   * Keys are referenced by the service; values are query templates with
   * `{{context.*}}` placeholders.
   */
  prefetch?: Record<string, string>
}

/** Discovery response body. */
export interface CdsDiscoveryResponse {
  services: CdsServiceDefinition[]
}

/** Context object for the `patient-view` hook. */
export interface PatientViewContext {
  userId?: string
  patientId?: string
  encounterId?: string
}

/**
 * A CDS Hooks service invocation body (`POST /cds-services/{id}`).
 *
 * `prefetch` values are whatever FHIR the client resolved for our prefetch
 * templates — for us, a QuestionnaireResponse searchset Bundle (or a bare
 * resource / array, both of which we tolerate).
 */
export interface CdsHookRequest {
  hook: string
  hookInstance: string
  /** FHIR base URL of the calling EHR (unused in v1 — we consume prefetch only). */
  fhirServer?: string
  context: PatientViewContext
  prefetch?: Record<string, unknown>
}

/** Feedback body (`POST /cds-services/{id}/feedback`). Accepted, not persisted. */
export interface CdsFeedbackRequest {
  feedback: Array<{
    card: string
    outcome: 'accepted' | 'overridden'
    outcomeTimestamp?: string
  }>
}
