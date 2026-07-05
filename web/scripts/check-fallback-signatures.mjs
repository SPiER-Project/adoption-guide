#!/usr/bin/env node
/**
 * Anti-drift check for the code-based fallback dispatcher.
 *
 * `web/src/lib/observationMappers/fallbackDispatch.ts` hand-lists standardized
 * LOINC per-item codes (INSTRUMENT_SIGNATURES[].itemCodes) mapped to SPiER
 * linkIds, so a foreign QuestionnaireResponse can be recognized and normalized
 * into SPiER shape. Those same code↔linkId pairs already live in the canonical
 * SPiER Questionnaire JSON (FHIR-Resources/<tool>/*.json) — a third home for a
 * hand-duplicated value (see CLAUDE.md "Drift-prone hand-duplicated values").
 *
 * This script asserts, for every signature entry:
 *   1. `spierCanonical` resolves (version-stripped) to a Questionnaire in
 *      FHIR-Resources/, and
 *   2. each { code, linkId } pair matches that Questionnaire: the item with
 *      that linkId carries that code in `item.code[].code`.
 *
 * So if someone renumbers a Questionnaire's linkIds or edits its item LOINC
 * codes without updating the signature (or vice-versa), CI fails here.
 *
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '..')
const root = resolve(here, '../..') // repo root
const questionnairesDir = join(root, 'FHIR-Resources')
const signaturesFile = join(webRoot, 'src/lib/observationMappers/fallbackDispatch.ts')

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

const stripVersion = (canonical) => {
  const pipe = canonical.indexOf('|')
  return pipe === -1 ? canonical : canonical.slice(0, pipe)
}

// --- Index every FHIR-Resources Questionnaire by canonical URL -------------
function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walkFiles(full)
    else if (entry.endsWith('.json')) yield full
  }
}

function* walkItems(items) {
  for (const it of items ?? []) {
    yield it
    yield* walkItems(it.item)
  }
}

/** canonical (version-stripped) → Map(linkId → Set(codes)). */
const questionnaireItemCodes = new Map()
for (const file of walkFiles(questionnairesDir)) {
  let json
  try { json = JSON.parse(readFileSync(file, 'utf8')) } catch { continue }
  if (json?.resourceType !== 'Questionnaire' || !json.url) continue
  const linkIdCodes = new Map()
  for (const it of walkItems(json.item)) {
    if (!it.linkId) continue
    const codes = new Set((it.code ?? []).map((c) => c.code).filter(Boolean))
    linkIdCodes.set(it.linkId, codes)
  }
  questionnaireItemCodes.set(stripVersion(json.url), linkIdCodes)
}

// --- Parse INSTRUMENT_SIGNATURES from the TS source ------------------------
const src = readFileSync(signaturesFile, 'utf8')

const spierQMatch = src.match(/const SPIER_Q\s*=\s*'([^']+)'/)
if (!spierQMatch) {
  fail(`could not find \`const SPIER_Q = '…'\` in ${signaturesFile}`)
}
const SPIER_Q = spierQMatch?.[1]

// Scope parsing to the INSTRUMENT_SIGNATURES array body so `spierCanonical:` in
// the InstrumentSignature interface / JSDoc above it isn't mistaken for a entry.
const declMatch = src.match(/INSTRUMENT_SIGNATURES[^=]*=\s*\[/)
let arrayBody = ''
if (declMatch) {
  // Walk from the opening `[` to its matching `]` (bracket-depth scan) so we
  // don't spill into the functions below the array (whose params also mention
  // `spierCanonical:`).
  const open = declMatch.index + declMatch[0].length - 1
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']' && --depth === 0) { arrayBody = src.slice(open, i + 1); break }
  }
}
if (!arrayBody) fail('could not locate the INSTRUMENT_SIGNATURES array')

// Split into per-signature chunks on the `spierCanonical:` marker.
const chunks = arrayBody.split(/spierCanonical\s*:/).slice(1)
if (chunks.length === 0) fail('no `spierCanonical:` entries found in INSTRUMENT_SIGNATURES')

let checkedPairs = 0
for (const chunk of chunks) {
  // canonical: either `${SPIER_Q}/PHQ-9` (template) or a plain '...' literal.
  const tmpl = chunk.match(/`\$\{SPIER_Q\}([^`]*)`/)
  const literal = chunk.match(/^\s*'([^']+)'/)
  const canonical = tmpl ? `${SPIER_Q}${tmpl[1]}` : literal?.[1]
  if (!canonical) { fail('could not parse a signature canonical'); continue }

  const itemCodes = questionnaireItemCodes.get(stripVersion(canonical))
  if (!itemCodes) {
    fail(`signature canonical "${canonical}" has no Questionnaire in FHIR-Resources/`)
    continue
  }

  // Each itemCodes entry: { system: '…', code: '…', linkId: '…' }.
  const pairRe = /code:\s*'([^']+)'\s*,\s*linkId:\s*'([^']+)'/g
  let m
  let matched = 0
  while ((m = pairRe.exec(chunk)) !== null) {
    matched++
    checkedPairs++
    const [, code, linkId] = m
    const codes = itemCodes.get(linkId)
    if (!codes) {
      fail(`${canonical}: signature linkId "${linkId}" not found in the Questionnaire`)
    } else if (!codes.has(code)) {
      fail(`${canonical}: item "${linkId}" declares codes [${[...codes].join(', ') || '—'}] but signature maps code "${code}" to it`)
    }
  }
  if (matched === 0) fail(`${canonical}: no { code, linkId } pairs parsed from signature`)
  else console.log(`✓ ${canonical}: ${matched} item-code mapping(s) match the Questionnaire`)
}

if (failures) {
  console.error(`\nfallback-signature drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log(`\nfallback-signature drift check passed (${checkedPairs} mapping(s)).`)
