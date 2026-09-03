import { describe, it, expect } from 'vitest'
import { buildCdsCards, type BuildCdsCardsInput } from '@spier/core/lib/cdsHooks/cards'
import { TOOLS } from '@spier/core/data/catalog'
import { orderByPathwayRealization } from '@spier/core/lib/pathwayRealizations'
import { PATHWAY_STAGE_SYSTEM } from '@spier/core/lib/patientPathway'
import type { RiskAlert } from '@spier/core/lib/observationMappers'
import { intentForLaunchPath, launchPathForIntent } from '@spier/core/lib/smartIntent'
import { PROBLEM_LIST_CARD_ID } from '@spier/core/lib/cdsHooks/problemListCard'
import { RISK_TIER_SYSTEM } from '@spier/core/lib/riskEpisode'

// A real launchable tool from the catalog anchors the link/dedupe tests so they
// stay honest against actual paths rather than invented ones. It has to be the
// tool that LEADS its stage card: the builder puts the pathway's demonstrated
// realization first (orderByPathwayRealization), so the first catalog tool is
// no longer the first link — for Identify Possible Risk that is the PHQ-9.
const launchTool = orderByPathwayRealization(TOOLS.filter((t) => t.launchActions.length > 0))[0]
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

describe('buildCdsCards — an alert absorbed into the stage card keeps its reason', () => {
  it('carries the alert summary + detail as the stage card detail, and emits no duplicate', () => {
    // The alert names a tool that belongs to the ACTIVE stage (the PHQ-9 → C-SSRS
    // Screener case once the screener became a Clarify Risk tool). The dedupe
    // rightly emits one link for that path; the reason the step is due must
    // not disappear with the alert card.
    const cards = build({
      isToolEnabled: () => true,
      riskAlerts: [
        alert({
          level: 'moderate',
          summary: 'PHQ-9 Item 9 positive (score: 1/3)',
          detail: 'Patient endorsed thoughts of death or self-harm.',
          suggestedAction: { label: 'Start it', path: launchPath },
        }),
      ],
    })
    expect(cards[0].detail).toBe(
      'PHQ-9 Item 9 positive (score: 1/3). Patient endorsed thoughts of death or self-harm.',
    )
    const linking = cards.filter((c) => c.links?.some((l) => l.url.endsWith(launchPath)))
    expect(linking).toHaveLength(1)
    expect(linking[0].extension?.['spier-card-id']).toBe(`cds-stage-${launchStage}`)
  })

  it('keeps the stage blurb when no alert targets this stage’s tools', () => {
    const [card] = build({
      isToolEnabled: () => true,
      riskAlerts: [alert({ level: 'high', suggestedAction: { label: 'Elsewhere', path: '/patient/assessments/stanley-and-brown' } })],
    })
    expect(card.detail).not.toContain('summary')
    expect(card.detail?.length ?? 0).toBeGreaterThan(0)
  })
})

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

  it('never marks the reporting stage urgent, whatever the alert level', () => {
    // A high-risk patient whose remaining step is "measure and share" was shown
    // an URGENT card whose action was "open the measure dashboard". Urgency
    // belongs to the alert cards, which still carry it.
    const cards = build({
      activeStageId: 'measure-and-share',
      riskAlerts: [alert({ level: 'acute' })],
    })
    expect(cards[0].extension?.['spier-stage-id']).toBe('measure-and-share')
    expect(cards[0].indicator).toBe('info')
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

describe('buildCdsCards — SMART launch links (panel step 5)', () => {
  const LAUNCH_URL = 'https://spier-adoption-guide.example/'

  it('emits type:"absolute" deep links by default', () => {
    // The in-app default. Unchanged by step 5 on purpose: the Patient Chart
    // renders these cards itself and there is no EHR to perform a launch.
    const [card] = build({ isToolEnabled: () => true })
    expect(card.links?.length).toBeGreaterThan(0)
    for (const link of card.links!) {
      expect(link.type).toBe('absolute')
      expect(link.appContext).toBeUndefined()
    }
  })

  it('emits type:"smart" links carrying the tool in appContext when asked', () => {
    const [card] = build({ isToolEnabled: () => true, smartLaunch: { launchUrl: LAUNCH_URL } })
    const link = card.links![0]
    expect(link.type).toBe('smart')
    // The URL is the app's launch_uri — the SAME for every link, which is why
    // the tool cannot be carried in it.
    expect(link.url).toBe(LAUNCH_URL)
    expect(JSON.parse(link.appContext!)).toEqual({ intent: intentForLaunchPath(launchPath) })
  })

  it('never puts iss or launch in the URL — the CDS client appends those', () => {
    // The one thing a card builder must not do: it has no authorization server
    // and no launch context, so inventing either would be a fabrication.
    const [card] = build({ isToolEnabled: () => true, smartLaunch: { launchUrl: LAUNCH_URL } })
    for (const link of card.links!) {
      expect(link.url).not.toContain('iss=')
      expect(link.url).not.toContain('launch=')
    }
  })

  it('drops spier-router-paths, which only the app itself can act on', () => {
    // A router path handed to a host EHR is an invitation to route a link it is
    // not the consumer of.
    const [card] = build({ isToolEnabled: () => true, smartLaunch: { launchUrl: LAUNCH_URL } })
    expect(card.extension?.['spier-router-paths']).toBeUndefined()
    // …and it is still there in the default form.
    const [plain] = build({ isToolEnabled: () => true })
    expect(Object.keys(plain.extension?.['spier-router-paths'] ?? {}).length).toBeGreaterThan(0)
  })

  it('applies to alert cards too, not just the stage card', () => {
    const cards = buildCdsCards({
      activeStageId: null,
      riskAlerts: [alert({ level: 'high', suggestedAction: { label: 'Launch it', path: launchPath } })],
      isToolEnabled: () => true,
      recommendedNextStep: null,
      isSmartConnected: false,
      smartLaunch: { launchUrl: LAUNCH_URL },
    })
    expect(cards).toHaveLength(1)
    expect(cards[0].links![0]).toMatchObject({ type: 'smart', url: LAUNCH_URL })
    expect(cards[0].extension?.['spier-router-paths']).toBeUndefined()
  })

  it('emits an intent the app can resolve back to the tool', () => {
    // The round trip is the whole contract between the card and the panel: the
    // host copies appContext.intent into the launch context, and SmartRedirect
    // resolves it to a route. Asserted end to end here so neither half can drift
    // alone.
    const [card] = build({ isToolEnabled: () => true, smartLaunch: { launchUrl: LAUNCH_URL } })
    const { intent } = JSON.parse(card.links![0].appContext!) as { intent: string }
    expect(launchPathForIntent(intent)).toBe(launchPath)
  })
})

describe('buildCdsCards — problem-list guidance card (pathway Phase 5)', () => {
  const conceptObs = (tier: string) => ({
    resourceType: 'Observation' as const,
    id: `obs-${tier}`,
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' }] },
    effectiveDateTime: '2026-08-05T10:00:00.000Z',
    valueCodeableConcept: {
      coding: [{ system: RISK_TIER_SYSTEM, code: tier, display: `${tier} risk` }],
    },
  })

  it('appends the guidance card when the latest concept tier is positive', () => {
    const cards = build({ observations: [conceptObs('high')] })
    const guidance = cards.find(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID)
    expect(guidance).toBeDefined()
    // Last, and carrying no link — a documentation prompt sits behind the
    // actionable cards and can never duplicate one of their destinations.
    expect(cards.at(-1)).toBe(guidance)
    expect(guidance!.links).toBeUndefined()
  })

  it('emits none for a negative tier, and none when no observations are passed', () => {
    const negative = build({ observations: [conceptObs('no-risk')] })
    expect(negative.some(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID)).toBe(false)
    const absent = build()
    expect(absent.some(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID)).toBe(false)
  })
})

describe('buildCdsCards — one link per destination', () => {
  it('does not repeat a launch path two tools share', () => {
    // TL-042 and TL-043 both launch /population/measures with the same label, so the
    // stage card carried two byte-identical links. Asserted against the real
    // catalog rather than a fixture, because the defect WAS the catalog shape:
    // a fixture would have had to reproduce the coincidence to catch it.
    const shared = new Map<string, number>()
    for (const tool of TOOLS) {
      for (const action of tool.launchActions) {
        shared.set(action.path, (shared.get(action.path) ?? 0) + 1)
      }
    }
    const duplicated = [...shared.entries()].filter(([, n]) => n > 1)
    // If this ever becomes empty the test stops proving anything — say so rather
    // than passing vacuously.
    expect(duplicated.length).toBeGreaterThan(0)

    for (const [path] of duplicated) {
      const stageId = TOOLS.find(t => t.launchActions.some(a => a.path === path))!.stageId
      const [card] = buildCdsCards({
        activeStageId: stageId,
        riskAlerts: [],
        isToolEnabled: () => true,
        recommendedNextStep: null,
        isSmartConnected: false,
      })
      const urls = (card.links ?? []).map(l => l.url)
      expect(urls.length).toBe(new Set(urls).size)
    }
  })

  it('keeps distinct destinations at the same stage', () => {
    // The dedupe must not collapse a stage's genuinely different tools into one
    // link — that would be the opposite defect and just as invisible.
    for (const tool of TOOLS) {
      const stagePaths = new Set(
        TOOLS.filter(t => t.stageId === tool.stageId).flatMap(t => t.launchActions.map(a => a.path)),
      )
      if (stagePaths.size < 2) continue
      const [card] = buildCdsCards({
        activeStageId: tool.stageId,
        riskAlerts: [],
        isToolEnabled: () => true,
        recommendedNextStep: null,
        isSmartConnected: false,
      })
      expect(card.links?.length).toBe(stagePaths.size)
      break
    }
  })
})
