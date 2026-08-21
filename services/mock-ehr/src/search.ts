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
export const SEARCHABLE_TYPES: string[] = Object.keys(PATIENT_LINK).sort()

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
  /** The patient id the search is scoped to. */
  patientId: string
  /** `category` token, when present. */
  category?: string
}

export type SearchParse =
  | { ok: true; query: SearchQuery }
  | { ok: false; status: 400; diagnostics: string }

/**
 * Parse a search's query string. `patient` (or its `subject` alias) is
 * REQUIRED — this server has no all-patients search, because serving one would
 * let a demo look like it works while the patient scoping is broken.
 */
export function parseSearch(params: URLSearchParams): SearchParse {
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
  if (!raw) {
    return {
      ok: false,
      status: 400,
      diagnostics: "Missing required search parameter 'patient'. This server has no all-patients search.",
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
    if (!belongsToPatient(r, query.patientId)) return false
    if (query.category !== undefined && !matchesToken(r.category, query.category)) return false
    return true
  })
}
