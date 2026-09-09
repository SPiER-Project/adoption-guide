import { Link, Outlet, useLocation } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { GUIDE_SECTIONS, guideGroupLabel, guideHref } from '../data/guideSections'
import '../css/AdoptionGuide.css'

export function AdoptionGuide() {
  const location = useLocation()

  // The active section is the last path segment under /guide. The index route
  // redirects /guide → /guide/pathway, so a bare /guide falls back to the
  // first section rather than rendering a titleless header.
  const segment = location.pathname.replace(/^\/guide\/?/, '').split('/')[0]
  const activeIndex = Math.max(
    0,
    GUIDE_SECTIONS.findIndex(s => s.path === segment),
  )
  const active = GUIDE_SECTIONS[activeIndex]
  const prev = activeIndex > 0 ? GUIDE_SECTIONS[activeIndex - 1] : null
  const next =
    activeIndex < GUIDE_SECTIONS.length - 1 ? GUIDE_SECTIONS[activeIndex + 1] : null

  // The width test is hoisted out of the JSX so the className expression below
  // contains nothing but the two class lists. `check:template` reads the page
  // root's classes out of this file's source — a root class it cannot see is a
  // page width it cannot check against the two-token vocabulary — and it
  // rejects a literal in there that is not part of the root's own block, which
  // an inline `active.width === 'wide'` would have put there.
  const wide = active.width === 'wide'

  return (
    <div className={wide ? 'implementation-guide implementation-guide--wide' : 'implementation-guide'}>
      <PageHeader eyebrow={['Adoption Guide', guideGroupLabel(active.group)]} title={active.label} />

      {/* A `<div>`, not a `<main>`: AppShell already renders the document's one
          `<main>` around this outlet, and a second one nested inside it is not a
          landmark a screen reader can make sense of. */}
      <div className="ig-content">
        <Outlet />

        <nav className="guide-pager" aria-label="Guide sections">
          {prev ? (
            <Link to={guideHref(prev.path)} className="guide-pager__link guide-pager__link--prev">
              <span className="guide-pager__dir">← Previous</span>
              <span className="guide-pager__label">{prev.label}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={guideHref(next.path)} className="guide-pager__link guide-pager__link--next">
              <span className="guide-pager__dir">Next →</span>
              <span className="guide-pager__label">{next.label}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </div>
  )
}
