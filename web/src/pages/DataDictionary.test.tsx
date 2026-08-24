/**
 * @vitest-environment jsdom
 *
 * The Data Dictionary's two structural claims.
 *
 * ⚠️ **What this file can and cannot cover.** The change it guards was driven by
 * measurement — the table was 2065px wide in a 1134px column with rows at
 * median 111px / p90 402px / max 675px, because `.dd-cell-path` was `nowrap`
 * under `table-layout: auto` and starved the prose column to 112px. jsdom
 * computes no layout, so **none of that is testable here** and it was verified
 * in a browser instead (median 64 / p90 119 / max 136, no horizontal scroll).
 * The measurements live in the comments beside the CSS they justify.
 *
 * What IS testable is the behaviour that layout fix depends on, and every case
 * below is a way the fix could regress into something worse than the bug:
 *
 *  - prose creeping back into the scan grid;
 *  - a search matching a field the reader can no longer see;
 *  - the normalization layer going back behind a caret;
 *  - the derived counts contradicting the prose they sit above.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DataDictionary } from './DataDictionary'

afterEach(cleanup)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/guide/data-dictionary']}>
      <DataDictionary />
    </MemoryRouter>,
  )
}

/** A phrase that appears ONLY in a binding's description, never in a name or code. */
const DESC_ONLY = 'passive death wish'

describe('the normalization layer leads the page', () => {
  it('is expanded on arrival, not hidden behind a caret', () => {
    renderPage()
    // The defect being guarded: this shipped as a collapsed accordion headed
    // "Shared concepts · 1 concept". With a single concept, collapsed hides the
    // entire section — and it is the half of SPiER's claim that a reader cannot
    // reach by scrolling.
    const toggle = screen.getByRole('button', { expanded: true })
    expect(toggle.textContent).toContain('Suicide risk tier')
  })

  it('is named for what it is, and counts tools rather than instruments', () => {
    const { container } = renderPage()
    expect(screen.getByText('Cross-instrument normalization')).toBeTruthy()
    const count = container.querySelector('.dd-concept-layer .dd-stage-count')!.textContent!
    // ⚠️ "tools", not "instruments". `usedBy` holds catalog tool ids and one
    // instrument family owns several — C-SSRS alone contributes four — so the
    // derived number is 11 while the concept's own description correctly says
    // *five instruments*. Labelling the derived count "instruments" made the
    // page contradict itself two lines apart.
    expect(count).toMatch(/tools?\b/)
    expect(count).not.toMatch(/instruments?\b/)
    // Derived, so the shape is asserted rather than the digits.
    expect(count).toMatch(/\d+ concepts?\b/)
    expect(count).toMatch(/\d+ routes?\b/)
  })
})

describe('the scan grid holds no prose', () => {
  it('keeps descriptions out of the summary row', () => {
    renderPage()
    // 386 characters in a table cell is what produced a 675px row. If a
    // description reappears in `.dd-row`, the row-height bug is back.
    for (const row of document.querySelectorAll('.dd-row')) {
      expect(row.textContent ?? '').not.toContain('Passive death wish, past month')
    }
  })

  it('shows the description in the detail row once opened', () => {
    renderPage()
    const row = [...document.querySelectorAll('.dd-row')].find(r =>
      (r.textContent ?? '').includes('Wish to be dead'),
    )!
    const toggle = within(row as HTMLElement).getByRole('button')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    // aria-controls must resolve — the detail row is rendered at every state and
    // hidden with `hidden`, never removed.
    const detail = document.getElementById(toggle.getAttribute('aria-controls')!)
    expect(detail).toBeTruthy()
    expect(detail!.textContent).toContain('Passive death wish, past month')
  })
})

describe('search still explains itself', () => {
  it('auto-expands rows whose description matched, and only those', () => {
    const { container } = renderPage()
    fireEvent.change(container.querySelector('.dd-search')!, { target: { value: DESC_ONLY } })

    const open = [...document.querySelectorAll('.dd-detail-row')].filter(
      r => !(r as HTMLElement).hidden,
    )
    // ⚠️ The hole this closes: search matches `description`, which the summary
    // row no longer shows. Without auto-expansion a result appears with no
    // visible reason for matching — strictly worse than the tall rows, because
    // the reader cannot even tell it is not a bug.
    expect(open.length).toBeGreaterThan(0)
    for (const row of open) {
      expect((row.textContent ?? '').toLowerCase()).toContain(DESC_ONLY)
    }
  })

  it('lets an explicitly closed row stay closed against the search', () => {
    const { container } = renderPage()
    fireEvent.change(container.querySelector('.dd-search')!, { target: { value: DESC_ONLY } })
    const before = [...document.querySelectorAll('.dd-detail-row')].filter(
      r => !(r as HTMLElement).hidden,
    ).length
    expect(before).toBeGreaterThan(1)

    // `toggled[id] ?? autoOpen.has(id)` — the explicit decision wins. A plain
    // Set of open ids could not express "the search opened this and I closed it".
    fireEvent.click(document.querySelector('.dd-detail-toggle')!)
    const after = [...document.querySelectorAll('.dd-detail-row')].filter(
      r => !(r as HTMLElement).hidden,
    ).length
    expect(after).toBe(before - 1)
  })
})
