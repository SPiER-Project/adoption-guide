import { describe, it, expect } from 'vitest'
import {
  DRIVER_RESOLVED_NOTE,
  camsDispositionResolved,
  isCamsDriver,
  resolveCamsDrivers,
} from '@spier/core/lib/camsDriverResolution'
import { deriveFromResponse } from '@spier/core/lib/deriveFromResponse'
import type { ConditionResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'
import SECTION_B from '@spier/fhir-artifacts/generated/QuestionnaireResponse-ExampleCAMSSectionBResponse.json'
import DISPOSITION from '@spier/fhir-artifacts/generated/QuestionnaireResponse-ExampleCAMSOutcomeDispositionResponse.json'

/**
 * Built by the REAL mappers from the IG's two example responses — the drivers
 * Section B writes and the disposition the final session records — so the rule
 * is tested against what the app actually produces.
 *
 * ⚠️ The rule itself is not clinically reviewed; see
 * docs/decisions/cams-driver-resolution.md. These tests hold what it DOES.
 */
const drivers = deriveFromResponse({ ...SECTION_B, id: 'b' } as QuestionnaireResponseResource)!.conditions

function dispositionWith(code: string) {
  const qr = JSON.parse(JSON.stringify(DISPOSITION)) as QuestionnaireResponseResource
  const walk = (items: NonNullable<QuestionnaireResponseResource['item']>) => {
    for (const item of items) {
      if (item.linkId === 'disposition' && item.answer?.[0]?.valueCoding) item.answer[0].valueCoding.code = code
      walk(item.item ?? [])
    }
  }
  walk(qr.item ?? [])
  return deriveFromResponse({ ...qr, id: 'd' })!.observations
}

const statusOf = (c: ConditionResource) =>
  (c as { clinicalStatus?: { coding?: { code?: string }[] } }).clinicalStatus?.coding?.[0]?.code

describe('the disposition that resolves drivers', () => {
  it('is `resolved`, and only `resolved`', () => {
    expect(camsDispositionResolved(dispositionWith('resolved'))).toBe(true)
    for (const other of ['continue-cams', 'refer-adjunctive', 'higher-level-care']) {
      expect(camsDispositionResolved(dispositionWith(other)), other).toBe(false)
    }
  })
})

describe('resolveCamsDrivers', () => {
  const at = '2026-07-15T16:00:00Z'

  it('resolves every active driver, dated at the disposition, with a note saying it is unreviewed', () => {
    expect(drivers.length).toBeGreaterThan(0)
    const resolved = resolveCamsDrivers(drivers, at)
    expect(resolved).toHaveLength(drivers.length)
    for (const r of resolved) {
      expect(statusOf(r)).toBe('resolved')
      expect((r as { abatementDateTime?: string }).abatementDateTime).toBe(at)
      const notes = (r as { note?: { text: string }[] }).note ?? []
      expect(notes.at(-1)?.text).toBe(DRIVER_RESOLVED_NOTE)
      // The driver's own note stays first — it is the one the record page shows.
      expect(notes.length).toBeGreaterThan(1)
    }
    // Same resources, updated in place: the id is what the save uses to update
    // rather than create.
    expect(resolved.map(r => r.id)).toEqual(drivers.map(d => d.id))
  })

  it('leaves alone a driver already resolved, and any problem that is not a driver', () => {
    const [first] = resolveCamsDrivers(drivers, at)
    const otherProblem: ConditionResource = {
      resourceType: 'Condition',
      id: 'depression',
      clinicalStatus: { coding: [{ code: 'active' }] },
      category: [{ coding: [{ code: 'problem-list-item' }] }],
    }
    expect(isCamsDriver(otherProblem)).toBe(false)
    expect(resolveCamsDrivers([first, otherProblem], at)).toEqual([])
  })
})
