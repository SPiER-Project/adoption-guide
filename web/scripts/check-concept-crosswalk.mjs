#!/usr/bin/env node
/**
 * Anti-drift check for the cross-instrument CONCEPT LAYER.
 *
 * The concept layer maps each instrument's result onto one common
 * suicide-risk tier (http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier).
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
import { reportFloors } from '../../scripts/lib/floors.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..') // repo root
const genDir = join(root, 'ig/fsh-generated/resources')
const draftsDir = join(root, 'ig/drafts')

const TIER_URL = 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier'

// Disposition CodeSystem url -> the TS mapper(s) that produce those codes (check F).
// A code must appear in at least one of the listed (existing) mapper files.
/**
 * ConceptMap sources with NO runtime producer, and why each is acceptable.
 *
 * ⚠️ **An unlisted source used to skip check F in total silence** — not via the
 * `note:` path below, which only fires for a *listed* file that is missing. A
 * source absent from `MAPPER_FOR_SOURCE` missed the `if (mapperRels)` guard
 * entirely and produced no output at all, so the one map whose every row is a
 * lossy widening was the one nothing checked. That is the #232 / #261 family:
 * a gate reporting green over something it never looked at.
 *
 * So an unlisted source is now a FAILURE unless it appears here with a reason.
 * An entry is a known gap, not an exemption from thinking about it.
 */
const NO_MAPPER_REASON = {
  'http://thespierproject.org/fhir/CodeSystem/cams-ssf-overall-risk':
    'Published crosswalk with no runtime producer (#436): the CAMS mappers emit the SSF-5 ' +
    'overall-risk rating as Observation.valueInteger with an H/N/L interpretation, never as a ' +
    'cams-ssf-overall-risk coding — so no code in this map is emitted by SPiER today.',
  'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier':
    'Egress map (tier → LOINC), so its source is the concept layer itself rather than an ' +
    'instrument disposition. Produced by whichever instrument route reached the tier, which ' +
    'checks A–C already cover from the other direction.',
}

const MAPPER_FOR_SOURCE = {
  'http://thespierproject.org/fhir/CodeSystem/asq-screening-result': ['packages/core/src/lib/observationMappers/asq.ts'],
  'http://thespierproject.org/fhir/CodeSystem/bssa-disposition': ['packages/core/src/lib/observationMappers/bssa.ts'],
  'http://thespierproject.org/fhir/CodeSystem/pss3-result': ['packages/core/src/lib/observationMappers/pss3.ts'],
  'http://thespierproject.org/fhir/CodeSystem/cssrs-risk-level': [
    'packages/core/src/lib/observationMappers/cssrsScreener.ts',
    'packages/core/src/lib/observationMappers/cssrsFull.ts',
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

    // F: mapper coverage (best-effort) — code must appear in >=1 existing mapper
    const mapperRels = MAPPER_FOR_SOURCE[group.source]
    if (!mapperRels) {
      // Silence here is what hid #436. Either the source has a producer worth
      // checking, or it has a written reason why it does not.
      const reason = NO_MAPPER_REASON[group.source]
      if (reason) {
        console.log(`  note: ${group.source.split('/').pop()} has no runtime producer — ${reason}`)
      } else {
        fail(
          `${id}: ConceptMap source ${group.source} has no MAPPER_FOR_SOURCE entry and no ` +
          `NO_MAPPER_REASON entry — check F would skip it silently. Add the mapper file(s) it ` +
          `is produced by, or record why nothing produces it.`,
        )
      }
    }
    if (mapperRels) {
      const present = mapperRels
        .map((rel) => ({ rel, path: join(root, rel) }))
        .filter(({ path }) => existsSync(path))
        .map(({ rel, path }) => ({ rel, txt: readFileSync(path, 'utf8') }))
      if (present.length === 0) {
        // ⚠️ **This was a `note:` and a skip until #500, and that was the second
        // half of the same hole.** The header above records the FIRST half — an
        // *unlisted* source skipping check F in silence — and fixed it. A listed
        // source whose every mapper file is MISSING took this branch instead and
        // still reported green, so moving the mapper directory (as step E did,
        // `web/src/lib` → `packages/core/src/lib`) would have disabled check F
        // for every source at once while the gate printed "passed".
        //
        // Proved rather than assumed: with the directory moved away, the gate
        // went from 0 skips to 4 and still exited 0. It now exits 1.
        //
        // Partial absence is still tolerated — the cssrs source lists two files
        // and only one need exist — because the coverage question is "does some
        // producer carry this code", not "do all listed producers".
        fail(
          `${id}: every mapper file listed for ${group.source} is missing ` +
          `(${mapperRels.join(', ')}) — check F would skip silently. Either the ` +
          `paths are stale (did the mappers move?) or MAPPER_FOR_SOURCE is wrong.`,
        )
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

// #500 made an all-missing mapper list a failure. This is the other half: the
// ConceptMaps themselves are read from SUSHI's output, and a narrowed glob there
// leaves every remaining map checked and every dropped one unmentioned.
//
// ⚠️ The source is `ig/fsh-generated/resources`, NOT
// `packages/fhir-artifacts/generated`. This floor was first written with the
// latter label — the copied tree the *other* artifact gates read — and it was
// wrong: thinning that tree to one file left this gate still reporting six. A
// floor whose label names the wrong tree is worse than none, because the next
// person reads the label and not the `genDir` twenty lines up.
reportFloors([
  { source: 'ig/fsh-generated/resources', dimension: 'ConceptMap(s)', actual: conceptMaps.length, floor: 3 },
], fail)

if (failures) {
  console.error(`\nconcept-crosswalk drift check FAILED (${failures} issue(s)).`)
  process.exit(1)
}
console.log('\nconcept-crosswalk drift check passed.')
