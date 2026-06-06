#!/usr/bin/env node
/**
 * Anti-drift check for the cross-instrument CONCEPT LAYER.
 *
 * The concept layer maps each instrument's result onto one common
 * suicide-risk tier (http://spier.org/CodeSystem/spier-suicide-risk-tier).
 * Two crosswalk shapes feed it:
 *   - coded dispositions  -> ConceptMap   (ASQ, C-SSRS)
 *   - numeric thresholds   -> StructureMap (PHQ-9 Item 9, SBQ-R), in ig/drafts/*.fml
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
 *   D. every tier code referenced literally in a draft .fml is a real tier code
 *   E. every ConceptMap referenced by a draft .fml (imports / translate())
 *      actually exists
 *   F. (best-effort) every ConceptMap source disposition code still appears
 *      in the corresponding TS mapper, so a renamed code can't drift
 *
 * Requires `sushi .` to have run (reads ig/fsh-generated/resources). Exits
 * non-zero on drift so it can gate CI.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..') // repo root
const genDir = join(root, 'ig/fsh-generated/resources')
const draftsDir = join(root, 'ig/drafts')

const TIER_URL = 'http://spier.org/CodeSystem/spier-suicide-risk-tier'

// Disposition CodeSystem url -> the TS mapper(s) that produce those codes (check F).
// A code must appear in at least one of the listed (existing) mapper files.
const MAPPER_FOR_SOURCE = {
  'http://spier.org/CodeSystem/asq-screening-result': ['web/src/lib/observationMappers/asq.ts'],
  'http://spier.org/CodeSystem/cssrs-risk-level': [
    'web/src/lib/observationMappers/cssrsScreener.ts',
    'web/src/lib/observationMappers/cssrsFull.ts',
  ],
}

if (!existsSync(genDir)) {
  console.error(`✗ ${genDir} not found — run \`sushi .\` in ig/ first.`)
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

// ---- A/B/C/F: ConceptMaps -------------------------------------------------
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
    // F: mapper coverage (best-effort) — code must appear in >=1 existing mapper
    const mapperRels = MAPPER_FOR_SOURCE[group.source]
    if (mapperRels) {
      const present = mapperRels
        .map((rel) => ({ rel, path: join(root, rel) }))
        .filter(({ path }) => existsSync(path))
        .map(({ rel, path }) => ({ rel, txt: readFileSync(path, 'utf8') }))
      if (present.length === 0) {
        console.log(`  note: no mapper file found for ${group.source} — skipping coverage check`)
      } else {
        for (const code of mapped) {
          const found = present.some(({ txt }) => txt.includes(`'${code}'`) || txt.includes(`"${code}"`) || txt.includes(`\`${code}\``))
          if (!found) {
            fail(`${id}: source code "${code}" not found in any runtime mapper (${mapperRels.join(', ')}) — possible drift`)
          }
        }
      }
    }
  }
  console.log(`✓ ConceptMap ${id}: ${(resource.group ?? []).reduce((n, g) => n + (g.element?.length ?? 0), 0)} element(s) checked`)
}

// ---- D/E: draft StructureMaps (.fml) -------------------------------------
// Quote-agnostic (single/double); matchAll avoids global-regex lastIndex state.
const TIER_REF = /spier-suicide-risk-tier['"]\s*,\s*['"]([^'"]+)['"]/g
const CM_TRANSLATE = /translate\([^,]+\s*,\s*['"]([^'"]+)['"]/g
const CM_IMPORT = /imports\s+['"]([^'"]+)['"]/g

if (existsSync(draftsDir)) {
  for (const file of readdirSync(draftsDir)) {
    if (!file.endsWith('.fml')) continue
    const txt = readFileSync(join(draftsDir, file), 'utf8')
    let n = 0
    for (const m of txt.matchAll(TIER_REF)) {
      n++
      if (tierCodes && !tierCodes.has(m[1])) fail(`${file}: tier code "${m[1]}" is not a valid suicide-risk tier`)
    }
    for (const re of [CM_TRANSLATE, CM_IMPORT]) {
      for (const m of txt.matchAll(re)) {
        const url = m[1]
        if (url.includes('/ConceptMap/') && !conceptMapUrls.has(url)) {
          fail(`${file}: references ConceptMap "${url}" which does not exist`)
        }
      }
    }
    console.log(`✓ ${file}: ${n} tier reference(s) checked`)
  }
}

if (failures) {
  console.error(`\nconcept-crosswalk drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nconcept-crosswalk drift check passed.')
