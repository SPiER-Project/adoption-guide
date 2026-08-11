#!/usr/bin/env node
/**
 * Anti-drift check for the demo registry's hand-authored NON-QuestionnaireResponse
 * resources — the other half of `npm run check:scenarios`.
 *
 * `check-scenario-responses.mjs` validates the `responses` bucket only (its own
 * header says so). `scripts/validate-fhir.mjs` historically did not read
 * `web/src/data/population/` at all. So every Observation, CarePlan,
 * Communication, EpisodeOfCare, Appointment, ServiceRequest, Procedure and
 * DocumentReference in `scenarios/patient-*.json` was ungated hand-authored
 * FHIR (issue #226).
 *
 * That matters because the Stage-8 measure engine (`src/lib/measures.ts`) reads
 * exactly those buckets. A malformed `EpisodeOfCare.status`, a `ServiceRequest`
 * missing `intent`, or a profile claim that resolves to nothing does not fail —
 * it silently produces a WRONG measure score, which is worse than an empty one.
 *
 * ── What this checks (offline, in `npm run verify`) ──────────────────────────
 *
 *   1. Every top-level scenario key is a bucket something actually reads. A
 *      typo (`serviceRequest`) is otherwise invisible: the app reads
 *      `slice.serviceRequests ?? []` and quietly sees nothing.
 *   2. Every entry in a FHIR bucket has the `resourceType` that bucket implies,
 *      and an `id` unique within the scenario (localDataSource upserts by id).
 *   3. Every resource points at THIS scenario's patient — a copy-pasted
 *      resource carrying the wrong `subject` would be counted for the wrong
 *      patient by the measure engine and never look wrong on screen.
 *   4. Base FHIR R4 required elements are present, and `status` is a member of
 *      the R4 status ValueSet for that type.
 *   5. `meta.profile` canonicals RESOLVE to a real StructureDefinition. An
 *      unresolvable profile is an ERROR, not a warning — that is the exact
 *      silent-pass mode #218 had to fix in validate-fhir.mjs, and it was live
 *      here: patient-001's safety plan claimed `hl7.fhir.us.ecareplan`, a
 *      canonical that does not exist.
 *   6. For each claimed SPiER profile, the constraints its differential
 *      actually states: `min >= 1` elements present, `fixedCode` /
 *      `pattern[x]` values matching, and required bindings to SPiER-local
 *      ValueSets satisfied. These are DERIVED from the generated
 *      StructureDefinitions, not hand-copied, so changing FSH changes this
 *      check.
 *   7. The same required-binding check for SPiER extensions, resolved through
 *      the extension's own StructureDefinition — and for COMPLEX extensions,
 *      each sub-extension slice's cardinality and binding too.
 *      `episode-closure-reason` is read directly by two measure exclusions, so
 *      a bad code there changes a score; `handoff-withheld-item` is only
 *      meaningful if the withheld item and its basis are both present.
 *   8. Date-bearing elements parse as FHIR date / dateTime.
 *   9. The two NON-FHIR buckets — `riskAlerts` (an app type) and `walkthrough`
 *      (`ScenarioEncounter` narration; real Encounters ARE a FHIR bucket) — are
 *      checked against their TypeScript shapes instead.
 *
 * ── What this does NOT check ────────────────────────────────────────────────
 *
 * Everything else full FHIR conformance means: base cardinalities beyond the
 * hand-listed table below, invariants, extension context, slicing, reference
 * target types, and codes from external systems (LOINC / SNOMED). Those are
 * covered by `node scripts/validate-fhir.mjs`, which now unwraps these same
 * scenario resources and runs the HL7 validator over them in CI. This script is
 * the fast offline half of that pair — it is deliberately not a reimplementation
 * of the validator, and must not be described as one.
 *
 * Requires `npm run copy-fhir` (reads the generated StructureDefinitions,
 * ValueSets and CodeSystems out of web/src/data/fhir/).
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const scenariosDir = join(webRoot, 'src/data/population/scenarios')
const fhirDir = join(webRoot, 'src/data/fhir')

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures++
}

// ─────────────────────────────────────────────────────────────
// Bucket → resource type
// ─────────────────────────────────────────────────────────────

/**
 * The FHIR buckets of `PatientSlice` (src/types/fhir.ts), each mapped to the
 * one resourceType localDataSource routes into it. Keep in step with
 * `LocalDataSource.saveArtifact`'s switch.
 */
const FHIR_BUCKETS = {
  observations: 'Observation',
  carePlans: 'CarePlan',
  communications: 'Communication',
  episodes: 'EpisodeOfCare',
  flags: 'Flag',
  tasks: 'Task',
  documentReferences: 'DocumentReference',
  serviceRequests: 'ServiceRequest',
  appointments: 'Appointment',
  consents: 'Consent',
  procedures: 'Procedure',
  // Real FHIR Encounters — the #263 correlation hinge. NOT the walkthrough
  // narration, which moved to the `walkthrough` bucket for exactly this reason.
  encounters: 'Encounter',
}

/** Buckets that are not FHIR at all, handled separately below. */
const NON_FHIR_BUCKETS = new Set([
  'responses', // StoredResponse wrappers — check-scenario-responses.mjs owns these
  'riskAlerts', // the app's RiskAlert type
  'walkthrough', // ScenarioEncounter narration; real Encounters are a FHIR bucket above
])

// ─────────────────────────────────────────────────────────────
// FHIR R4 base facts
// ─────────────────────────────────────────────────────────────
// Hand-maintained, because the base R4 StructureDefinitions are not vendored
// into this repo. These are spec constants, not SPiER choices, so they do not
// drift — but the table can be INCOMPLETE, and an omission here means less
// offline coverage rather than a silent overall pass: validate-fhir.mjs checks
// the real cardinalities against the published base definitions.

/** Elements with min=1 in base R4, for the types a scenario can carry. */
const BASE_REQUIRED = {
  Observation: ['status', 'code'],
  CarePlan: ['status', 'intent', 'subject'],
  Communication: ['status'],
  EpisodeOfCare: ['status', 'patient'],
  Flag: ['status', 'code', 'subject'],
  Task: ['status', 'intent'],
  DocumentReference: ['status', 'content'],
  ServiceRequest: ['status', 'intent', 'subject'],
  Appointment: ['status', 'participant'],
  Consent: ['status', 'scope', 'category'],
  Procedure: ['status', 'subject'],
  Encounter: ['status', 'class'],
}

/** The required-bound `status` ValueSet for each type. */
const STATUS_CODES = {
  Observation: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'],
  CarePlan: ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'],
  Communication: ['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown'],
  EpisodeOfCare: ['planned', 'waitlist', 'active', 'onhold', 'finished', 'cancelled', 'entered-in-error'],
  Flag: ['active', 'inactive', 'entered-in-error'],
  Task: ['draft', 'requested', 'received', 'accepted', 'rejected', 'ready', 'cancelled', 'in-progress', 'on-hold', 'failed', 'completed', 'entered-in-error'],
  DocumentReference: ['current', 'superseded', 'entered-in-error'],
  ServiceRequest: ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'],
  Appointment: ['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist'],
  Consent: ['draft', 'proposed', 'active', 'rejected', 'inactive', 'entered-in-error'],
  Procedure: ['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown'],
  Encounter: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'],
}

/** `ServiceRequest.intent`, `Task.intent`, `CarePlan.intent` — all required-bound. */
const INTENT_CODES = {
  ServiceRequest: ['proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'],
  Task: ['unknown', 'proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'],
  CarePlan: ['proposal', 'plan', 'order', 'option'],
}

const PARTICIPANT_STATUS_CODES = ['accepted', 'declined', 'tentative', 'needs-action']

/**
 * Where each type carries its patient link. `Appointment` is the odd one out —
 * the patient is a participant, not a dedicated element.
 */
const PATIENT_ELEMENT = {
  Observation: 'subject',
  CarePlan: 'subject',
  Communication: 'subject',
  EpisodeOfCare: 'patient',
  Flag: 'subject',
  Task: 'for',
  DocumentReference: 'subject',
  ServiceRequest: 'subject',
  Consent: 'patient',
  Procedure: 'subject',
  Encounter: 'subject',
}

/**
 * Element names whose string value is a FHIR date / dateTime / instant in every
 * type above. Checked wherever they appear in the resource tree, which reaches
 * `Period.start` / `Period.end` and `Appointment.start` alike.
 */
const DATE_KEYS = new Set([
  'date', 'dateTime', 'sent', 'received', 'authoredOn', 'created', 'issued',
  'lastModified', 'effectiveDateTime', 'occurrenceDateTime', 'performedDateTime',
  'start', 'end',
])

// FHIR R4 date | dateTime, per the published regexes (union, loosened only in
// that a bare date is accepted wherever a dateTime is).
const FHIR_DATE_RE =
  /^([0-9]{4})(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?$/

/**
 * External canonicals a scenario resource is allowed to claim even though no
 * StructureDefinition for them is loaded here. Keep this EMPTY unless there is
 * a reason: an entry is a hole in check 5.
 */
const EXTERNAL_PROFILE_ALLOWLIST = new Set([])

// ─────────────────────────────────────────────────────────────
// Load the generated conformance resources
// ─────────────────────────────────────────────────────────────

let generatedFiles
try {
  generatedFiles = readdirSync(fhirDir)
} catch {
  console.error(`[check:scenario-resources] ${fhirDir} not found — run \`npm run copy-fhir\` first.`)
  process.exit(1)
}

/** canonical url → StructureDefinition */
const structureDefs = new Map()
/** canonical url → CodeSystem */
const codeSystems = new Map()
/** canonical url → ValueSet */
const valueSets = new Map()

for (const name of generatedFiles) {
  if (!name.endsWith('.json')) continue
  let doc
  try {
    doc = JSON.parse(readFileSync(join(fhirDir, name), 'utf8'))
  } catch {
    continue
  }
  if (typeof doc?.url !== 'string') continue
  if (doc.resourceType === 'StructureDefinition') structureDefs.set(doc.url, doc)
  else if (doc.resourceType === 'CodeSystem') codeSystems.set(doc.url, doc)
  else if (doc.resourceType === 'ValueSet') valueSets.set(doc.url, doc)
}

if (structureDefs.size === 0) {
  console.error(
    '[check:scenario-resources] no StructureDefinitions found in web/src/data/fhir/ — ' +
      'run `npm run copy-fhir -- --force`. Without them checks 5–7 would pass vacuously.',
  )
  process.exit(1)
}

/** Every code in a CodeSystem, including nested concepts. */
function codeSystemCodes(cs, into = new Set(), concepts = cs?.concept) {
  for (const c of concepts ?? []) {
    if (c.code) into.add(c.code)
    if (c.concept) codeSystemCodes(cs, into, c.concept)
  }
  return into
}

/**
 * Expand a ValueSet to `system|code` pairs. Returns `null` when any include
 * draws on a system this repo does not publish (LOINC, SNOMED) — membership is
 * then unknowable offline, and claiming otherwise would be the silent pass this
 * whole gate exists to avoid.
 */
const expansionCache = new Map()
function expandValueSet(url) {
  if (expansionCache.has(url)) return expansionCache.get(url)
  const vs = valueSets.get(url)
  let result = null
  if (vs && !vs.compose?.exclude) {
    const members = new Set()
    let complete = (vs.compose?.include ?? []).length > 0
    for (const inc of vs.compose?.include ?? []) {
      if (inc.valueSet || !inc.system) {
        complete = false
        break
      }
      if (inc.concept) {
        for (const c of inc.concept) members.add(`${inc.system}|${c.code}`)
        continue
      }
      const cs = codeSystems.get(inc.system)
      if (!cs) {
        complete = false // e.g. LOINC / SNOMED — not published here
        break
      }
      for (const code of codeSystemCodes(cs)) members.add(`${inc.system}|${code}`)
    }
    if (complete) result = members
  }
  expansionCache.set(url, result)
  return result
}

// ─────────────────────────────────────────────────────────────
// Path helpers
// ─────────────────────────────────────────────────────────────

/** Resolve a dotted FHIR path, flattening arrays. Returns the values found. */
function valuesAt(node, path) {
  let current = Array.isArray(node) ? node : [node]
  for (const segment of path.split('.')) {
    const next = []
    for (const item of current) {
      if (item === null || item === undefined || typeof item !== 'object') continue
      const value = item[segment]
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) next.push(...value)
      else next.push(value)
    }
    current = next
  }
  return current
}

/**
 * Does `path` have a value? Handles a `[x]` choice tail by accepting any
 * `<base><Type>` key (`performed[x]` → `performedDateTime` | `performedPeriod`).
 */
function hasElement(resource, path) {
  if (!path.endsWith('[x]')) return valuesAt(resource, path).length > 0
  const dot = path.lastIndexOf('.')
  const parentPath = dot === -1 ? null : path.slice(0, dot)
  const base = path.slice(dot + 1, path.length - 3)
  const parents = parentPath ? valuesAt(resource, parentPath) : [resource]
  return parents.some(
    (p) =>
      p &&
      typeof p === 'object' &&
      Object.keys(p).some((k) => k.startsWith(base) && k.length > base.length && /^[A-Z]/.test(k[base.length])),
  )
}

/** The value(s) of a possibly-choice path. */
function choiceValues(resource, path) {
  if (!path.endsWith('[x]')) return valuesAt(resource, path)
  const dot = path.lastIndexOf('.')
  const parentPath = dot === -1 ? null : path.slice(0, dot)
  const base = path.slice(dot + 1, path.length - 3)
  const parents = parentPath ? valuesAt(resource, parentPath) : [resource]
  const out = []
  for (const p of parents) {
    if (!p || typeof p !== 'object') continue
    for (const [k, v] of Object.entries(p)) {
      if (k.startsWith(base) && k.length > base.length && /^[A-Z]/.test(k[base.length])) out.push(v)
    }
  }
  return out
}

/** Every Coding inside a CodeableConcept | Coding | code value. */
function codingsOf(value) {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return [{ code: value }]
  if (Array.isArray(value)) return value.flatMap(codingsOf)
  if (typeof value !== 'object') return []
  if (Array.isArray(value.coding)) return value.coding
  if ('code' in value || 'system' in value) return [value]
  return []
}

// ─────────────────────────────────────────────────────────────
// Profile-derived checks
// ─────────────────────────────────────────────────────────────

/**
 * Apply the constraints a StructureDefinition's DIFFERENTIAL actually states.
 * Deliberately partial (see the header): min-cardinality, fixed/pattern values,
 * and required bindings to locally-expandable ValueSets. Sliced elements
 * (`id` containing `:`) are skipped — resolving a slice needs a discriminator
 * evaluator, which is validate-fhir.mjs's job.
 */
function checkAgainstProfile(resource, sd, where) {
  const typePrefix = `${sd.type}.`
  for (const el of sd.differential?.element ?? []) {
    const id = el.id ?? el.path
    if (typeof id !== 'string' || !id.startsWith(typePrefix)) continue
    if (id.includes(':')) continue // slice — out of scope, see above
    const path = id.slice(typePrefix.length)

    if ((el.min ?? 0) >= 1 && !hasElement(resource, path)) {
      fail(`${where}: ${sd.type}.${path} is required by ${sd.url} but is absent`)
      continue
    }

    const values = choiceValues(resource, path)

    // Fixed / pattern values. SUSHI writes `fixedCode` for `= #x (exactly)` and
    // `patternCodeableConcept` / `patternCoding` for a pattern assignment.
    for (const [key, expected] of Object.entries(el)) {
      if (!key.startsWith('fixed') && !key.startsWith('pattern')) continue
      if (values.length === 0) {
        fail(`${where}: ${sd.type}.${path} is fixed by ${sd.url} but is absent`)
        continue
      }
      if (typeof expected === 'string') {
        if (!values.some((v) => v === expected)) {
          fail(
            `${where}: ${sd.type}.${path} must be "${expected}" per ${sd.url}, found ` +
              JSON.stringify(values.length === 1 ? values[0] : values),
          )
        }
        continue
      }
      const wanted = codingsOf(expected)
      if (wanted.length === 0) continue
      const found = values.flatMap(codingsOf)
      for (const w of wanted) {
        if (!found.some((f) => f.system === w.system && f.code === w.code)) {
          fail(`${where}: ${sd.type}.${path} must include ${w.system}#${w.code} per ${sd.url}`)
        }
      }
    }

    // Required bindings, where the ValueSet is expandable from local content.
    if (el.binding?.strength === 'required' && typeof el.binding.valueSet === 'string' && values.length) {
      const members = expandValueSet(el.binding.valueSet.split('|')[0])
      if (members) {
        for (const coding of values.flatMap(codingsOf)) {
          if (!coding?.code) continue
          const key = `${coding.system ?? ''}|${coding.code}`
          if (!members.has(key)) {
            fail(
              `${where}: ${sd.type}.${path} — ${coding.system ?? '(no system)'}#${coding.code} is not ` +
                `in the required binding ${el.binding.valueSet}`,
            )
          }
        }
      }
    }
  }
}

/** A required binding on one element of an extension's differential. */
function requiredBinding(sd, elementId) {
  const el = (sd.differential?.element ?? []).find((e) => (e.id ?? e.path) === elementId)
  return el?.binding?.strength === 'required' ? el.binding : undefined
}

function checkBoundValue(ext, binding, label) {
  const members = expandValueSet(String(binding.valueSet).split('|')[0])
  if (!members) return
  const values = choiceValues(ext, 'value[x]')
  if (values.length === 0) {
    fail(`${label} carries no value[x]`)
    return
  }
  for (const coding of values.flatMap(codingsOf)) {
    if (!coding?.code) continue
    if (!members.has(`${coding.system ?? ''}|${coding.code}`)) {
      fail(
        `${label} — ${coding.system ?? '(no system)'}#${coding.code} is not in the required ` +
          `binding ${binding.valueSet}`,
      )
    }
  }
}

/**
 * One extension against its own StructureDefinition: the required binding on a
 * simple extension's value, or — for a COMPLEX extension — each sub-extension
 * slice's own cardinality and binding.
 *
 * The complex half exists for `handoff-withheld-item`, whose whole point is
 * that the withheld content code and the basis travel together. Nothing else
 * offline looks inside a complex extension, so a packet claiming a withheld
 * item with no basis (or a basis outside the vocabulary) would otherwise pass
 * here and wait for the Java validator to notice.
 */
function checkExtensionAgainst(sd, ext, where) {
  const elements = sd.differential?.element ?? []
  const simple = requiredBinding(sd, 'Extension.value[x]')
  if (simple) {
    checkBoundValue(ext, simple, `${where}: extension ${ext.url}`)
    return
  }
  for (const slice of elements.filter((e) => /^Extension\.extension:[^.]+$/.test(e.id ?? ''))) {
    const name = String(slice.id).split(':')[1]
    // The sub-extension's url is its slice name unless the SD fixes another.
    const urlEl = elements.find((e) => (e.id ?? '') === `Extension.extension:${name}.url`)
    const url = urlEl?.fixedUri ?? name
    const children = (ext.extension ?? []).filter((s) => s?.url === url)
    if ((slice.min ?? 0) > children.length) {
      fail(
        `${where}: extension ${ext.url} — sub-extension "${url}" is required (min ${slice.min}) ` +
          `but ${children.length} present`,
      )
      continue
    }
    const binding = requiredBinding(sd, `Extension.extension:${name}.value[x]`)
    if (!binding) continue
    for (const child of children) {
      checkBoundValue(child, binding, `${where}: extension ${ext.url} → ${url}`)
    }
  }
}

/** Required bindings on SPiER extensions, resolved through their own SD. */
function checkExtensions(node, where, seen = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) checkExtensions(item, where, seen)
    return
  }
  if (!node || typeof node !== 'object') return
  for (const ext of node.extension ?? []) {
    if (typeof ext?.url !== 'string') continue
    const sd = structureDefs.get(ext.url)
    if (!sd || sd.type !== 'Extension') continue
    if (seen.has(ext)) continue
    seen.add(ext)
    checkExtensionAgainst(sd, ext, where)
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') checkExtensions(value, where, seen)
  }
}

// ─────────────────────────────────────────────────────────────
// Per-resource checks
// ─────────────────────────────────────────────────────────────

function checkDates(node, where, path = '') {
  if (Array.isArray(node)) {
    node.forEach((item, i) => checkDates(item, where, `${path}[${i}]`))
    return
  }
  if (!node || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    const at = path ? `${path}.${key}` : key
    if (DATE_KEYS.has(key) && typeof value === 'string') {
      if (!FHIR_DATE_RE.test(value) || (value.includes('T') && !Number.isFinite(Date.parse(value)))) {
        fail(`${where}: ${at} = "${value}" is not a valid FHIR date/dateTime`)
      }
    }
    if (value && typeof value === 'object') checkDates(value, where, at)
  }
}

function checkResource(resource, expectedType, patientId, where) {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    fail(`${where}: not a FHIR resource object`)
    return
  }
  if (resource.resourceType !== expectedType) {
    fail(`${where}: resourceType "${resource.resourceType}" — this bucket holds ${expectedType}`)
    return
  }
  if (typeof resource.id !== 'string' || resource.id.length === 0) {
    fail(`${where}: no id (localDataSource upserts by id; an id-less scenario resource can never be updated)`)
  }

  // 4 — base required elements + status/intent membership
  for (const path of BASE_REQUIRED[expectedType] ?? []) {
    if (!hasElement(resource, path)) {
      fail(`${where}: ${expectedType}.${path} is required by base FHIR R4 but is absent`)
    }
  }
  const statuses = STATUS_CODES[expectedType]
  if (statuses && typeof resource.status === 'string' && !statuses.includes(resource.status)) {
    fail(`${where}: status "${resource.status}" is not a valid ${expectedType}.status code`)
  }
  const intents = INTENT_CODES[expectedType]
  if (intents && typeof resource.intent === 'string' && !intents.includes(resource.intent)) {
    fail(`${where}: intent "${resource.intent}" is not a valid ${expectedType}.intent code`)
  }
  if (expectedType === 'Appointment') {
    for (const [i, p] of (resource.participant ?? []).entries()) {
      if (typeof p?.status !== 'string') {
        fail(`${where}: participant[${i}] has no status (required 1..1 in base R4)`)
      } else if (!PARTICIPANT_STATUS_CODES.includes(p.status)) {
        fail(`${where}: participant[${i}].status "${p.status}" is not a participation-status code`)
      }
    }
  }

  // 3 — the patient link points at THIS scenario's patient
  const wanted = `Patient/${patientId}`
  const element = PATIENT_ELEMENT[expectedType]
  if (element) {
    const refs = valuesAt(resource, `${element}.reference`).filter((r) => typeof r === 'string')
    if (refs.length && !refs.includes(wanted)) {
      fail(`${where}: ${expectedType}.${element} references ${refs.join(', ')}, not ${wanted}`)
    }
  } else if (expectedType === 'Appointment') {
    const refs = valuesAt(resource, 'participant.actor.reference').filter((r) => typeof r === 'string')
    if (refs.length && !refs.includes(wanted)) {
      fail(`${where}: Appointment has no participant.actor referencing ${wanted} (found ${refs.join(', ') || 'none'})`)
    }
  }

  // 5/6 — profile claims must resolve, then constrain
  for (const url of resource.meta?.profile ?? []) {
    const bare = String(url).split('|')[0]
    const sd = structureDefs.get(bare)
    if (!sd) {
      if (EXTERNAL_PROFILE_ALLOWLIST.has(bare)) continue
      fail(
        `${where}: meta.profile "${bare}" does not resolve to any known StructureDefinition — ` +
          'nothing would validate this resource against it [treated as a failure, not a pass]',
      )
      continue
    }
    if (sd.type !== expectedType) {
      fail(`${where}: meta.profile "${bare}" profiles ${sd.type}, not ${expectedType}`)
      continue
    }
    checkAgainstProfile(resource, sd, where)
  }

  // 7 + 8
  checkExtensions(resource, where)
  checkDates(resource, where)
}

// ─────────────────────────────────────────────────────────────
// The two non-FHIR buckets
// ─────────────────────────────────────────────────────────────

/**
 * `RiskAlert['level']` parsed out of the mapper source rather than copied, so
 * adding a tier there cannot leave this check rejecting valid data. (The same
 * trick check-measures.mjs uses on the CRITERIA map.)
 */
const RISK_LEVELS = (() => {
  const src = readFileSync(join(webRoot, 'src/lib/observationMappers/shared.ts'), 'utf8')
  const block = src.match(/export interface RiskAlert \{[\s\S]*?\n\}/)?.[0]
  const union = block?.match(/^\s*level:\s*(.+)$/m)?.[1]
  const levels = [...(union ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (levels.length === 0) {
    console.error(
      '[check:scenario-resources] could not parse RiskAlert["level"] out of ' +
        'src/lib/observationMappers/shared.ts. If it was renamed or retyped, update this ' +
        'script — do not delete the check.',
    )
    process.exit(1)
  }
  return new Set(levels)
})()

function checkRiskAlert(alert, where) {
  if (!alert || typeof alert !== 'object') return fail(`${where}: not an object`)
  for (const field of ['tool', 'level', 'summary', 'detail']) {
    if (typeof alert[field] !== 'string' || !alert[field]) {
      fail(`${where}: RiskAlert.${field} must be a non-empty string`)
    }
  }
  if (typeof alert.level === 'string' && !RISK_LEVELS.has(alert.level)) {
    fail(`${where}: RiskAlert.level "${alert.level}" is not one of ${[...RISK_LEVELS].join(' | ')}`)
  }
  if (alert.suggestedAction !== undefined) {
    const a = alert.suggestedAction
    if (!a || typeof a.label !== 'string' || typeof a.path !== 'string') {
      fail(`${where}: RiskAlert.suggestedAction needs both a label and a path`)
    } else if (!a.path.startsWith('/')) {
      fail(`${where}: RiskAlert.suggestedAction.path "${a.path}" is not an app route`)
    }
  }
}

function checkEncounter(step, where, artifactIds) {
  if (!step || typeof step !== 'object') return fail(`${where}: not an object`)
  for (const field of ['id', 'date', 'title', 'notes']) {
    if (typeof step[field] !== 'string' || !step[field]) {
      fail(`${where}: ScenarioEncounter.${field} must be a non-empty string`)
    }
  }
  if (typeof step.date === 'string' && !FHIR_DATE_RE.test(step.date)) {
    fail(`${where}: ScenarioEncounter.date "${step.date}" is not a valid date`)
  }
  if (step.status !== 'completed' && step.status !== 'scheduled') {
    fail(`${where}: ScenarioEncounter.status "${step.status}" must be completed | scheduled`)
  }

  // `relatedRefs` replaced two string-matching fields in #263 phase 5b — a
  // QuestionnaireResponse matched by display NAME and a CarePlan by id
  // SUBSTRING. Renaming either silently broke the link with nothing going red,
  // which is the whole reason those fields are gone. A reference is only better
  // if it is checked, so: every ref must resolve to an artifact in this same
  // scenario, and the retired fields must not come back.
  for (const legacy of ['relatedResponseNames', 'relatedCarePlanIdSubstrings']) {
    if (legacy in step) {
      fail(
        `${where}: ScenarioEncounter.${legacy} was retired in #263 phase 5b — ` +
          `use relatedRefs with FHIR references (Type/id) instead`,
      )
    }
  }
  if (step.relatedRefs !== undefined) {
    if (!Array.isArray(step.relatedRefs)) {
      fail(`${where}: ScenarioEncounter.relatedRefs must be an array of "Type/id" strings`)
    } else {
      for (const ref of step.relatedRefs) {
        if (typeof ref !== 'string' || !/^[A-Za-z]+\/[\w-]+$/.test(ref)) {
          fail(`${where}: relatedRefs entry ${JSON.stringify(ref)} is not a "Type/id" reference`)
          continue
        }
        if (!artifactIds.has(ref)) {
          fail(
            `${where}: relatedRefs "${ref}" does not resolve to an artifact in this scenario — ` +
              `the step claims it produced that artifact, so it has to be here`,
          )
        } else {
          walkthroughRefs.resolved++
        }
      }
    }
  }
}

/** Counter so the summary states how many walkthrough links are live. */
const walkthroughRefs = { resolved: 0 }

/** Every `Type/id` a walkthrough step could legitimately reference. */
function artifactIdsOf(scenario) {
  const ids = new Set()
  for (const [bucket, value] of Object.entries(scenario)) {
    if (!Array.isArray(value)) continue
    if (bucket === 'riskAlerts' || bucket === 'walkthrough') continue
    if (bucket === 'responses') {
      for (const sr of value) {
        const qr = sr?.resource
        if (qr?.resourceType && qr?.id) ids.add(`${qr.resourceType}/${qr.id}`)
      }
      continue
    }
    for (const r of value) {
      if (r?.resourceType && r?.id) ids.add(`${r.resourceType}/${r.id}`)
    }
  }
  return ids
}

// ─────────────────────────────────────────────────────────────
// Walk the scenarios
// ─────────────────────────────────────────────────────────────

const scenarioFiles = readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).sort()
if (scenarioFiles.length === 0) {
  console.error(`[check:scenario-resources] no scenarios found in ${scenariosDir}`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────
// Episode correlation (#263, phase 2)
// ─────────────────────────────────────────────────────────────
//
// Phase 1 added the Encounters; phase 2 pointed every artifact at one. Nothing
// verified either, and both this gate and validate-fhir.mjs passed identically
// before and after the links were added — `.encounter` is optional in base R4,
// so a dropped reference is invisible to conformance checking. That is precisely
// the shape of an unguarded claim: the plan asserts a queryable record, and only
// this check makes that true.
//
// Deliberately counts its exclusions out loud rather than shrinking the
// denominator (the #232 lesson): a type that legitimately cannot be linked is
// named here, and a type that stops being linkable has to be added on purpose.

/** Types with no route to an EpisodeOfCare in R4. Each needs a written reason. */
const CORRELATION_EXEMPT = {
  // Consent has no `.encounter` and no usable basedOn/partOf. Arguably right:
  // a consent to share information scopes to the patient and the receiving
  // organisation, and outlives any single episode. Revisit under #263.
  Consent: 'no .encounter and no indirect route in R4',
}

/** Types linked in reverse, by Encounter naming them. */
const CORRELATION_REVERSE = {
  // Appointment has no `.encounter`; Encounter.appointment is a native
  // Reference(Appointment), which is how it joins the chain.
  Appointment: 'Encounter.appointment',
}

const correlation = { linked: 0, reverse: 0, exempt: 0, triggers: 0, exemptTypes: new Set() }

/** `.encounter` lives under `context` on DocumentReference and nowhere else. */
function encounterRefsOf(resource) {
  if (resource.resourceType === 'DocumentReference') {
    return (resource.context?.encounter ?? []).map((e) => e?.reference).filter(Boolean)
  }
  const ref = resource.encounter?.reference
  return ref ? [ref] : []
}

function checkEpisodeCorrelation(scenario, file) {
  const encounters = Array.isArray(scenario.encounters) ? scenario.encounters : []
  if (encounters.length === 0) return // scenarios with no episode have nothing to correlate

  const encounterIds = new Set(encounters.map((e) => e?.id).filter(Boolean))
  const episodeIds = new Set((scenario.episodes ?? []).map((e) => e?.id).filter(Boolean))

  // Every Encounter must name an episode that exists in THIS scenario. The
  // profile requires episodeOfCare to be present; this adds that it resolves.
  for (const [i, enc] of encounters.entries()) {
    for (const ref of enc?.episodeOfCare ?? []) {
      const id = String(ref?.reference ?? '').replace(/^EpisodeOfCare\//, '')
      if (!episodeIds.has(id)) {
        fail(
          `scenarios/${file} encounters[${i}] (${enc?.id}): episodeOfCare "${ref?.reference}" ` +
            `does not resolve to an EpisodeOfCare in this scenario ` +
            `(have: ${[...episodeIds].join(', ') || 'none'})`,
        )
      }
    }
  }

  // Decision 1 (#263): an episode names the artifact that opened it. The profile
  // invariant makes the extension REQUIRED when entry reason is positive-screen —
  // but a FHIRPath `exists()` cannot check that the reference resolves, and the
  // validator runs without the scenario as a bundle, so a trigger pointing at a
  // deleted or misspelled id would satisfy the invariant and mean nothing.
  const artifactIds = new Set()
  for (const [bucket, value] of Object.entries(scenario)) {
    if (!Array.isArray(value)) continue
    if (bucket === 'riskAlerts' || bucket === 'walkthrough') continue
    if (bucket === 'responses') {
      value.forEach((sr) => {
        const qr = sr?.resource
        if (qr?.resourceType && qr?.id) artifactIds.add(`${qr.resourceType}/${qr.id}`)
      })
      continue
    }
    value.forEach((r) => {
      if (r?.resourceType && r?.id) artifactIds.add(`${r.resourceType}/${r.id}`)
    })
  }
  for (const [i, ep] of (scenario.episodes ?? []).entries()) {
    for (const ext of ep?.extension ?? []) {
      if (!String(ext?.url ?? '').endsWith('/episode-trigger')) continue
      const ref = ext?.valueReference?.reference
      if (!artifactIds.has(ref)) {
        fail(
          `scenarios/${file} episodes[${i}] (${ep?.id}): episode-trigger "${ref}" does not ` +
            `resolve to an artifact in this scenario — the episode claims an artifact evidenced ` +
            `its opening, so that artifact has to be here (#263, Decision 1)`,
        )
      } else {
        correlation.triggers++
      }
    }
  }

  // Anything named by Encounter.appointment, for the reverse-linked types.
  const reverseNamed = new Set()
  for (const enc of encounters) {
    for (const ref of enc?.appointment ?? []) {
      if (typeof ref?.reference === 'string') reverseNamed.add(ref.reference)
    }
  }

  const artifacts = []
  for (const [bucket, value] of Object.entries(scenario)) {
    if (!Array.isArray(value)) continue
    if (bucket === 'riskAlerts' || bucket === 'walkthrough') continue
    if (bucket === 'episodes' || bucket === 'encounters') continue
    if (bucket === 'responses') {
      value.forEach((sr, i) => {
        if (sr?.resource?.resourceType) artifacts.push([`responses[${i}].resource`, sr.resource])
      })
      continue
    }
    value.forEach((r, i) => {
      if (r?.resourceType) artifacts.push([`${bucket}[${i}]`, r])
    })
  }

  for (const [path, r] of artifacts) {
    const where = `scenarios/${file} ${path} (${r.id ?? 'no id'})`
    const rt = r.resourceType

    if (rt in CORRELATION_EXEMPT) {
      correlation.exempt++
      correlation.exemptTypes.add(rt)
      continue
    }

    if (rt in CORRELATION_REVERSE) {
      if (!reverseNamed.has(`${rt}/${r.id}`)) {
        fail(
          `${where}: ${rt} has no .encounter in R4, so it must be named by ` +
            `${CORRELATION_REVERSE[rt]} — no Encounter in this scenario references ${rt}/${r.id}`,
        )
      } else {
        correlation.reverse++
      }
      continue
    }

    const refs = encounterRefsOf(r)
    if (refs.length === 0) {
      fail(
        `${where}: no Encounter reference — every artifact in a scenario with an episode must ` +
          `correlate to one (#263). ${rt === 'DocumentReference' ? 'Set context.encounter' : 'Set .encounter'}, ` +
          `or add ${rt} to CORRELATION_EXEMPT with a reason.`,
      )
      continue
    }
    for (const ref of refs) {
      const id = String(ref).replace(/^Encounter\//, '')
      if (!encounterIds.has(id)) {
        fail(
          `${where}: encounter reference "${ref}" does not resolve to an Encounter in this ` +
            `scenario (have: ${[...encounterIds].join(', ')})`,
        )
      } else {
        correlation.linked++
      }
    }
  }
}

let resourcesChecked = 0

for (const file of scenarioFiles) {
  const patientId = file.replace(/\.json$/, '')
  let scenario
  try {
    scenario = JSON.parse(readFileSync(join(scenariosDir, file), 'utf8'))
  } catch (err) {
    fail(`scenarios/${file}: not parseable JSON — ${err.message}`)
    continue
  }

  const ids = new Map()
  let n = 0

  for (const [bucket, value] of Object.entries(scenario)) {
    // 1 — an unknown bucket is read by nothing and would vanish silently.
    if (!(bucket in FHIR_BUCKETS) && !NON_FHIR_BUCKETS.has(bucket)) {
      fail(
        `scenarios/${file}: unknown bucket "${bucket}" — nothing reads it. ` +
          `Known: ${[...Object.keys(FHIR_BUCKETS), ...NON_FHIR_BUCKETS].sort().join(', ')}`,
      )
      continue
    }
    if (!Array.isArray(value)) {
      fail(`scenarios/${file}: "${bucket}" must be an array`)
      continue
    }
    if (bucket === 'responses') continue // sibling script owns these

    if (bucket === 'riskAlerts') {
      value.forEach((a, i) => checkRiskAlert(a, `scenarios/${file} riskAlerts[${i}]`))
      continue
    }
    if (bucket === 'walkthrough') {
      const artifactIds = artifactIdsOf(scenario)
      value.forEach((e, i) =>
        checkEncounter(e, `scenarios/${file} walkthrough[${i}]`, artifactIds),
      )
      continue
    }

    const expectedType = FHIR_BUCKETS[bucket]
    value.forEach((resource, i) => {
      const where = `scenarios/${file} ${bucket}[${i}] (${resource?.id ?? 'no id'})`
      n++
      resourcesChecked++
      checkResource(resource, expectedType, patientId, where)
      if (typeof resource?.id === 'string') {
        // Stricter than FHIR, deliberately: FHIR scopes ids per resource type,
        // but these ids are hand-authored and patient-prefixed, so the same id
        // on two resources in one scenario is a copy-paste, and `context.related`
        // references read as ambiguous to a human even where `Type/id` resolves.
        const prior = ids.get(resource.id)
        if (prior) fail(`scenarios/${file}: id "${resource.id}" is used by both ${prior} and ${bucket}[${i}]`)
        else ids.set(resource.id, `${bucket}[${i}]`)
      }
    })
  }

  if (n > 0) console.log(`✓ scenarios/${file}: ${n} FHIR resource(s) checked`)

  checkEpisodeCorrelation(scenario, file)
}

console.log(
  `\n${resourcesChecked} non-QuestionnaireResponse scenario resource(s) checked against ` +
    `${structureDefs.size} StructureDefinition(s).`,
)
console.log(
  `episode correlation: ${correlation.linked} artifact(s) linked to an Encounter, ` +
    `${correlation.reverse} via Encounter.appointment, ${correlation.exempt} exempt ` +
    `(${[...correlation.exemptTypes].sort().join(', ') || 'none'}); ` +
    `${correlation.triggers} episode trigger(s) resolve; ` +
    `${walkthroughRefs.resolved} walkthrough ref(s) resolve.`,
)

if (failures) {
  console.error(`\nscenario-resource check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('scenario-resource check passed.')
