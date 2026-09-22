/**
 * One record's kind, its key and the path that opens it.
 *
 * ── Why a "kind" at all, when the resource type is right there ────────────
 *
 * Because the resource type is the one thing this surface may not say
 * (`check:jargon`'s clinical scan, clinical-app audit §1.9). Every row on the
 * care pathway's stages and on *What's on file* already names what was recorded
 * without it; opening one needs the same word in two more places — the address
 * a clinician can see in a launched tab, and the line under the record's title.
 * So the mapping is made once, here, and both of those read from it.
 *
 * ⚠️ **The key is `kind-id`, and the kind is load-bearing rather than
 * decorative.** Ids are unique within a bucket and nothing guarantees they are
 * unique across them — a scenario is free to carry `Observation/p001-sb` beside
 * `CarePlan/p001-sb` — so the kind is what keeps two records from resolving to
 * the same page. It is also why the key is never PARSED: `findRecord` recomputes
 * the key for every artifact and compares, so an id containing the separator
 * costs nothing, and the resolution cannot disagree with the link.
 *
 * ⚠️ **`record` is the honest fallback, not a bug.** A resource type SPiER has
 * no word for still gets a row on the chart (`workflowArtifactDisplay`'s own
 * default says so), and a row that cannot be opened is worse than a plain one.
 */
import type { FhirResourceLike } from '@spier/core/lib/patientPathway'

export type RecordKind =
  | 'form'
  | 'result'
  | 'plan'
  | 'contact'
  | 'referral'
  | 'appointment'
  | 'document'
  | 'consent'
  | 'procedure'
  | 'alert'
  | 'task'
  | 'visit'
  | 'episode'
  | 'record'

/**
 * Resource type → the clinician's word for it.
 *
 * ⚠️ Written as identifier keys rather than quoted ones on purpose: a quoted
 * `'QuestionnaireResponse'` here is a string literal in a rendering module's
 * tree, which is exactly what the clinical jargon scan reads. The values are
 * what a reader meets; the keys are what the wire calls them.
 */
const KIND_BY_TYPE: Record<string, RecordKind> = {
  QuestionnaireResponse: 'form',
  Observation: 'result',
  CarePlan: 'plan',
  Communication: 'contact',
  ServiceRequest: 'referral',
  Appointment: 'appointment',
  DocumentReference: 'document',
  Consent: 'consent',
  Procedure: 'procedure',
  Flag: 'alert',
  Task: 'task',
  Encounter: 'visit',
  EpisodeOfCare: 'episode',
}

/** What this record is, in one word a clinician uses. */
export const KIND_WORD: Record<RecordKind, string> = {
  form: 'Completed form',
  result: 'Result',
  plan: 'Plan',
  contact: 'Contact with the patient',
  referral: 'Referral',
  appointment: 'Appointment',
  document: 'Document',
  consent: 'Consent',
  procedure: 'Procedure',
  alert: 'Chart alert',
  task: 'Task',
  visit: 'Visit',
  episode: 'Episode of care',
  record: 'Record',
}

export function recordKind(resource: FhirResourceLike): RecordKind {
  return KIND_BY_TYPE[resource.resourceType ?? ''] ?? 'record'
}

/** The stable key for one record — `kind-id`. Empty when the record has no id. */
export function recordKey(resource: FhirResourceLike): string {
  const id = typeof resource.id === 'string' ? resource.id : ''
  return id ? `${recordKind(resource)}-${id}` : ''
}

/** Where this record opens, or null when it has no id to be addressed by. */
export function recordPath(resource: FhirResourceLike): string | null {
  const key = recordKey(resource)
  return key ? `/patient/on-file/${encodeURIComponent(key)}` : null
}
