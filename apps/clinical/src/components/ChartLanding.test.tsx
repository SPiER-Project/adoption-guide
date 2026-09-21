/**
 * @vitest-environment jsdom
 *
 * The landing screen, over every demo chart: one instruction, and it is the
 * pathway's.
 *
 * ⚠️ **The load-bearing test is "exactly one primary, and it is PR 3's"**
 * (clinical-app audit rule 3). The chart answered "what do I do" three times
 * until 2026-09-21 and disagreed twice; PR 3 made the ANSWER one, and this is
 * the screen that has to render one. Two things could break that independently
 * — the screen could show a second act of its own, or it could show a different
 * act from the one the evaluator and the CDS service agree on — so both are
 * asserted against `evaluatePathway` rather than against a copied expectation.
 *
 * ⚠️ **It renders no patient identity**, and that is checked too. Audit §4.7:
 * the chrome's banner and the landing screen's "who" line are ONE strip. A
 * second one here is the duplicate `need_patient_banner` exists to prevent,
 * rendered an inch lower where no launch parameter can turn it off.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { evaluatePathway, type PathwayRecord } from '@spier/core/lib/pathwayEvaluation'
import { ChartLanding } from './ChartLanding'

afterEach(cleanup)

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

function renderLanding(id: string, isToolEnabled: (toolId: string) => boolean = () => true) {
  const evaluation = evaluatePathway(recordFor(id), { now: NOW })
  const view = render(
    <MemoryRouter>
      <ChartLanding
        evaluation={evaluation}
        isToolEnabled={isToolEnabled}
        stepLabel="Step 3 of 8"
        recordCount={14}
        onJump={() => {}}
      />
    </MemoryRouter>,
  )
  return { ...view, evaluation }
}

const scenarioIds = Object.keys(POPULATION_SCENARIOS)

describe('one instruction, and it is the pathway’s', () => {
  it('draws exactly one act card on every demo chart', () => {
    for (const id of scenarioIds) {
      const { container } = renderLanding(id)
      expect(container.querySelectorAll('.chart-landing__act'), id).toHaveLength(1)
      cleanup()
    }
  })

  it('titles that card with the evaluator’s primary, and nothing else', () => {
    let withPrimary = 0
    for (const id of scenarioIds) {
      const { container, evaluation } = renderLanding(id)
      const act = container.querySelector('.chart-landing__act')!
      if (evaluation.primary) {
        withPrimary++
        expect(act.textContent, id).toBe(evaluation.primary.title)
        expect(container.querySelector('.chart-landing__trigger')!.textContent, id).toBe(
          evaluation.primary.reason,
        )
      } else {
        expect(act.textContent, id).toBe('Nothing is due')
        // ⚠️ The heading's own words are dropped from the sentence under it —
        // the evaluator's `reason` opens "Nothing is due." because every other
        // consumer reads it with nothing above it. The rest must survive
        // verbatim, which is what this asserts rather than a `toContain`.
        expect(container.querySelector('.chart-landing__trigger')!.textContent, id).toBe(
          evaluation.reason.replace(/^Nothing is due\. /, ''),
        )
        expect(evaluation.reason.startsWith('Nothing is due'), id).toBe(true)
      }
      cleanup()
    }
    // …and the charts that have a primary are most of them, or the assertion
    // above is being satisfied by the empty branch.
    expect(withPrimary).toBeGreaterThan(scenarioIds.length / 2)
  })

  it('offers one launch button, for the primary’s own tool', () => {
    const id = scenarioIds.find(s => evaluatePathway(recordFor(s), { now: NOW }).primary?.tool)
    expect(id, 'no demo chart has a launchable primary — this test would check nothing').toBeDefined()
    const { container, evaluation } = renderLanding(id!)
    const buttons = container.querySelectorAll('.chart-landing__launch a')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].getAttribute('href')).toBe(evaluation.primary!.tool!.path)
    expect(buttons[0].textContent).toBe(evaluation.primary!.tool!.label)
  })

  it('states what else is due as text, never as a second card', () => {
    const id = scenarioIds.find(s => evaluatePathway(recordFor(s), { now: NOW }).alsoDue.length > 0)
    expect(id, 'no demo chart owes more than one thing — this test would check nothing').toBeDefined()
    const { container, evaluation } = renderLanding(id!)
    const also = container.querySelector('.chart-landing__also')!
    for (const obligation of evaluation.alsoDue) {
      expect(also.textContent, obligation.title).toContain(obligation.title)
    }
    // One act, still — the also-due list is a sentence under it.
    expect(container.querySelectorAll('.chart-landing__act')).toHaveLength(1)
    expect(container.querySelectorAll('.chart-landing__launch')).toHaveLength(1)
  })

  it('still names what is due when the site has not enabled the tool', () => {
    // ⚠️ The same rule `cards.ts` states: a disabled tool costs the card its
    // button and nothing else. What the protocol obliges is not a site setting.
    const id = scenarioIds.find(s => evaluatePathway(recordFor(s), { now: NOW }).primary?.tool)!
    const { container, evaluation } = renderLanding(id, () => false)
    expect(container.querySelector('.chart-landing__act')!.textContent).toBe(
      evaluation.primary!.title,
    )
    expect(container.querySelectorAll('.chart-landing__launch')).toHaveLength(0)
  })
})

describe('the two ways off the screen', () => {
  it('carries a fact on each', () => {
    const { container } = renderLanding('patient-001')
    const ways = container.querySelectorAll('.chart-landing__way')
    expect(ways).toHaveLength(2)
    expect(within(ways[0] as HTMLElement).getByText('Step 3 of 8')).toBeDefined()
    expect(within(ways[1] as HTMLElement).getByText('14 records')).toBeDefined()
  })

  it('links to "Why this?" only where there is something to explain', () => {
    const withPrimary = scenarioIds.find(
      s => evaluatePathway(recordFor(s), { now: NOW }).primary,
    )!
    renderLanding(withPrimary)
    expect(screen.getByRole('link', { name: 'Why this?' }).getAttribute('href')).toBe('/patient/why')
    cleanup()

    const withoutPrimary = scenarioIds.find(
      s => !evaluatePathway(recordFor(s), { now: NOW }).primary,
    )
    expect(
      withoutPrimary,
      'no demo chart is clear — the "nothing is due" branch would be unchecked',
    ).toBeDefined()
    renderLanding(withoutPrimary!)
    expect(screen.queryByRole('link', { name: 'Why this?' })).toBeNull()
  })
})

describe('the patient is named once, by the chrome', () => {
  it('renders no identity of its own', () => {
    const { container } = renderLanding('patient-001')
    expect(container.querySelector('.identity-strip')).toBeNull()
    expect(container.querySelector('.patient-banner')).toBeNull()
  })
})
