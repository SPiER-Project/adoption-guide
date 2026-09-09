/**
 * search — the patient-scoped search semantics this server implements, and
 * nothing more.
 *
 * `SmartDataSource.getSlice` issues exactly 14 searches, all of the form
 * `GET Type?patient=<id>`, two of them adding `&category=`. This module answers
 * those and rejects anything else loudly. That refusal is deliberate: a mock
 * that ignores a parameter it does not understand returns a plausible Bundle
 * for a query it did not actually run, and the caller cannot tell.
 *
 * ── The patient element is not `subject` everywhere ─────────────────────────
 * Mirrors `patientRefField` in packages/core/src/lib/dataSource/smartDataSource.ts, which
 * exists for the write direction; this is the same table read backwards.
 * EpisodeOfCare and Consent use `patient`, Task uses `for`, and Appointment
 * carries the patient as a `participant.actor` reference rather than any
 * top-level element. Matching only `subject` would silently return zero
 * Appointments, EpisodeOfCares, Consents and Tasks — four empty buckets that
 * look exactly like "this patient has none".
 */
import type { MockResource } from './fixtures'

/** How a resource type points at its patient. */
type PatientLink = 'subject' | 'patient' | 'for' | 'appointment-participant'

const PATIENT_LINK: Record<string, PatientLink> = {
  QuestionnaireResponse: 'subject',
  Observation: 'subject',
  CarePlan: 'subject',
  Communication: 'subject',
  Encounter: 'subject',
  Flag: 'subject',
  DocumentReference: 'subject',
  ServiceRequest: 'subject',
  Procedure: 'subject',
  EpisodeOfCare: 'patient',
  Consent: 'patient',
  Task: 'for',
  Appointment: 'appointment-participant',
}

/** The types this server will answer a search for. */
/**
 * Types this server implements search for.
 *
 * ⚠️ `Patient` is in the list but NOT in `PATIENT_LINK`, and the asymmetry is
 * the point. Every other type is searched *by* its patient; `Patient` is the
 * roster (#401) and is searched only unscoped, which is why it has no patient
 * link to match on. `parseSearch` refuses a scoped `GET /fhir/Patient?patient=…`
 * rather than returning the empty Bundle a missing link would produce — an empty
 * Bundle for a query this server does not implement is indistinguishable from a
 * patient who does not exist.
 */
export const SEARCHABLE_TYPES: string[] = [...Object.keys(PATIENT_LINK), 'Patient'].sort()

/** The one type searched unscoped rather than by patient — see above. */
export const ROSTER_TYPE = 'Patient'

/** Search parameters this server understands. Anything else is a 400. */
const KNOWN_PARAMS = new Set(['patient', 'subject', 'category'])

function referenceId(value: unknown): string | undefined {
  const ref = (value as { reference?: unknown } | undefined)?.reference
  if (typeof ref !== 'string') return undefined
  // 'Patient/patient-011' | 'patient-011' | 'https://host/fhir/Patient/patient-011'
  const match = ref.match(/(?:^|\/)Patient\/([^/?]+)$/)
  return match ? match[1] : (ref.includes('/') ? undefined : ref)
}

/** Does `resource` belong to `patientId`, by the element its type actually uses? */
export function belongsToPatient(resource: MockResource, patientId: string): boolean {
  const link = PATIENT_LINK[resource.resourceType]
  if (!link) return false
  if (link === 'appointment-participant') {
    const participants = resource.participant
    if (!Array.isArray(participants)) return false
    return participants.some(p => referenceId((p as { actor?: unknown })?.actor) === patientId)
  }
  return referenceId(resource[link]) === patientId
}

/**
 * FHIR token match against a CodeableConcept array. Accepts the three token
 * spellings a client may send: `code`, `system|code`, and `|code` (meaning "no
 * system"). Matches if ANY coding of ANY concept matches — which is what makes
 * `category=survey` and `category=procedure` return genuinely different sets
 * rather than the same everything.
 */
export function matchesToken(concepts: unknown, token: string): boolean {
  const [left, right] = token.includes('|') ? token.split('|', 2) : [undefined, token]
  const wantSystem = left === undefined ? undefined : left // '' means "no system"
  const wantCode = right
  const list = Array.isArray(concepts) ? concepts : concepts ? [concepts] : []
  for (const concept of list) {
    const codings = (concept as { coding?: unknown })?.coding
    if (!Array.isArray(codings)) continue
    for (const coding of codings) {
      const c = coding as { system?: unknown; code?: unknown }
      if (c?.code !== wantCode) continue
      if (wantSystem === undefined) return true
      if (wantSystem === '' && c.system === undefined) return true
      if (wantSystem === c.system) return true
    }
  }
  return false
}

export interface SearchQuery {
  /**
   * The patient id the search is scoped to, or `undefined` for the ONE
   * all-patients search this server implements — the roster (#401).
   *
   * ⚠️ `undefined` is only reachable when the caller passed
   * `allowAllPatients`, which the route grants solely for `GET /fhir/Patient`
   * on a token that may cross patients. `applySearch` therefore also requires
   * `allPatients` to be set explicitly rather than inferring "unscoped" from a
   * missing id: a bug that dropped `patientId` would otherwise turn a
   * patient-scoped search into a whole-server one, and the Bundle would look
   * perfectly normal.
   */
  patientId?: string
  /** Set only for the roster search, so a missing `patientId` cannot pass for it. */
  allPatients?: true
  /** `category` token, when present. */
  category?: string
}

export type SearchParse =
  | { ok: true; query: SearchQuery }
  | { ok: false; status: 400; diagnostics: string }

/**
 * Parse a search's query string. `patient` (or its `subject` alias) is
 * REQUIRED unless the caller explicitly allows the roster search.
 *
 * ⚠️ **This module's header said "this server has no all-patients search" until
 * #401, and the reason it said so still applies to every type but one.** Serving
 * an unscoped search generally would let a demo look like it works while the
 * patient scoping is broken. What changed is that a worklist app needs a
 * *roster*: it cannot ask "which patients are there?" one patient at a time. So
 * exactly one unscoped search exists — `GET /fhir/Patient` — and only for a
 * token that may cross patients. Every clinical type stays patient-scoped, which
 * is why `allowAllPatients` is a parameter here rather than a mode this module
 * decides for itself: the route knows the type and the grant, and this does not.
 */
export function parseSearch(
  params: URLSearchParams,
  /**
   * The resource type being searched. Supplying it is what lets this module
   * apply the roster's semantics; omitting it keeps the pre-#401 behaviour
   * (every search patient-scoped), which is what the unit tests of the parser
   * itself rely on.
   *
   * ⚠️ The TYPE is a semantics question and belongs here. The PERMISSION —
   * may this token enumerate the roster — is a 403 the route raises, because
   * this module only ever answers 400, and the existing division of labour is
   * that the search layer refuses what it cannot express while the auth layer
   * refuses what it will not allow.
   */
  { type }: { type?: string } = {},
): SearchParse {
  // `forEach` rather than `keys()`: @cloudflare/workers-types' URLSearchParams
  // does not declare the iterator helpers, and this file typechecks under it.
  const names: string[] = []
  params.forEach((_value, name) => names.push(name))
  for (const name of names) {
    if (!KNOWN_PARAMS.has(name)) {
      return {
        ok: false,
        status: 400,
        diagnostics:
          `Unsupported search parameter '${name}'. This mock implements only `
          + `${[...KNOWN_PARAMS].sort().join(', ')} — it rejects rather than ignores, so a query it `
          + 'cannot honour never comes back as a plausible-looking result. Paging parameters '
          + '(_count, _offset) are unsupported for the same reason: silently truncating a Bundle '
          + 'would look like a patient with fewer artifacts.',
      }
    }
  }
  const raw = params.get('patient') ?? params.get('subject')
  if (type === ROSTER_TYPE) {
    // ⚠️ Unconditional on the grant, because it is about what the query MEANS.
    // Without this branch a scoped roster search fell through to the
    // patient-link match, and `Patient` has no patient link — so it returned an
    // empty 200 Bundle, which this module's header is explicit is the one thing
    // worse than a refusal: indistinguishable from a patient who does not exist.
    if (raw) {
      return {
        ok: false,
        status: 400,
        diagnostics:
          `'${ROSTER_TYPE}' search is the unscoped roster and takes no 'patient' parameter. `
          + `To fetch one patient, read it: GET /fhir/${ROSTER_TYPE}/{id}.`,
      }
    }
    return { ok: true, query: { allPatients: true } }
  }
  if (!raw) {
    return {
      ok: false,
      status: 400,
      diagnostics:
        "Missing required search parameter 'patient'. The only unscoped search this server "
        + 'implements is the roster, `GET /fhir/Patient`, and only for a token that may cross '
        + 'patients — every clinical type is patient-scoped.',
    }
  }
  // Tolerate `patient=Patient/patient-011` as well as a bare id.
  const patientId = raw.startsWith('Patient/') ? raw.slice('Patient/'.length) : raw
  const category = params.get('category') ?? undefined
  return { ok: true, query: { patientId, category } }
}

/** Apply a parsed search to the held resources of one type. */
export function applySearch(
  resources: MockResource[],
  type: string,
  query: SearchQuery,
): MockResource[] {
  return resources.filter(r => {
    if (r.resourceType !== type) return false
    // The roster: every resource of the type, no patient filter. Gated on the
    // explicit flag, never on `patientId` merely being absent.
    if (query.allPatients) {
      return query.category === undefined || matchesToken(r.category, query.category)
    }
    if (query.patientId === undefined) return false
    if (!belongsToPatient(r, query.patientId)) return false
    if (query.category !== undefined && !matchesToken(r.category, query.category)) return false
    return true
  })
}
