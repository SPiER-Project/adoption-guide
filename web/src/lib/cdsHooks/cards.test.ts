import { describe, it, expect } from 'vitest'
import { buildCdsCards, type BuildCdsCardsInput } from './cards'
import { TOOLS } from '../../data/catalog'
import { PATHWAY_STAGE_SYSTEM } from '../patientPathway'
import type { RiskAlert } from '../observationMappers'

// A real launchable tool from the catalog anchors the link/dedupe tests so they
// stay honest against actual paths rather than invented ones.
const launchTool = TOOLS.find((t) => t.launchActions.length > 0)!
const launchPath = launchTool.launchActions[0].path
const launchStage = launchTool.stageId

function alert(overrides: Partial<RiskAlert> = {}): RiskAlert {
  return {
    tool: 'PHQ-9',
    level: 'moderate',
    summary: 'summary',
    detail: 'detail',
    ...overrides,
  }
}

function build(overrides: Partial<BuildCdsCardsInput> = {}) {
  return buildCdsCards({
    activeStageId: launchStage,
    riskAlerts: [],
    isToolEnabled: () => false,
    recommendedNextStep: null,
    isSmartConnected: false,
    ...overrides,
  })
}

describe('buildCdsCards — level → indicator', () => {
  it('maps the highest-severity alert to the stage-card indicator', () => {
    // acute outranks moderate regardless of array order.
    const [card] = build({ riskAlerts: [alert({ level: 'moderate' }), alert({ level: 'acute' })] })
    expect(card.indicator).toBe('critical')
  })

  it('maps moderate → warning, low → info, and empty → info', () => {
    expect(build({ riskAlerts: [alert({ level: 'high' })] })[0].indicator).toBe('critical')
    expect(build({ riskAlerts: [alert({ level: 'moderate' })] })[0].indicator).toBe('warning')
    expect(build({ riskAlerts: [alert({ level: 'low' })] })[0].indicator).toBe('info')
    expect(build({ riskAlerts: [] })[0].indicator).toBe('info')
  })
})

describe('buildCdsCards — stage card shape', () => {
  it('carries a pathway-stage topic Coding and deterministic extension id', () => {
    const [card] = build()
    expect(card.source.topic).toEqual({
      system: PATHWAY_STAGE_SYSTEM,
      code: launchStage,
      display: expect.any(String),
    })
    expect(card.extension?.['spier-card-id']).toBe(`cds-stage-${launchStage}`)
    expect(card.extension?.['spier-stage-id']).toBe(launchStage)
  })

  it('emits absolute deep links with an in-app router path when tools are enabled', () => {
    const [card] = build({ isToolEnabled: (id) => id === launchTool.id })
    expect(card.links).toHaveLength(1)
    const link = card.links![0]
    expect(link.type).toBe('absolute')
    expect(link.url).toBe(`https://spier-project.github.io/adoption-guide/#${launchPath}`)
    expect(card.extension?.['spier-router-paths']?.[link.url]).toBe(launchPath)
  })

  it('no enabled tools → no links and no narrative-only flag', () => {
    const [card] = build()
    expect(card.links).toBeUndefined()
    expect(card.extension?.['spier-narrative-only']).toBeUndefined()
  })
})

describe('buildCdsCards — recommendedNextStep substitution', () => {
  const recommendedNextStep = {
    stageId: launchStage,
    label: 'Curated next step',
    rationale: 'Because the care team said so.',
  }

  it('substitutes only when options are empty, not SMART, and the stage matches', () => {
    const [card] = build({ recommendedNextStep })
    expect(card.summary).toBe('Curated next step')
    expect(card.detail).toBe('Because the care team said so.')
    expect(card.extension?.['spier-narrative-only']).toBe(true)
  })

  it('does not substitute under a live SMART connection', () => {
    const [card] = build({ recommendedNextStep, isSmartConnected: true })
    expect(card.summary).toBe(`Next step: ${card.source.topic!.display}`)
    expect(card.extension?.['spier-narrative-only']).toBeUndefined()
  })

  it('does not substitute when the recommendation targets a different stage', () => {
    const other = { ...recommendedNextStep, stageId: `${launchStage}-nope` }
    const [card] = build({ recommendedNextStep: other })
    expect(card.summary.startsWith('Next step:')).toBe(true)
  })

  it('does not substitute when tools are enabled for the stage', () => {
    const [card] = build({ recommendedNextStep, isToolEnabled: (id) => id === launchTool.id })
    expect(card.summary.startsWith('Next step:')).toBe(true)
    expect(card.extension?.['spier-narrative-only']).toBeUndefined()
  })
})

describe('buildCdsCards — alert cards & dedupe', () => {
  const suggestedAction = { label: 'Do the thing', path: launchPath }

  it('collapses duplicate suggestedAction paths to a single alert card', () => {
    const cards = buildCdsCards({
      activeStageId: null,
      riskAlerts: [
        alert({ tool: 'A', level: 'high', suggestedAction }),
        alert({ tool: 'B', level: 'moderate', suggestedAction }),
      ],
      isToolEnabled: (id) => id === launchTool.id,
      recommendedNextStep: null,
      isSmartConnected: false,
    })
    expect(cards).toHaveLength(1)
    expect(cards[0].extension?.['spier-card-id']).toBe('cds-alert-A')
    expect(cards[0].indicator).toBe('critical')
  })

  it('suppresses an alert card whose path is already a stage-card link', () => {
    const cards = buildCdsCards({
      activeStageId: launchStage,
      riskAlerts: [alert({ tool: 'A', level: 'high', suggestedAction })],
      isToolEnabled: (id) => id === launchTool.id,
      recommendedNextStep: null,
      isSmartConnected: false,
    })
    expect(cards.filter((c) => c.extension?.['spier-card-id']?.startsWith('cds-alert-'))).toHaveLength(0)
  })

  it('skips alerts with no suggestedAction or level none', () => {
    const cards = buildCdsCards({
      activeStageId: null,
      riskAlerts: [alert({ level: 'none', suggestedAction }), alert({ level: 'high' })],
      isToolEnabled: () => true,
      recommendedNextStep: null,
      isSmartConnected: false,
    })
    expect(cards).toHaveLength(0)
  })
})

describe('buildCdsCards — summary length', () => {
  it('truncates summaries to the CDS Hooks 140-char cap', () => {
    const longLabel = 'x'.repeat(200)
    const [card] = build({
      recommendedNextStep: { stageId: launchStage, label: longLabel, rationale: 'r' },
    })
    expect(card.summary.length).toBeLessThanOrEqual(140)
    expect(card.summary.endsWith('…')).toBe(true)
  })
})
