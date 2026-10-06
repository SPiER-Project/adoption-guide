/**
 * check:patients — the 14 demo patients' demographics agree across all THREE
 * places they are written down.
 *
 * ── Why this gate exists ──────────────────────────────────────────────────
 *
 * `packages/demo-population/src/patients/patient-0NN.json` is canonical for the 14
 * patients (it was `ig/input/fsh/population-patients.fsh` until #392), but
 * two other sites carry the same facts:
 *
 *   1. `packages/demo-population/src/patients.json` — display copies of name / dob /
 *      gender / mrn, read by the caseload table and the patient banner.
 *   2. `populationToFhir` in `packages/app-shell/src/context/PatientProvider.tsx` —
 *      builds a runtime `Patient` from patients.json, stamping its MRN with core's
 *      `MRN_SYSTEM` (packages/core/src/lib/fhircast.ts).
 *
 * That is exactly the hand-duplication CLAUDE.md warns about, and the failure is
 * silent in the worst way: patients.json feeds what a human SEES, the Patient JSON
 * is what the mock EHR SERVES, and a drifted birthDate would show one age on the
 * caseload while the EHR holds another. Nothing else compares them —
 * `check:scenarios` proves the subject *exists* (check 8), not that it agrees.
 *
 * ⚠️ **Site 3 is now a VALUE, loaded, plus one structural rule.** Until
 * 2026-10-06 the MRN system was regex-scraped from the first
 * `identifier: [{ system: '…' }]` literal in PatientProvider.tsx. Moving the
 * builder's system into a local constant (with a typo) made the regex fall
 * through to BLANK_PATIENT's literal further down, and the gate passed while the
 * app emitted the typo. Now core's `MRN_SYSTEM` is loaded through
 * lib/load-core.mjs and compared with the Patient JSON, and every identifier
 * `system` in PatientProvider.tsx must be that import — not a literal, not a
 * local constant.
 *
 * Deriving the display copies from the Patient JSON at import time would delete
 * site 1 and most of this gate; that is a proposal, not done here.
 *
 * ⚠️ Fails when it reads nothing, rather than passing over an unread input. That
 * is the #232 / #261 failure mode and it is the whole reason a gate like this can
 * report green while checking zero rows.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reportFloors } from './lib/floors.mjs'
import { REPO_ROOT } from './lib/app-roots.mjs'
import { loadCore } from './lib/load-core.mjs'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..') // repo root
const patientsDir = join(root, 'packages/demo-population/src/patients')
const patientsJsonPath = join(root, 'packages/demo-population/src/patients.json')
// ⚠️ PatientProvider is in packages/app-shell — runtime BOTH apps mount, so
// it is not under any app root. appRoot() answers only for app trees.
const providerPath = join(REPO_ROOT, 'packages/app-shell/src/context/PatientProvider.tsx')

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures++
}

// ── Site 1: the canonical Patient JSON ────────────────────────────────────
// Hand-authored FHIR in packages/demo-population, NOT a SUSHI output: step E2
// (#392) moved the 14 Patients out of the IG, because nothing in the IG
// referenced them and a fake EHR's roster should not depend on a compile. So
// this site is now checked-in JSON and needs no `copy-fhir` to have run.
const fhirPatients = new Map()
let patientDirEntries
try {
  patientDirEntries = readdirSync(patientsDir)
} catch {
  console.error(`[check:patients] ${patientsDir} not found — the 14 demo Patients live there since #392.`)
  process.exit(1)
}
for (const name of patientDirEntries) {
  if (!name.endsWith('.json')) continue
  const doc = JSON.parse(readFileSync(join(patientsDir, name), 'utf8'))
  if (doc?.resourceType !== 'Patient' || typeof doc.id !== 'string') continue
  fhirPatients.set(doc.id, doc)
}
if (fhirPatients.size === 0) {
  console.error(
    `[check:patients] no Patient resources in ${patientsDir} — refusing to pass over an unread input.`,
  )
  process.exit(1)
}

// ── Site 2: patients.json ─────────────────────────────────────────────────
const registry = JSON.parse(readFileSync(patientsJsonPath, 'utf8'))
if (!Array.isArray(registry) || registry.length === 0) {
  console.error('[check:patients] patients.json is empty or not an array.')
  process.exit(1)
}

// ── Site 3: the MRN system the app emits — core's constant, imported ─────
const [fhircast] = await loadCore(['@spier/core/lib/fhircast'])
const appMrnSystem = fhircast.MRN_SYSTEM
if (typeof appMrnSystem !== 'string' || !appMrnSystem) {
  console.error('[check:patients] @spier/core/lib/fhircast exports no MRN_SYSTEM — refusing to compare MRNs against nothing.')
  process.exit(1)
}
{
  const providerSrc = readFileSync(providerPath, 'utf8')
  const sf = ts.createSourceFile(providerPath, providerSrc, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const rel = 'packages/app-shell/src/context/PatientProvider.tsx'
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  // The local name core's MRN_SYSTEM is imported under, if it is.
  let importedAs
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text === '@spier/core/lib/fhircast' &&
        stmt.importClause?.namedBindings && ts.isNamedImports(stmt.importClause.namedBindings)) {
      for (const el of stmt.importClause.namedBindings.elements) {
        if ((el.propertyName ?? el.name).text === 'MRN_SYSTEM') importedAs = el.name.text
      }
    }
  }
  let identifierSystems = 0
  const visit = (node) => {
    // `identifier: [ { system: … } ]`
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'identifier' &&
        ts.isArrayLiteralExpression(node.initializer)) {
      for (const el of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue
        for (const prop of el.properties) {
          if (!(ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) || prop.name.getText(sf) !== 'system') continue
          identifierSystems++
          const init = ts.isPropertyAssignment(prop) ? prop.initializer : prop.name
          if (!importedAs || !ts.isIdentifier(init) || init.text !== importedAs) {
            fail(`${rel}:${line(prop)}: identifier system is \`${init.getText(sf)}\`, not core's MRN_SYSTEM imported from @spier/core/lib/fhircast — a second spelling of the MRN namespace this gate cannot hold to the Patient JSON`)
          }
        }
      }
    }
    // A local re-declaration would shadow the import's meaning even if spelled alike.
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === importedAs) {
      fail(`${rel}:${line(node)}: declares its own ${importedAs} — use the import from @spier/core/lib/fhircast`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (identifierSystems === 0) {
    console.error(
      `[check:patients] found no identifier \`system\` in ${rel} — if populationToFhir moved or ` +
        'was reshaped, update this gate deliberately; do not delete the check.',
    )
    process.exit(1)
  }
}

// ── Both directions of the id sets ────────────────────────────────────────
for (const p of registry) {
  if (!fhirPatients.has(p.id)) {
    fail(`patients.json has "${p.id}" with no Patient JSON in demo-population/src/patients`)
  }
}
for (const id of fhirPatients.keys()) {
  if (!registry.some((p) => p.id === id)) {
    fail(`demo-population/src/patients has Patient/${id} with no row in patients.json`)
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
        `populationToFhir emits (core's MRN_SYSTEM), so the Patient JSON and the app disagree on this patient's MRN`,
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

// 14 patients agreeing across three sites is the claim. Two patients agreeing
// across three sites is also "no disagreement found", and reads identically.
reportFloors([
  { source: 'demo-population/src/patients', dimension: 'patient(s) compared', actual: compared, floor: 7 },
], fail)

if (failures > 0) {
  console.error(`\npatient demographics check FAILED (${failures} issue(s)).`)
  process.exit(1)
}

console.log(
  `✓ patients: ${compared} patient(s) agree across demo-population/src/patients, ` +
    `patients.json and populationToFhir (MRN system "${appMrnSystem}")`,
)
console.log('patient demographics check passed.')
