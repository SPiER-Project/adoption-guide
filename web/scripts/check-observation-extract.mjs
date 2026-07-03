#!/usr/bin/env node
/**
 * Anti-drift check for the SDC observationExtract contract.
 *
 * The screening Questionnaires DECLARE which items yield Observations via the
 * SDC `sdc-questionnaire-observationExtract` extension; the per-instrument
 * mappers (web/src/lib/observationMappers/*) are the reference IMPLEMENTATION
 * of that contract. The two can silently drift. This script asserts:
 *
 *   1. every item declaring observationExtract also carries a `code`
 *      (otherwise the extracted Observation would have no Observation.code), and
 *   2. the set of declared extract codes per Questionnaire matches EXPECTED —
 *      the literal per-answer / total-score Observation codes the mapper emits.
 *
 * Computed/derived Observations (ASQ composite disposition, C-SSRS risk level,
 * PHQ-9 item-9 ordinal) are NOT literal extractions and are intentionally NOT
 * declared with observationExtract; they live only in the mapper. See README.
 *
 * Exits non-zero on drift so it can gate CI / copy-fhir.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..') // repo root

const EXTRACT_URL =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract'

// Questionnaire file → the Observation codes its mapper extracts as LITERAL
// per-item / total-score Observations (i.e. the items that should declare
// observationExtract). Keep in sync with web/src/lib/observationMappers/*.
const EXPECTED = {
  'FHIR-Resources/PHQ-9/phq9-questionnaire.json': ['44261-6'],
  'FHIR-Resources/SBQ-R/sbqr-questionnaire.json': ['225337009'],
  'FHIR-Resources/C-SSRS/cssrs-screener.json': [
    '93246-7', '93247-5', '93248-3', '93249-1', '93250-9', '93267-3',
  ],
  // ASQ has NO published per-item LOINC codes (verified June 2026), so the five
  // screening items bind to the SPiER-local http://spier.org/CodeSystem/asq-item.
  // These are NOT LOINC codes; they match web/src/lib/observationMappers/asq.ts.
  'FHIR-Resources/ASQ/asq-questionnaire.json': [
    'wished-dead', 'family-better-off-dead', 'thoughts-killing-self',
    'ever-attempted', 'acute-ideation-now',
  ],
}

function* walk(items) {
  for (const it of items ?? []) {
    yield it
    yield* walk(it.item)
  }
}

let failures = 0
for (const [relPath, expected] of Object.entries(EXPECTED)) {
  const q = JSON.parse(readFileSync(resolve(root, relPath), 'utf8'))
  const declared = []
  for (const item of walk(q.item)) {
    const hasExtract = (item.extension ?? []).some(
      e => e.url === EXTRACT_URL && e.valueBoolean === true,
    )
    if (!hasExtract) continue
    const code = item.code?.[0]?.code
    if (!code) {
      console.error(`✗ ${relPath}: item "${item.linkId}" declares observationExtract but has no code`)
      failures++
      continue
    }
    declared.push(code)
  }
  const exp = new Set(expected)
  const dec = new Set(declared)
  const missing = [...exp].filter(c => !dec.has(c))
  const extra = [...dec].filter(c => !exp.has(c))
  if (missing.length || extra.length) {
    console.error(`✗ ${relPath}: observationExtract codes drift from mapper`)
    if (missing.length) console.error(`    expected (mapper emits) but not declared: ${missing.join(', ')}`)
    if (extra.length) console.error(`    declared but mapper does not emit:        ${extra.join(', ')}`)
    failures++
  } else {
    console.log(`✓ ${relPath}: ${declared.length} observationExtract item(s) match mapper`)
  }
}

if (failures) {
  console.error(`\nobservationExtract drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nobservationExtract drift check passed.')
