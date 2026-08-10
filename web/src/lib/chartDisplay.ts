/**
 * Display helpers for the FHIR resources the patient chart renders — naming,
 * dating and counting. Pure and React-free; the components that use them live
 * in components/ChartArtifacts.tsx.
 */
import type { FhirResourceLike, StoredResponseLike } from './patientPathway'
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

