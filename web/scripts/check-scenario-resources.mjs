#!/usr/bin/env node
/**
 * Anti-drift check for the demo registry's hand-authored NON-QuestionnaireResponse
 * resources — the other half of `npm run check:scenarios`.
 *
 * `check-scenario-responses.mjs` validates the `responses` bucket only (its own
 * header says so). `scripts/validate-fhir.mjs` historically did not read
 * `packages/demo-population/` at all. So every Observation, CarePlan,
 * Communication, EpisodeOfCare, Appointment, ServiceRequest, Procedure and
 * DocumentReference in `scenarios/patient-*.json` was ungated hand-authored
 * FHIR (issue #226).
 *
 * That matters because the Stage-8 measure engine (`packages/core/src/lib/measures.ts`) reads
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
 * ValueSets and CodeSystems out of packages/fhir-artifacts/generated/).
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import {
  assertUsableIndex,
  buildConformanceIndex,
  // The walkthrough narration (`ScenarioEncounter.date`) is not FHIR, but its
  // dates are FHIR dates — one definition of "is this a FHIR date", not two.
  FHIR_DATE_RE,
  patientLinkProblems,
  validateResource,
} from '../../packages/core/fhir-resource-rules.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..') // repo root
const scenariosDir = join(root, 'packages/demo-population/src/scenarios')
const fhirDir = join(root, 'packages/fhir-artifacts/generated')
const patientsDir = join(root, 'packages/demo-population/src/patients')

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
// FHIR R4 base facts, profile-derived checks, and the per-resource rules
// ─────────────────────────────────────────────────────────────
// All of it now lives in packages/core/fhir-resource-rules.mjs, shared VERBATIM
// with the mock EHR's `POST /fhir/{Type}` — a guardrail of the embedded-panel
// plan §1, which requires the mock to reuse these checks "rather than inventing
// a second, laxer opinion". The tables that were here (base-R4 required
// elements, status/intent codes, patient elements, date keys) moved with them.
//
// What stays in this script is what is scenario-shaped rather than
// resource-shaped: bucket names, id uniqueness, cross-resource episode
// correlation, and the two non-FHIR buckets.

// ─────────────────────────────────────────────────────────────
// Load the generated conformance resources
// ─────────────────────────────────────────────────────────────
// The RULES that read these live in packages/core/fhir-resource-rules.mjs, shared
// verbatim with the mock EHR's write endpoint — see that file's header for why
// two opinions were never necessary. This script keeps only what is
// scenario-shaped: buckets, ids, cross-resource correlation, and the two
// non-FHIR buckets below.

let generatedFiles
try {
  generatedFiles = readdirSync(fhirDir)
} catch {
  console.error(`[check:scenario-resources] ${fhirDir} not found — run \`npm run copy-fhir\` first.`)
  process.exit(1)
}

// Conformance resources come from the IG's output; the 14 Patients come from
// packages/demo-population, because step E2 (#392) moved them out of the IG —
// nothing in the IG referenced them, and a fake EHR's roster should not need a
// SUSHI compile. Both feed ONE index: check 8 resolves the scenarios' `subject`
// references against its `patientIds`.
const readJson = (dir, name) => {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8'))
  } catch {
    return null
  }
}
let patientFiles
try {
  patientFiles = readdirSync(patientsDir).filter((n) => n.endsWith('.json'))
} catch {
  console.error(`[check:scenario-resources] ${patientsDir} not found — the 14 demo Patients live there since #392.`)
  process.exit(1)
}
const conformance = buildConformanceIndex(
  [
    ...generatedFiles.filter((name) => name.endsWith('.json')).map((n) => readJson(fhirDir, n)),
    ...patientFiles.map((n) => readJson(patientsDir, n)),
  ].filter(Boolean),
)

// ⚠️ Startup, not per-resource: an empty index makes every profile-derived rule
// report nothing, so the gate would pass vacuously rather than fail. Same reason
// the old inline loader exited here, and the message still names the fix.
try {
  assertUsableIndex(conformance, 'run `npm run copy-fhir -- --force`')
} catch (err) {
  console.error(`[check:scenario-resources] ${err.message}`)
  process.exit(1)
}

const { patientIds, structureDefs } = conformance

// ─────────────────────────────────────────────────────────────
// The two non-FHIR buckets
// ─────────────────────────────────────────────────────────────

/**
 * `RiskAlert['level']` parsed out of the mapper source rather than copied, so
 * adding a tier there cannot leave this check rejecting valid data. (The same
 * trick check-measures.mjs uses on the CRITERIA map.)
 */
const RISK_LEVELS = (() => {
  const src = readFileSync(join(root, 'packages/core/src/lib/observationMappers/shared.ts'), 'utf8')
  const block = src.match(/export interface RiskAlert \{[\s\S]*?\n\}/)?.[0]
  const union = block?.match(/^\s*level:\s*(.+)$/m)?.[1]
  const levels = [...(union ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (levels.length === 0) {
    console.error(
      '[check:scenario-resources] could not parse RiskAlert["level"] out of ' +
        'packages/core/src/lib/observationMappers/shared.ts. If it was renamed or retyped, update this ' +
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

  // ⚠️ RESTORED. This block landed in #298 (#263 phase 5b) and was removed by
  // #300, which rewrote this file from a pre-#298 base — so between those two
  // merges the scenarios' `relatedRefs` were unguarded and the retired fields
  // could have come back unnoticed. Re-added here; see PR #305.
  //
  // `relatedRefs` replaced two string-matching fields: a QuestionnaireResponse
  // matched by display NAME and a CarePlan by id SUBSTRING. Renaming either broke
  // the link with nothing going red, which is why they are gone. A reference is
  // only better than a substring if something checks it resolves.
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

/**
 * Appointment statuses for a visit that has NOT happened, and so cannot be named
 * by an Encounter yet.
 *
 * The correlation rule below assumed every seeded Appointment was a past one,
 * which was true until #297 added a genuinely upcoming visit. An Encounter for a
 * visit that has not occurred would fabricate a contact — `Encounter.appointment`
 * is populated when the encounter happens — so a future-status Appointment is
 * exempt rather than a violation. Enumerated rather than inverted so that a NEW
 * status has to be classified deliberately.
 */
const APPOINTMENT_NOT_YET_HELD = new Set([
  'proposed',
  'pending',
  'booked',
  'waitlist',
  'cancelled',
  'entered-in-error',
])

/** Types linked in reverse, by Encounter naming them. */
const CORRELATION_REVERSE = {
  // Appointment has no `.encounter`; Encounter.appointment is a native
  // Reference(Appointment), which is how it joins the chain.
  Appointment: 'Encounter.appointment',
}

const correlation = { linked: 0, reverse: 0, exempt: 0, triggers: 0, exemptTypes: new Set() }
let packetClaimsChecked = 0

/** `.encounter` lives under `context` on DocumentReference and nowhere else. */
function encounterRefsOf(resource) {
  if (resource.resourceType === 'DocumentReference') {
    return (resource.context?.encounter ?? []).map((e) => e?.reference).filter(Boolean)
  }
  const ref = resource.encounter?.reference
  return ref ? [ref] : []
}

/**
 * A discharge packet may not claim to carry a copy of a safety plan that has no
 * content (#303).
 *
 * `p007-discharge-packet` declared `handoff-content-item = safety-plan-copy`
 * while `context.related` named `CarePlan/p007-stanley-brown`, a CarePlan with
 * **zero `activity`** — the six Stanley-Brown sections ARE the plan, and SPiER
 * encodes them as activities. So the packet asserted it enclosed a copy of an
 * empty plan, and nothing could see it: the claim is an extension, the plan is a
 * separate resource, and no gate related the two.
 *
 * ⚠️ **Scoped to the CONTRADICTED case on purpose.** A packet that claims
 * `safety-plan-copy` and relates to no CarePlan at all is *unverifiable*, not
 * false — the copy may live in the attachment rather than as a linked resource,
 * which is a legitimate shape. `p009-discharge-packet` is exactly that, and it
 * is deliberately NOT failed here. Widening this rule to "must relate to a
 * CarePlan" would be inventing a requirement the profile does not state.
 */
function checkSafetyPlanCopyClaim(scenario, file) {
  const plans = new Map(
    (scenario.carePlans ?? [])
      .filter((c) => typeof c?.id === 'string')
      .map((c) => [c.id, Array.isArray(c.activity) ? c.activity.length : 0]),
  )

  for (const [i, dr] of (scenario.documentReferences ?? []).entries())  {
    const claims = (dr?.extension ?? []).some(
      (e) =>
        e?.url === 'http://spier.org/StructureDefinition/handoff-content-item' &&
        e?.valueCodeableConcept?.coding?.some((c) => c?.code === 'safety-plan-copy'),
    )
    if (!claims) continue
    packetClaimsChecked++

    for (const rel of dr?.context?.related ?? []) {
      const ref = rel?.reference
      if (typeof ref !== 'string' || !ref.startsWith('CarePlan/')) continue
      const id = ref.slice('CarePlan/'.length)
      if (!plans.has(id)) continue // dangling refs are check 3/8's business
      if (plans.get(id) === 0) {
        fail(
          `scenarios/${file} documentReferences[${i}] (${dr.id ?? 'no id'}): claims handoff content ` +
            `"safety-plan-copy" but the plan it points at (${ref}) has no activity — the six ` +
            `Stanley-Brown sections are the plan's content, so the packet claims to enclose an empty plan`,
        )
      }
    }
  }
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

    if (rt === 'Appointment' && APPOINTMENT_NOT_YET_HELD.has(r.status)) {
      correlation.exempt++
      correlation.exemptTypes.add(`Appointment(${r.status})`)
      continue
    }

    if (rt in CORRELATION_REVERSE) {
      // The naming Encounter must be the one the artifact actually happened at.
      // Without this, a reverse link is satisfied by ANY Encounter in the
      // scenario — which is how all five Appointments ended up on the wrong
      // contact (#263 phase 2 placed them by pathway-stage tag because its
      // date-key list omitted `Appointment.start`). The read side surfaced it as
      // an appointment under one contact and an empty contact where it belonged.
      const owner = encounters.find((e) =>
        (e?.appointment ?? []).some((a) => a?.reference === `${rt}/${r.id}`),
      )
      const start = typeof r.start === 'string' ? r.start : undefined
      if (owner && start) {
        const from = owner.period?.start
        const to = owner.period?.end ?? from
        if (from && !(from <= start && start <= to)) {
          fail(
            `${where}: named by Encounter/${owner.id}, whose period ` +
              `(${from} – ${to}) does not cover ${rt}.start ${start} — a reverse link has to ` +
              `point at the contact the artifact happened at, not merely at some contact`,
          )
        }
      }
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
let responseLinksChecked = 0

for (const file of scenarioFiles) {
  const patientId = file.replace(/\.json$/, '')

  // 8 — the scenario's subject actually EXISTS.
  //
  // Check 3 (in checkResource) asserts every resource references
  // `Patient/<this scenario's id>`. Together with this line that closes the
  // dangle: 116 references across 14 ids pointed at nothing at all until
  // the 14 Patient resources landed, and neither gate could see it —
  // a `subject` naming a nonexistent Patient is not a conformance error, so the
  // HL7 validator passed it too. Check 3 alone only proves the references agree
  // with each other.
  if (!patientIds.has(patientId)) {
    fail(
      `scenarios/${file}: no Patient resource with id "${patientId}" — every ` +
        `subject reference in this scenario dangles. Add an Instance to ` +
        `packages/demo-population/src/patients/.`,
    )
  }

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
    if (bucket === 'responses') {
      // #364: the sibling script validates each QR against its Questionnaire,
      // which says nothing about `subject`; this script walks the FHIR buckets,
      // and `responses` is not one of them (they are StoredResponse wrappers).
      // Between the two, `QuestionnaireResponse.subject` was owned by NEITHER —
      // and all 20 scenario QRs duly had none, so a patient-scoped search on a
      // real server returned nothing for every patient.
      //
      // So the bucket stays out of every other check here, for the reason above,
      // and is walked for exactly one: the patient link. Unwrap `entry.resource`.
      value.forEach((entry, i) => {
        const qr = entry?.resource
        if (!qr || typeof qr !== 'object') return // shape is the sibling script's business
        responseLinksChecked++
        const where = `scenarios/${file} responses[${i}] (${qr.id ?? 'no id'})`
        for (const problem of patientLinkProblems(qr, {
          expectedType: 'QuestionnaireResponse',
          patientId,
          where,
        })) fail(problem)

        // #369, the same gap in a second field: the WRAPPER carries
        // `completedAt` and the resource carried no `authored`, so a server
        // serving the resource alone dropped the date — the chart rendered
        // "Invalid Date Invalid Date" for every SMART-read QR. They describe one
        // event, so they must agree; asserting equality is what stops them
        // drifting once both exist.
        if (typeof qr.authored !== 'string' || !FHIR_DATE_RE.test(qr.authored)) {
          fail(`${where}: authored ${qr.authored === undefined ? 'is missing' : `"${qr.authored}" is not a FHIR dateTime`}`)
        } else if (typeof entry.completedAt === 'string' && qr.authored !== entry.completedAt) {
          fail(
            `${where}: authored "${qr.authored}" disagrees with the wrapper's ` +
              `completedAt "${entry.completedAt}" — they describe the same event`,
          )
        }
      })
      continue
    }

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
      for (const problem of validateResource(resource, {
        expectedType,
        patientId,
        where,
        index: conformance,
      })) fail(problem)
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
  checkSafetyPlanCopyClaim(scenario, file)
}

console.log(
  `\n${resourcesChecked} non-QuestionnaireResponse scenario resource(s) checked against ` +
    `${structureDefs.size} StructureDefinition(s).`,
)
// A silent zero here would mean the `responses` bucket had vanished or been
// renamed, and this check would report success having read nothing — the
// failure this repo keeps cataloguing (#232, #261, and the rest).
if (responseLinksChecked === 0) {
  fail(
    'no QuestionnaireResponse found in any scenario\'s `responses` bucket — the patient-link ' +
      'check read nothing [treated as a failure, not a pass]',
  )
}
console.log(`${responseLinksChecked} QuestionnaireResponse patient link(s) checked.`)
// Reading nothing here would mean no packet claims a safety-plan copy at all,
// which is a fixture change worth noticing rather than a silent pass.
if (packetClaimsChecked === 0) {
  fail(
    'no discharge packet claims `safety-plan-copy` — the safety-plan-copy check read nothing ' +
      '[treated as a failure, not a pass]',
  )
}
console.log(`${packetClaimsChecked} safety-plan-copy packet claim(s) checked.`)
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
