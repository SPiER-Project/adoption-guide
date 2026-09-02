/**
 * @vitest-environment jsdom
 *
 * The rail's copy in the embedded panel — the four things a user review found
 * (2026-09-01) and the fix for each:
 *
 *  1. "Do now" beside "Complete" on the same node. A card on a completed stage
 *     is guidance, not a to-do; only a stage the patient is on or has not
 *     reached gets the to-do flag.
 *  2. Five lines of meta before the first stage. In panel chrome the subtitle
 *     lines become a footnote under the rail, and the protocol link survives —
 *     in the panel it is the only way into the published pathway.
 *  3. A 200-word card first. Long detail clips behind "Show more".
 *  4. "Configure tools in your implementation", addressed to someone who is not
 *     in a host chart. Hidden in panel chrome.
 *
 * The full EHR shell keeps its behaviour in every case, and that is asserted
 * too: this pass was about the panel, not about the chart.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { STAGES } from '@spier/core/data/catalog'
import type { Card } from '@spier/core/lib/cdsHooks'
import type { StageArtifacts, StageStatus } from '@spier/core/lib/patientPathway'
import { PresentationProvider } from '../context/PresentationProvider'
import type { ChromeMode } from '../context/PresentationContext'
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

describe('PatientPathway — to-do versus guidance', () => {
  it('flags a card on the active stage and on an upcoming stage as "Do now"', () => {
    const { container } = renderRail('ehr', [card(3), card(5)])
    expect(node(container, 3).querySelector('.pathway-node-flag')?.textContent).toBe('Do now')
    expect(node(container, 5).querySelector('.pathway-node-flag')?.textContent).toBe('Do now')
  })

  it('labels a card on a COMPLETED stage "Guidance", never "Do now"', () => {
    // The problem-list card sits on a finished "Define the Risk Picture" by
    // design. The old rule flagged every stage with a card, so three completed
    // nodes read "DO NOW  COMPLETE" at once.
    const { container } = renderRail('ehr', [card(0)])
    const flags = node(container, 0).querySelectorAll('.pathway-node-flag')
    expect(flags).toHaveLength(1)
    expect(flags[0].textContent).toBe('Guidance')
    expect(flags[0].classList.contains('pathway-node-flag--guidance')).toBe(true)
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
    // The title and the progress line stay: they are the answer, not the meta.
    expect(container.querySelector('.pathway-title')?.textContent).toBe('Suicide-safer care pathway')
    expect(container.querySelector('.pathway-progress')).not.toBeNull()
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

  it('offers "Configure tools" in the shell and not in the panel', () => {
    // A card with no links and no narrative-only marker: the shell tells an
    // implementer where to enable a tool; the panel has no implementer to tell.
    const shell = renderRail('ehr', [card(3)])
    expect(shell.container.querySelector('a[href="/guide/tool-configuration"]')).not.toBeNull()
    cleanup()
    const panel = renderRail('panel', [card(3)])
    expect(panel.container.querySelector('a[href="/guide/tool-configuration"]')).toBeNull()
    expect(panel.container.textContent).toContain('No tool is enabled for this step.')
  })
})
