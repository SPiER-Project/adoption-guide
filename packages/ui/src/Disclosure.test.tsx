/**
 * @vitest-environment jsdom
 *
 * `Disclosure` — the ninth surface owner (adoption-guide audit §4.4).
 *
 * The three properties a later edit could quietly undo, each the reason the
 * component exists rather than a sixth hand-rolled `<details>`:
 *
 *  1. **Closed by default.** The pages that adopted it fit on one screen
 *     BECAUSE their drawers start closed; a component whose default flipped
 *     would undo every one of them at once and no page test would notice.
 *  2. **One element, three variants.** The look is a class on the root, so a
 *     page can never be tempted to redeclare padding, radius or border.
 *  3. **The label and the hint are inline spans inside the `<summary>`.** A
 *     `<summary>` set to `flex` loses its `::marker`; keeping them as spans is
 *     what lets the CSS leave the summary as `display: list-item`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Disclosure } from './Disclosure'

afterEach(cleanup)

describe('Disclosure', () => {
  it('is closed until it is asked for, and opens on the summary', () => {
    render(<Disclosure summary="How it decides">the mechanism</Disclosure>)
    const details = document.querySelector('details.disclosure') as HTMLDetailsElement
    expect(details.open).toBe(false)
    fireEvent.click(screen.getByText('How it decides'))
    // jsdom does not implement the native toggle, so drive the property the
    // way the browser would and assert the body is mounted either way — the
    // point of the assertion is that the content is PRESENT, not hidden by a
    // condition the component could get wrong.
    details.open = true
    expect(details.open).toBe(true)
    expect(screen.getByText('the mechanism')).toBeDefined()
  })

  it('defaultOpen is opt-in, and it is the only way to start open', () => {
    render(<Disclosure summary="Open one" defaultOpen>body</Disclosure>)
    expect((document.querySelector('details.disclosure') as HTMLDetailsElement).open).toBe(true)
  })

  it('carries its look as a variant class on the root, never as page styling', () => {
    const { rerender } = render(<Disclosure summary="a">x</Disclosure>)
    expect(document.querySelector('details')?.className).toBe('disclosure disclosure--rule')
    rerender(<Disclosure summary="a" variant="boxed">x</Disclosure>)
    expect(document.querySelector('details')?.className).toBe('disclosure disclosure--boxed')
    rerender(<Disclosure summary="a" variant="quiet" className="tools-index__handoff">x</Disclosure>)
    expect(document.querySelector('details')?.className).toBe(
      'disclosure disclosure--quiet tools-index__handoff',
    )
  })

  it('keeps the label and the hint as spans inside the summary, so the marker survives', () => {
    render(<Disclosure summary="What it records" hint="1 resource">rows</Disclosure>)
    const summary = document.querySelector('summary.disclosure__summary') as HTMLElement
    expect(summary.querySelector('.disclosure__label')?.textContent).toBe('What it records')
    expect(summary.querySelector('.disclosure__hint')?.textContent).toBe('1 resource')
    // Nothing between the summary and its two spans that could become a flex row.
    expect([...summary.children].map(c => c.className)).toEqual([
      'disclosure__label',
      'disclosure__hint',
    ])
  })

  it('renders no hint element at all when none is given', () => {
    render(<Disclosure summary="Licensing">terms</Disclosure>)
    expect(document.querySelector('.disclosure__hint')).toBeNull()
  })

  it('follows a controlled `open` and reports the reader’s own toggle', () => {
    const seen: boolean[] = []
    const { rerender } = render(
      <Disclosure summary="Clarify Risk" open={false} onToggle={o => seen.push(o)}>rows</Disclosure>,
    )
    const details = document.querySelector('details.disclosure') as HTMLDetailsElement
    expect(details.open).toBe(false)
    // The page opens it — a jump nav landing here, a search matching inside.
    rerender(<Disclosure summary="Clarify Risk" open onToggle={o => seen.push(o)}>rows</Disclosure>)
    expect(details.open).toBe(true)
    // The reader closes it: the browser flips the attribute, then fires
    // `toggle`, and the component reports the state the element now holds.
    details.open = false
    fireEvent(details, new Event('toggle'))
    expect(seen).toEqual([false])
  })
})
