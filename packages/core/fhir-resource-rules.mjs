/**
 * fhir-resource-rules — the SINGLE opinion on whether one hand-authored or
 * newly-written FHIR resource is acceptable.
 *
 * ⚠️ **This exists because of a guardrail, not for tidiness.** The embedded-panel
 * plan reverses an earlier "do not write your own mock FHIR server" decision, and
 * the reversal is conditional (§1): *"the mock validates writes before accepting
 * them, reusing the profile checks in `check-scenario-resources.mjs` rather than
 * inventing a second, laxer opinion."* The objection it answers is that **a
 * lenient mock accepts writes a real EHR rejects, so the demo looks better while
 * proving less** — and the failure is invisible from inside the demo.
 *
 * Two callers, one rule set:
 *
 *   - `web/scripts/check-scenario-resources.mjs` — the offline gate over the
 *     hand-authored population scenarios (in `npm run verify`).
 *   - `services/mock-ehr/src/validate.ts` — the mock EHR's `POST /fhir/{Type}`,
 *     which refuses anything this module reports a problem with.
 *
 * A shared module rather than a port: `services/mock-ehr/README.md` used to say
 * the mock's validation would be *"a port of check-scenario-resources.mjs, not a
 * reuse of it (that script is Node reading StructureDefinitions off a
 * filesystem)"*. That was true of the script and not of the rules — the rules
 * only need the conformance resources as **data**, and a Worker can have them:
 * `import.meta.glob` inlines `packages/fhir-artifacts/generated/*.json` at build time exactly as
 * it already inlines the Patients. So the filesystem was the script's problem,
 * not the rule set's, and two opinions were never necessary.
 *
 * ── Deliberately partial, and that is documented where it matters ────────────
 *
 * These are the checks that can be made offline with the GENERATED
 * StructureDefinitions: base-R4 required elements (hand-listed, see below),
 * required-bound `status` / `intent` codes, patient linkage, `meta.profile`
 * canonicals resolving, each claimed profile's differential (min-cardinality,
 * fixed/pattern values, required bindings expandable from local content), SPiER
 * extension bindings including complex sub-slices, and date parsing.
 *
 * NOT here: base cardinalities beyond the table, invariants, extension context,
 * slicing, reference target types, and codes from external systems (LOINC /
 * SNOMED). `scripts/validate-fhir.mjs` covers those with the HL7 validator, and
 * the nightly covers external terminology. **This is not a reimplementation of
 * the validator and must not be described as one** — that sentence is inherited
 * verbatim from the script this came out of, and it still holds.
 *
 * ── Why a factory closure ───────────────────────────────────────────────────
 *
 * Every rule body below was moved out of `check-scenario-resources.mjs`
 * UNCHANGED, including its `fail(...)` calls and its free references to
 * `structureDefs` / `expandValueSet`. Wrapping them in a closure that supplies
 * those names is what made the move a move rather than a rewrite — the diff on
 * the rules themselves is empty, so this refactor cannot have quietly loosened
 * one. The single exception is labelled at the line it changes.
 */

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
export const FHIR_DATE_RE =
  /^([0-9]{4})(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01])(T([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?$/

/**
 * External canonicals a scenario resource is allowed to claim even though no
 * StructureDefinition for them is loaded here. Keep this EMPTY unless there is
 * a reason: an entry is a hole in check 5.
 */
const EXTERNAL_PROFILE_ALLOWLIST = new Set([])


/**
 * Index the generated conformance resources.
 *
 * `docs` is every parsed JSON document from `packages/fhir-artifacts/generated/` — the CLI reads
 * them off disk, the Worker gets them from `import.meta.glob`. Neither knows how
 * this index is shaped, which is the point.
 *
 * ⚠️ The `Patient` branch comes BEFORE the `url` guard, deliberately. A Patient
 * has no `url`, so folding it into the conformance-resource chain yields an empty
 * set — and a vacuous pass on the check that every scenario subject resolves.
 * Inherited verbatim from the script, including the reason.
 */
export function buildConformanceIndex(docs) {
  const index = {
    structureDefs: new Map(),
    codeSystems: new Map(),
    valueSets: new Map(),
    patientIds: new Set(),
    expansionCache: new Map(),
  }
  for (const doc of docs) {
    if (doc?.resourceType === 'Patient' && typeof doc.id === 'string') index.patientIds.add(doc.id)
    if (typeof doc?.url !== 'string') continue
    if (doc.resourceType === 'StructureDefinition') index.structureDefs.set(doc.url, doc)
    else if (doc.resourceType === 'CodeSystem') index.codeSystems.set(doc.url, doc)
    else if (doc.resourceType === 'ValueSet') index.valueSets.set(doc.url, doc)
  }
  return index
}

/**
 * Every problem with one resource, as human-readable strings. Empty means the
 * rules found nothing — NOT that the resource is fully conformant (see the
 * header's "deliberately partial").
 *
 * ⚠️ **An empty index makes this return nothing for anything.** Both callers must
 * refuse to run on one rather than reporting a clean pass — that is the #232 /
 * #261 silent-pass shape, and `assertUsableIndex` below is the shared way to say
 * so. It is not called from here, because "no conformance resources loaded" is a
 * startup failure for the caller, not a problem with the resource in hand.
 */
export function validateResource(resource, { expectedType, patientId, where = 'resource', index }) {
  const problems = []
  const fail = (msg) => problems.push(msg)
  const { structureDefs, codeSystems, valueSets } = index
  // Referenced by the moved bodies below; kept so their `void` markers are honest.
  void codeSystems

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
  const expansionCache = index.expansionCache
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
  checkResource(resource, expectedType, patientId, where)
  return problems
}

/**
 * Throw unless the index actually holds the conformance resources the rules need.
 *
 * Both callers need this and for the same reason: with an empty index every rule
 * that reads a StructureDefinition or expands a ValueSet finds nothing and
 * reports nothing, so `validateResource` returns `[]` for a resource it never
 * looked at. A gate that green-lights everything because its inputs are missing
 * is the failure this repo keeps cataloguing (#232, #261, and check 8 of the
 * scenario gate). `copy-fhir` not having run is the ordinary cause.
 */
export function assertUsableIndex(index, hint = 'run `npm run copy-fhir -- --force`') {
  if (index.structureDefs.size === 0) {
    throw new Error(
      `[fhir-resource-rules] no StructureDefinitions loaded — ${hint}. `
      + 'Without them every profile-derived check would pass vacuously.',
    )
  }
  if (index.patientIds.size === 0) {
    throw new Error(
      `[fhir-resource-rules] no Patient resources loaded — ${hint}. `
      + 'Without them subject references cannot be resolved.',
    )
  }
}

/** The resource types these rules know base-R4 facts for. */
export function knownResourceTypes() {
  return Object.keys(BASE_REQUIRED)
}
