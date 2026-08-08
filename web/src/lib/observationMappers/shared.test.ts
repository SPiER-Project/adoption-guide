import { describe, it, expect } from 'vitest'
import {
  walkItems,
  getCodingAnswer,
  getBooleanAnswer,
  getYesNoBoolean,
  highestRiskLevel,
  makeObservation,
  interpretationOf,
  RISK_LEVEL_ORDER,
  type RiskAlert,
} from './shared'
import type { QuestionnaireResponseItem } from '../../types/fhir'

// These primitives sit underneath every per-tool observation mapper (phq9,
// asq, cssrs*, cams*, sbqr). The per-tool tests exercise them transitively;
// this file pins their edge cases directly so a regression here surfaces as a
// failure in one obvious place rather than as a confusing break across every
// mapper at once.

function alert(level: RiskAlert['level']): RiskAlert {
  return { tool: 'T', level, summary: 's', detail: 'd' }
}

// ObservationResource carries status/category/subject/note through its
// FhirResource index signature (typed `unknown`). This narrows them for
// assertions without weakening the production type.
type ObsView = {
  category?: Array<{ coding?: Array<{ code?: string }> }>
  subject?: { reference?: string }
  note?: Array<{ text?: string }>
}
const view = (o: unknown): ObsView => o as ObsView

describe('walkItems', () => {
  it('finds a top-level item by linkId', () => {
    const items: QuestionnaireResponseItem[] = [{ linkId: 'a' }, { linkId: 'b' }]
    expect(walkItems(items, 'b')?.linkId).toBe('b')
  })

  it('recurses into nested item arrays', () => {
    const items: QuestionnaireResponseItem[] = [
      { linkId: 'group', item: [{ linkId: 'deep', item: [{ linkId: 'target' }] }] },
    ]
    expect(walkItems(items, 'target')?.linkId).toBe('target')
  })

  it('recurses into answer.item nodes (repeating-group structures)', () => {
    const items: QuestionnaireResponseItem[] = [
      { linkId: 'g', answer: [{ item: [{ linkId: 'nested-in-answer' }] }] },
    ]
    expect(walkItems(items, 'nested-in-answer')?.linkId).toBe('nested-in-answer')
  })

  it('returns undefined when the linkId is absent', () => {
    expect(walkItems([{ linkId: 'a' }], 'missing')).toBeUndefined()
  })

  it('returns the first match when the linkId repeats', () => {
    const items: QuestionnaireResponseItem[] = [
      { linkId: 'dup', answer: [{ valueString: 'first' }] },
      { linkId: 'dup', answer: [{ valueString: 'second' }] },
    ]
    expect(walkItems(items, 'dup')?.answer?.[0]?.valueString).toBe('first')
  })
})

describe('getCodingAnswer / getBooleanAnswer', () => {
  it('reads the first answer.valueCoding', () => {
    // Synthetic code on an example system, not `http://loinc.org#LA1` — this test
    // exercises answer traversal, not terminology, and a fixture that claims LOINC
    // for a code LOINC does not publish is how a fabricated code starts to look
    // legitimate. See issue #220.
    const item: QuestionnaireResponseItem = {
      linkId: 'x',
      answer: [{ valueCoding: { system: 'http://example.org/test-codes', code: 'LA1' } }],
    }
    expect(getCodingAnswer(item)?.code).toBe('LA1')
  })

  it('reads the first answer.valueBoolean, including false', () => {
    expect(getBooleanAnswer({ linkId: 'x', answer: [{ valueBoolean: false }] })).toBe(false)
    expect(getBooleanAnswer({ linkId: 'x', answer: [{ valueBoolean: true }] })).toBe(true)
  })

  it('returns undefined for a missing item or missing answer', () => {
    expect(getCodingAnswer(undefined)).toBeUndefined()
    expect(getBooleanAnswer(undefined)).toBeUndefined()
    expect(getCodingAnswer({ linkId: 'x' })).toBeUndefined()
  })
})

describe('getYesNoBoolean (SNOMED Yes/No → boolean)', () => {
  const yes = (code: string, system = 'http://snomed.info/sct'): QuestionnaireResponseItem => ({
    linkId: 'x',
    answer: [{ valueCoding: { system, code } }],
  })

  it('maps SNOMED 373066001 → true', () => {
    expect(getYesNoBoolean(yes('373066001'))).toBe(true)
  })

  it('maps SNOMED 373067005 → false', () => {
    expect(getYesNoBoolean(yes('373067005'))).toBe(false)
  })

  it('returns undefined for an unknown SNOMED code', () => {
    expect(getYesNoBoolean(yes('99999999'))).toBeUndefined()
  })

  it('returns undefined when the coding is not SNOMED', () => {
    expect(getYesNoBoolean(yes('373066001', 'http://loinc.org'))).toBeUndefined()
  })

  it('returns undefined when there is no coding at all', () => {
    expect(getYesNoBoolean({ linkId: 'x' })).toBeUndefined()
    expect(getYesNoBoolean(undefined)).toBeUndefined()
  })
})

describe('highestRiskLevel', () => {
  it('returns "none" for an empty set', () => {
    expect(highestRiskLevel([])).toBe('none')
  })

  it('returns the single level when only one alert is present', () => {
    expect(highestRiskLevel([alert('low')])).toBe('low')
  })

  it('picks the most severe level regardless of order', () => {
    expect(highestRiskLevel([alert('low'), alert('acute'), alert('moderate')])).toBe('acute')
    expect(highestRiskLevel([alert('none'), alert('high'), alert('low')])).toBe('high')
  })

  it('orders severity acute > high > moderate > low > none', () => {
    // Lower number = more severe; this ordering is what the UI ranks on.
    expect(RISK_LEVEL_ORDER.acute).toBeLessThan(RISK_LEVEL_ORDER.high)
    expect(RISK_LEVEL_ORDER.high).toBeLessThan(RISK_LEVEL_ORDER.moderate)
    expect(RISK_LEVEL_ORDER.moderate).toBeLessThan(RISK_LEVEL_ORDER.low)
    expect(RISK_LEVEL_ORDER.low).toBeLessThan(RISK_LEVEL_ORDER.none)
  })
})

describe('makeObservation', () => {
  const baseCode = { system: 'http://loinc.org', code: '44261-6', display: 'Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]' }

  it('stamps a uniform survey Observation shell', () => {
    const obs = makeObservation({
      id: 'obs-1',
      code: baseCode,
      value: 6,
      valueType: 'integer',
      questionnaireName: 'PHQ-9',
    })
    expect(obs.resourceType).toBe('Observation')
    expect(obs.id).toBe('obs-1')
    expect(obs.status).toBe('final')
    expect(view(obs).category?.[0]?.coding?.[0]?.code).toBe('survey')
    expect(obs.code?.coding?.[0]).toEqual(baseCode)
    expect(obs.code?.text).toBe('Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]')
    expect(view(obs).subject?.reference).toBe('Patient/demo-patient')
    expect(obs.effectiveDateTime).toBeDefined()
  })

  it('routes each valueType to the matching Observation.value[x] field', () => {
    expect(
      makeObservation({ id: 'i', code: baseCode, value: 6, valueType: 'integer', questionnaireName: 'Q' }).valueInteger,
    ).toBe(6)
    expect(
      makeObservation({ id: 'b', code: baseCode, value: true, valueType: 'boolean', questionnaireName: 'Q' }).valueBoolean,
    ).toBe(true)
    expect(
      makeObservation({ id: 's', code: baseCode, value: 'txt', valueType: 'string', questionnaireName: 'Q' }).valueString,
    ).toBe('txt')
    const cc = { text: 'Positive' }
    expect(
      makeObservation({ id: 'c', code: baseCode, value: cc, valueType: 'codeable', questionnaireName: 'Q' })
        .valueCodeableConcept,
    ).toEqual(cc)
  })

  it('uses the default DEMO note when none is supplied, and a custom note when it is', () => {
    const dflt = makeObservation({ id: 'i', code: baseCode, value: 1, valueType: 'integer', questionnaireName: 'PHQ-9' })
    expect(view(dflt).note?.[0]?.text).toContain('DEMO ONLY')
    expect(view(dflt).note?.[0]?.text).toContain('PHQ-9')

    const custom = makeObservation({
      id: 'i',
      code: baseCode,
      value: 1,
      valueType: 'integer',
      note: 'custom note',
      questionnaireName: 'PHQ-9',
    })
    expect(view(custom).note?.[0]?.text).toBe('custom note')
  })

  it('attaches interpretation coding only when supplied', () => {
    const withInterp = makeObservation({
      id: 'i',
      code: baseCode,
      value: 1,
      valueType: 'integer',
      interpretation: { system: 'http://x', code: 'H', display: 'High' },
      questionnaireName: 'Q',
    })
    expect(withInterp.interpretation?.[0]?.coding?.[0]?.code).toBe('H')

    const withoutInterp = makeObservation({ id: 'i', code: baseCode, value: 1, valueType: 'integer', questionnaireName: 'Q' })
    expect(withoutInterp.interpretation).toBeUndefined()
  })
})

// The #236 contract. check:codings proves the five displays in
// INTERPRETATIONS are still HL7's, but it runs nightly against a terminology
// server and cannot see whether a mapper puts its own phrasing back into
// `Coding.display`. These assertions are the offline half: they pin *where* each
// string is allowed to land, which is the part a refactor is likely to undo.
describe('interpretationOf', () => {
  it('publishes HL7 display in the coding and the caller phrase in text', () => {
    const interp = interpretationOf('H', 'Moderate depression (score 12/27)')
    expect(interp.display).toBe('High')
    expect(interp.text).toBe('Moderate depression (score 12/27)')
  })

  it('keeps the summary out of Coding.display once on a built Observation', () => {
    const obs = makeObservation({
      id: 'i',
      code: { system: 'http://loinc.org', code: '44260-8', display: 'Thoughts that you would be better off dead, or of hurting yourself in some way in last 2 weeks [Reported.PHQ]' },
      value: 12,
      valueType: 'integer',
      interpretation: interpretationOf('A', 'Positive — suicide risk screening indicated'),
      questionnaireName: 'PHQ-9',
    })
    const coding = obs.interpretation?.[0]?.coding?.[0]
    expect(coding?.system).toBe('http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation')
    expect(coding?.display).toBe('Abnormal')
    // A Coding has no `text` element; the phrase belongs to the CodeableConcept.
    expect(coding).not.toHaveProperty('text')
    expect(obs.interpretation?.[0]?.text).toBe('Positive — suicide risk screening indicated')
  })

  it('carries a code-level text override into CodeableConcept.text, not the coding', () => {
    const obs = makeObservation({
      id: 'i',
      code: { system: 'http://spier.org/CodeSystem/cams-ssf', code: 'psychological-pain', display: 'Psychological Pain', text: 'CAMS SSF: Psychological Pain' },
      value: 4,
      valueType: 'integer',
      questionnaireName: 'CAMS SSF-5: Section A',
    })
    expect(obs.code?.coding?.[0]?.display).toBe('Psychological Pain')
    expect(obs.code?.coding?.[0]).not.toHaveProperty('text')
    expect(obs.code?.text).toBe('CAMS SSF: Psychological Pain')
  })
})
