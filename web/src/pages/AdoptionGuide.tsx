import { Link, Outlet, useLocation } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { GUIDE_SECTIONS, guideGroupLabel, guideHref, resolveGuidePath } from '../data/guideSections'
import '../css/AdoptionGuide.css'

export function AdoptionGuide() {
  const location = useLocation()

  // Which section owns this path, and whether the path names one of its
  // subsections. The index route redirects /guide → /guide/pathway, so a bare
  // /guide falls back to the first section rather than rendering a titleless
  // header.
  const resolved = resolveGuidePath(location.pathname)
  const active = resolved?.section ?? GUIDE_SECTIONS[0]
  const subsection = resolved?.subsection
  const activeIndex = Math.max(0, GUIDE_SECTIONS.indexOf(active))
  // ⚠️ The pager walks SECTIONS, and a subsection borrows its owner's
  // neighbours rather than becoming a step. Making it a step would put a page
  // in the linear read that the sidebar does not list, so a reader paging
  // through the guide would land somewhere they cannot navigate back to by the
  // same means.
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
      {/* A subsection is a DRILL-IN, so it follows PageHeader's documented rule
          for one rather than the guide's rule for a section: the eyebrow names
          the page's parent, `up` points at it, and the pill marks it as a page
          below a lens. That renders "← Tools" over "Adoption Readiness".
          ⚠️ `up` links the FIRST eyebrow segment, so the trail cannot keep
          "Adoption Guide" in front — it would make that word the way back to
          Tools. A section keeps the two-segment group trail and no `up`. */}
      {subsection ? (
        <PageHeader
          eyebrow={active.label}
          up={guideHref(active.path)}
          eyebrowStyle="pill"
          title={subsection.label}
        />
      ) : (
        <PageHeader eyebrow={['Adoption Guide', guideGroupLabel(active.group)]} title={active.label} />
      )}

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
