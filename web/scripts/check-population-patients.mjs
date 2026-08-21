/**
 * check:patients — the 14 demo patients' demographics agree across all THREE
 * places they are written down.
 *
 * ── Why this gate exists ──────────────────────────────────────────────────
 *
 * `ig/input/fsh/population-patients.fsh` is canonical for the 14 patients, but
 * two other sites carry the same facts:
 *
 *   1. `packages/demo-population/src/patients.json` — display copies of name / dob /
 *      gender / mrn, read by the caseload table and the patient banner.
 *   2. `populationToFhir` in `web/src/context/PatientProvider.tsx` — builds a
 *      runtime `Patient` from patients.json, and hardcodes the MRN system.
 *
 * That is exactly the hand-duplication CLAUDE.md warns about, and the failure is
 * silent in the worst way: patients.json feeds what a human SEES, the FSH feeds
 * what a server would RECEIVE, and a drifted birthDate would show one age on the
 * caseload while writing another into an EHR. Nothing else compares them —
 * `check:scenarios` proves the subject *exists* (check 8), not that it agrees.
 *
 * Eliminating the duplication would mean rewiring the caseload and banner to read
 * generated FHIR, which is a bigger change than this is worth today. So this
 * follows the repo's established pattern instead — `check:stages`,
 * `check:fallback`, `check:catalog`, `check:measures` all gate duplication rather
 * than pretend it is not there.
 *
 * ⚠️ Note what makes site 3 covered rather than merely mentioned: the MRN system
 * is SCRAPED from the TypeScript, not restated here. A gate that hardcoded the
 * URI would agree with itself forever while the app drifted.
 *
 * ⚠️ Fails when it reads nothing, rather than passing over an unread input. That
 * is the #232 / #261 failure mode and it is the whole reason a gate like this can
 * report green while checking zero rows.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const root = join(webRoot, '..') // repo root
const fhirDir = join(webRoot, 'src/data/fhir')
const patientsJsonPath = join(root, 'packages/demo-population/src/patients.json')
const providerPath = join(webRoot, 'src/context/PatientProvider.tsx')

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures++
}

// ── Site 1: the canonical FSH output ──────────────────────────────────────
const fhirPatients = new Map()
let fhirDirEntries
try {
  fhirDirEntries = readdirSync(fhirDir)
} catch {
  console.error(`[check:patients] ${fhirDir} not found — run \`npm run copy-fhir\` first.`)
  process.exit(1)
}
for (const name of fhirDirEntries) {
  if (!name.startsWith('Patient-') || !name.endsWith('.json')) continue
  const doc = JSON.parse(readFileSync(join(fhirDir, name), 'utf8'))
  if (doc?.resourceType !== 'Patient' || typeof doc.id !== 'string') continue
  fhirPatients.set(doc.id, doc)
}
if (fhirPatients.size === 0) {
  console.error(
    '[check:patients] no Patient resources in web/src/data/fhir/ — run ' +
      '`npm run copy-fhir -- --force`. Refusing to pass over an unread input.',
  )
  process.exit(1)
}

// ── Site 2: patients.json ─────────────────────────────────────────────────
const registry = JSON.parse(readFileSync(patientsJsonPath, 'utf8'))
if (!Array.isArray(registry) || registry.length === 0) {
  console.error('[check:patients] patients.json is empty or not an array.')
  process.exit(1)
}

// ── Site 3: the MRN system the app emits, scraped not restated ────────────
const providerSrc = readFileSync(providerPath, 'utf8')
const mrnMatch = providerSrc.match(/identifier:\s*\[\s*\{\s*system:\s*'([^']+)'/)
if (!mrnMatch) {
  console.error(
    '[check:patients] could not find the MRN identifier system in ' +
      'PatientProvider.tsx (populationToFhir). If that builder was removed or ' +
      'reshaped, update this gate deliberately — do not delete the check.',
  )
  process.exit(1)
}
const appMrnSystem = mrnMatch[1]

// ── Both directions of the id sets ────────────────────────────────────────
for (const p of registry) {
  if (!fhirPatients.has(p.id)) {
    fail(`patients.json has "${p.id}" with no Patient Instance in population-patients.fsh`)
  }
}
for (const id of fhirPatients.keys()) {
  if (!registry.some((p) => p.id === id)) {
    fail(`population-patients.fsh has Patient/${id} with no row in patients.json`)
  }
}

// ── Field-by-field agreement ──────────────────────────────────────────────
let compared = 0
for (const p of registry) {
  const fhir = fhirPatients.get(p.id)
  if (!fhir) continue
  compared++

  const name = fhir.name?.[0] ?? {}
  const fhirDisplay = [...(name.given ?? []), name.family].filter(Boolean).join(' ')
  if (fhirDisplay !== p.displayName) {
    fail(`${p.id}: displayName "${p.displayName}" vs FHIR name "${fhirDisplay}"`)
  }
  if (fhir.birthDate !== p.dob) {
    fail(`${p.id}: dob "${p.dob}" vs FHIR birthDate "${fhir.birthDate}"`)
  }
  if (fhir.gender !== p.gender.toLowerCase()) {
    fail(`${p.id}: gender "${p.gender}" (→ "${p.gender.toLowerCase()}") vs FHIR gender "${fhir.gender}"`)
  }

  const ident = (fhir.identifier ?? []).find((i) => i.system === appMrnSystem)
  if (!ident) {
    fail(
      `${p.id}: no identifier with system "${appMrnSystem}" — that is the system ` +
        `populationToFhir emits, so the FSH and the app disagree on this patient's MRN`,
    )
  } else if (ident.value !== p.mrn) {
    fail(`${p.id}: mrn "${p.mrn}" vs FHIR identifier value "${ident.value}"`)
  }

  // The one field that is deliberately NOT in FHIR: recommendedNextStep is
  // hand-curated app copy (see lib/registry.ts), not a Patient element.
  if (!p.recommendedNextStep?.stageId) {
    fail(`${p.id}: patients.json row has no recommendedNextStep.stageId`)
  }
}

if (compared === 0) {
  console.error('[check:patients] compared 0 patients — nothing was actually checked.')
  process.exit(1)
}

if (failures > 0) {
  console.error(`\npatient demographics check FAILED (${failures} issue(s)).`)
  process.exit(1)
}

console.log(
  `✓ patients: ${compared} patient(s) agree across population-patients.fsh, ` +
    `patients.json and populationToFhir (MRN system "${appMrnSystem}")`,
)
console.log('patient demographics check passed.')
