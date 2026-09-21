import { useEffect, useState, type RefObject } from 'react'

/**
 * The phone breakpoint, in pixels, as a number this module can compare against.
 *
 * ⚠️ **Not a token, and that is the convention rather than an exception.** The
 * repo's three breakpoints are literals (640 / 768 / 1024) because `var()`
 * cannot be read inside `@media` — see `docs/internals/css-and-page-template.md`.
 * This is the same number reached from JavaScript instead of from CSS, so it is
 * written the same way, once, here.
 */
export const PHONE_BREAKPOINT = 640

/**
 * Whether the observed element is itself narrower than the phone breakpoint.
 *
 * The element's OWN width, not the window's: this runs inside a host EHR's
 * iframe, where the window is the frame and the frame is what the host sized.
 *
 * ⚠️ **A width of zero is "not measured yet", never "narrow".** jsdom reports 0
 * for every element, and so does a real browser for one frame before layout, so
 * a naive `width < 640` starts life true everywhere — which would make the
 * narrow branch the default and the wide branch the thing nobody ever sees. The
 * state therefore starts `false` and only ever moves on a positive measurement.
 */
export function useIsNarrow(ref: RefObject<HTMLElement | null>): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const width = el.getBoundingClientRect().width
      if (width > 0) setIsNarrow(width < PHONE_BREAKPOINT)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return isNarrow
}
