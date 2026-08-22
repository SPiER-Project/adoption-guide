/**
 * fixtures — the mock EHR's entire dataset, built once at module load from the
 * app's OWN files. There is no second copy of any patient anywhere: the
 * scenarios are `packages/demo-population/src/scenarios/patient-0NN.json` and the
 * Patients are `packages/demo-population/src/patients/patient-0NN.json`
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
 * 3. **A missing patient link or `authored` THROWS; neither is supplied.** This
 *    module used to stamp both on, because all 20 scenario QuestionnaireResponses
 *    carried neither. That is fixed at the source now (#364), so the fallbacks
 *    are gone rather than left in place unused — a fallback that never fires is
 *    indistinguishable from a fixture that is correct, which is exactly how the
 *    gap survived. `check-scenario-resources.mjs` requires the link offline; this
 *    is the second line of defence.
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
 * Assert the fixture carries its own patient link, rather than supplying one.
 *
 * ⚠️ **This used to stamp the link, and the stamp is deleted rather than made
 * conditional (#364).** All 20 scenario QuestionnaireResponses had no `subject`
 * — twelve of thirteen buckets were 100% linked, `responses` was 0% — and
 * `QuestionnaireResponse?patient=` is one of only two searches whose failure
 * fails the whole chart, so the most load-bearing search on this server returned
 * nothing for every patient. A stamp here made the demo work while leaving the
 * fixtures wrong, which is why it was always meant to die with the defect.
 *
 * The fixtures now carry both `subject` and `authored`, and
 * `check-scenario-resources.mjs` requires the patient link on every bucket
 * INCLUDING `responses` — so this is a belt-and-braces invariant, not a fix. It
 * throws for the same reason `assertUsableIndex` does: a mock that silently
 * serves an unlinked resource is a mock that makes a broken fixture look fine.
 */
function assertPatientLink(resource: MockResource, patientId: string): MockResource {
  const element = PATIENT_ELEMENT[resource.resourceType]
  if (!element) return resource
  const wanted = `Patient/${patientId}`
  const key = `${resource.resourceType}/${String(resource.id)}`

  if (element === 'appointment-participant') {
    const participants = Array.isArray(resource.participant) ? resource.participant : []
    const linked = participants.some(
      p => (p as { actor?: { reference?: string } })?.actor?.reference === wanted,
    )
    if (!linked) {
      throw new Error(
        `[mock-ehr] ${key} has no participant.actor referencing ${wanted}. Fix the fixture in `
        + 'packages/demo-population/src/scenarios/ — this service no longer supplies the link (#364).',
      )
    }
    return resource
  }

  const ref = (resource[element] as { reference?: string } | undefined)?.reference
  if (ref !== wanted) {
    throw new Error(
      `[mock-ehr] ${key} has ${element}=${ref ?? 'nothing'}, expected ${wanted}. Fix the fixture in `
      + 'packages/demo-population/src/scenarios/ — this service no longer supplies the link (#364).',
    )
  }
  return resource
}

// The roster comes from packages/demo-population, NOT the IG's compiled output.
// Step E2 (#392) moved the 14 Patients out of `ig/`: a fake EHR's patient list
// should not depend on a SUSHI compile, and the IG was publishing 14 examples
// that referenced none of its own profiles.
const patientModules = import.meta.glob<MockResource>(
  '../../../packages/demo-population/src/patients/patient-*.json',
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
        const raw = (bucket === 'responses'
          ? (entry as { resource?: MockResource })?.resource
          : entry) as MockResource | undefined
        // ⚠️ Was the same shape as the missing `subject`, and also deleted in
        // #364. The StoredResponse WRAPPER carries `completedAt` while not one
        // of the 20 QRs carried `authored`, so a server serving the resource
        // alone dropped the date and the chart rendered "Invalid Date Invalid
        // Date" for every SMART-read QuestionnaireResponse. The fixtures carry
        // `authored` now; this asserts it rather than supplying it, because a
        // fallback here is what let the fixture stay wrong.
        if (bucket === 'responses' && raw && typeof raw.authored !== 'string') {
          throw new Error(
            `[mock-ehr] QuestionnaireResponse/${String(raw.id)} has no \`authored\`. Fix the fixture in `
            + 'packages/demo-population/src/scenarios/ — the StoredResponse wrapper\'s `completedAt` is '
            + 'no longer copied onto the resource (#364).',
          )
        }
        if (!raw || typeof raw !== 'object') continue
        if (raw.resourceType !== type) {
          throw new Error(
            `[mock-ehr] ${patientId} bucket '${bucket}' holds a ${String(raw.resourceType)}, expected ${type}.`,
          )
        }
        held.push({ patientId, resource: assertPatientLink(strip(raw), patientId) })
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
 * where the 14 demo patients' demographics must agree — the Patient JSON
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
