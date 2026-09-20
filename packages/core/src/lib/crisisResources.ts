/**
 * Stage-4 (Document Safety Actions) crisis-resource helpers — TL-013.
 *
 * The FHIR shape is defined in ig/input/fsh/crisis-resources.fsh. Like TL-008,
 * this is a safety-ACTION documentation tool rather than a questionnaire:
 * handing a patient the 988 number is an act that gets recorded, not a form
 * they fill in. It records as one stage-tagged `Communication` whose payloads
 * are the resources shared.
 *
 * ── Why the payload carries an extension ────────────────────────────────────
 *
 * `Communication.payload.content[x]` is `string | Attachment | Reference` —
 * there is no coded choice. So "which resource was shared" rides on the
 * `crisis-resource-code` extension beside the human-readable line, which is
 * exactly what `ExampleCrisisResourcesShared` does. Without it the record is
 * prose, and "did this patient leave with crisis contacts" is not a query.
 *
 * ⚠️ **`payload` is `1..*` on the profile.** A submission with nothing selected
 * cannot be recorded conformantly, so the recorder disables its submit rather
 * than emitting a resource that claims a profile it fails. The builder does not
 * paper over an empty list: inventing a payload would assert that something was
 * handed over.
 *
 * ⚠️ **This existed as a profile before it existed as a builder.** Until
 * 2026-09-17 the route rendered the generic `WorkflowActionView`, which stamped
 * no `meta.profile`, wrote `category: [{ text }]` with no coding (failing the
 * `category:suicideRisk` slice `#262` made required) and wrote `payload` only
 * when the optional note was non-empty. The TL-013 ActivityDefinition's own
 * description has always said the output is "a SPiERCrisisResourcesShared
 * Communication"; it was not. Unlike its sibling TL-009 no measure reads this
 * profile, so the cost was a conformance claim the guide made and the app
 * broke, rather than a silent zero in a numerator.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server, and no resource is actually
 * transmitted to the patient.
 */
import type { StageId } from '@spier/fhir-artifacts/generated/stage-ids.generated'
import { displayFor, type CodedOption } from './codedOption'
import { stageTag } from './stageTag'
import type { CommunicationResource } from '../types/fhir'
import { suicideRiskCategory } from './conceptDomain'

// `satisfies StageId`: the literal keeps its type, and a stage renamed in the
// CodeSystem (stage-ids.generated.ts follows it) is a compile error here rather
// than a stage tag nothing resolves.
export const STAGE_ID = 'document-safety-actions' satisfies StageId

export const CRISIS_RESOURCES_PROFILE =
  'http://thespierproject.org/fhir/StructureDefinition/spier-crisis-resources-shared'

export const CRISIS_RESOURCE_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-crisis-resource'
export const CRISIS_RESOURCE_CODE_EXT =
  'http://thespierproject.org/fhir/StructureDefinition/crisis-resource-code'

/**
 * The shareable resources (spier-crisis-resource).
 *
 * `display` is the coded display and is NOT a free choice — `validate-fhir.mjs`
 * checks every `Coding.display` on a SPiER-local system against the CodeSystem,
 * so these must match `crisis-resources.fsh` exactly. `patientText` is the
 * separate, patient-facing line that goes in `payload.contentString`: a code
 * display names the service, while what the patient is handed has to say how to
 * reach it.
 */
export const CRISIS_RESOURCES: (CodedOption & { patientText: string })[] = [
  {
    code: 'lifeline-988',
    display: '988 Suicide & Crisis Lifeline',
    patientText: '988 Suicide & Crisis Lifeline (call/text/chat 988)',
  },
  {
    code: 'crisis-text-line',
    display: 'Crisis Text Line',
    patientText: 'Crisis Text Line — text HOME to 741741',
  },
  {
    code: 'now-matters-now',
    display: 'Now Matters Now',
    patientText: 'Now Matters Now — coping skills videos (nowmattersnow.org)',
  },
  {
    code: 'safety-plan-copy',
    display: 'Safety plan copy',
    patientText: 'Copy of your safety plan',
  },
  {
    code: 'local-crisis-line',
    display: 'Local crisis line',
    patientText: 'Local crisis line',
  },
  {
    code: 'warmline',
    display: 'Peer warmline',
    patientText: 'Peer warmline',
  },
]

/** The SSC's expected minimum — pre-checked by the recorder. */
export const DEFAULT_CRISIS_RESOURCES = ['lifeline-988', 'crisis-text-line', 'safety-plan-copy']

export function crisisResourceText(code: string): string {
  return CRISIS_RESOURCES.find(r => r.code === code)?.patientText ?? code
}

/**
 * Record that patient-facing crisis resources were provided.
 *
 * `resourceCodes` must be non-empty — see the `payload 1..*` note above.
 * `customLine` is for the one thing a code list cannot carry: the actual number
 * of *this* site's local crisis line. It replaces the generic patient text on
 * whichever coded entries have no number of their own, so the record says what
 * the patient can actually dial.
 */
export function buildCrisisResourcesShared(params: {
  id: string
  patientId: string | null
  sent: string
  /** Codes from CRISIS_RESOURCES. Must not be empty: the profile is `payload 1..*`. */
  resourceCodes: string[]
  /** Site-specific text for the local crisis line / warmline, when given. */
  localLine?: string
  note?: string
}): CommunicationResource {
  const localised = new Set(['local-crisis-line', 'warmline'])
  return {
    resourceType: 'Communication',
    id: params.id,
    meta: { profile: [CRISIS_RESOURCES_PROFILE], tag: stageTag(STAGE_ID) },
    status: 'completed',
    category: [{ text: 'Crisis resources shared' }, suicideRiskCategory()],
    subject: { reference: `Patient/${params.patientId ?? 'demo-patient'}` },
    sent: params.sent,
    payload: params.resourceCodes.map(code => ({
      contentString:
        params.localLine && localised.has(code)
          ? `${crisisResourceText(code)} — ${params.localLine}`
          : crisisResourceText(code),
      extension: [
        {
          url: CRISIS_RESOURCE_CODE_EXT,
          valueCoding: {
            system: CRISIS_RESOURCE_SYSTEM,
            code,
            display: displayFor(CRISIS_RESOURCES, code),
          },
        },
      ],
    })),
    ...(params.note ? { note: [{ text: params.note }] } : {}),
  }
}

/** The crisis-resource codes recorded on one Communication. */
export function crisisResourceCodes(resource: CommunicationResource): string[] {
  const payload = (resource as {
    payload?: { extension?: { url?: string; valueCoding?: { code?: string } }[] }[]
  }).payload
  return (payload ?? [])
    .map(p => p.extension?.find(e => e.url === CRISIS_RESOURCE_CODE_EXT)?.valueCoding?.code)
    .filter((c): c is string => !!c)
}

/**
 * Crisis-resource shares on a chart, most recent first. Matched on the profile,
 * for the same reason `safetyHandoffs` is: nothing else distinguishes this
 * Communication from any other, which is why the unprofiled output it replaced
 * was invisible rather than wrong-looking.
 */
export function crisisResourceShares(
  communications: CommunicationResource[],
): CommunicationResource[] {
  return communications
    .filter(c =>
      (c.meta?.profile ?? []).includes(
        CRISIS_RESOURCES_PROFILE,
      ),
    )
    .slice()
    .sort((a, b) => (b.sent ?? '').localeCompare(a.sent ?? ''))
}
