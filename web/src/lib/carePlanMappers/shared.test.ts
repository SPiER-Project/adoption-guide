import { describe, it, expect } from 'vitest'
import {
  extractAnswers,
  extractAnswer,
  extractPairs,
  makeSuicidePreventionCarePlan,
} from './shared'
import type { QuestionnaireResponseItem } from '../../types/fhir'

// These extraction helpers power all three CarePlan mappers (stanleyBrown,
// camsStabilization, camsTherapeutic). The per-tool tests cover the common
// cases; this file pins the recursion/edge behavior directly so a change to
// the walking logic can't silently alter every mapper's output at once.

describe('extractAnswers (collect every valueString for a linkId)', () => {
  it('collects all valueString answers under a linkId', () => {
    const items: QuestionnaireResponseItem[] = [
      { linkId: 'list', answer: [{ valueString: 'a' }, { valueString: 'b' }] },
    ]
    expect(extractAnswers(items, 'list')).toEqual(['a', 'b'])
  })

  it('walks nested item and answer.item arrays', () => {
    const items: QuestionnaireResponseItem[] = [
      {
        linkId: 'group',
        item: [{ linkId: 'list', answer: [{ valueString: 'nested' }] }],
      },
      {
        linkId: 'list',
        answer: [{ valueString: 'top', item: [{ linkId: 'list', answer: [{ valueString: 'in-answer' }] }] }],
      },
    ]
    expect(extractAnswers(items, 'list')).toEqual(['nested', 'top', 'in-answer'])
  })

  it('drops empty/falsy strings', () => {
    const items: QuestionnaireResponseItem[] = [
      { linkId: 'list', answer: [{ valueString: 'kept' }, { valueString: '' }] },
    ]
    expect(extractAnswers(items, 'list')).toEqual(['kept'])
  })

  it('returns [] when the linkId is absent', () => {
    expect(extractAnswers([{ linkId: 'other' }], 'list')).toEqual([])
  })
})

describe('extractAnswer (single value for a linkId)', () => {
  it('returns the first valueString', () => {
    expect(extractAnswer([{ linkId: 'x', answer: [{ valueString: 'hello' }] }], 'x')).toBe('hello')
  })

  it('falls back to valueText when valueString is absent', () => {
    expect(extractAnswer([{ linkId: 'x', answer: [{ valueText: 'from-text' }] }], 'x')).toBe('from-text')
  })

  it('recurses into nested items', () => {
    const items: QuestionnaireResponseItem[] = [
      { linkId: 'group', item: [{ linkId: 'x', answer: [{ valueString: 'deep' }] }] },
    ]
    expect(extractAnswer(items, 'x')).toBe('deep')
  })

  it('returns "" when the linkId is absent or has no answer', () => {
    expect(extractAnswer([{ linkId: 'other' }], 'x')).toBe('')
    expect(extractAnswer([{ linkId: 'x' }], 'x')).toBe('')
  })
})

describe('extractPairs (fieldA/fieldB under a repeating group)', () => {
  function group(pairs: Array<[string, string]>): QuestionnaireResponseItem {
    return {
      linkId: 'g',
      answer: pairs.map(([a, b]) => ({
        item: [
          ...(a ? [{ linkId: 'fa', answer: [{ valueString: a }] }] : []),
          ...(b ? [{ linkId: 'fb', answer: [{ valueString: b }] }] : []),
        ],
      })),
    }
  }

  it('extracts complete pairs', () => {
    expect(extractPairs([group([['barrier', 'solution']])], 'g', 'fa', 'fb')).toEqual([
      { a: 'barrier', b: 'solution' },
    ])
  })

  it('keeps a pair when only fieldA is present (b defaults to "")', () => {
    expect(extractPairs([group([['barrier', '']])], 'g', 'fa', 'fb')).toEqual([{ a: 'barrier', b: '' }])
  })

  it('keeps a pair when only fieldB is present (a defaults to "")', () => {
    expect(extractPairs([group([['', 'solution']])], 'g', 'fa', 'fb')).toEqual([{ a: '', b: 'solution' }])
  })

  it('skips an answer where neither field is present', () => {
    const emptyGroup: QuestionnaireResponseItem = { linkId: 'g', answer: [{ item: [] }] }
    expect(extractPairs([emptyGroup], 'g', 'fa', 'fb')).toEqual([])
  })

  it('returns [] when the group linkId is absent', () => {
    expect(extractPairs([{ linkId: 'other' }], 'g', 'fa', 'fb')).toEqual([])
  })
})

describe('makeSuicidePreventionCarePlan (shell factory)', () => {
  const profileUrl = 'http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan' as const

  function build(hasAnyData: boolean) {
    return makeSuicidePreventionCarePlan({
      id: 'cp-1',
      profileUrl,
      noteText: 'DEMO note',
      hasAnyData,
      activities: [
        { stepTitle: 'Coded Step', loincCode: '76694-1', description: 'coded desc' },
        { stepTitle: 'Text-only Step', description: 'text desc' },
      ],
    })
  }

  it('stamps the FHIR CarePlan shell with profile and suicide-prevention category', () => {
    const { resource } = build(true)
    expect(resource.resourceType).toBe('CarePlan')
    expect(resource.id).toBe('cp-1')
    expect(resource.status).toBe('active')
    expect(resource.intent).toBe('plan')
    expect((resource.meta as { profile?: string[] }).profile).toContain(profileUrl)
    const category = resource.category as Array<{ coding?: Array<{ system?: string; code?: string }> }>
    expect(category[0].coding?.[0]?.system).toBe('http://snomed.info/sct')
    expect(category[0].coding?.[0]?.code).toBe('735324008')
    expect((resource.note as Array<{ text?: string }> | undefined)?.[0]?.text).toBe('DEMO note')
  })

  it('maps a loincCode activity to detail.code.coding and a text-only activity to detail.code.text', () => {
    const { resource } = build(true)
    const activity = resource.activity as Array<{
      detail?: { code?: { coding?: Array<{ system?: string; code?: string }>; text?: string }; description?: string; status?: string }
    }>
    // Coded activity → LOINC coding + text label
    expect(activity[0].detail?.code?.coding?.[0]?.system).toBe('http://loinc.org')
    expect(activity[0].detail?.code?.coding?.[0]?.code).toBe('76694-1')
    expect(activity[0].detail?.code?.text).toBe('Coded Step')
    expect(activity[0].detail?.description).toBe('coded desc')
    expect(activity[0].detail?.status).toBe('in-progress')
    // Text-only activity → no coding, just text
    expect(activity[1].detail?.code?.coding).toBeUndefined()
    expect(activity[1].detail?.code?.text).toBe('Text-only Step')
  })

  it('echoes the input activities and derives isEmpty from hasAnyData', () => {
    expect(build(true).isEmpty).toBe(false)
    expect(build(false).isEmpty).toBe(true)
    expect(build(true).activities).toHaveLength(2)
  })
})
