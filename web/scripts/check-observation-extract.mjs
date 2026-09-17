#!/usr/bin/env node
/**
 * Anti-drift check for the SDC observationExtract contract.
 *
 * The screening Questionnaires DECLARE which items yield Observations via the
 * SDC `sdc-questionnaire-observationExtract` extension; the per-instrument
 * mappers (packages/core/src/lib/observationMappers/*) are the reference IMPLEMENTATION
 * of that contract. The two can silently drift. This script asserts:
 *
 *   1. every item declaring observationExtract also carries a `code`
 *      (otherwise the extracted Observation would have no Observation.code),
 *   2. the set of declared extract codes per Questionnaire matches EXPECTED —
 *      the literal per-answer / total-score Observation codes the mapper emits,
 *      and
 *   3. EVERY mapper's Questionnaire is classified — listed in EXPECTED, or in
 *      NO_LITERAL_EXTRACTS with the reason it has none.
 *
 * Computed/derived Observations (ASQ composite disposition, C-SSRS risk level,
 * PHQ-9 item-9 ordinal) are NOT literal extractions and are intentionally NOT
 * declared with observationExtract; they live only in the mapper. See README.
 *
 * ⚠️ **Rule 3 is the one that was missing, and its absence was the whole hole.**
 * EXPECTED is a hand-written list of paths, and a Questionnaire simply absent
 * from it was checked by nothing — not "checked and found empty", but never
 * opened. Four of the fourteen mappers were in that state: `camsSectionA` and
 * `camsOutcomeDisposition` each emit six literal per-item SSF-vital Observations
 * (plus, for the latter, a coded disposition) and their Questionnaires declared
 * ZERO observationExtract items; `camsSectionB` and `cssrsFull` genuinely have
 * none, but nothing recorded that as a decision rather than an oversight. The
 * gate printed a green ✓ for ten files and said nothing about the other four.
 *
 * This is the same shape as `check:outputs`' first run and as the emitter's
 * fixture coverage: a per-item list that nothing compares against the set of
 * things that ought to be in it. The fix is always the same — derive the set
 * from the registry, and make every absence explicit.
 *
 * Exits non-zero on drift so it can gate CI / copy-fhir.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..') // repo root

const EXTRACT_URL =
  'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract'

// Questionnaire file → the Observation codes its mapper extracts as LITERAL
// per-item / total-score Observations (i.e. the items that should declare
// observationExtract). Keep in sync with packages/core/src/lib/observationMappers/*.
const EXPECTED = {
  'FHIR-Resources/PHQ-9/phq9-questionnaire.json': ['44261-6'],
  'FHIR-Resources/SBQ-R/sbqr-questionnaire.json': ['225337009'],
  'FHIR-Resources/C-SSRS/cssrs-screener.json': [
    '93246-7', '93247-5', '93248-3', '93249-1', '93250-9', '93267-3',
  ],
  // C-SSRS Since Last Visit shares the screener's 6-item set but NOT its coding.
  // LOINC codes C-SSRS items only per timeframe (Lifetime / 1 month / 3 months)
  // and has nothing for "since last contact", so these bind to the SPiER-local
  // http://thespierproject.org/fhir/CodeSystem/cssrs-interval-item instead of reusing the
  // screener's 1-month LOINC codes, which would assert a window the instrument
  // does not claim (issue #220). These are NOT LOINC codes; they match
  // packages/core/src/lib/observationMappers/cssrsSinceLastContact.ts.
  'FHIR-Resources/C-SSRS/cssrs-since-last-contact.json': [
    'wish-to-be-dead', 'non-specific-active-thoughts', 'active-ideation-any-methods',
    'active-ideation-some-intent', 'active-ideation-plan-and-intent', 'suicidal-behavior',
  ],
  // C-SSRS Pediatric / Adolescent reuses the validated screener item set + LOINC
  // codes. Matches packages/core/src/lib/observationMappers/cssrsPediatric.ts (shared core).
  'FHIR-Resources/C-SSRS/cssrs-pediatric.json': [
    '93246-7', '93247-5', '93248-3', '93249-1', '93250-9', '93267-3',
  ],
  // ASQ items carry published LOINC codes as of LOINC 2.83, which added the ASQ
  // panel 115564-7 and its eight item codes. Until then the ASQ had none and the
  // five screening items bound to the SPiER-local asq-item CodeSystem, now
  // deleted. Match packages/core/src/lib/observationMappers/asq.ts.
  'FHIR-Resources/ASQ/asq-questionnaire.json': [
    '115566-2', '115567-0', '115568-8', '115569-6', '115571-2',
  ],
  // BSSA has NO published panel/per-item LOINC codes. The disposition item
  // carries the generic LOINC 93374-7 ("Suicide risk level"); the discrete
  // interview findings bind to the SPiER-local http://thespierproject.org/fhir/CodeSystem/bssa-item.
  // These match packages/core/src/lib/observationMappers/bssa.ts.
  'FHIR-Resources/BSSA/bssa-questionnaire.json': [
    '93374-7', 'current-ideation', 'suicide-plan', 'intent-scale',
    'past-suicide-attempt', 'needs-help-to-be-safe',
  ],
  // PSS-3 has NO published panel/per-item LOINC codes. The three screening
  // items bind to the SPiER-local http://thespierproject.org/fhir/CodeSystem/pss3-item; the
  // result is COMPUTED (not observationExtract-declared). Match packages/core/src/lib/observationMappers/pss3.ts.
  'FHIR-Resources/PSS-3/pss3-questionnaire.json': [
    'depression-2wk', 'active-ideation-2wk', 'lifetime-attempt',
  ],
  // SAFE-T is a clinical-judgment formulation; only the risk-level item is a
  // literal extraction (LOINC 93374-7). Its value binds directly to the shared
  // suicide-risk tier (no crosswalk). Matches packages/core/src/lib/observationMappers/safet.ts.
  'FHIR-Resources/SAFE-T/safet-questionnaire.json': ['93374-7'],
  // PSS Full: only the site-defined risk-level (93374-7) is a literal extraction;
  // the PSS-3 screen items are recorded in the QR for context. Matches packages/core/src/lib/observationMappers/pssFull.ts.
  'FHIR-Resources/PSS-Full/pss-full-questionnaire.json': ['93374-7'],
  // CAMS SSF-5 Section A: the six SSF Core Assessment ratings ARE literal
  // extractions — the Observation's value is the 1–5 answer and its code is the
  // item's. No LOINC concepts exist for the SSF scale, so they bind to the
  // SPiER-local cams-ssf CodeSystem. Added 2026-09-17: this Questionnaire
  // declared none, and was absent from this list, so nothing looked.
  // ⚠️ The SEVENTH Observation the mapper emits is deliberately NOT declared.
  // It re-codes the same `6-score` answer under LOINC 93374-7, and `$extract`
  // produces ONE Observation per item — an item with two codes yields one
  // Observation with two codings, not two resources. A second resource from one
  // answer is mapper logic, not an extraction.
  'FHIR-Resources/CAMS/cams-ssf5-section-a.json': [
    'psychological-pain', 'stress', 'agitation', 'hopelessness', 'self-hate', 'overall-risk',
  ],
  // CAMS SSF-5 Outcome/Disposition: the same six re-rated vitals, plus the
  // disposition — also literal, since the Observation's valueCodeableConcept is
  // the answer's own coding and its code is the item's (LOINC 93374-7).
  // Matches packages/core/src/lib/observationMappers/camsOutcomeDisposition.ts.
  'FHIR-Resources/CAMS/cams-ssf5-outcome-disposition.json': [
    'psychological-pain', 'stress', 'agitation', 'hopelessness', 'self-hate', 'overall-risk',
    '93374-7',
  ],
}

/**
 * Mappers whose Questionnaire declares NO observationExtract, with the reason.
 *
 * ⚠️ An entry here is a claim that every Observation the mapper emits is
 * COMPUTED — derived from several answers, or a re-coding — rather than the
 * answer itself. It is not "we have not got to it yet": rule 3 exists precisely
 * because absence from EXPECTED used to mean both, indistinguishably.
 */
const NO_LITERAL_EXTRACTS = {
  // Emits one Observation: the risk tier, computed by walking the published
  // C-SSRS triage ladder across twelve lifetime/recent items. No single answer
  // becomes an Observation, so there is nothing to extract.
  'FHIR-Resources/C-SSRS/cssrs-full-lifetime-recent.json':
    'one computed risk tier from the C-SSRS triage ladder over twelve items — no per-answer Observation',
  // Emits Conditions, not Observations: one suicide-driver Condition per
  // described driver, whose `code.text` is the free-text description and whose
  // categories come from a different item. `observationExtract` is defined for
  // Observations, so it cannot express this even in principle.
  'FHIR-Resources/CAMS/cams-ssf5-section-b.json':
    'emits SPiERCAMSSuicideDriver Conditions, not Observations — observationExtract does not apply',
}

function* walk(items) {
  for (const it of items ?? []) {
    yield it
    yield* walk(it.item)
  }
}

let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

// ─── RULE 3 — every mapper's Questionnaire is classified ────────────────────
//
// The "ought to be checked" set is DERIVED from the mapper registry rather than
// restated here, so a fifteenth mapper is classified or this gate goes red.
// Read as text: this is a node script and the registry is TypeScript.
const registrySrc = readFileSync(
  resolve(root, 'packages/core/src/lib/observationMappers/index.ts'),
  'utf8',
)
const mappedCanonicals = [...registrySrc.matchAll(/\[`\$\{SPIER_Q\}(\/[^`]+)`\]:/g)].map(
  (m) => `http://thespierproject.org/fhir/Questionnaire${m[1]}`,
)
if (mappedCanonicals.length === 0) {
  fail(
    'observationMappers/index.ts: parsed no mapper canonicals — this rule reads that registry as ' +
      'text, so a changed shape would make it vacuous rather than red',
  )
}

/** Questionnaire canonical → its path under FHIR-Resources/. */
const pathByCanonical = new Map()
function* jsonFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* jsonFiles(full)
    else if (entry.name.endsWith('.json')) yield full
  }
}
for (const full of jsonFiles(resolve(root, 'FHIR-Resources'))) {
  let doc
  try { doc = JSON.parse(readFileSync(full, 'utf8')) } catch { continue }
  if (doc.resourceType !== 'Questionnaire' || typeof doc.url !== 'string') continue
  pathByCanonical.set(doc.url.split('|')[0], full.slice(resolve(root).length + 1))
}

const classified = new Map()
for (const k of Object.keys(EXPECTED)) classified.set(k, 'EXPECTED')
for (const k of Object.keys(NO_LITERAL_EXTRACTS)) {
  if (classified.has(k)) {
    fail(`${k} is in BOTH EXPECTED and NO_LITERAL_EXTRACTS — it cannot be both, and the second would win silently`)
  }
  classified.set(k, 'NO_LITERAL_EXTRACTS')
}

for (const canonical of mappedCanonicals) {
  const relPath = pathByCanonical.get(canonical)
  if (!relPath) {
    fail(
      `observationMappers/index.ts maps "${canonical}", which resolves to no Questionnaire JSON under ` +
        `FHIR-Resources/. check:catalog owns that relation; this rule needs it to find the file.`,
    )
    continue
  }
  if (classified.has(relPath)) continue
  fail(
    `${relPath} has a mapper but appears in NEITHER EXPECTED NOR NO_LITERAL_EXTRACTS, so this gate ` +
      `never opened it. If its mapper emits an Observation whose VALUE is an answer and whose CODE is ` +
      `that item's, declare observationExtract on those items and list the codes in EXPECTED. If every ` +
      `Observation it emits is computed from several answers, say so in NO_LITERAL_EXTRACTS with the ` +
      `reason — "absent" used to mean both, which is how four mappers went unchecked.`,
  )
}

// And the classifications expire: an entry for a Questionnaire no mapper serves
// is a rule about nothing.
const mappedPaths = new Set(mappedCanonicals.map((c) => pathByCanonical.get(c)).filter(Boolean))
for (const [relPath, where] of classified) {
  if (mappedPaths.has(relPath)) continue
  fail(
    `${where} names ${relPath}, which no mapper in observationMappers/index.ts serves. Delete the ` +
      `entry — a classification for a Questionnaire nothing maps is checking nothing.`,
  )
}
console.log(
  `✓ coverage: ${mappedCanonicals.length} mapper(s), each classified ` +
    `(${Object.keys(EXPECTED).length} with literal extracts, ${Object.keys(NO_LITERAL_EXTRACTS).length} without)`,
)

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
      fail(`${relPath}: item "${item.linkId}" declares observationExtract but has no code`)
      continue
    }
    declared.push(code)
  }
  const exp = new Set(expected)
  const dec = new Set(declared)
  const missing = [...exp].filter(c => !dec.has(c))
  const extra = [...dec].filter(c => !exp.has(c))
  if (missing.length || extra.length) {
    fail(`${relPath}: observationExtract codes drift from mapper`)
    if (missing.length) console.error(`    expected (mapper emits) but not declared: ${missing.join(', ')}`)
    if (extra.length) console.error(`    declared but mapper does not emit:        ${extra.join(', ')}`)
  } else {
    console.log(`✓ ${relPath}: ${declared.length} observationExtract item(s) match mapper`)
  }
}

// A NO_LITERAL_EXTRACTS claim is checkable: the file must really declare none.
for (const [relPath, reason] of Object.entries(NO_LITERAL_EXTRACTS)) {
  if (!reason || reason.length < 20) {
    fail(`NO_LITERAL_EXTRACTS["${relPath}"] carries no usable reason. An exemption without one is indistinguishable from an oversight.`)
  }
  const q = JSON.parse(readFileSync(resolve(root, relPath), 'utf8'))
  const declared = [...walk(q.item)].filter((it) =>
    (it.extension ?? []).some((e) => e.url === EXTRACT_URL && e.valueBoolean === true),
  )
  if (declared.length) {
    fail(
      `${relPath} is classified NO_LITERAL_EXTRACTS but declares observationExtract on ` +
        `${declared.map((d) => `"${d.linkId}"`).join(', ')}. Move it to EXPECTED with the codes its ` +
        `mapper emits.`,
    )
  } else {
    console.log(`✓ ${relPath}: no literal extracts, as classified — ${reason}`)
  }
}

if (failures) {
  console.error(`\nobservationExtract drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nobservationExtract drift check passed.')
