/**
 * @vitest-environment jsdom
 *
 * The rail's copy in the embedded panel — the four things a user review found
 * (2026-09-01) and the fix for each:
 *
 *  1. "Do now" beside "Complete" on the same node. A card on a completed stage
 *     is guidance, not a to-do; only a stage the patient has not reached gets
 *     the to-do flag. (2026-09-02: the ACTIVE stage lost it too — "Do now" beside
 *     "You are here" above an "Urgent" card titled "Next step" was four labels
 *     for one state. The active node keeps its one status pill.)
 *  2. Five lines of meta before the first stage. In panel chrome the subtitle
 *     lines become a footnote under the rail, and the protocol link survives —
 *     in the panel it is the only way into the published pathway. (2026-09-02:
 *     the rail's title and progress line left the panel too — the chart's
 *     PageHeader carries them as title + lede, via `PathwayProgress`.)
 *  3. A 200-word card first. Long detail clips behind "Show more".
 *  4. "Configure tools in your implementation", addressed to someone who is not
 *     in a host chart. Hidden in panel chrome.
 *
 * The full app shell keeps its behaviour in every case, and that is asserted
 * too: this pass was about the panel, not about the chart.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { STAGES } from '@spier/core/data/catalog'
import type { Card } from '@spier/core/lib/cdsHooks'
import type { StageArtifacts, StageStatus } from '@spier/core/lib/patientPathway'
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import type { ChromeMode } from '@spier/tool-views/context/PresentationContext'
import { PatientPathway, PathwayProgress } from './PatientPathway'

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

function renderRail(mode: ChromeMode, cards: Card[]) {
  return render(
    <MemoryRouter>
      <PresentationProvider initialMode={mode}>
        <PatientPathway
          stageGroups={emptyGroups}
          statuses={statuses}
          cards={cards}
          isToolEnabled={() => false}
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

describe('PatientPathway — to-do versus guidance', () => {
  it('flags a card on an UPCOMING stage "Do now", and leaves the active stage to its one pill', () => {
    const { container } = renderRail('ehr', [card(3), card(5)])
    // Upcoming: the flag is the only thing saying this row is actionable.
    expect(flagsOf(node(container, 5))[0]?.textContent).toBe('Do now')
    // Active: "You are here" is the one label; the open card says what to do.
    expect(flagsOf(node(container, 3))).toHaveLength(0)
    expect(node(container, 3).querySelector('[class*="pathway-node-status--"]')?.textContent).toBe('You are here')
    expect(node(container, 3).querySelector('.cds-card')).not.toBeNull()
    // …and the node still reads as needing attention (border), just not twice.
    expect(node(container, 3).classList.contains('pathway-node--attention')).toBe(true)
  })

  it('labels a card on a COMPLETED stage "Guidance", never "Do now"', () => {
    // The problem-list card sits on a finished "Define the Risk Picture" by
    // design. The old rule flagged every stage with a card, so three completed
    // nodes read "DO NOW  COMPLETE" at once.
    const { container } = renderRail('ehr', [card(0)])
    const flags = flagsOf(node(container, 0))
    expect(flags).toHaveLength(1)
    expect(flags[0].textContent).toBe('Guidance')
    // Guidance is the quiet pill; "Do now" is the brand-coloured one.
    expect(flags[0].classList.contains('pill--neutral')).toBe(true)
    expect(node(container, 0).textContent).not.toContain('Do now')
    // …and the node still opens for it, because the card is the point.
    expect(node(container, 0).querySelector('.cds-card')).not.toBeNull()
  })
})

describe('PatientPathway — the header in panel chrome', () => {
  it('keeps the subtitle lines in the full shell', () => {
    const { container } = renderRail('ehr', [])
    expect(container.querySelector('.pathway-subtitle')).not.toBeNull()
    expect(container.querySelector('.pathway-footnote')).toBeNull()
  })

  it('moves them to a footnote in the panel, keeping the way into the protocol', () => {
    const { container } = renderRail('panel', [])
    expect(container.querySelector('.pathway-subtitle')).toBeNull()
    const foot = container.querySelector('.pathway-footnote')
    expect(foot).not.toBeNull()
    // The panel has no sidebar, so this link is the only exit to the definition.
    expect(foot!.querySelector('a[href="/patient/pathway"]')).not.toBeNull()
    // The rail's own title and progress line are NOT rendered in the panel: the
    // chart's PageHeader carries both (title + `PathwayProgress` lede), so the
    // panel shows one heading above the first stage rather than three.
    expect(container.querySelector('.pathway-title')).toBeNull()
    expect(container.querySelector('.pathway-progress')).toBeNull()
  })

  it('keeps the title and progress line in the full shell', () => {
    const { container } = renderRail('ehr', [card(3)])
    expect(container.querySelector('.pathway-title')?.textContent).toBe('Suicide-safer care pathway')
    expect(container.querySelector('.pathway-progress')?.textContent).toContain('Now at step 4 of 8')
    expect(container.querySelector('.pathway-progress')?.textContent).toContain('stages with activity')
  })
})

describe('PathwayProgress — the one-line status the chart header carries in the panel', () => {
  it('compact form: step, stage title and action count, without the activity clause', () => {
    const { container } = render(<p><PathwayProgress statuses={statuses} actionCount={1} compact /></p>)
    const text = container.textContent ?? ''
    expect(text).toContain(`Step 4 of ${STAGES.length}`)
    expect(text).toContain(STAGES[3].title)
    expect(text).toContain('1 recommended action')
    expect(text).not.toContain('stages with activity')
    expect(text).not.toContain('Now at')
  })

  it('says so when every stage is passed', () => {
    const passed = Object.fromEntries(STAGES.map(s => [s.id, 'complete' as StageStatus]))
    const { container } = render(<p><PathwayProgress statuses={passed} actionCount={0} compact /></p>)
    expect(container.textContent).toBe(`All ${STAGES.length} stages passed`)
  })
})

describe('CdsCardView — long detail and the configure link', () => {
  const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} of a very long card detail.`).join(' ')

  it('clips detail past the limit behind "Show more", and expands on demand', () => {
    const { container } = renderRail('ehr', [card(3, { detail: long })])
    const text = container.querySelector('.cds-card-rationale__text')!
    expect(text.textContent!.length).toBeLessThan(long.length)
    // Cut at a sentence boundary, not mid-word.
    expect(text.textContent!.endsWith('.')).toBe(true)
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

  it('reaches the settings from the panel footnote, and the shell does not need to', () => {
    // The other half of the rule above, and the reason the assertion there had
    // to get narrower rather than be deleted. PanelShell carries no nav — it
    // exists to give the vertical budget back to the form — so this strip is the
    // panel's only chrome-level navigation, and without a row here the settings
    // are unreachable from inside a host chart.
    const panel = renderRail('panel', [card(3)])
    expect(panel.container.querySelector('.pathway-footnote a[href="/settings"]')).not.toBeNull()
    cleanup()
    // The shell has a sidebar and a full header; the footnote is panel-only.
    const shell = renderRail('ehr', [card(3)])
    expect(shell.container.querySelector('.pathway-footnote')).toBeNull()
  })
})
