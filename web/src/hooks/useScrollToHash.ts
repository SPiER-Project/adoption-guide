import { useCallback, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

function scrollToAnchor(anchor: string) {
  if (!anchor) return
  const el = document.getElementById(anchor)
  if (!el) return
  // Element.scrollIntoView() misbehaves in this app's shell: several ancestors
  // declare `overflow-y: auto` but never actually scroll (their content grows
  // the grid so the *document* scrolls instead), and scrollIntoView picks the
  // wrong boundary and overshoots. So find the nearest ancestor that genuinely
  // scrolls and scroll it by the element's offset; fall back to the window.
  let scroller: HTMLElement | null = el.parentElement
  while (scroller) {
    const { overflowY } = getComputedStyle(scroller)
    if ((overflowY === 'auto' || overflowY === 'scroll') && scroller.scrollHeight > scroller.clientHeight) {
      break
    }
    scroller = scroller.parentElement
  }
  if (scroller) {
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  } else {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY)
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
