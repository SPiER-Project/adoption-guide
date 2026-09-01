import { useLayoutEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useScrollToTopOnNavigate } from '../hooks/useScrollToHash'
import { PatientBanner } from './PatientBanner'
import { Sidebar } from './Sidebar'
import { SpierLogo } from './SpierLogo'
import '../css/EhrShell.css'

// ⚠️ **The app bar carries no links, and that is where they used to be.** Three
// outbound pills lived here, with `HeaderMenu` as an overflow disclosure below
// 640px — two renderings of one list, swapped by CSS. Adding a fourth (the mock
// EHR demo) did not fit at any width, and the disclosure was 121 lines of
// Escape/pointerdown/blur handling for links that are just links once they are in
// a list. Both are gone; `DESTINATIONS` in `Sidebar.tsx` owns the real
// destinations now (`.sidebar-footer`'s "Elsewhere" group), and the note there
// records why that does not re-break the "a lens that can never be active"
// objection that moved the IG link up here in the first place.
//
// `PROJECT_LINKS` lived alongside `DESTINATIONS` in that same sidebar group
// until the true page footer got a sidebar-shaped bug: the sidebar's height is
// pinned to the viewport, so on any page short enough not to fill it, the
// sidebar's sticky box visually covered `.ehr-footer` at the bottom of the page.
// The links moved down here, into the footer that already carries the SPiER
// tagline, so they render full-width below the sidebar rather than at the
// bottom of a column that can be obscured. See `PROJECT_LINKS` below and the
// note on `.sidebar` in `Sidebar.css` for the height fix that makes the two
// stop overlapping regardless.
//
// What the header keeps is the hamburger and the brand — plus, still, the
// natural slot for a SMART-connection indicator.

/** Project metadata, rendered in the page footer — see the note above. */
const PROJECT_LINKS = [
  { key: 'site', href: 'https://thespierproject.org', label: 'thespierproject.org' },
  { key: 'repo', href: 'https://github.com/SPiER-Project/adoption-guide', label: 'GitHub' },
] as const

/**
 * Publishes the app bar's live height as `--ehr-header-height`.
 *
 * ── Why anything needs to know this ─────────────────────────────────────────
 *
 * The bar is `position: sticky` (see EhrShell.css), and three things have to sit
 * *below* it rather than under it: the sidebar's viewport-height box, the patient
 * banner's own sticky offset, and `--anchor-scroll-offset`. Every one of those
 * needs the number, and the bar has no fixed height to hardcode — it is
 * content-sized, `padding: 0.65rem` plus a wordmark, and it is allowed to wrap to
 * two lines below 640px when a user scales text up. So it is measured.
 *
 * ⚠️ **Second hand-written copy of this pattern; `PatientBanner`'s
 * `useBannerHeightVar` is the first, and `useFooterHeightVar` below is now the
 * third.** Two is a pair, three is drift, and normally that would be the signal
 * to extract one `useElementHeightVar(name)` hook — but `check:tokens` (see
 * below) scrapes a *literal* `setProperty('--token', …)` call per token; a
 * shared hook taking the property name as a runtime argument would stop
 * satisfying that scrape, silently un-gating every `var(--…)` it feeds. Kept as
 * three hand-written copies for that reason, on top of the original one
 * (unifying still means touching the working anchor-offset plumbing to fix a
 * layout bug that isn't in it).
 *
 * `check:tokens` scrapes `setProperty` calls rather than reading an allowlist, so
 * this token is recognized by virtue of this line existing — and stops being
 * recognized if this line goes.
 */
function useHeaderHeightVar() {
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!headerEl) return
    const publish = () =>
      document.documentElement.style.setProperty(
        '--ehr-header-height',
        `${Math.round(headerEl.getBoundingClientRect().height)}px`,
      )
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(headerEl)
    return () => {
      observer.disconnect()
      // PanelShell renders instead of this shell when embedded, and it has no
      // app bar — so a stale height would offset the panel's anchors by 47px.
      // Every consumer falls back to 0px.
      document.documentElement.style.removeProperty('--ehr-header-height')
    }
  }, [headerEl])

  return setHeaderEl
}

/**
 * Publishes the page footer's live height as `--ehr-footer-height`, which
 * `.sidebar` subtracts (alongside `--ehr-header-height`) from its own height.
 *
 * ── Why the sidebar needs this ──────────────────────────────────────────────
 *
 * `.sidebar` is `height: calc(100dvh - header height)`, pinned to the viewport
 * so it stays visible on long pages. On a page short enough to fit inside the
 * viewport with room to spare, that box reaches all the way to the bottom of
 * the viewport regardless — and since `position: sticky` makes it a positioned
 * element, it paints *over* the non-positioned `.ehr-footer` wherever the two
 * overlap, covering the footer's text rather than sitting above it. Subtracting
 * the footer's own height stops the box short of the footer's row instead.
 *
 * Measured rather than hardcoded because the footer wraps to two lines below
 * 768px (see EhrShell.css) and grows when a link label wraps just above it.
 */
function useFooterHeightVar() {
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!footerEl) return
    const publish = () =>
      document.documentElement.style.setProperty(
        '--ehr-footer-height',
        `${Math.round(footerEl.getBoundingClientRect().height)}px`,
      )
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(footerEl)
    return () => {
      observer.disconnect()
      // PanelShell renders instead of this shell when embedded, and it has no
      // footer — every consumer falls back to 0px.
      document.documentElement.style.removeProperty('--ehr-footer-height')
    }
  }, [footerEl])

  return setFooterEl
}

export function EhrShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const setHeaderEl = useHeaderHeightVar()
  const setFooterEl = useFooterHeightVar()
  const location = useLocation()
  useScrollToTopOnNavigate()
  const isPatientView =
    location.pathname.startsWith('/patient') || location.pathname.startsWith('/chart')

  return (
    <div className="ehr-shell">
      <header className="ehr-header" ref={setHeaderEl}>
        <div className="ehr-header-content">
          <button
            className="ehr-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={sidebarOpen}
          >
            <span className={`ehr-hamburger ${sidebarOpen ? 'ehr-hamburger--active' : ''}`} />
          </button>
          <Link to="/" className="ehr-brand">
            <SpierLogo className="ehr-brand-logo" />
          </Link>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="ehr-content">
        {isPatientView && <PatientBanner />}
        <div className="ehr-content-body">
          <Outlet />
        </div>
      </main>

      <footer className="ehr-footer" ref={setFooterEl}>
        <span>SPiER — Setting priorities for technology-enabled suicide-safer care</span>
        <nav className="ehr-footer-links" aria-label="Project links">
          {PROJECT_LINKS.map(l => (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${l.label} (opens in a new tab)`}
            >
              {l.label}
              <span aria-hidden="true">&#8599;</span>
            </a>
          ))}
          <span className="ehr-footer-version">SPiER v0.1.0</span>
        </nav>
      </footer>
    </div>
  )
}
