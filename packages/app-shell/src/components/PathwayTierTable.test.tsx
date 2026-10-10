/**
 * @vitest-environment jsdom
 *
 * The tier table's two forms, and which one a box gets.
 *
 * ⚠️ **The width is the table's OWN box, not the window's.** The clinician's
 * panel is a ~470px frame inside a full-size screen, and there the grid (44rem
 * at least) scrolled sideways inside its box with the High-risk column — four
 * of the six obligations — off the edge. So the table measures itself with
 * `useIsNarrow`, and these cases set the width that measurement reads.
 *
 * jsdom implements neither `ResizeObserver` nor layout, so both are stubbed the
 * way `apps/clinical/src/components/PanelShell.test.tsx` stubs them. A width of
 * 0 is "not measured", which must stay the GRID — every other suite that
 * renders this table (CarePathway, CarePathwayProtocol, PathwayProtocol) runs
 * unmeasured and asserts the grid.
 *
 * The artifact is the real one, loaded the way the pages load it, so the rows
 * and spans asserted here are the published PlanDefinition's.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, within } from '@testing-library/react'
import { InspectContext } from '@spier/tool-views/context/InspectContext'
import { usePathway } from '../hooks/usePathway'
import type { PathwayTierTableProps } from './PathwayView'

let boxWidth = 0
const rect = Element.prototype.getBoundingClientRect
Element.prototype.getBoundingClientRect = function boundingRect(this: Element) {
  return { ...rect.call(this), width: boxWidth } as DOMRect
}
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver

const { PathwayTierTable } = await import('./PathwayView')

afterEach(() => {
  cleanup()
  boxWidth = 0
})

function Tiers(props: Omit<PathwayTierTableProps, 'tiers'>) {
  const { model, error } = usePathway()
  if (!model) throw new Error(`the pathway did not load: ${error}`)
  return <PathwayTierTable tiers={model.tierBranch.tiers} {...props} />
}

/**
 * The table as the guide draws it — under inspection, every note — unless a
 * case asks for the clinician's view, which is what the clinical app renders.
 */
function Table({ inspect = true, ...props }: Omit<PathwayTierTableProps, 'tiers'> & { inspect?: boolean }) {
  return (
    <InspectContext.Provider value={inspect}>
      <Tiers {...props} />
    </InspectContext.Provider>
  )
}

/** Each card's title and the tier labels under it, in order. */
function cards() {
  return [...document.querySelectorAll('.pathway-tier-list__item')].map(item => ({
    title: item.querySelector('.pathway-obligation__title')?.textContent,
    owedBy: [...item.querySelectorAll('.pathway-tier-list__label')].map(l => l.textContent),
  }))
}

describe('PathwayTierTable — which form a box gets', () => {
  it('is the grid when unmeasured — jsdom, and a real browser\'s first frame', () => {
    render(<Table />)
    expect(document.querySelector('.pathway-matrix')).not.toBeNull()
    expect(document.querySelector('.pathway-tier-list')).toBeNull()
  })

  it('is the grid in a box at the breakpoint or wider', () => {
    boxWidth = 640
    render(<Table />)
    expect(document.querySelector('.pathway-matrix')).not.toBeNull()
  })

  it('is one card per obligation in a narrower box — the panel\'s 470px', () => {
    boxWidth = 404
    render(<Table />)
    expect(document.querySelector('.pathway-matrix')).toBeNull()
    // The same six rows as the grid, each naming the tiers that owe it. High
    // risk is on the page, not off the edge of a scrolling box.
    expect(cards()).toEqual([
      { title: 'Share patient-facing crisis resources', owedBy: ['Owed: All tiers'] },
      { title: 'Complete a collaborative safety plan', owedBy: ['Owed: Moderate and high risk'] },
      { title: 'Reassess on the published cadence for this tier', owedBy: ['Owed: All tiers'] },
      { title: 'Ask the direct question at every contact', owedBy: ['Owed: High risk'] },
      { title: 'STAT safety evaluation', owedBy: ['Owed: High risk'] },
      { title: 'Missed-appointment outreach protocol', owedBy: ['Owed: High risk'] },
    ])
  })
})

describe('PathwayTierTable — the narrow form keeps what the grid says', () => {
  it('full density: every tier\'s gate, and the notes under the tiers that carry them', () => {
    boxWidth = 404
    render(<Table />)
    const gates = document.querySelector('.pathway-tier-list__gates') as HTMLElement
    expect(within(gates).getByText('Low risk')).toBeDefined()
    expect(within(gates).getByText('Moderate risk')).toBeDefined()
    expect(within(gates).getByText('High risk')).toBeDefined()
    const crisis = [...document.querySelectorAll('.pathway-tier-list__item')]
      .find(item => item.textContent?.includes('Share patient-facing crisis resources')) as HTMLElement
    expect(within(crisis).getByText('Every tier')).toBeDefined()
    expect(crisis.querySelector('.pathway-stage-chip')).not.toBeNull()
  })

  it('the clinician\'s view: only the notes the artifact marks clinician-facing, and no definition names', () => {
    boxWidth = 404
    render(<Table inspect={false} />)
    const labels = [...document.querySelectorAll('.pathway-tier-list .pathway-notes__label')].map(l => l.textContent)
    // Implementer notes ("Every tier", "One home for the cadence", "High risk
    // only") are gone; the clinician-facing ones remain, and carry no marker —
    // the marker is the implementer's key, on the guide.
    expect(labels).toEqual([
      'Emotional Fire Safety Plan',
      'Review at each contact',
      'Clinical judgment',
      'Every contact',
    ])
    expect(document.querySelector('.pathway-notes__audience')).toBeNull()
    expect(document.querySelector('.pathway-obligation__def')).toBeNull()
    expect(document.body.textContent).not.toMatch(/ActivityDefinition|PlanDefinition|SPiER[A-Z]/)
  })

  it('summary density: no gates, no notes, no chips — as the explainer\'s grid', () => {
    boxWidth = 404
    render(<Table density="summary" />)
    expect(document.querySelector('.pathway-tier-list__gates')).toBeNull()
    expect(document.querySelector('.pathway-tier-list .pathway-notes')).toBeNull()
    expect(document.querySelector('.pathway-tier-list .pathway-stage-chip')).toBeNull()
  })

  it('lights what the simulated tier owes and fades the rest; nothing either way unselected', () => {
    boxWidth = 404
    const { rerender } = render(<Table density="summary" activeTierCode="low" />)
    const state = () => cards().map((c, i) => {
      const item = document.querySelectorAll('.pathway-tier-list__item')[i]
      return [c.title, item.classList.contains('pathway-tier-list__item--active') ? 'active'
        : item.classList.contains('pathway-tier-list__item--dimmed') ? 'dimmed' : 'neither']
    })
    expect(state()).toEqual([
      ['Share patient-facing crisis resources', 'active'],
      ['Complete a collaborative safety plan', 'dimmed'],
      ['Reassess on the published cadence for this tier', 'active'],
      ['Ask the direct question at every contact', 'dimmed'],
      ['STAT safety evaluation', 'dimmed'],
      ['Missed-appointment outreach protocol', 'dimmed'],
    ])
    rerender(<Table density="summary" />)
    expect(state().every(([, s]) => s === 'neither')).toBe(true)
  })
})
