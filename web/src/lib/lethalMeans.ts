/**
 * Stage-4 (Document Safety Actions) lethal-means helpers — TL-008.
 *
 * The FHIR shape is defined in ig/input/fsh/lethal-means.fsh. TL-008 is the one
 * Stage-4 tool that is NOT a questionnaire: means-safety counseling is an act,
 * not a form, so it records as a Procedure with the concrete per-means actions
 * hanging off it as Observations.
 *
 * Why two resource types rather than one:
 *
 *  - **The Procedure answers "did counseling happen".** That is the process
 *    measure — `SPiERLethalMeansCounselingCompleted` counts exactly this
 *    resource and deliberately ignores the actions, because a site that
 *    counsels every patient and secures nothing is still a site that counsels.
 *  - **The Observations answer "what was actually secured".** One per means,
 *    with the action as the value, so "firearm → transferred to a trusted
 *    party" is queryable rather than buried in narrative. `status` separates a
 *    completed action (`final`) from one merely agreed (`preliminary`) — the
 *    distinction that makes follow-up possible.
 *
 * There is no validated LOINC/SNOMED panel for either vocabulary, so both are
 * SPiER-local CodeSystems; the counseling Procedure carries a general SNOMED
 * counseling code plus clarifying `code.text`.
 *
 * ⚠️ DEMO ONLY — no data is persisted to a server.
 */
import { PATHWAY_STAGE_SYSTEM } from '@spier/core/lib/patientPathway'
import type { CodedOption } from '@spier/core/lib/handoffs'
import type { ObservationResource, ProcedureResource } from '@spier/core/types/fhir'
import { suicideRiskCategory } from '@spier/core/lib/conceptDomain'

export const STAGE_ID = 'document-safety-actions'
const STAGE_TITLE = 'Document Safety Actions'

export const COUNSELING_PROFILE =
  'http://thespierproject.org/fhir/StructureDefinition/spier-lethal-means-counseling'
export const MEANS_SAFETY_ACTION_PROFILE =
  'http://thespierproject.org/fhir/StructureDefinition/spier-means-safety-action'

export const LETHAL_MEANS_METHOD_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-lethal-means-method'
export const MEANS_SAFETY_ACTION_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-means-safety-action'

const SNOMED_SYSTEM = 'http://snomed.info/sct'
const OBSERVATION_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/observation-category'

/**
 * The generic SNOMED counseling concept the profile mandates. SNOMED has no
 * concept for means-safety counseling specifically, so the specificity lives in
 * `code.text` rather than in a code SPiER would have had to invent.
 */
export const COUNSELING_CODE = { system: SNOMED_SYSTEM, code: '409063005', display: 'Counseling' }

/** Default `code.text` — names the protocol most sites will recognise. */
export const COUNSELING_TEXT = 'Lethal means safety counseling (CALM)'

export const LETHAL_MEANS_METHODS: CodedOption[] = [
  { code: 'firearm', display: 'Firearm' },
  { code: 'medication', display: 'Medication' },
  { code: 'sharps', display: 'Sharp objects' },
  { code: 'ligature', display: 'Ligature / hanging risk' },
  { code: 'household-poison', display: 'Household poisons / chemicals' },
  { code: 'other-means', display: 'Other means' },
]

export const MEANS_SAFETY_ACTIONS: CodedOption[] = [
  { code: 'removed-from-environment', display: 'Removed from the environment' },
  { code: 'locked-and-secured', display: 'Locked and secured' },
  { code: 'transferred-to-other-party', display: 'Transferred to a trusted party' },
  { code: 'safely-disposed', display: 'Safely disposed' },
  { code: 'no-access-confirmed', display: 'No access confirmed' },
  { code: 'declined', display: 'Declined / not yet addressed' },
]

export function displayFor(options: CodedOption[], code: string): string {
  return options.find(o => o.code === code)?.display ?? code
}

function stageTag() {
  return [{ system: PATHWAY_STAGE_SYSTEM, code: STAGE_ID, display: STAGE_TITLE }]
}

// ─── The counseling Procedure ─────────────────────────────────

/**
 * "Means-safety counseling was provided." `status` is fixed to `completed` by
 * the profile: a Procedure recorded here has happened, and counseling that is
 * merely planned is a Task, not a completed Procedure.
 */
export function buildLethalMeansCounseling(params: {
  id: string
  patientId: string | null
  performed: string
  /** Overrides the default CALM wording where a site uses another protocol. */
  text?: string
  note?: string
}): ProcedureResource {
  return {
    resourceType: 'Procedure',
    id: params.id,
    meta: { profile: [COUNSELING_PROFILE], tag: stageTag() },
    status: 'completed',
    // R4 caps Procedure.category at 0..1, so the single slot carries the domain
    // code; the counselling act itself is identified by Procedure.code below.
    category: suicideRiskCategory(),
    code: {
      coding: [{ ...COUNSELING_CODE }],
      text: params.text?.trim() || COUNSELING_TEXT,
    },
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    performedDateTime: params.performed,
    ...(params.note ? { note: [{ text: params.note }] } : {}),
  }
}

// ─── The per-means action Observations ────────────────────────

/**
 * One means, one action.
 *
 * `completed` drives `status`, and the split is the whole point of recording
 * these separately from the counseling: `final` means the means is secured now,
 * `preliminary` means the patient agreed to secure it and someone has to check.
 * Collapsing them would make an agreement indistinguishable from a result.
 */
export function buildMeansSafetyAction(params: {
  id: string
  patientId: string | null
  effective: string
  /** A code from LETHAL_MEANS_METHODS — what the action was about. */
  method: string
  /** A code from MEANS_SAFETY_ACTIONS — what was done. */
  action: string
  /** True when the action is done; false when it is agreed but not yet taken. */
  completed: boolean
  /** Responsible party and plan detail — the profile puts these in `note`. */
  note?: string
}): ObservationResource {
  return {
    resourceType: 'Observation',
    id: params.id,
    meta: { profile: [MEANS_SAFETY_ACTION_PROFILE], tag: stageTag() },
    status: params.completed ? 'final' : 'preliminary',
    category: [
      { coding: [{ system: OBSERVATION_CATEGORY_SYSTEM, code: 'procedure' }] },
      suicideRiskCategory(),
    ],
    code: {
      coding: [
        {
          system: LETHAL_MEANS_METHOD_SYSTEM,
          code: params.method,
          display: displayFor(LETHAL_MEANS_METHODS, params.method),
        },
      ],
    },
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    effectiveDateTime: params.effective,
    valueCodeableConcept: {
      coding: [
        {
          system: MEANS_SAFETY_ACTION_SYSTEM,
          code: params.action,
          display: displayFor(MEANS_SAFETY_ACTIONS, params.action),
        },
      ],
    },
    ...(params.note ? { note: [{ text: params.note }] } : {}),
  }
}

// ─── Readers ──────────────────────────────────────────────────

function profiles(resource: { meta?: { profile?: string[] } }): string[] {
  return resource.meta?.profile ?? []
}

export function isLethalMeansCounseling(resource: ProcedureResource): boolean {
  return profiles(resource as { meta?: { profile?: string[] } }).includes(COUNSELING_PROFILE)
}

/**
 * Means-safety actions on a chart, most recent first.
 *
 * Recognized by the SPiER method CodeSystem rather than by profile URL, so an
 * action written by another system — which is unlikely to populate
 * `meta.profile` — still shows up next to the ones this app wrote.
 */
export function meansSafetyActions(observations: ObservationResource[]): ObservationResource[] {
  return observations
    .filter(o => meansSafetyMethod(o) !== undefined)
    .slice()
    .sort((a, b) => (effectiveOf(b) ?? '').localeCompare(effectiveOf(a) ?? ''))
}

function effectiveOf(o: ObservationResource): string | undefined {
  return (o as { effectiveDateTime?: string }).effectiveDateTime
}

export function meansSafetyMethod(o: ObservationResource): string | undefined {
  const coding = (o as { code?: { coding?: { system?: string; code?: string }[] } }).code?.coding
  return coding?.find(c => c.system === LETHAL_MEANS_METHOD_SYSTEM)?.code
}

export function meansSafetyActionCode(o: ObservationResource): string | undefined {
  const coding = (o as { valueCodeableConcept?: { coding?: { system?: string; code?: string }[] } })
    .valueCodeableConcept?.coding
  return coding?.find(c => c.system === MEANS_SAFETY_ACTION_SYSTEM)?.code
}
