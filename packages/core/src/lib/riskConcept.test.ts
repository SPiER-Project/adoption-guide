import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import {
  RISK_CONCEPT_PROFILE,
  isRiskConcept,
  phq9Item9Tier,
  riskConceptFor,
  sbqrTotalTier,
  tierForResult,
  withRiskConcepts,
} from './riskConcept'
import { mapResponseToObservations } from './observationMappers'
import { RISK_TIER_SYSTEM } from './riskEpisode'
import type { ObservationResource } from '../types/fhir'

const REPO = resolve(__dirname, '../../../..')
const LOINC = 'http://loinc.org'
const CS = 'http://thespierproject.org/fhir/CodeSystem'

function obs(fields: Record<string, unknown>): ObservationResource {
  return { resourceType: 'Observation', status: 'final', ...fields } as unknown as ObservationResource
}

const onRiskLoinc = (system: string, code: string, extra: Record<string, unknown> = {}) =>
  obs({
    id: 'src',
    code: { coding: [{ system: LOINC, code: '93374-7' }] },
    valueCodeableConcept: { coding: [{ system, code }] },
    subject: { reference: 'Patient/p1' },
    effectiveDateTime: '2026-09-01T10:00:00.000Z',
    ...extra,
  })

/* ─── The threshold maps, held equal to the published FML ─────── */

/**
 * The `tgt.value` rules of a published threshold map, as predicates.
 *
 * ⚠️ This evaluates the `.fml` file the IG publishes, so a cut-off changed there
 * fails here — the same contract `stanleyBrown.parity.test.ts` holds for the
 * CarePlan map. It understands only the comparison forms these two maps use and
 * THROWS on anything else, rather than skipping a rule it cannot read: a parser
 * that skips is a gate that passes while checking nothing (#232).
 */
function fmlTierRules(file: string): Array<{ tier: string; holds: (v: number) => boolean }> {
  const text = readFileSync(join(REPO, 'ig/input/resources/maps', file), 'utf8')
  const rules = [...text.matchAll(/where \(([^)]*)\) -> tgt\.value = cc\('[^']+', '([^']+)'\)/g)].map(m => {
    const clauses = m[1].split(/\s+and\s+/).map(clause => {
      const c = /^v\s*(=|<|<=|>|>=)\s*(-?\d+)$/.exec(clause.trim())
      if (!c) throw new Error(`${file}: cannot read the condition "${clause}" — teach this parser, do not skip it`)
      const n = Number(c[2])
      return ({
        '=': (v: number) => v === n,
        '<': (v: number) => v < n,
        '<=': (v: number) => v <= n,
        '>': (v: number) => v > n,
        '>=': (v: number) => v >= n,
      } as Record<string, (v: number) => boolean>)[c[1]]
    })
    return { tier: m[2], holds: (v: number) => clauses.every(f => f(v)) }
  })
  if (rules.length === 0) throw new Error(`${file}: no tier rules read — this test would check nothing`)
  return rules
}

function fmlTier(rules: ReturnType<typeof fmlTierRules>, v: number): string | undefined {
  const hits = rules.filter(r => r.holds(v))
  if (hits.length > 1) throw new Error(`the map assigns ${v} to ${hits.length} tiers`)
  return hits[0]?.tier
}

describe('the threshold maps — the same answer as the published FML, for every score', () => {
  it('PHQ-9 item 9 matches PHQ9Item9ToSuicideRiskConcept.fml', () => {
    const rules = fmlTierRules('PHQ9Item9ToSuicideRiskConcept.fml')
    expect(rules.length).toBe(4)
    // Past both ends, so "the map assigns nothing" is compared too.
    for (let v = -1; v <= 5; v++) expect(phq9Item9Tier(v), `item 9 = ${v}`).toBe(fmlTier(rules, v))
  })

  it('SBQ-R total matches SBQRTotalScoreToSuicideRiskConcept.fml', () => {
    const rules = fmlTierRules('SBQRTotalScoreToSuicideRiskConcept.fml')
    expect(rules.length).toBe(3)
    for (let v = 0; v <= 20; v++) expect(sbqrTotalTier(v), `total = ${v}`).toBe(fmlTier(rules, v))
  })
})

/* ─── The crosswalked results, every published row ───────────── */

describe('a crosswalked result derives the tier its published ConceptMap states', () => {
  const dir = join(REPO, 'packages/fhir-artifacts/generated')
  const rows = readdirSync(dir)
    .filter(f => /^ConceptMap-.*\.json$/.test(f))
    .flatMap(f => {
      const map = JSON.parse(readFileSync(join(dir, f), 'utf8')) as {
        group?: Array<{ source?: string; target?: string; element?: Array<{ code?: string; target?: Array<{ code?: string }> }> }>
      }
      return (map.group ?? [])
        .filter(g => g.target === RISK_TIER_SYSTEM && g.source)
        .flatMap(g => (g.element ?? []).map(e => ({ system: g.source!, code: e.code!, tier: e.target?.[0]?.code })))
    })

  it('reads real maps', () => {
    expect(rows.length).toBeGreaterThanOrEqual(15)
  })

  it('for every row', () => {
    for (const row of rows) {
      const concept = riskConceptFor(onRiskLoinc(row.system, row.code))
      expect(concept?.valueCodeableConcept?.coding?.[0], `${row.system}|${row.code}`).toMatchObject({
        system: RISK_TIER_SYSTEM,
        code: row.tier,
      })
    }
  })

  it('passes a result already coded in the tier vocabulary straight through (SAFE-T, PSS-Full)', () => {
    const safet = onRiskLoinc(RISK_TIER_SYSTEM, 'high', {
      meta: { profile: ['http://thespierproject.org/fhir/StructureDefinition/spier-safet-risk-level'] },
    })
    expect(riskConceptFor(safet)?.valueCodeableConcept?.coding?.[0]?.code).toBe('high')
  })

  it('derives nothing from a result no map covers', () => {
    expect(riskConceptFor(onRiskLoinc(`${CS}/not-a-crosswalked-system`, 'x'))).toBeNull()
    expect(riskConceptFor(obs({ id: 'src', code: { coding: [{ system: LOINC, code: '44261-6' }] }, valueInteger: 20 }))).toBeNull()
  })
})

/* ─── The shape the profile requires ─────────────────────────── */

describe('the concept Observation', () => {
  const source = onRiskLoinc(`${CS}/cssrs-risk-level`, 'moderate', {
    id: 'cssrs-risk',
    encounter: { reference: 'Encounter/e1' },
    meta: { tag: [{ system: `${CS}/spier-pathway-stage`, code: 'clarify-risk' }, { system: 'urn:other', code: 'x' }] },
  })
  const concept = riskConceptFor(source)!

  it('carries everything SPiERSuicideRiskConcept makes required', () => {
    expect(concept.meta?.profile).toEqual([RISK_CONCEPT_PROFILE])
    expect(concept.status).toBe('final')
    expect(concept.code?.coding?.[0]).toMatchObject({ system: LOINC, code: '93374-7' })
    expect((concept as { subject?: unknown }).subject).toEqual({ reference: 'Patient/p1' })
    expect(concept.effectiveDateTime).toBe('2026-09-01T10:00:00.000Z')
    expect(concept.derivedFrom).toEqual([{ reference: 'Observation/cssrs-risk' }])
    const category = (concept as { category?: Array<{ coding?: Array<{ code?: string }> }> }).category
    expect(category?.map(c => c.coding?.[0]?.code)).toEqual(['survey', 'suicide-risk'])
    expect(concept.interpretation?.[0]?.coding?.[0]).toMatchObject({ code: 'POS', display: 'Positive' })
  })

  it('reads NEG for no-risk, as every published map writes it', () => {
    const negative = riskConceptFor(onRiskLoinc(`${CS}/cssrs-risk-level`, 'none'))!
    expect(negative.valueCodeableConcept?.coding?.[0]?.code).toBe('no-risk')
    expect(negative.interpretation?.[0]?.coding?.[0]).toMatchObject({ code: 'NEG', display: 'Negative' })
  })

  it('carries the stage tag and the encounter, and nothing else from meta', () => {
    expect(concept.meta?.tag).toEqual([{ system: `${CS}/spier-pathway-stage`, code: 'clarify-risk' }])
    expect((concept as { encounter?: unknown }).encounter).toEqual({ reference: 'Encounter/e1' })
  })

  it('is never derived from a concept — including an unprofiled tier-coded one', () => {
    expect(riskConceptFor(concept)).toBeNull()
    expect(tierForResult(onRiskLoinc(RISK_TIER_SYSTEM, 'low'))).toBeUndefined()
  })
})

describe('isRiskConcept — the profile claim, or an unprofiled tier on 93374-7', () => {
  it('accepts the profile claim and the unprofiled tier', () => {
    expect(isRiskConcept(riskConceptFor(onRiskLoinc(`${CS}/cssrs-risk-level`, 'low'))!)).toBe(true)
    expect(isRiskConcept(onRiskLoinc(RISK_TIER_SYSTEM, 'low'))).toBe(true)
  })

  it('rejects an instrument-native result, and a tier-coded result that claims another profile', () => {
    expect(isRiskConcept(onRiskLoinc(`${CS}/cssrs-risk-level`, 'low'))).toBe(false)
    expect(
      isRiskConcept(
        onRiskLoinc(RISK_TIER_SYSTEM, 'low', {
          meta: { profile: ['http://thespierproject.org/fhir/StructureDefinition/spier-safet-risk-level'] },
        }),
      ),
    ).toBe(false)
  })
})

describe('withRiskConcepts', () => {
  const source = onRiskLoinc(`${CS}/cssrs-risk-level`, 'high', { id: 's1' })

  it('places each concept right after its source', () => {
    const out = withRiskConcepts([source])
    expect(out.map(o => o.id)).toEqual(['s1', 's1-concept'])
  })

  it('is idempotent, and recognizes an existing concept by derivedFrom rather than id', () => {
    const once = withRiskConcepts([source])
    expect(withRiskConcepts(once)).toEqual(once)
    // As read back from a server: the concept has the server's id.
    const fromServer = [source, { ...once[1], id: 'server-assigned-17' }]
    expect(withRiskConcepts(fromServer)).toEqual(fromServer)
  })
})

/* ─── Every path that emits a result emits its concept ───────── */

describe('the dispatch every consumer calls', () => {
  it('returns each tiered result with its concept', () => {
    const qr = POPULATION_SCENARIOS['patient-011'].responses.find(r => r.id === 'p011-cssrs-full')
    expect(qr).toBeDefined()
    const result = mapResponseToObservations(qr!.resource)!
    const tiered = result.observations.filter(o => tierForResult(o) !== undefined)
    expect(tiered.length).toBeGreaterThan(0)
    for (const t of tiered) {
      expect(result.observations.some(o => isRiskConcept(o) && o.derivedFrom?.[0]?.reference === `Observation/${t.id}`)).toBe(true)
    }
  })
})

describe('the demo fixtures carry the concepts SPiER would have written', () => {
  // The scenarios stand for charts SPiER wrote, so every result in them that a
  // published map covers carries its concept — added by running `riskConceptFor`
  // over them, and held equal to it here so a changed map or builder fails
  // rather than leaving the fixtures describing an older derivation.
  it('for every scenario, every derivable result has exactly the derived concept beside it', () => {
    let checked = 0
    for (const [id, scenario] of Object.entries(POPULATION_SCENARIOS)) {
      for (const o of scenario.observations) {
        const expected = riskConceptFor(o)
        if (!expected) continue
        checked++
        expect(scenario.observations, `${id}: ${o.id}`).toContainEqual(expected)
      }
    }
    expect(checked).toBeGreaterThanOrEqual(12)
  })
})
