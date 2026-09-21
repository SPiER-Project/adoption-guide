/**
 * Display helpers for the FHIR resources the patient chart renders — naming,
 * dating and counting. Pure and React-free; the components that use them live
 * in components/ChartArtifacts.tsx.
 */
import { toolForResponse } from '@spier/core/lib/patientPathway'
import type {
  FhirResourceLike,
  QuestionnaireResponseLike,
  StoredResponseLike,
} from '@spier/core/lib/patientPathway'
import type { CodeableConcept } from '@spier/core/types/fhir'

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
  // CarePlan's record-time field; the fixtures carry it instead of `_savedAt`,
  // which only a runtime save stamps.
  created?: string
  _savedAt?: string
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
 * A FHIR lifecycle code in the word a clinician uses for it.
 *
 * ⚠️ **The state is kept and only its SPELLING changes**, which is the whole
 * judgement here (clinical-app audit §1.9). "A referral that has completed and
 * one still outstanding are the same resource at two points", so dropping the
 * state with the resource type would have cost the chart the tracking Stage 5
 * exists to demonstrate; printing `active` / `revoked` / `noshow` at a
 * clinician is printing the wire's enum at someone who never sees the wire.
 *
 * One map across every type on purpose: the codes that collide across resource
 * types (`active`, `completed`, `cancelled`, `draft`) mean the same thing to a
 * reader wherever they appear, and a per-type map would have been four chances
 * to say it four ways. A code not listed renders as nothing rather than as
 * itself — an unknown lifecycle word is exactly the case this exists to stop.
 */
const LIFECYCLE_WORD: Record<string, string> = {
  active: 'Active',
  'on-hold': 'On hold',
  onhold: 'On hold',
  draft: 'Draft',
  'in-progress': 'In progress',
  preparation: 'Being prepared',
  completed: 'Completed',
  finished: 'Completed',
  fulfilled: 'Attended',
  booked: 'Booked',
  pending: 'Awaiting confirmation',
  proposed: 'Proposed',
  waitlist: 'On the waiting list',
  arrived: 'Arrived',
  noshow: 'Did not attend',
  'not-done': 'Not done',
  cancelled: 'Cancelled',
  revoked: 'Withdrawn',
  stopped: 'Stopped',
  'entered-in-error': 'Entered in error',
  current: 'Current',
  superseded: 'Superseded',
  inactive: 'Inactive',
}

/** The clinician's word for a lifecycle code, or null when there is none. */
export function lifecycleWord(status: string | undefined): string | null {
  return status ? (LIFECYCLE_WORD[status] ?? null) : null
}

/**
 * Name, state and date for a Stage-5 workflow artifact. These types describe
 * themselves through different elements (a packet's attachment title, a
 * referral's code, an appointment's description), and the lifecycle state
 * matters as much as the name — see `lifecycleWord` above.
 *
 * ⚠️ **It returned an `icon` and a `meta` string until 2026-09-21** and the
 * meta led with the resource type (`ServiceRequest · active`). The caller
 * assembles the line now, from parts that are each a clinical fact.
 */
export function workflowArtifactDisplay(resource: FhirResourceLike): {
  name: string
  state: string | null
  when: string | null
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
  const on = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : null)
  switch (resource.resourceType) {
    case 'DocumentReference':
      return {
        name: r.content?.[0]?.attachment?.title ?? r.type?.text ?? 'Discharge safety packet',
        state: lifecycleWord(r.status ?? 'current'),
        when: on(r.date ?? r._savedAt),
      }
    case 'ServiceRequest':
      return {
        name: r.code?.text ?? 'Suicide-safety referral',
        // The receiving service is the fact that makes two open referrals
        // tell apart, so it travels with the state rather than being dropped.
        state: [
          lifecycleWord(r.status ?? 'active'),
          r.performer?.[0]?.display ? `to ${r.performer[0].display}` : null,
        ]
          .filter(Boolean)
          .join(' \u00b7 '),
        when: on(r.authoredOn ?? r._savedAt),
      }
    case 'Appointment':
      return {
        name: r.description ?? 'Follow-up appointment',
        state: lifecycleWord(r.status ?? 'booked'),
        when: on(r.start ?? r._savedAt),
      }
    case 'Procedure':
      return {
        name: r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Safety procedure',
        state: lifecycleWord(r.status ?? 'completed'),
        when: on(r.performedDateTime ?? r._savedAt),
      }
    case 'Consent':
      return {
        name:
          r.provision?.type === 'deny'
            ? 'Information sharing declined'
            : 'Information sharing permitted',
        state: lifecycleWord(r.status ?? 'active'),
        when: on(r.dateTime ?? r._savedAt),
      }
    default:
      // ⚠️ No resource type as the fallback NAME, which is what this was. A
      // clinician meeting a row SPiER has no words for is better served by an
      // honest "something was recorded" than by the wire's noun for it.
      return {
        name: 'Recorded in this chart',
        state: null,
        when: on(r.created ?? r._savedAt),
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
    return toolForResponse(resource as QuestionnaireResponseLike)?.name ?? 'Completed form'
  }
  if (resource.resourceType === 'Observation') {
    return (
      r.code?.text ??
      r.code?.coding?.[0]?.display ??
      scoreSummaryOf([resource]) ??
      'Recorded result'
    )
  }
  // Flags, re-attempt tasks and the elopement encounter reach this function
  // through *What's on file*, which lists every bucket the episode grouping
  // reads (patient-013 and patient-014 carry all three). Without these cases
  // the default would name the row after its resource type, which is the thing
  // this surface exists not to do.
  if (resource.resourceType === 'Flag') {
    return r.code?.text ?? r.code?.coding?.[0]?.display ?? 'Chart alert'
  }
  if (resource.resourceType === 'Task') {
    // `code` is the short name of the work; `description` is the full
    // instruction and runs to a sentence or more, which reads badly as a chip.
    const t = resource as RenderableResource & { description?: unknown }
    if (r.code?.text) return r.code.text
    return typeof t.description === 'string' ? t.description : 'Follow-up task'
  }
  if (resource.resourceType === 'Encounter') {
    const e = resource as RenderableResource & { class?: { display?: string } }
    return e.class?.display ? `${e.class.display} contact` : 'Contact'
  }
  if (resource.resourceType === 'Communication') {
    // The first category with prose; the #262 concept-domain category is coded
    // only, so it is skipped rather than shown as the name.
    return (
      r.category?.find((c) => c?.text)?.text ??
      r.reasonCode?.find((c) => c?.text)?.text ??
      'Contact with the patient'
    )
  }
  return workflowArtifactDisplay(resource).name
}
