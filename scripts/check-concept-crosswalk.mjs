#!/usr/bin/env node
/**
 * Anti-drift check for the cross-instrument CONCEPT LAYER.
 *
 * The concept layer maps each instrument's result onto one common
 * suicide-risk tier (http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier).
 * Two crosswalk shapes feed it:
 *   - coded dispositions  -> ConceptMap   (ASQ, BSSA, PSS-3, C-SSRS, CAMS)
 *   - numeric thresholds   -> StructureMap (PHQ-9 Item 9, SBQ-R), the published
 *     `.fml` maps in ig/input/resources/maps/ (and any draft in ig/drafts/)
 *
 * These can silently drift from (a) the tier vocabulary, (b) the
 * per-instrument disposition CodeSystems, and (c) the TypeScript runtime
 * mappers. This script asserts, against the SUSHI-generated resources:
 *
 *   A. every ConceptMap target code is a real tier code
 *   B. every ConceptMap source code exists in its source CodeSystem
 *   C. completeness — every code in a disposition CodeSystem that maps to
 *      the tier system is actually mapped (no instrument result left
 *      without a tier)
 *   D. every tier code referenced literally in an .fml map is a real tier code
 *   E. every ConceptMap referenced by an .fml map (imports / translate())
 *      actually exists
 *   F. the mappers, RUN: every code a mapper emits under a ConceptMap's source
 *      system is a real code of it (F1), and every source code the map
 *      translates is emitted by some mapper on some response (F2)
 *
 * ⚠️ **D and E read a directory that had emptied, from #238 until 2026-10-06.**
 * They globbed `ig/drafts/*.fml`; the maps were promoted to
 * `ig/input/resources/maps/`, leaving only a README behind, and both rules
 * passed a `'severe'` tier and a translate() of a ConceptMap that does not exist
 * without printing a line. They now read both directories and carry a floor.
 *
 * ⚠️ **F searched the mapper SOURCE for each code as a quoted literal until
 * 2026-10-06**, through a hand table of file paths. `asq.ts` emitting
 * `'acute-pos'` passed, because `'acute-positive'` was still in the file — in
 * the comparison three lines further down. F now runs every registered mapper
 * (lib/load-core.mjs) over the probe responses in lib/mapper-probes.mjs and
 * reads the codings it emits, so a mis-spelled code is a code outside the
 * CodeSystem (F1), and a code no branch emits any more is F2.
 *
 * Requires `npm run copy-fhir` (or `npx fsh-sushi .` in ig/ plus an `npm ci`
 * and the generated tree, for F). `--static` runs A–E only, for the ig.yml job
 * that compiles SUSHI without installing the app: F runs in `npm run verify`.
 * Exits non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'
import { reportFloors } from './lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..') // repo root
const genDir = join(root, 'ig/fsh-generated/resources')
const fmlDirs = [join(root, 'ig/input/resources/maps'), join(root, 'ig/drafts')]
const STATIC_ONLY = process.argv.includes('--static')

const TIER_URL = 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier'

/**
 * ConceptMap sources with NO runtime producer, and why each is acceptable.
 *
 * ⚠️ **An unlisted source used to skip check F in total silence.** So a source
 * no mapper emits is a FAILURE (F2) unless it appears here with a reason. An
 * entry is a known gap, not an exemption from thinking about it.
 */
const NO_MAPPER_REASON = {
  // ⚠️ `cams-ssf-overall-risk` lived here until 2026-09-21, and this is what an
  // entry being CLOSED looks like: "#436: the CAMS mappers emit the SSF-5
  // overall-risk rating as Observation.valueInteger … so no code in this map is
  // emitted by SPiER today". `camsSectionA.ts` is now that producer, and F2
  // sees it emit all five codes.
  'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier':
    'Egress map (tier → LOINC), so its source is the concept layer itself rather than an ' +
    'instrument disposition. Produced by whichever instrument route reached the tier, which ' +
    'checks A–C already cover from the other direction.',
}

if (!existsSync(genDir)) {
  console.error(`✗ ${genDir} not found — run \`npm run copy-fhir\` (or \`npx fsh-sushi .\` in ig/) first.`)
  process.exit(1)
}

// ---- load generated resources -------------------------------------------
const codeSystems = new Map() // url -> Set(codes)
const conceptMaps = [] // { id, resource }
const conceptMapUrls = new Set()

function collectConceptCodes(concepts, set) {
  for (const c of concepts ?? []) {
    if (c.code) set.add(c.code)
    if (c.concept) collectConceptCodes(c.concept, set)
  }
}

for (const file of readdirSync(genDir)) {
  if (!file.endsWith('.json')) continue
  let res
  try { res = JSON.parse(readFileSync(join(genDir, file), 'utf8')) } catch { continue }
  if (res.resourceType === 'CodeSystem' && res.url) {
    const set = new Set()
    collectConceptCodes(res.concept, set)
    codeSystems.set(res.url, set)
  } else if (res.resourceType === 'ConceptMap') {
    conceptMaps.push({ id: res.id || res.name || file, resource: res })
    if (res.url) conceptMapUrls.add(res.url)
  }
}

const tierCodes = codeSystems.get(TIER_URL)
let failures = 0
const fail = (msg) => { console.error(`✗ ${msg}`); failures++ }

if (!tierCodes || tierCodes.size === 0) {
  fail(`tier CodeSystem ${TIER_URL} not found or empty in generated resources`)
} else {
  console.log(`tier vocabulary: ${[...tierCodes].sort().join(', ')}`)
}

/** ConceptMap source system -> { id, mapped codes } for check F. */
const sourcesForF = new Map()

// ---- A/B/C: ConceptMaps ---------------------------------------------------
for (const { id, resource } of conceptMaps) {
  for (const group of resource.group ?? []) {
    const srcCodes = codeSystems.get(group.source) // may be undefined (external)
    const mapsToTier = group.target === TIER_URL
    const mapped = new Set()
    for (const el of group.element ?? []) {
      mapped.add(el.code)
      if (srcCodes && !srcCodes.has(el.code)) {
        fail(`${id}: source code "${el.code}" not in source CodeSystem ${group.source}`)
      }
      for (const t of el.target ?? []) {
        if (mapsToTier && tierCodes && !tierCodes.has(t.code)) {
          fail(`${id}: target tier code "${t.code}" is not a valid suicide-risk tier`)
        }
      }
    }
    // C: completeness — every disposition code must map to a tier
    if (mapsToTier && srcCodes) {
      for (const code of srcCodes) {
        if (!mapped.has(code)) fail(`${id}: disposition "${code}" (${group.source}) has no tier mapping`)
      }
    }
    // Validate LOINC and SNOMED bindings in ConceptMaps
    if (group.source === 'http://loinc.org' || group.target === 'http://loinc.org') {
      for (const el of group.element ?? []) {
        if (group.source === 'http://loinc.org' && !/^\d{3,5}-\d$/.test(el.code)) {
          fail(`${id}: Invalid LOINC code "${el.code}" in source`)
        }
        for (const t of el.target ?? []) {
          if (group.target === 'http://loinc.org' && !/^\d{3,5}-\d$/.test(t.code)) {
            // Some target LOINC answers (like LA9194-7) have an "L" prefix. Let's accommodate HL7 normative codes.
            if (!/^L[A-Z0-9]+-\d$/.test(t.code) && !/^\d{3,5}-\d$/.test(t.code)) {
              fail(`${id}: Invalid LOINC code "${t.code}" in target`)
            }
          }
        }
      }
    }

    if (group.source === 'http://snomed.info/sct' || group.target === 'http://snomed.info/sct') {
      for (const el of group.element ?? []) {
        if (group.source === 'http://snomed.info/sct' && !/^\d{6,18}$/.test(el.code)) {
          fail(`${id}: Invalid SNOMED CT code "${el.code}" in source`)
        }
        for (const t of el.target ?? []) {
          if (group.target === 'http://snomed.info/sct' && !/^\d{6,18}$/.test(t.code)) {
            fail(`${id}: Invalid SNOMED CT code "${t.code}" in target`)
          }
        }
      }
    }

    if (NO_MAPPER_REASON[group.source]) {
      console.log(`  note: ${group.source.split('/').pop()} has no runtime producer — ${NO_MAPPER_REASON[group.source]}`)
    } else {
      const entry = sourcesForF.get(group.source) ?? { ids: [], mapped: new Set() }
      entry.ids.push(id)
      for (const code of mapped) entry.mapped.add(code)
      sourcesForF.set(group.source, entry)
    }
  }
  console.log(`✓ ConceptMap ${id}: ${(resource.group ?? []).reduce((n, g) => n + (g.element?.length ?? 0), 0)} element(s) checked`)
}

// ---- D/E: StructureMaps (.fml) -------------------------------------------
// Quote-agnostic (single/double); matchAll avoids global-regex lastIndex state.
const TIER_REF = /spier-suicide-risk-tier['"]\s*,\s*['"]([^'"]+)['"]/g
const CM_TRANSLATE = /translate\([^,]+\s*,\s*['"]([^'"]+)['"]/g
const CM_IMPORT = /imports\s+['"]([^'"]+)['"]/g

let fmlFiles = 0
let tierRefs = 0
let conceptMapRefs = 0
for (const dir of fmlDirs) {
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.fml')) continue
    fmlFiles++
    const rel = relative(root, join(dir, file))
    // Comments are not the map: a `//` line naming a tier or a ConceptMap is
    // prose, and the shipped FML explains its translate() calls in comments.
    // (A `//` right after a `:` is a URL, not a comment.)
    const txt = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    let n = 0
    for (const m of txt.matchAll(TIER_REF)) {
      n++
      if (tierCodes && !tierCodes.has(m[1])) fail(`${rel}: tier code "${m[1]}" is not a valid suicide-risk tier`)
    }
    let c = 0
    for (const re of [CM_TRANSLATE, CM_IMPORT]) {
      for (const m of txt.matchAll(re)) {
        const url = m[1]
        if (!url.includes('/ConceptMap/')) continue
        c++
        if (!conceptMapUrls.has(url)) fail(`${rel}: references ConceptMap "${url}" which does not exist`)
      }
    }
    tierRefs += n
    conceptMapRefs += c
    console.log(`✓ ${rel}: ${n} tier reference(s), ${c} ConceptMap reference(s) checked`)
  }
}

// ---- F: the mappers, run --------------------------------------------------
let mapperRuns = 0
if (STATIC_ONLY) {
  console.log('  note: --static — check F (the runtime mappers) is NOT run here; `npm run verify` runs it.')
} else {
  const { loadCore } = await import('./lib/load-core.mjs')
  const { probeAnswerSets, respond, codingsIn } = await import('./lib/mapper-probes.mjs')
  const [mappers, registry, native] = await loadCore([
    '@spier/core/lib/observationMappers',
    '@spier/core/data/questionnaires',
    '@spier/core/lib/nativeQuestionnaireResponse',
  ])
  /** source system -> code -> the first Questionnaire that produced it */
  const emitted = new Map()
  for (const [canonical, mapper] of Object.entries(mappers.MAPPER_BY_QUESTIONNAIRE_URL)) {
    const q = registry.QUESTIONNAIRE_BY_URL[canonical]
    if (!q) {
      fail(`F: no Questionnaire registered for mapped canonical ${canonical} — cannot run its mapper`)
      continue
    }
    for (const answers of probeAnswerSets(q, native)) {
      const result = mapper(respond(native, q, answers))
      mapperRuns++
      for (const c of codingsIn(result?.observations ?? [])) {
        if (!sourcesForF.has(c.system)) continue
        const codes = emitted.get(c.system) ?? new Map()
        if (!codes.has(c.code)) codes.set(c.code, canonical.split('/').pop())
        emitted.set(c.system, codes)
      }
    }
  }
  for (const [system, { ids, mapped }] of sourcesForF) {
    const codes = emitted.get(system) ?? new Map()
    const known = codeSystems.get(system)
    // F1 — nothing emitted outside the CodeSystem.
    for (const [code, from] of codes) {
      if (known && !known.has(code)) {
        fail(`${ids.join(', ')}: the ${from} mapper emits "${code}" under ${system}, which that CodeSystem does not define — the ConceptMap cannot translate it, so the result reaches no tier`)
      }
    }
    // F2 — every translated code is produced by some mapper.
    if (codes.size === 0) {
      fail(
        `${ids.join(', ')}: no mapper emits ANY code under ${system} on any probe response. Either the ` +
          'producer changed system, or nothing produces this source — record why in NO_MAPPER_REASON.',
      )
      continue
    }
    for (const code of mapped) {
      if (!codes.has(code)) {
        fail(`${ids.join(', ')}: source code "${code}" (${system}) is emitted by no mapper on any probe response — a renamed or dropped branch, or a disposition the probes cannot reach (see lib/mapper-probes.mjs)`)
      }
    }
    console.log(`✓ F ${system.split('/').pop()}: ${codes.size} emitted code(s), all in the CodeSystem; ${mapped.size} translated code(s) all produced`)
  }
}

// The ConceptMaps themselves are read from SUSHI's output, and a narrowed glob
// there leaves every remaining map checked and every dropped one unmentioned.
//
// ⚠️ The source is `ig/fsh-generated/resources`, NOT
// `packages/fhir-artifacts/generated`. This floor was first written with the
// latter label, and thinning that tree to one file left this gate still
// reporting six. A floor whose label names the wrong tree is worse than none.
const floors = [
  { source: 'ig/fsh-generated/resources', dimension: 'ConceptMap(s)', actual: conceptMaps.length, floor: 3 },
  // Five maps, seven tier literals and two translate() calls today. The `.fml`
  // floors are what would have caught D/E reading an emptied directory.
  { source: 'ig/input/resources/maps + ig/drafts', dimension: '.fml map(s)', actual: fmlFiles, floor: 2 },
  { source: 'ig/input/resources/maps + ig/drafts', dimension: 'tier reference(s)', actual: tierRefs, floor: 3 },
  { source: 'ig/input/resources/maps + ig/drafts', dimension: 'ConceptMap reference(s)', actual: conceptMapRefs, floor: 1 },
]
if (!STATIC_ONLY) {
  floors.push({ source: 'observationMappers registry', dimension: 'probe run(s)', actual: mapperRuns, floor: 500 })
}
reportFloors(floors, fail)

if (failures) {
  console.error(`\nconcept-crosswalk drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nconcept-crosswalk drift check passed.')
