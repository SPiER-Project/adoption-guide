/**
 * Display helpers for the FHIR resources the patient chart renders — naming,
 * dating and counting. Pure and React-free; the components that use them live
 * in components/ChartArtifacts.tsx.
 */
import { toolForResponse } from './patientPathway'
import type {
  FhirResourceLike,
  QuestionnaireResponseLike,
  StoredResponseLike,
} from './patientPathway'
import type { CodeableConcept } from '../types/fhir'

// The chart renders stored FHIR resources that arrive (via patientPathway) as
// loose FhirResourceLike — typed only for stage resolution. This is the set of
// extra fields the rendering reads off them; `_savedAt` is SPiER's client-side
// capture stamp (demo only, no server persistence).
export interface RenderableResource {
  id?: string
  status?: string
  code?: CodeableConcept
  effectiveDateTime?: string
  valueInteger?: number
  valueQuantity?: { value?: number }
  reasonCode?: CodeableConcept[]
  category?: CodeableConcept[]
  sent?: string
  _savedAt?: string
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

// Short labels for the per-stage score chip — full LOINC/SNOMED display names
// are too long to read inline.
const SCORE_CHIP_LABELS: Record<string, string> = {
  '44261-6': 'PHQ-9 total',
  '44260-8': 'PHQ-9 item 9',
  '225337009': 'SBQ-R total',
}

/**
 * The clinical score(s) a stage's Observations carry, e.g. "PHQ-9 total: 14".
 * Read straight off the persisted resource value; empty when no scored
 * observation exists.
 */
export function scoreSummaryOf(observations: FhirResourceLike[]): string {
  return observations
    .map(rawObs => {
      const o = rawObs as RenderableResource
      const value = o.valueInteger ?? o.valueQuantity?.value
      if (value === undefined || value === null) return null
      // Full LOINC display names are long and clutter the chip — prefer a short
      // label for known scored codes, falling back to the resource's own text.
      const code = o.code?.coding?.[0]?.code
      const label =
        (code && SCORE_CHIP_LABELS[code]) || o.code?.text || o.code?.coding?.[0]?.display || 'Score'
      return `${label}: ${value}`
    })
    .filter(Boolean)
    .join(' · ')
}

// CarePlan display name: the resource's own title when present (scenario and
// foreign-EHR plans carry one), else the legacy id-convention fallbacks for
// tool-emitted plans that predate titles.
export function carePlanDisplayName(cp: RenderableResource & { title?: unknown }): string {
  if (typeof cp.title === 'string' && cp.title) return cp.title
  if (cp.id?.includes('stanley-brown')) return 'Stanley-Brown Safety Plan'
  if (cp.id?.includes('cams-stabilization')) return 'CAMS Stabilization Plan'
  if (cp.id?.includes('cams-therapeutic')) return 'CAMS Therapeutic Worksheet'
  return 'Care plan'
}

/**
 * Label + icon for a Stage-5 workflow artifact. These types describe themselves
 * through different elements (a packet's attachment title, a referral's code, an
 * appointment's description), and the lifecycle state matters as much as the
 * name — a referral that has completed and one still outstanding are the same
 * resource at two points, and a card that couldn't tell them apart would
 * undercut the tracking the stage exists to demonstrate.
 */
export function workflowArtifactDisplay(resource: FhirResourceLike): {
  icon: string
  name: string
  meta: string
} {
  const r = resource as RenderableResource & {
    type?: { text?: string }
    content?: { attachment?: { title?: string } }[]
    description?: string
    start?: string
    date?: string
    dateTime?: string
    authoredOn?: string
    performer?: { display?: string }[]
    performedDateTime?: string
    provision?: { type?: string }
  }
  const on = (iso?: string) => (iso ? ` · ${new Date(iso).toLocaleDateString()}` : '')
  switch (resource.resourceType) {
    case 'DocumentReference':
      return {
        icon: '\u{1F4E6}',
        name: r.content?.[0]?.attachment?.title ?? r.type?.text ?? 'Discharge safety packet',
        meta: `DocumentReference · ${r.status ?? 'current'}${on(r.date ?? r._savedAt)}`,
      }
    case 'ServiceRequest':
      return {
        icon: '\u{1F500}',
        name: r.code?.text ?? 'Suicide-safety referral',
        meta: `ServiceRequest · ${r.status ?? 'active'}${
          r.performer?.[0]?.display ? ` → ${r.performer[0].display}` : ''
        }${on(r.authoredOn ?? r._savedAt)}`,
      }
    case 'Appointment':
      return {
        icon: '\u{1F4C5}',
        name: r.description ?? 'Follow-up appointment',
        meta: `Appointment · ${r.status ?? 'booked'}${on(r.start ?? r._savedAt)}`,
      }
    case 'Procedure':
      return {
        icon: '\u{1F6E1}',
        name: r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Safety procedure',
        meta: `Procedure · ${r.status ?? 'completed'}${on(r.performedDateTime ?? r._savedAt)}`,
      }
    case 'Consent':
      return {
        icon: '\u{1F510}',
        name:
          r.provision?.type === 'deny'
            ? 'Information sharing declined'
            : 'Information sharing permitted',
        meta: `Consent · ${r.status ?? 'active'}${on(r.dateTime ?? r._savedAt)}`,
      }
    default:
      return {
        icon: '\u{1F4C4}',
        name: resource.resourceType ?? 'Resource',
        meta: `${resource.resourceType ?? 'Resource'}${on(r._savedAt)}`,
      }
  }
}

export interface ArtifactBuckets {
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
  communications: FhirResourceLike[]
  workflowArtifacts: FhirResourceLike[]
}

export function artifactCount(b: ArtifactBuckets): number {
  return (
    b.responses.length +
    b.carePlans.length +
    b.observations.length +
    b.communications.length +
    b.workflowArtifacts.length
  )
}


// ─── Walkthrough artifact references (#263 phase 5b) ─────────

/** One artifact a walkthrough step produced, resolved for display. */
export interface RelatedArtifact {
  ref: string
  name: string
  resourceType: string
}

/**
 * `Type/id` → display, for every artifact a walkthrough step can reference.
 *
 * Extracted from PatientChart so it can be tested: the string matching this
 * replaced (`relatedResponseNames` by display name, `relatedCarePlanIdSubstrings`
 * by id substring) reached only responses and CarePlans, and broke silently when
 * either was renamed.
 *
 * QuestionnaireResponses are keyed by the StoredResponse wrapper id, which is the
 * identity the app gives them — `PatientProvider.addResponse` sets
 * `resource.id = entry.id`, and the scenario fixtures now match.
 */
/**
 * A human label for one artifact, whatever its type.
 *
 * `workflowArtifactDisplay` has no `Observation` or `Communication` case and its
 * default returns the bare resourceType, which reads as "Observation ·
 * Observation" in the walkthrough list. Handled here rather than by widening that
 * function, which other chart surfaces already depend on.
 */
export function artifactLabel(resource: FhirResourceLike): string {
  const r = resource as RenderableResource & {
    category?: CodeableConcept[]
    reasonCode?: CodeableConcept[]
  }
  if (resource.resourceType === 'CarePlan') {
    return carePlanDisplayName(resource as RenderableResource & { title?: unknown })
  }
  if (resource.resourceType === 'QuestionnaireResponse') {
    // The StoredResponse wrapper carries `questionnaireName`, but a bare resource
    // does not — so resolve the instrument from its own canonical instead.
    return toolForResponse(resource as QuestionnaireResponseLike)?.name ?? 'Questionnaire response'
  }
  if (resource.resourceType === 'Observation') {
    return (
      r.code?.text ??
      r.code?.coding?.[0]?.display ??
      scoreSummaryOf([resource]) ??
      'Observation'
    )
  }
  // Flag / Task / Encounter reach this function only through the walkthrough
  // ref index (patient-013 and patient-014 link precautions, re-attempt tasks
  // and the elopement encounter). Without these cases the default returns the
  // bare resourceType, which renders as "Flag · Flag".
  if (resource.resourceType === 'Flag') {
    return r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Flag'
  }
  if (resource.resourceType === 'Task') {
    // `code` is the short name of the work; `description` is the full
    // instruction and runs to a sentence or more, which reads badly as a chip.
    const t = resource as RenderableResource & { description?: unknown }
    if (r.code?.text) return r.code.text
    return typeof t.description === 'string' ? t.description : 'Task'
  }
  if (resource.resourceType === 'Encounter') {
    const e = resource as RenderableResource & { class?: { display?: string } }
    return e.class?.display ? `${e.class.display} encounter` : 'Encounter'
  }
  if (resource.resourceType === 'Communication') {
    // The first category with prose; the #262 concept-domain category is coded
    // only, so it is skipped rather than shown as the name.
    return (
      r.category?.find((c) => c?.text)?.text ??
      r.reasonCode?.find((c) => c?.text)?.text ??
      'Communication'
    )
  }
  return workflowArtifactDisplay(resource).name
}

export function buildWalkthroughRefIndex(buckets: ArtifactBuckets): Map<string, RelatedArtifact> {
  const index = new Map<string, RelatedArtifact>()
  const add = (resourceType: string, id: unknown, name: string) => {
    if (typeof id !== 'string' || !id) return
    const ref = `${resourceType}/${id}`
    index.set(ref, { ref, name, resourceType })
  }

  for (const r of buckets.responses) {
    // Prefer the QR's own id — that is what a `QuestionnaireResponse/<id>`
    // reference resolves against — falling back to the wrapper id for a
    // persisted slice authored before the two were kept in step.
    const qrId = (r.resource as { id?: string })?.id ?? r.id
    add('QuestionnaireResponse', qrId, r.questionnaireName ?? 'QuestionnaireResponse')
  }
  for (const cp of buckets.carePlans) {
    add('CarePlan', cp.id, carePlanDisplayName(cp as RenderableResource))
  }
  for (const o of buckets.observations) {
    add('Observation', o.id, artifactLabel(o))
  }
  for (const resource of [...buckets.communications, ...buckets.workflowArtifacts]) {
    if (!resource.resourceType) continue
    add(resource.resourceType, resource.id, artifactLabel(resource))
  }
  return index
}

/**
 * Resolve a step's references, dropping any that point at nothing rather than
 * rendering a dead row. `check-scenario-resources.mjs` is what stops an
 * unresolvable reference shipping in the first place.
 */
export function resolveRelatedRefs(
  refs: string[] | undefined,
  index: Map<string, RelatedArtifact>,
): RelatedArtifact[] {
  return (refs ?? []).map((ref) => index.get(ref)).filter((a): a is RelatedArtifact => !!a)
}
