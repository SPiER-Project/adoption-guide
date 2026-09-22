/**
 * @vitest-environment jsdom
 *
 * The rail, which is *Where this patient is* since 2026-09-21 (clinical-app
 * audit §4.3). What is gated here:
 *
 *  1. **"N due" is the pathway's count, never the card count.** A card on the
 *     rail is guidance — the obligations are the landing screen's — and a
 *     guidance card that flagged its stage as outstanding would be the "four
 *     labels for one state" defect (§1.6) one layer down.
 *  2. **The rail draws no header in either chrome.** It used to draw a title, a
 *     subtitle and a progress line in a standalone tab and suppress them in the
 *     panel; the page owns all three now, so there is one owner instead of two.
 *  3. **Every row links to its stage page**, collapsed or open, and the tool
 *     chips that were the only route there are gone.
 *  4. **The stage's sentence is the clinician's**, not the CodeSystem
 *     definition written to an EHR vendor (§1.9).
 *  5. A 200-word card first: long detail clips behind "Show more".
 *  6. "Configure tools in your implementation", addressed to someone who is not
 *     in a host chart. Hidden in panel chrome.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { STAGES, stageBlurb } from '@spier/core/data/catalog'
import type { Card } from '@spier/core/lib/cdsHooks'
import type { StageArtifacts, StageStatus } from '@spier/core/lib/patientPathway'
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import type { ChromeMode } from '@spier/tool-views/context/PresentationContext'
import { PatientPathway } from './PatientPathway'

afterEach(cleanup)

const emptyGroups: StageArtifacts[] = STAGES.map(s => ({
  stageId: s.id,
  responses: [],
  carePlans: [],
  observations: [],
  communications: [],
  workflowArtifacts: [],
}))

// Stages 1–3 complete, 4 active, the rest not started.
const statuses: Record<string, StageStatus> = Object.fromEntries(
  STAGES.map((s, i) => [s.id, i < 3 ? 'complete' : i === 3 ? 'active' : 'not-started']),
)

function card(stageIndex: number, overrides: Partial<Card> = {}): Card {
  const stageId = STAGES[stageIndex].id
  return {
    uuid: `card-${stageIndex}`,
    summary: `Card for ${stageId}`,
    indicator: 'warning',
    source: { label: 'test', url: 'https://example.test' },
    extension: { 'spier-card-id': `card-${stageIndex}`, 'spier-stage-id': stageId },
    ...overrides,
  }
}

function renderRail(mode: ChromeMode, cards: Card[], dueByStage: Record<string, number> = {}) {
  return render(
    <MemoryRouter>
      <PresentationProvider initialMode={mode}>
        <PatientPathway
          stageGroups={emptyGroups}
          statuses={statuses}
          cards={cards}
          dueByStage={dueByStage}
        />
      </PresentationProvider>
    </MemoryRouter>,
  )
}

function node(container: HTMLElement, stageIndex: number): HTMLElement {
  const el = container.querySelector(`#stage-${STAGES[stageIndex].id}`)
  if (!el) throw new Error(`no node for stage ${stageIndex}`)
  return el as HTMLElement
}

/** The flag pills in a node's aside — everything that is not the state pill. */
function flagsOf(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('.pathway-node-aside .pill')].filter(
    p => !/pathway-node-status--/.test(p.className),
  )
}

describe('PatientPathway — what is due versus what is guidance', () => {
  it('says "1 due" on the stage the PATHWAY owes something at', () => {
    const { container } = renderRail('ehr', [], { [STAGES[3].id]: 1 })
    expect(flagsOf(node(container, 3))[0]?.textContent).toBe('1 due')
    expect(node(container, 3).classList.contains('pathway-node--attention')).toBe(true)
    // …and nowhere else on the rail.
    expect(flagsOf(node(container, 5))).toHaveLength(0)
  })

  it('counts more than one', () => {
    const { container } = renderRail('ehr', [], { [STAGES[3].id]: 3 })
    expect(flagsOf(node(container, 3))[0]?.textContent).toBe('3 due')
  })

  it('labels a card "Guidance" and never lets it claim the stage is outstanding', () => {
    // ⚠️ The rule this file exists for. The problem-list card sits on a
    // finished "Define the Risk Picture" by design; the obligations are the
    // landing screen's, so a card here is never a to-do.
    const { container } = renderRail('ehr', [card(0)])
    const flags = flagsOf(node(container, 0))
    expect(flags).toHaveLength(1)
    expect(flags[0].textContent).toBe('Guidance')
    expect(flags[0].classList.contains('pill--neutral')).toBe(true)
    expect(node(container, 0).textContent).not.toContain('due')
    expect(node(container, 0).classList.contains('pathway-node--attention')).toBe(false)
    // …and the node still opens for it, because the card is the point.
    expect(node(container, 0).querySelector('.cds-card')).not.toBeNull()
  })
})

describe('PatientPathway — the row is a way into the stage', () => {
  it('links every row to its stage page, open or collapsed', () => {
    const { container } = renderRail('ehr', [])
    for (const [i, stage] of STAGES.entries()) {
      const link = node(container, i).querySelector('.pathway-node-open')
      expect(link?.getAttribute('href'), stage.id).toBe(`/patient/pathway/${stage.id}`)
    }
    // ⚠️ `Open this stage →` used to live inside a block that rendered only
    // when the node had NO cards, which made the stage page unreachable from a
    // stage that had one. It is the row now.
    expect(container.querySelectorAll('.pathway-node-open')).toHaveLength(STAGES.length)
  })

  it('offers no tool chips — that list is the stage page\u2019s', () => {
    const { container } = renderRail('ehr', [])
    expect(container.querySelector('.pathway-node-tools')).toBeNull()
    expect(container.querySelector('.pathway-tool-chip')).toBeNull()
  })

  it('describes a stage to the clinician, not to an EHR vendor', () => {
    const { container } = renderRail('ehr', [])
    const desc = node(container, 3).querySelector('.pathway-node-desc')?.textContent ?? ''
    expect(desc.length).toBeGreaterThan(10)
    expect(desc).not.toMatch(/The EHR /)
    expect(desc).toBe(stageBlurb(STAGES[3].id))
  })
})

describe('PatientPathway — the header belongs to the page', () => {
  it('draws no title, subtitle or progress line in EITHER chrome', () => {
    // ⚠️ The shell half asserted the OPPOSITE until 2026-09-21. The rail is a
    // page now and `PatientWhere` owns its header; two owners for one page
    // title is what `docs/internals/css-and-page-template.md` rules out.
    for (const mode of ['ehr', 'panel'] as ChromeMode[]) {
      const { container } = renderRail(mode, [])
      expect(container.querySelector('.pathway-title'), mode).toBeNull()
      expect(container.querySelector('.pathway-subtitle'), mode).toBeNull()
      expect(container.querySelector('.pathway-progress'), mode).toBeNull()
      expect(container.querySelector('.pathway-footnote'), mode).toBeNull()
      cleanup()
    }
  })
})

describe('CdsCardView — long detail and the configure link', () => {
  const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} of a very long card detail.`).join(' ')

  it('clips detail past the limit behind "Show more", and expands on demand', () => {
    const { container } = renderRail('ehr', [card(3, { detail: long })])
    const text = container.querySelector('.cds-card-rationale__text')!
    expect(text.textContent.length).toBeLessThan(long.length)
    // Cut at a sentence boundary, not mid-word.
    expect(text.textContent.endsWith('.')).toBe(true)
    const more = screen.getByRole('button', { name: 'Show more' })
    fireEvent.click(more)
    expect(container.querySelector('.cds-card-rationale__text')?.textContent).toBe(long)
    expect(screen.getByRole('button', { name: 'Show less' })).toBeDefined()
  })

  it('renders short detail in full with no toggle', () => {
    const { container } = renderRail('ehr', [card(3, { detail: 'Short and complete.' })])
    expect(container.querySelector('.cds-card-more')).toBeNull()
    expect(container.querySelector('.cds-card-rationale')?.textContent).toBe('Short and complete.')
  })

  it('offers "Configure tools" on a disabled-tool card in the shell, never in the panel', () => {
    // A card with no links and no narrative-only marker: the shell tells an
    // implementer where to enable a tool; the panel has no implementer to tell.
    //
    // ⚠️ **Scoped to the card's `.empty-state` line on purpose, and it was not always.**
    // This asserted `querySelector('a[href="/settings"]')` over the whole
    // container, which passed only while the panel had NO route to the settings
    // anywhere. The moment the panel footnote gained one (2026-09-15) that
    // spelling failed — correctly, but for the wrong reason: the rule was never
    // "the panel cannot reach the settings", it is "a card that says a tool is
    // unavailable does not offer a switch that cannot change that". A container-
    // wide assertion cannot tell those apart, so it is the card that is checked.
    const shell = renderRail('ehr', [card(3)])
    expect(
      shell.container.querySelector('.cds-card .empty-state a[href="/settings"]'),
    ).not.toBeNull()
    cleanup()
    const panel = renderRail('panel', [card(3)])
    expect(panel.container.querySelector('.cds-card .empty-state a[href="/settings"]')).toBeNull()
    expect(panel.container.textContent).toContain('No tool is enabled for this step.')
  })

  it('offers the settings nowhere in the panel', () => {
    // The other half of the rule above. The rail used to carry a settings link
    // in a panel-only footnote, on the argument that PanelShell has no nav and
    // the page would otherwise be unreachable inside a host chart. It is now
    // unreachable there on purpose: `lib/toolEnablement.ts` records that the
    // preset has no effect in panel chrome, so the link promised a fix it could
    // not deliver, and §4.9 is where an operator's page belongs.
    const panel = renderRail('panel', [card(3)])
    expect(panel.container.querySelector('a[href="/settings"]')).toBeNull()
  })
})
