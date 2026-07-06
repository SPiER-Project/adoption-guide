import { Link, Outlet, useLocation } from 'react-router-dom'
import { GUIDE_SECTIONS, guideHref } from '../data/guideSections'
import '../css/AdoptionGuide.css'

export function AdoptionGuide() {
  const location = useLocation()

  // The active section is the last path segment under /guide. The index route
  // redirects /guide → /guide/overview, so a bare /guide falls back to the
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

  return (
    <div className="implementation-guide">
      <header className="ig-header">
        <p className="ig-eyebrow">Adoption Guide</p>
        <h2 className="ig-title">{active.label}</h2>
      </header>

      <main className="ig-content">
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
      </main>
    </div>
  )
}
