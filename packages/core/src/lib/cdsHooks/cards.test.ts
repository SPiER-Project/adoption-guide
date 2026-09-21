import { describe, it, expect } from 'vitest'
import { buildCdsCards, type BuildCdsCardsInput } from '@spier/core/lib/cdsHooks/cards'
import type { Card } from '@spier/core/lib/cdsHooks/types'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { PATHWAY_STAGE_SYSTEM } from '@spier/core/lib/patientPathway'
import { evaluatePathway, type PathwayRecord } from '@spier/core/lib/pathwayEvaluation'
import { intentForLaunchPath, launchPathForIntent } from '@spier/core/lib/smartIntent'
import { PROBLEM_LIST_CARD_ID } from '@spier/core/lib/cdsHooks/problemListCard'
import { RISK_TIER_SYSTEM } from '@spier/core/lib/riskEpisode'
import type { ObservationResource } from '@spier/core/types/fhir'

/**
 * `expect.any(String)` is typed `any` by vitest, so using it inline makes the
 * WHOLE object literal an unchecked assignment — the other keys stop being
 * compared against the real `Card` shape. Naming the cast once keeps them.
 */
const anyString = expect.any(String) as unknown as string

const NOW = new Date('2026-09-21T12:00:00.000Z')

function recordFor(id: string): PathwayRecord {
  const s = POPULATION_SCENARIOS[id]
  if (!s) throw new Error(`no demo scenario ${id} — this test would check nothing`)
  return {
    responses: s.responses,
    observations: s.observations,
    carePlans: s.carePlans,
    communications: s.communications ?? [],
    procedures: s.procedures ?? [],
    episodes: s.episodes ?? [],
    riskAlerts: s.riskAlerts,
  }
}

function build(record: PathwayRecord, overrides: Partial<BuildCdsCardsInput> = {}): Card[] {
  return buildCdsCards({
    record,
    isToolEnabled: () => true,
    evaluation: { now: NOW },
    ...overrides,
  })
}

/** The ROUTER paths a card offers — `link.url` is the absolute app URL. */
function routerPathsOf(card: Card): string[] {
  return Object.values(card.extension?.['spier-router-paths'] ?? {}).sort()
}

const actionCards = (cards: Card[]) =>
  cards.filter(c => c.extension?.['spier-card-id'] !== PROBLEM_LIST_CARD_ID)

describe('one primary, and it is the pathway’s first unsatisfied step', () => {
  it('marks exactly one card primary, and it leads', () => {
    for (const id of Object.keys(POPULATION_SCENARIOS)) {
      const cards = build(recordFor(id))
      const primaries = cards.filter(c => c.extension?.['spier-primary'] === true)
      expect(primaries.length, `${id} has ${primaries.length} primary cards`).toBeLessThanOrEqual(1)
      if (primaries.length === 1) expect(cards[0]).toBe(primaries[0])
    }
    // …and at least one patient actually has one, or the check is vacuous.
    expect(
      Object.keys(POPULATION_SCENARIOS).some(
        id => build(recordFor(id)).some(c => c.extension?.['spier-primary'] === true),
      ),
    ).toBe(true)
  })

  it('is the obligation the evaluator picked, card for card and in order', () => {
    for (const id of Object.keys(POPULATION_SCENARIOS)) {
      const { primary, alsoDue } = evaluatePathway(recordFor(id), { now: NOW })
      const expected = [primary, ...alsoDue].filter(o => !!o).map(o => o.title)
      expect(actionCards(build(recordFor(id))).map(c => c.summary), id).toEqual(expected)
    }
  })

  it('Marcus Chen with an empty chart is told to screen, not to do a stage’s default', () => {
    const [card] = build(recordFor('patient-002'))
    expect(card.summary).toBe('Screen for suicide risk')
    expect(card.extension?.['spier-primary']).toBe(true)
    expect(routerPathsOf(card)).toEqual(['/patient/assessments/phq-9'])
  })

  it('Sarah Patel is told to assess, and nothing recommends a C-SSRS once she has one', () => {
    const before = build(recordFor('patient-003'))
    expect(before[0].summary).toBe('Assess suicide risk after a positive screen')
    expect(routerPathsOf(before[0])).toEqual(['/patient/assessments/cssrs-screener'])
  })

  it('nothing due → no action cards at all', () => {
    // patient-012: a negative ASQ. The patient does not enter the pathway.
    expect(actionCards(build(recordFor('patient-012')))).toEqual([])
  })
})

describe('card shape — what the chart, the panel and a host EHR all read', () => {
  it('titles the ACT and details the trigger, never a CodeSystem definition', () => {
    const [card] = build(recordFor('patient-003'))
    expect(card.summary).toBe('Assess suicide risk after a positive screen')
    expect(card.detail?.startsWith('PHQ-9 on Aug 11: positive screen.')).toBe(true)
  })

  it('carries a pathway-stage topic Coding and a deterministic card id', () => {
    const [card] = build(recordFor('patient-002'))
    expect(card.source.topic).toEqual({
      system: PATHWAY_STAGE_SYSTEM,
      code: 'identify-possible-risk',
      display: anyString,
    })
    expect(card.extension?.['spier-card-id']).toBe('cds-pathway-screen')
    expect(card.extension?.['spier-stage-id']).toBe('identify-possible-risk')
  })

  it('every card resolves to a stage the chart can group it under', () => {
    // PatientPathway files a card by `spier-stage-id`; one that does not
    // resolve renders above the rail instead of on the step it belongs to.
    for (const id of Object.keys(POPULATION_SCENARIOS)) {
      for (const card of build(recordFor(id))) {
        expect(card.extension?.['spier-stage-id'], `${id}/${card.summary}`).toBeTruthy()
      }
    }
  })

  it('truncates a summary to the CDS Hooks 140-char cap', () => {
    const cards = build(recordFor('patient-002'))
    for (const card of cards) expect(card.summary.length).toBeLessThanOrEqual(140)
  })

  it('maps the record’s urgency onto the card indicator', () => {
    expect(build(recordFor('patient-002'))[0].indicator).toBe('info')
    expect(build(recordFor('patient-011'))[0].indicator).toBe('critical')
  })
})

describe('a disabled tool costs the card its button, never the recommendation', () => {
  /**
   * ⚠️ **The 2026-09-02 defect, closed rather than guarded.** The old builder
   * DROPPED a card whose tool was disabled, so a site whose preset excluded the
   * pathway's instrument silently lost the recommendation — Minimum Viable
   * enables the ASQ and the pathway names the PHQ-9, so that is a real
   * configuration. What the protocol obliges is not a site setting.
   */
  it('keeps the card and its words with every tool turned off', () => {
    const on = build(recordFor('patient-003'))
    const off = build(recordFor('patient-003'), { isToolEnabled: () => false })
    expect(off.map(c => c.summary)).toEqual(on.map(c => c.summary))
    expect(off[0].links).toBeUndefined()
    expect(on[0].links?.length).toBe(1)
  })

  it('says "configure tools" for a disabled tool, and not for a standing instruction', () => {
    // The chart's empty state sends a reader to /settings, which is the right
    // thing to say about a tool that is off and the wrong thing about a step
    // with no tool at all.
    const off = build(recordFor('patient-003'), { isToolEnabled: () => false })
    expect(off[0].extension?.['spier-narrative-only']).toBeUndefined()
    const standing = build(recordFor('patient-011')).find(c =>
      c.extension?.['spier-card-id'] === 'cds-pathway-high-every-contact-question',
    )
    expect(standing?.extension?.['spier-narrative-only']).toBe(true)
  })
})

describe('link form — deep link in the app, SMART launch for a host', () => {
  const LAUNCH_URL = 'https://spier-adoption-guide.example/'

  it('emits type:"absolute" deep links with a router path by default', () => {
    const [card] = build(recordFor('patient-003'))
    const link = card.links![0]
    expect(link.type).toBe('absolute')
    expect(link.url).toBe(
      'https://spier-project.github.io/adoption-guide/#/patient/assessments/cssrs-screener',
    )
    expect(card.extension?.['spier-router-paths']?.[link.url]).toBe(
      '/patient/assessments/cssrs-screener',
    )
  })

  it('emits type:"smart" links carrying the tool in appContext when asked', () => {
    const [card] = build(recordFor('patient-003'), { smartLaunch: { launchUrl: LAUNCH_URL } })
    const link = card.links![0]
    expect(link.type).toBe('smart')
    // The URL is the app's launch_uri — the SAME for every link, which is why
    // the tool cannot be carried in it.
    expect(link.url).toBe(LAUNCH_URL)
    expect(JSON.parse(link.appContext!)).toEqual({
      intent: intentForLaunchPath('/patient/assessments/cssrs-screener'),
    })
  })

  it('never puts iss or launch in the URL — the CDS client appends those', () => {
    const [card] = build(recordFor('patient-003'), { smartLaunch: { launchUrl: LAUNCH_URL } })
    for (const link of card.links!) {
      expect(link.url).not.toContain('iss=')
      expect(link.url).not.toContain('launch=')
    }
  })

  it('drops spier-router-paths, which only the app itself can act on', () => {
    const [card] = build(recordFor('patient-003'), { smartLaunch: { launchUrl: LAUNCH_URL } })
    expect(card.extension?.['spier-router-paths']).toBeUndefined()
    expect(Object.keys(build(recordFor('patient-003'))[0].extension?.['spier-router-paths'] ?? {}).length)
      .toBeGreaterThan(0)
  })

  it('emits an intent the app can resolve back to the tool', () => {
    // The round trip is the whole contract between the card and the panel.
    const [card] = build(recordFor('patient-003'), { smartLaunch: { launchUrl: LAUNCH_URL } })
    const { intent } = JSON.parse(card.links![0].appContext!) as { intent: string }
    expect(launchPathForIntent(intent)).toBe('/patient/assessments/cssrs-screener')
  })

  it('offers ONE launch per card — a card is one act', () => {
    for (const id of Object.keys(POPULATION_SCENARIOS)) {
      for (const card of build(recordFor(id))) {
        expect((card.links ?? []).length, `${id}/${card.summary}`).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('the problem-list guidance card stays last and unlinked', () => {
  const conceptObs = (tier: string): ObservationResource => ({
    resourceType: 'Observation',
    id: `obs-${tier}`,
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
    effectiveDateTime: '2026-09-05T10:00:00.000Z',
    valueCodeableConcept: {
      coding: [{ system: RISK_TIER_SYSTEM, code: tier, display: `${tier} risk` }],
    },
  }) as unknown as ObservationResource

  it('appends it when the latest concept tier is positive', () => {
    const base = recordFor('patient-003')
    const cards = build({ ...base, observations: [...(base.observations ?? []), conceptObs('high')] })
    const guidance = cards.find(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID)
    expect(guidance).toBeDefined()
    expect(cards.at(-1)).toBe(guidance)
    expect(guidance!.links).toBeUndefined()
    expect(guidance!.extension?.['spier-primary']).toBeUndefined()
  })

  it('emits none for a negative tier, and none for a chart with no observations', () => {
    const base = recordFor('patient-003')
    const negative = build({ ...base, observations: [...(base.observations ?? []), conceptObs('no-risk')] })
    expect(negative.some(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID)).toBe(false)
    const absent = build({ responses: [] })
    expect(absent.some(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID)).toBe(false)
  })
})
