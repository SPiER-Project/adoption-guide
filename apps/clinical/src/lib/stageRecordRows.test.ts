/**
 * The collapsed stage's readout: instrument, outcome, date.
 *
 * ⚠️ **The date is the point of the change, not decoration.** The row this
 * replaced printed scores with no date at all — `PHQ-9 total: 9 · PHQ-9 item
 * 9: 1` — so a screen from eighteen months ago and one from this morning read
 * identically on a collapsed stage. Every case below asserts all three columns
 * for that reason.
 */
import { describe, it, expect } from 'vitest'
import { stageRecordRows } from './chartDisplay'
import type { ArtifactBuckets } from './chartDisplay'

const empty: ArtifactBuckets = {
  responses: [],
  carePlans: [],
  observations: [],
  communications: [],
  workflowArtifacts: [],
}

function buckets(over: Partial<ArtifactBuckets>): ArtifactBuckets {
  return { ...empty, ...over }
}

describe('stageRecordRows', () => {
  it('reads a scored Observation as instrument, score and clinical date', () => {
    const rows = stageRecordRows(
      buckets({
        observations: [
          {
            resourceType: 'Observation',
            code: { coding: [{ code: '44261-6', display: 'PHQ-9 total score' }] },
            valueInteger: 24,
            effectiveDateTime: '2026-09-09T10:00:00Z',
          },
        ],
      }),
    )
    expect(rows).toHaveLength(1)
    // "PHQ-9 total" is the score's name; the column is the INSTRUMENT's.
    expect(rows[0]?.tool).toBe('PHQ-9')
    expect(rows[0]?.outcome).toBe('24')
    expect(rows[0]?.when).toBe(new Date('2026-09-09T10:00:00Z').toLocaleDateString())
  })

  it('names a coded result in the harmonized tier vocabulary, beside the score', () => {
    // The whole point of the concept layer: one set of words across instruments.
    const rows = stageRecordRows(
      buckets({
        observations: [
          {
            resourceType: 'Observation',
            code: { text: 'Suicide risk level' },
            valueCodeableConcept: {
              coding: [
                {
                  system: 'http://thespierproject.org/fhir/CodeSystem/spier-suicide-risk-tier',
                  code: 'high',
                },
              ],
            },
            effectiveDateTime: '2026-09-09T10:00:00Z',
          },
        ],
      }),
    )
    expect(rows[0]?.tool).toBe('Suicide risk level')
    expect(rows[0]?.outcome).toMatch(/high/i)
  })

  it('drops an Observation with no value rather than printing an empty outcome', () => {
    const rows = stageRecordRows(
      buckets({
        observations: [{ resourceType: 'Observation', code: { text: 'Something' } }],
      }),
    )
    expect(rows).toEqual([])
  })

  // ⚠️ Stages 4–6 record acts, not measurements: a stage holding a completed
  // safety plan must not read as empty because nothing there has a number.
  it('gives an act the same three columns, with its state as the outcome', () => {
    const rows = stageRecordRows(
      buckets({
        carePlans: [
          {
            resourceType: 'CarePlan',
            title: 'Stanley-Brown Safety Plan',
            status: 'active',
            created: '2026-09-10T09:00:00Z',
          },
        ],
      }),
    )
    expect(rows).toEqual([
      {
        tool: 'Stanley-Brown Safety Plan',
        outcome: 'Active',
        when: new Date('2026-09-10T09:00:00Z').toLocaleDateString(),
      },
    ])
  })

  it('leaves the date empty rather than inventing one', () => {
    const rows = stageRecordRows(
      buckets({
        observations: [
          { resourceType: 'Observation', code: { text: 'Score' }, valueInteger: 3 },
        ],
      }),
    )
    expect(rows[0]?.when).toBe('')
  })
})
