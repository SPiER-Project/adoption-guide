/**
 * check:patients — the 14 demo patients have ONE set of demographics, and the
 * app stamps their MRNs in the namespace the Patient JSON uses.
 *
 * ── What this gate was, and why it is smaller now ─────────────────────────
 *
 * Until 2026-10-07 the demographics were written down three times: the
 * canonical Patient JSON (`packages/demo-population/src/patients/patient-0NN.json`),
 * display copies of name / dob / gender / mrn in a `patients.json`, and the MRN
 * system `populationToFhir` stamps. This gate compared the first two field by
 * field, because a drifted birthDate showed one age on the caseload while the
 * mock EHR served another.
 *
 * The copies are gone: `packages/demo-population/src/patients.ts` derives every
 * registry row from its Patient resource, and THROWS on a resource that cannot
 * supply a field (no name, birthDate, gender, MRN under core's `MRN_SYSTEM`, or
 * curated next step) and on a next step naming no patient. So the field
 * comparison is structural now, and what is left here is:
 *
 *   1. The derivation RUNS, over every Patient JSON: the registry is loaded
 *      through Vite (lib/load-core.mjs), and its ids must equal the Patient
 *      files' ids both ways. A loader error — the derivation's own throw — is
 *      a failure, printed.
 *   2. The MRN system the app emits is core's `MRN_SYSTEM`, imported: every
 *      identifier `system` in PatientProvider.tsx must be that import — not a
 *      literal, not a local constant.
 *
 * ⚠️ Rule 2 was regex-scraped until 2026-10-06. Moving the builder's system
 * into a local constant (with a typo) made the regex fall through to
 * BLANK_PATIENT's literal further down, and the gate passed while the app
 * emitted the typo. It is a TypeScript AST walk now.
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
// ⚠️ PatientProvider is in packages/app-shell — runtime BOTH apps mount, so
// it is not under any app root. appRoot() answers only for app trees.
const providerPath = join(REPO_ROOT, 'packages/app-shell/src/context/PatientProvider.tsx')

let failures = 0
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  failures++
}

// ── The canonical Patient JSON ────────────────────────────────────────────
// Hand-authored FHIR in packages/demo-population, NOT a SUSHI output (#392),
// so this needs no `copy-fhir` to have run.
const fileIds = new Set()
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
  fileIds.add(doc.id)
}
if (fileIds.size === 0) {
  console.error(`[check:patients] no Patient resources in ${patientsDir} — refusing to pass over an unread input.`)
  process.exit(1)
}

// ── Rule 1: the derived registry covers exactly those patients ────────────
let registry
let fhircast
try {
  ;[{ POPULATION_PATIENTS: registry }, fhircast] = await loadCore(['@spier/demo-population', '@spier/core/lib/fhircast'])
} catch (err) {
  console.error(`✗ the demo registry did not derive from the Patient JSON: ${err.message}`)
  process.exit(1)
}
if (!Array.isArray(registry) || registry.length === 0) {
  console.error('[check:patients] @spier/demo-population exports no POPULATION_PATIENTS — refusing to compare against nothing.')
  process.exit(1)
}
const registryIds = new Set(registry.map((p) => p.id))
for (const id of fileIds) if (!registryIds.has(id)) fail(`Patient/${id} is in demo-population/src/patients but not in the derived registry`)
for (const id of registryIds) if (!fileIds.has(id)) fail(`the derived registry has "${id}" with no Patient JSON in demo-population/src/patients`)

// ── Rule 2: the MRN system the app emits — core's constant, imported ─────
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

// 14 patients deriving is the claim; two deriving reads identically.
reportFloors([
  { source: 'demo-population/src/patients', dimension: 'patient(s) derived', actual: registryIds.size, floor: 7 },
], fail)

if (failures > 0) {
  console.error(`\npatient demographics check FAILED (${failures} issue(s)).`)
  process.exit(1)
}

console.log(
  `✓ patients: ${registryIds.size} registry row(s) derived from demo-population/src/patients; ` +
    `PatientProvider stamps MRNs with core's MRN_SYSTEM ("${appMrnSystem}")`,
)
console.log('patient demographics check passed.')
