/**
 * fixtures — the mock EHR's entire dataset, built once at module load from the
 * app's OWN files. There is no second copy of any patient anywhere: the
 * scenarios are `packages/demo-population/src/scenarios/patient-0NN.json` and the
 * Patients are the FSH-generated `packages/fhir-artifacts/generated/Patient-patient-0NN.json`
 * minted in #356. Both arrive through `import.meta.glob`, inlined by the Vite
 * build, because a Worker has no filesystem.
 *
 * ── Two things here are deliberately loud ───────────────────────────────────
 *
 * 1. **The `responses` bucket is unwrapped explicitly.** The reference walk in
 *    `scripts/validate-fhir.mjs` (`SCENARIO_FHIR_BUCKETS`) deliberately OMITS
 *    it — those are `StoredResponse` wrappers, `{ id, questionnaireName,
 *    completedAt, resource }`, and the QR is `entry.resource`. That is the one
 *    bucket the read path cannot skip: `QuestionnaireResponse?patient=` is one
 *    of the two searches whose failure fails the whole chart.
 *
 * 2. **An unrecognized bucket throws** rather than being ignored. A scenario
 *    that grows a new FHIR bucket would otherwise be served as an empty search
 *    result forever, and an empty search result is indistinguishable from
 *    "this patient has none" — the silent-skip failure this repo keeps
 *    catching (#232, #261). Same for a duplicate `Type/id`: the id index would
 *    quietly serve whichever won.
 *
 * 3. **A missing patient link is stamped on, and every stamp is listed.** See
 *    `NORMALIZED_LINKS` below — this is a real gap in the fixtures, not a
 *    convenience, and it is exported so a test can pin exactly which resources
 *    needed it.
 */
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { MRN_SYSTEM } from '@spier/core/lib/fhircast'

/** The least a resource must be for this server to serve it. */
export interface MockResource {
  resourceType: string
  id?: string
  [key: string]: unknown
}

/**
 * Scenario bucket → FHIR resource type. Mirrors `SCENARIO_FHIR_BUCKETS` in
 * `scripts/validate-fhir.mjs`, plus `responses` (see the header note) — that
 * script omits it on purpose and this one cannot.
 */
const FHIR_BUCKETS: Record<string, string> = {
  responses: 'QuestionnaireResponse',
  observations: 'Observation',
  carePlans: 'CarePlan',
  communications: 'Communication',
  episodes: 'EpisodeOfCare',
  encounters: 'Encounter',
  flags: 'Flag',
  tasks: 'Task',
  documentReferences: 'DocumentReference',
  serviceRequests: 'ServiceRequest',
  appointments: 'Appointment',
  consents: 'Consent',
  procedures: 'Procedure',
}

/**
 * Scenario keys that are NOT FHIR and must never be served. `riskAlerts` is an
 * app type; `walkthrough` is `ScenarioEncounter` narration (the real Encounters
 * are the `encounters` bucket, #285). Listing them is what lets an unknown key
 * throw.
 */
const NON_FHIR_BUCKETS = new Set(['riskAlerts', 'walkthrough'])

/** Persistence stamp SPiER's client-side store adds; not part of the resource. */
const CLIENT_ONLY_FIELDS = ['_savedAt']

/**
 * How each type points at its patient — the read-direction twin of
 * `patientRefField` in packages/core/src/lib/dataSource/smartDataSource.ts.
 */
const PATIENT_ELEMENT: Record<string, 'subject' | 'patient' | 'for' | 'appointment-participant'> = {
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

/**
 * Every `Type/id` whose patient link this module had to supply, because the
 * fixture does not carry one.
 *
 * ⚠️ **All 20 scenario QuestionnaireResponses are in here, and nothing else
 * is.** Twelve of the thirteen buckets are 100% linked; `responses` is 0%. That
 * matters more than it looks: `QuestionnaireResponse?patient=` is one of the
 * two searches whose failure fails the whole chart, so without this stamp the
 * most load-bearing search on the server returns nothing for every patient.
 *
 * The gap is invisible to the existing gates by construction —
 * `check-scenario-resources.mjs` check 3 ("every resource points at THIS
 * scenario's patient") walks the FHIR buckets, and `responses` is not one of
 * them; `check-scenario-responses.mjs` validates each QR against its
 * Questionnaire, which says nothing about the subject. Neither is wrong; the
 * combination just leaves `QuestionnaireResponse.subject` unowned.
 *
 * Stamping here is the narrow fix — it keeps the change inside this service —
 * but the durable one is to add `subject` to the fixtures: **issue #364**. When
 * that lands, DELETE this stamping and assert the list is empty, so the
 * workaround dies with the defect instead of outliving it. `fixtures.test.ts`
 * pins the list meanwhile, so a NEW unlinked resource in any other bucket fails
 * loudly instead of quietly acquiring a link.
 */
export const NORMALIZED_LINKS: string[] = []

/**
 * Every QuestionnaireResponse whose `authored` this module had to supply from
 * its `StoredResponse` wrapper's `completedAt`. Pinned by a test for the same
 * reason as `NORMALIZED_LINKS`: the workaround must die with the defect.
 */
export const NORMALIZED_AUTHORED: string[] = []

function withPatientLink(resource: MockResource, patientId: string): MockResource {
  const element = PATIENT_ELEMENT[resource.resourceType]
  if (!element) return resource
  const reference = { reference: `Patient/${patientId}` }

  if (element === 'appointment-participant') {
    const participants = Array.isArray(resource.participant) ? resource.participant : []
    const linked = participants.some(
      p => (p as { actor?: { reference?: string } })?.actor?.reference === `Patient/${patientId}`,
    )
    if (linked) return resource
    NORMALIZED_LINKS.push(`${resource.resourceType}/${String(resource.id)}`)
    return { ...resource, participant: [...participants, { actor: reference, status: 'accepted' }] }
  }

  if ((resource[element] as { reference?: string } | undefined)?.reference) return resource
  NORMALIZED_LINKS.push(`${resource.resourceType}/${String(resource.id)}`)
  return { ...resource, [element]: reference }
}

const patientModules = import.meta.glob<MockResource>(
  '../../../packages/fhir-artifacts/generated/Patient-patient-*.json',
  { eager: true, import: 'default' },
)

function strip(resource: MockResource): MockResource {
  const clean = { ...resource }
  for (const field of CLIENT_ONLY_FIELDS) delete clean[field]
  return clean
}

/** Every resource this server holds, in load order, with its owning patient. */
export interface HeldResource {
  /** The patient whose scenario (or Patient resource) this came from. */
  patientId: string
  resource: MockResource
}

function buildHeld(): HeldResource[] {
  const held: HeldResource[] = []

  // The 14 Patients, from the generated IG examples.
  for (const [path, patient] of Object.entries(patientModules)) {
    if (patient?.resourceType !== 'Patient' || typeof patient.id !== 'string') {
      throw new Error(`[mock-ehr] ${path} is not a Patient with an id — copy-fhir output changed shape.`)
    }
    held.push({ patientId: patient.id, resource: strip(patient) })
  }
  if (held.length === 0) {
    // The #232/#261 failure mode: an empty dataset would serve empty Bundles
    // and look like a working server. `npm run copy-fhir` has not run.
    throw new Error('[mock-ehr] No Patient resources found. Run `npm run copy-fhir` in web/ first.')
  }

  for (const [patientId, scenario] of Object.entries(POPULATION_SCENARIOS)) {
    for (const [bucket, entries] of Object.entries(scenario as unknown as Record<string, unknown>)) {
      if (NON_FHIR_BUCKETS.has(bucket)) continue
      const type = FHIR_BUCKETS[bucket]
      if (!type) {
        throw new Error(
          `[mock-ehr] ${patientId} has unknown scenario bucket '${bucket}'. Add it to FHIR_BUCKETS `
          + '(and to the read API) or to NON_FHIR_BUCKETS — an unserved bucket is invisible.',
        )
      }
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        // `responses` holds StoredResponse wrappers; every other bucket holds
        // the resource directly.
        let raw = (bucket === 'responses'
          ? (entry as { resource?: MockResource })?.resource
          : entry) as MockResource | undefined
        // ⚠️ Same shape as the missing `subject`: the WRAPPER carries
        // `completedAt` and not one of the 20 QRs carries `authored`, so a
        // server serving the resource alone drops the date entirely. The chart
        // rendered "Invalid Date Invalid Date" for every SMART-read
        // QuestionnaireResponse until this existed. The app's own write path
        // already compensates in the other direction (smartDataSource stamps
        // `authored: entry.completedAt` when writing a QR back), which is the
        // tell that the fixture is what is incomplete. Tracked in #364 with
        // the `subject` gap; delete this when the fixtures carry `authored`.
        if (bucket === 'responses' && raw && !raw.authored) {
          const completedAt = (entry as { completedAt?: unknown })?.completedAt
          if (typeof completedAt === 'string' && completedAt) {
            raw = { ...raw, authored: completedAt }
            NORMALIZED_AUTHORED.push(`${raw.resourceType}/${String(raw.id)}`)
          }
        }
        if (!raw || typeof raw !== 'object') continue
        if (raw.resourceType !== type) {
          throw new Error(
            `[mock-ehr] ${patientId} bucket '${bucket}' holds a ${String(raw.resourceType)}, expected ${type}.`,
          )
        }
        held.push({ patientId, resource: withPatientLink(strip(raw), patientId) })
      }
    }
  }
  return held
}

export const HELD_RESOURCES: HeldResource[] = buildHeld()

/** `Type/id` → resource, for the read-by-id route. */
export const RESOURCES_BY_KEY: Map<string, MockResource> = (() => {
  const index = new Map<string, MockResource>()
  for (const { resource } of HELD_RESOURCES) {
    if (typeof resource.id !== 'string' || !resource.id) continue
    const key = `${resource.resourceType}/${resource.id}`
    if (index.has(key)) {
      throw new Error(`[mock-ehr] Duplicate ${key} across scenarios — read-by-id would be ambiguous.`)
    }
    index.set(key, resource)
  }
  return index
})()

/** Every resource type this server holds at least one of. */
export const HELD_TYPES: string[] = [
  ...new Set(HELD_RESOURCES.map(h => h.resource.resourceType)),
].sort()

/** The demo patients, sorted — for the control page's launch picker. */
export const PATIENT_IDS: string[] = HELD_RESOURCES
  .filter(h => h.resource.resourceType === 'Patient')
  .map(h => String(h.resource.id))
  .sort()

/**
 * Display demographics for the host chrome (patient list + chart banner),
 * DERIVED from the same `Patient` resources this server serves.
 *
 * ⚠️ Deliberately not a hand-typed table. `CLAUDE.md` already names three sites
 * where the 14 demo patients' demographics must agree — `population-patients.fsh`
 * (canonical), `patients.json`, and `populationToFhir`'s MRN system — and
 * `check:patients` gates all three. A fourth copy inside this service would sit
 * outside that gate and drift silently, which is the failure this repo keeps
 * finding. `MRN_SYSTEM` is imported rather than restated for the same reason.
 *
 * The banner is not decoration either: it is what makes
 * `need_patient_banner: false` an honest thing for a launch to say. A host that
 * tells the panel "I draw the banner" and then draws nothing is worse than one
 * that never sends the parameter.
 */
export interface DemoPatient {
  id: string
  /** "Maria Alvarez" — given + family, the shape the panel's strip renders. */
  name: string
  /** From `Patient.identifier` in SPiER's MRN namespace. */
  mrn: string
  birthDate: string
  gender: string
}

/** Fallback for a display field the resource does not carry. */
const UNKNOWN = '—'

function demographicsOf(patient: MockResource): DemoPatient {
  const name = (patient.name as Array<{ given?: string[]; family?: string }> | undefined)?.[0]
  const identifiers = (patient.identifier as Array<{ system?: string; value?: string }> | undefined) ?? []
  // Same preference order as readSmartPatientSummary: SPiER's own namespace
  // first, then any identifier that has a value.
  const mrn = identifiers.find(i => i?.system === MRN_SYSTEM)?.value
    ?? identifiers.find(i => i?.value)?.value

  return {
    id: String(patient.id),
    name: name ? `${name.given?.join(' ') ?? ''} ${name.family ?? ''}`.trim() : UNKNOWN,
    mrn: mrn ?? UNKNOWN,
    birthDate: typeof patient.birthDate === 'string' ? patient.birthDate : UNKNOWN,
    gender: typeof patient.gender === 'string' ? patient.gender : UNKNOWN,
  }
}

/** The demo patients with their demographics, sorted by id. */
export const DEMO_PATIENTS: DemoPatient[] = HELD_RESOURCES
  .filter(h => h.resource.resourceType === 'Patient')
  .map(h => demographicsOf(h.resource))
  .sort((a, b) => a.id.localeCompare(b.id))

/** `id` → demographics, for the chart page's banner. */
export const DEMO_PATIENTS_BY_ID: Map<string, DemoPatient> = new Map(
  DEMO_PATIENTS.map(p => [p.id, p]),
)
