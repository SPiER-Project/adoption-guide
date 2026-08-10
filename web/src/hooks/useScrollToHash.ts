import { useCallback, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Exported for tests — the scroll arithmetic is the part worth pinning. */
export function scrollToAnchor(anchor: string) {
  if (!anchor) return
  const el = document.getElementById(anchor)
  if (!el) return
  // Element.scrollIntoView() misbehaves in this app's shell: several ancestors
  // declare `overflow-y: auto` but never actually scroll (their content grows
  // the grid so the *document* scrolls instead), and scrollIntoView picks the
  // wrong boundary and overshoots. So find the nearest ancestor that genuinely
  // scrolls and scroll it by the element's offset; fall back to the window.
  //
  // Because the scroll is manual, `scroll-margin-top` does not apply on its own
  // — the CSS property is honored by scrollIntoView() and native fragment
  // navigation, neither of which runs here. Read it and subtract it, so every
  // such declaration in the stylesheets means what it says rather than sitting
  // dead. Without this the target lands flush against the viewport edge, which
  // for a target inside a bordered card clips the card's top edge.
  const scrollMargin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  let scroller: HTMLElement | null = el.parentElement
  while (scroller) {
    const { overflowY } = getComputedStyle(scroller)
    if ((overflowY === 'auto' || overflowY === 'scroll') && scroller.scrollHeight > scroller.clientHeight) {
      break
    }
    scroller = scroller.parentElement
  }
  if (scroller) {
    scroller.scrollTop +=
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scrollMargin
  } else {
    // Both scrollTo and scrollTop clamp to the scrollable range, so a target
    // near the top (negative result) or the bottom of a short page just lands
    // at the range's edge — that clamp is correct, not an offset bug.
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - scrollMargin)
  }
}

/**
 * Scrolls to the element whose id matches the router hash — on mount and
 * whenever the hash changes (sidebar links, the guide pager, browser
 * back/forward). Disables the browser's automatic scroll restoration so the
 * anchor scroll isn't clobbered when a page mounts with a hash.
 *
 * In a HashRouter app the section anchor is the part after the *second* '#'
 * (`#/patient/chart#activity` → `location.hash === '#activity'`), which React
 * Router surfaces as `location.hash`.
 *
 * Returns `jumpTo(anchor)` for in-page controls (e.g. the pathway tracker): it
 * updates the hash on the *current* path — preserving any patient id or route
 * params — and scrolls, without a full navigation.
 */
export function useScrollToHash() {
  const location = useLocation()

  useLayoutEffect(() => {
    const prev = history.scrollRestoration
    if (prev !== undefined) history.scrollRestoration = 'manual'
    return () => {
      if (prev !== undefined) history.scrollRestoration = prev
    }
  }, [])

  // Scroll to the hash target on mount and on every hash change. The immediate
  // useLayoutEffect pass (before paint) handles pages whose layout is already
  // settled — no scroll flash. A second pass on the next animation frame
  // corrects tall, lazily-rendered pages (e.g. the guide pathway) whose final
  // height isn't known at mount, so a cold deep-link would otherwise overshoot.
  useLayoutEffect(() => {
    const anchor = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
    if (!anchor) return
    scrollToAnchor(anchor)
    const raf = requestAnimationFrame(() => scrollToAnchor(anchor))
    return () => cancelAnimationFrame(raf)
  }, [location.hash])

  const jumpTo = useCallback(
    (anchor: string) => {
      history.replaceState(null, '', `#${location.pathname}#${anchor}`)
      scrollToAnchor(anchor)
    },
    [location.pathname],
  )

  return { jumpTo }
}

/**
 * Returns to the top of the page whenever the route changes. Without this a
 * deep scroll carries over into the next route — leaving the Population table
 * halfway down lands you halfway down a patient chart.
 *
 * Keyed on pathname + search, not the whole location: a route reached *with* a
 * section anchor belongs to `useScrollToHash`, and scrolling to the top first
 * would fight it.
 *
 * `useLayoutEffect` so the reset lands before paint. Lazily-routed pages render
 * their Suspense fallback first, so this fires against the fallback — which is
 * exactly right, since the real content then mounts at the top.
 */
export function useScrollToTopOnNavigate() {
  const location = useLocation()
  const routeKey = `${location.pathname}${location.search}`

  useLayoutEffect(() => {
    if (location.hash) return
    // Which element actually scrolls depends on content height: `.ehr-content`
    // declares `overflow-y: auto` but often lets the document scroll instead
    // (see the note on scrollToAnchor). Zeroing both is safe — on whichever one
    // isn't scrolling it's a no-op.
    document.querySelector<HTMLElement>('.ehr-content')?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [routeKey, location.hash])
}
