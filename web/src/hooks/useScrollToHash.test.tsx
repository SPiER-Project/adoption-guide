/**
 * @vitest-environment jsdom
 *
 * The only DOM-environment suite in this package — everything else under test is
 * a pure function walking FHIR JSON, so `vitest.config.ts` keeps the default
 * `node` environment and this file opts in.
 *
 * jsdom has no layout engine: `getBoundingClientRect()` returns zeros for every
 * element. So geometry is stubbed and what these tests pin is the *arithmetic
 * and the branching*, which is exactly where the bugs were — a scroll margin
 * that was never subtracted, and a scroll-to-top that raced the anchor scroll.
 * They cannot catch a wrong CSS value; the measurements in the PR did that.
 *
 * `getComputedStyle().scrollMarginTop` IS supported by jsdom, including values
 * from a stylesheet, so the scroll-margin behaviour is tested for real rather
 * than by stubbing the lookup.
 */
import { useEffect } from 'react'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { scrollToAnchor, useScrollToHash, useScrollToTopOnNavigate } from './useScrollToHash'

/* ---------- jsdom geometry helpers ---------- */

function stubRect(el: Element, top: number, height = 100) {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
}

function setWindowScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
}

/** A div that genuinely scrolls, as scrollToAnchor's ancestor-walk defines it. */
function makeScroller(top: number) {
  const scroller = document.createElement('div')
  scroller.style.overflowY = 'auto'
  Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true })
  Object.defineProperty(scroller, 'clientHeight', { value: 400, configurable: true })
  scroller.scrollTop = 0
  stubRect(scroller, top)
  return scroller
}

/** Anchor target with a real `scroll-margin-top`, applied via a stylesheet. */
function makeTarget(id: string, top: number, scrollMarginTop?: string) {
  const el = document.createElement('div')
  el.id = id
  if (scrollMarginTop) el.style.scrollMarginTop = scrollMarginTop
  stubRect(el, top)
  return el
}

let scrollToSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  setWindowScrollY(0)
  scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/* ---------- scrollToAnchor ---------- */

describe('scrollToAnchor', () => {
  test('scrolls the window so the target sits at the viewport top', () => {
    document.body.appendChild(makeTarget('activity', 500))
    setWindowScrollY(200)

    scrollToAnchor('activity')

    // rect.top (500) + scrollY (200) − margin (0)
    expect(scrollToSpy).toHaveBeenCalledWith(0, 700)
  })

  test('subtracts scroll-margin-top so the target clears sticky chrome', () => {
    document.body.appendChild(makeTarget('activity', 500, '62px'))
    setWindowScrollY(200)

    scrollToAnchor('activity')

    // Without the subtraction this is 700 and the target lands under the
    // 46px sticky patient banner. This is the regression that mattered.
    expect(scrollToSpy).toHaveBeenCalledWith(0, 638)
  })

  test('reads scroll-margin-top from a stylesheet, not just inline styles', () => {
    const sheet = document.createElement('style')
    sheet.textContent = '.anchored { scroll-margin-top: 90px; }'
    document.head.appendChild(sheet)
    const el = makeTarget('documents', 1000)
    el.className = 'anchored'
    document.body.appendChild(el)

    scrollToAnchor('documents')

    expect(scrollToSpy).toHaveBeenCalledWith(0, 910)
  })

  test('scrolls the nearest genuinely-scrolling ancestor instead of the window', () => {
    const scroller = makeScroller(50)
    const target = makeTarget('activity', 300, '16px')
    scroller.appendChild(target)
    document.body.appendChild(scroller)

    scrollToAnchor('activity')

    // target.top (300) − scroller.top (50) − margin (16)
    expect(scroller.scrollTop).toBe(234)
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  test('ignores an ancestor that declares overflow but does not actually scroll', () => {
    // An ancestor that declares `overflow-y: auto` while the document is what
    // actually scrolls — `.app-shell__content` at mobile widths, or any card that
    // declares an overflow it never uses. It must not be mistaken for the
    // scroller.
    const inert = document.createElement('div')
    inert.style.overflowY = 'auto'
    Object.defineProperty(inert, 'scrollHeight', { value: 400, configurable: true })
    Object.defineProperty(inert, 'clientHeight', { value: 400, configurable: true })
    stubRect(inert, 0)
    inert.appendChild(makeTarget('activity', 500))
    document.body.appendChild(inert)

    scrollToAnchor('activity')

    expect(scrollToSpy).toHaveBeenCalledWith(0, 500)
  })

  test('does nothing when the anchor names no element', () => {
    scrollToAnchor('nope')
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  test('does nothing for an empty anchor', () => {
    document.body.appendChild(makeTarget('activity', 500))
    scrollToAnchor('')
    expect(scrollToSpy).not.toHaveBeenCalled()
  })
})

/* ---------- the hooks ---------- */

// Renders both hooks under a MemoryRouter and hands the test a navigate
// function, so route changes go through react-router exactly as they do in the
// app rather than being simulated.
function renderWithRoute(
  initialEntry: string,
  hook: () => void,
): { navigate: NavigateFunction } {
  const captured: { navigate: NavigateFunction | null } = { navigate: null }

  function Harness() {
    hook()
    const navigate = useNavigate()
    useEffect(() => {
      captured.navigate = navigate
    }, [navigate])
    return null
  }

  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness />
    </MemoryRouter>,
  )
  return { navigate: captured.navigate as NavigateFunction }
}

describe('useScrollToHash', () => {
  test('scrolls to the hash target on mount', () => {
    document.body.appendChild(makeTarget('documents', 800))

    renderWithRoute('/patient/chart#documents', useScrollToHash)

    expect(scrollToSpy).toHaveBeenCalledWith(0, 800)
  })

  test('does not scroll when the route carries no hash', () => {
    document.body.appendChild(makeTarget('documents', 800))

    renderWithRoute('/patient/chart', useScrollToHash)

    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  test('scrolls again when the hash changes', () => {
    document.body.appendChild(makeTarget('activity', 300))
    document.body.appendChild(makeTarget('documents', 800))

    const { navigate } = renderWithRoute('/patient/chart#activity', useScrollToHash)
    expect(scrollToSpy).toHaveBeenCalledWith(0, 300)

    act(() => navigate('/patient/chart#documents'))
    expect(scrollToSpy).toHaveBeenCalledWith(0, 800)
  })
})

describe('useScrollToTopOnNavigate', () => {
  test('returns to the top when the pathname changes', () => {
    const { navigate } = renderWithRoute('/population', useScrollToTopOnNavigate)
    scrollToSpy.mockClear()

    act(() => navigate('/patient/chart/patient-001'))

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  test('returns to the top when only the search string changes', () => {
    const { navigate } = renderWithRoute('/patient/chart', useScrollToTopOnNavigate)
    scrollToSpy.mockClear()

    act(() => navigate('/patient/chart?new=1'))

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  test('stands aside when the destination carries a hash', () => {
    // The anchor scroll owns this case. Resetting to the top first would fight
    // it — and did, before the guard.
    const { navigate } = renderWithRoute('/population', useScrollToTopOnNavigate)
    scrollToSpy.mockClear()

    act(() => navigate('/patient/chart/patient-001#documents'))

    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  test('zeroes the shell scroll container as well as the window', () => {
    // Which of the two actually scrolls depends on content height, so both are
    // reset; on whichever is not scrolling it is a no-op.
    const content = document.createElement('div')
    content.className = 'app-shell__content'
    content.scrollTo = vi.fn()
    document.body.appendChild(content)

    const { navigate } = renderWithRoute('/population', useScrollToTopOnNavigate)
    act(() => navigate('/guide'))

    expect(content.scrollTo).toHaveBeenCalledWith(0, 0)
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })
})
