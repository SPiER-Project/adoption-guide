import { useEffect, useState } from 'react'

/**
 * Is this viewport a phone?
 *
 * ⚠️ **A media query, not a `ResizeObserver`.** `PanelShell` measures its own
 * box because a SMART panel can be 470px wide inside a 1,440px screen, so the
 * viewport tells it nothing. The caseload is the opposite case: it is a
 * top-level page that fills whatever it is opened in, and the question it asks
 * — "is this a phone" — is the one a media query answers. Keeping the two
 * mechanisms apart is deliberate; `matchMedia` here would have been wrong for
 * the panel and an observer here would be measuring the window through a box.
 *
 * ⚠️ **`640` is one of the three breakpoint literals** the CSS is allowed
 * (`docs/internals/css-and-page-template.md`), so the summary's collapse rule
 * and the stylesheet change at the same width rather than a pixel apart.
 *
 * ⚠️ **Defaults to "not narrow" when `matchMedia` is missing**, which is jsdom.
 * The other way round makes the narrow branch the default in every test that
 * never thought about it — the same trap PR 4 hit when a zero width read as
 * narrow (`PanelShell`).
 */
const PHONE = '(max-width: 640px)'

export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(PHONE).matches
      : false,
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(PHONE)
    const onChange = () => setNarrow(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return narrow
}
