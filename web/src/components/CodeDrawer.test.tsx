/**
 * @vitest-environment jsdom
 *
 * CodeDrawer — the FHIR view in both chromes (panel plan §2, §9.1 finding 3).
 *
 * Two properties carry this component, and both are easy to break silently:
 *
 *  1. **EHR chrome must be byte-for-byte what it was.** Twelve views had their
 *     `<aside className="debug-sidebar">` swapped for this component. The desktop
 *     sidebar was never the broken thing — regressing it while fixing the panel
 *     would be a poor trade, and nothing else would catch it.
 *  2. **Panel chrome must keep the drawer reachable.** The measured bug is that
 *     `.debug-sidebar` wraps *below* the form (2968px down at panel width), so
 *     the FHIR view is unreachable mid-demo. The drawer's whole value is being
 *     one tap away from any scroll position — which is a `position: fixed`
 *     concern in CSS, and here is pinned as "the handle always renders, even
 *     when the body does not".
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CodeDrawer } from './CodeDrawer'
import { PresentationProvider } from '../context/PresentationProvider'

// vitest runs without `globals: true` here, so RTL's auto-cleanup never
// registers — see vitest.config.ts.
afterEach(cleanup)

const renderIn = (mode: 'ehr' | 'panel') =>
  render(
    <PresentationProvider initialMode={mode}>
      <CodeDrawer>
        <div data-testid="payload">the FHIR</div>
      </CodeDrawer>
    </PresentationProvider>,
  )

describe('CodeDrawer — EHR chrome is unchanged', () => {
  it('renders the original .debug-sidebar aside, with its children visible', () => {
    const { container } = renderIn('ehr')
    const aside = container.querySelector('aside.debug-sidebar')
    expect(aside).not.toBeNull()
    // Children are rendered immediately: the desktop sidebar has never had a
    // collapsed state, and adding one would be the regression.
    expect(screen.getByTestId('payload')).toBeDefined()
  })

  it('renders no drawer chrome at all in EHR mode', () => {
    const { container } = renderIn('ehr')
    expect(container.querySelector('.code-drawer')).toBeNull()
    expect(container.querySelector('.code-drawer__handle')).toBeNull()
  })
})

describe('CodeDrawer — panel chrome', () => {
  it('renders the drawer instead of the sidebar', () => {
    const { container } = renderIn('panel')
    expect(container.querySelector('.code-drawer')).not.toBeNull()
    expect(container.querySelector('aside.debug-sidebar')).toBeNull()
  })

  it('starts collapsed — the body is unmounted, not merely hidden', () => {
    const { container } = renderIn('panel')
    expect(container.querySelector('.code-drawer__body')).toBeNull()
    expect(screen.queryByTestId('payload')).toBeNull()
  })

  it('always renders the handle, which is what makes it reachable', () => {
    // The bug being fixed is a FHIR view stranded ~3000px below the form. The
    // handle existing regardless of the body's state is the DOM half of the fix;
    // `position: fixed` in CodeDrawer.css is the visual half.
    const { container } = renderIn('panel')
    expect(container.querySelector('.code-drawer__handle')).not.toBeNull()
  })

  it('opens on click and reveals the children', () => {
    const { container } = renderIn('panel')
    fireEvent.click(container.querySelector('.code-drawer__handle')!)
    expect(screen.getByTestId('payload')).toBeDefined()
    expect(container.querySelector('.code-drawer__body')).not.toBeNull()
  })

  it('closes again, and reports its state to assistive tech', () => {
    const { container } = renderIn('panel')
    const handle = container.querySelector('.code-drawer__handle')!
    expect(handle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(handle)
    expect(handle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(handle)
    expect(handle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('payload')).toBeNull()
  })

  it('labels the drawer, defaulting to FHIR', () => {
    const { container } = renderIn('panel')
    expect(container.querySelector('.code-drawer__handle-label')?.textContent).toBe('FHIR')
  })
})
