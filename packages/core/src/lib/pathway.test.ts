import { describe, it, expect } from 'vitest'
import {
  loadPathway,
  parsePathway,
  PATHWAY_URL,
  PATHWAY_STAGE_SYSTEM,
  type PathwayAction,
} from './pathway'
import { RISK_TIER_SYSTEM } from './riskEpisode'

/**
 * Two halves, and the second is the one that matters.
 *
 * The first asserts what the published artifact currently says — a thin layer,
 * because restating the FSH in a test only proves the parser can read today's
 * file.
 *
 * The second plants a defect per rule and proves the parser THROWS. Every one
 * of those rules exists because the silent alternative is a page that omits a
 * step the published protocol states, and a parse that skips what it cannot
 * read is the #232 / #261 failure mode in module form.
 */

const flatten = (actions: PathwayAction[], out: PathwayAction[] = []): PathwayAction[] => {
  for (const a of actions) {
    out.push(a)
    flatten(a.children, out)
  }
  return out
}

/** A minimal well-formed pathway, so each defect below is the only thing wrong. */
function minimalPlan() {
  return {
    resourceType: 'PlanDefinition',
    url: PATHWAY_URL,
    version: '9.9.9',
    title: 'Test pathway',
    action: [
      {
        id: 'branch',
        title: 'Tier branch',
        code: [{ coding: [{ system: PATHWAY_STAGE_SYSTEM, code: 'define-risk-picture', display: 'Define the Risk Picture' }] }],
        action: [
          {
            id: 'tier-low',
            title: 'Low risk',
            code: [{ coding: [{ system: RISK_TIER_SYSTEM, code: 'low', display: 'Low risk' }] }],
            action: [
              {
                id: 'low-obligation',
                title: 'Do the thing',
                definitionCanonical: 'http://example.org/fhir/ActivityDefinition/Thing',
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('the published pathway artifact', () => {
  const model = loadPathway()

  it('loads the generated PlanDefinition, with its provenance', () => {
    expect(model.url).toBe(PATHWAY_URL)
    expect(model.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(model.title).toBeTruthy()
    // The provenance strip shows the raw artifact; it must be the artifact.
    expect((model.raw as { resourceType?: string }).resourceType).toBe('PlanDefinition')
  })

  it('reads the stage spine as the top-level groups, in order', () => {
    expect(model.steps.map(s => s.id)).toEqual([
      'screen',
      'assess-risk',
      'tier-branch',
      'clinician-guidance',
    ])
    expect(model.steps.map(s => s.stage?.code)).toEqual([
      'identify-possible-risk',
      'clarify-risk',
      'define-risk-picture',
      'define-risk-picture',
    ])
  })

  it('finds the tier branch structurally, covering low / moderate / high', () => {
    expect(model.tierBranch.group.id).toBe('tier-branch')
    expect(model.tierBranch.tiers.map(t => t.tier?.code)).toEqual(['low', 'moderate', 'high'])
    // Every tier group is gated, and on the same episode extension.
    for (const tier of model.tierBranch.tiers) {
      expect(tier.conditions).toHaveLength(1)
      expect(tier.conditions[0].expression).toContain('episode-current-risk-tier')
    }
  })

  it('carries the obligations and their realizing artifacts', () => {
    const high = model.tierBranch.tiers.find(t => t.tier?.code === 'high')!
    const canonicals = high.children.map(c => c.definitionCanonical).filter(Boolean)
    expect(canonicals).toContain('http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources')
    expect(canonicals).toContain('http://thespierproject.org/fhir/ActivityDefinition/AdministerStanleyBrown')
    // The cadence is REFERENCED, never restated — the whole point of the FSH's
    // no-timing rule, seen from the render side.
    expect(canonicals).toContain('http://thespierproject.org/fhir/PlanDefinition/SPiERReassessmentSchedule')
    // The three documentation-only high-risk extras have no definition at all.
    expect(high.children.filter(c => !c.definitionCanonical).map(c => c.id)).toEqual([
      'high-every-contact-question',
      'high-stat-safety-evaluation',
      'high-missed-appointment-outreach',
    ])
  })

  it('reads the positive-screen gate as a condition plus a trigger', () => {
    const assess = model.steps.find(s => s.id === 'assess-risk')!
    expect(assess.conditions[0].language).toBe('text/fhirpath')
    expect(assess.conditions[0].expression).toContain('>= 1')
    expect(assess.triggers[0].type).toBe('data-added')
    expect(assess.triggers[0].data[0]).toContain('Observation')
    expect(assess.triggers[0].data[0]).toContain('44260-8')
  })

  it('keeps every documentation note renderable', () => {
    const all = flatten(model.steps)
    const docs = all.flatMap(a => a.documentation)
    expect(docs.length).toBeGreaterThan(0)
    for (const d of docs) expect(d.display || d.url || d.resource).toBeTruthy()
  })

  it('surfaces the KPI relatedArtifacts', () => {
    expect(model.relatedArtifacts.length).toBe(3)
    expect(model.relatedArtifacts.map(r => r.label)).toEqual(['KPI 1', 'KPI 2 (in part)', 'KPI 3 (in part)'])
  })
})

describe('the parser refuses what it cannot read', () => {
  it('accepts the minimal well-formed plan (so each case below isolates one defect)', () => {
    expect(() => parsePathway(minimalPlan())).not.toThrow()
  })

  it('throws on a non-PlanDefinition', () => {
    expect(() => parsePathway({ resourceType: 'Questionnaire' })).toThrow(/not a PlanDefinition/)
    expect(() => parsePathway(null)).toThrow(/not a PlanDefinition/)
  })

  it('throws when the artifact has no version — the provenance strip states one', () => {
    const plan = minimalPlan() as Record<string, unknown>
    delete plan.version
    expect(() => parsePathway(plan)).toThrow(/no version/)
  })

  it('throws on a pathway with no actions rather than rendering an empty protocol', () => {
    const plan = { ...minimalPlan(), action: [] }
    expect(() => parsePathway(plan)).toThrow(/no actions/)
  })

  it('throws on an action with no id or no title', () => {
    const noId = minimalPlan()
    delete (noId.action[0] as Record<string, unknown>).id
    expect(() => parsePathway(noId)).toThrow(/has no id/)

    const noTitle = minimalPlan()
    delete (noTitle.action[0] as Record<string, unknown>).title
    expect(() => parsePathway(noTitle)).toThrow(/has no title/)
  })

  it('throws on a coding system the model does not draw', () => {
    const plan = minimalPlan()
    plan.action[0].code[0].coding.push({ system: 'http://snomed.info/sct', code: '1234', display: 'Something' })
    expect(() => parsePathway(plan)).toThrow(/does not\s+know|which this render model/)
  })

  it('throws on two stage codings or two tier codings on one action', () => {
    const twoStages = minimalPlan()
    twoStages.action[0].code[0].coding.push({ system: PATHWAY_STAGE_SYSTEM, code: 'clarify-risk', display: 'Clarify Risk' })
    expect(() => parsePathway(twoStages)).toThrow(/two pathway-stage codings/)

    const twoTiers = minimalPlan()
    twoTiers.action[0].action[0].code[0].coding.push({ system: RISK_TIER_SYSTEM, code: 'high', display: 'High risk' })
    expect(() => parsePathway(twoTiers)).toThrow(/two risk-tier codings/)
  })

  it('throws on definitionUri, which resolves to nothing a reader can fetch', () => {
    const plan = minimalPlan()
    ;(plan.action[0].action[0].action[0] as Record<string, unknown>).definitionUri = 'http://example.org/thing'
    expect(() => parsePathway(plan)).toThrow(/definitionUri/)
  })

  it('throws on a documentation entry with nothing to render', () => {
    const plan = minimalPlan()
    ;(plan.action[0] as Record<string, unknown>).documentation = [{ type: 'documentation', label: 'Empty' }]
    expect(() => parsePathway(plan)).toThrow(/carries no display, url or resource/)
  })

  it('throws on a condition with no expression rather than showing an ungated step', () => {
    const plan = minimalPlan()
    ;(plan.action[0].action[0] as Record<string, unknown>).condition = [{ kind: 'applicability', expression: { language: 'text/fhirpath' } }]
    expect(() => parsePathway(plan)).toThrow(/no expression\.expression/)
  })

  it('throws when there is no tier branch at all', () => {
    const plan = minimalPlan()
    delete (plan.action[0].action[0] as Record<string, unknown>).code
    expect(() => parsePathway(plan)).toThrow(/no tier branch/)
  })

  it('throws when two groups branch on tiers', () => {
    const plan = minimalPlan()
    plan.action.push({
      id: 'second-branch',
      title: 'Another branch',
      code: [{ coding: [{ system: PATHWAY_STAGE_SYSTEM, code: 'clarify-risk', display: 'Clarify Risk' }] }],
      action: [
        {
          id: 'other-low',
          title: 'Low risk again',
          code: [{ coding: [{ system: RISK_TIER_SYSTEM, code: 'low', display: 'Low risk' }] }],
          action: [],
        },
      ],
    } as unknown as (typeof plan.action)[number])
    expect(() => parsePathway(plan)).toThrow(/2 tier branches/)
  })

  it('throws when the tier branch mixes tiered and untiered children', () => {
    const plan = minimalPlan()
    plan.action[0].action.push({
      id: 'stray',
      title: 'Not a tier',
      action: [],
    } as unknown as (typeof plan.action)[0]['action'][number])
    expect(() => parsePathway(plan)).toThrow(/mixes tier-gated children/)
  })
})
