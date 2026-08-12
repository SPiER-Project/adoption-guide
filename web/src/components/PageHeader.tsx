import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import '../css/PageHeader.css'

/**
 * The one page header.
 *
 * Every top-level lens used to roll its own: four class prefixes (`overview__`,
 * `ig-`, `population-`, `patient-chart-`), four different answers to whether
 * there is an eyebrow, two different title colors, and one of them — the guide —
 * on a card band that also indented its whole body by 24px. The lenses were
 * visibly not the same page template, which is what this component exists to
 * make impossible: there is nowhere left to express a variant.
 *
 * Padding is deliberately absent. `.ehr-content-body` is the sole owner of the
 * page's inset (see EhrShell.css); a header that padded itself is exactly how
 * the guide and the Population view ended up 24px further in than the other two.
 * `npm run check:template` enforces both halves of that.
 */
interface PageHeaderProps {
  /**
   * The trail above the title: what this page sits inside. `['Adoption Guide',
   * 'Learn']` renders as `ADOPTION GUIDE / LEARN`. The separator is the
   * component's business, not the caller's, so a caller cannot introduce a
   * second punctuation style.
   *
   * Required, and the rule is "name the page's parent" — the lens for a page
   * inside one (`Patient View` → Patient Chart), the project for a lens that is
   * a single page (`SPiER` → Population View). It started out optional, and the
   * one page that skipped it had its title sitting 24px higher than the other
   * three: an absent eyebrow is a layout difference, not just a missing label.
   */
  eyebrow: string | string[]
  /**
   * Route to the page's parent. Turns the *first* eyebrow segment into a link
   * back to it, arrow included — so a drill-in page's way out is part of the
   * trail that already names where it is, rather than a second component
   * alongside it.
   *
   * The form views each carried their own `.breadcrumb` nav for this: a second
   * trail implementation, sitting above the card whose header was a third place
   * a title could live. A `to` rather than a free ReactNode segment on purpose —
   * the trail stays text, and a caller cannot smuggle arbitrary markup into it.
   */
  up?: string
  /** The page title. Rendered as the page's only `<h2>`. */
  title: ReactNode
  /**
   * One paragraph on what the page is for. Body prose belongs below the header;
   * this is the sentence a reader needs before deciding to read any of it.
   */
  lede?: ReactNode
}

export function PageHeader({ eyebrow, up, title, lede }: PageHeaderProps) {
  const trail = Array.isArray(eyebrow) ? eyebrow : [eyebrow]

  return (
    <header className="page-header">
      <p className="page-header__eyebrow">
        {trail.map((part, i) => (
          <span key={part}>
            {/* The slash is decoration; the spaces around it are real, so the
                trail reads as "Adoption Guide Learn" to a screen reader
                rather than running the two words together. */}
            {i > 0 && (
              <>
                {' '}
                <span className="page-header__eyebrow-sep" aria-hidden="true">
                  /
                </span>{' '}
              </>
            )}
            {i === 0 && up !== undefined ? (
              <Link to={up} className="page-header__up">
                {/* The arrow is inside the link so the whole affordance is one
                    target, and aria-hidden so the accessible name stays the
                    destination's name. */}
                <span aria-hidden="true">←</span> {part}
              </Link>
            ) : (
              part
            )}
          </span>
        ))}
      </p>
      <h2 className="page-header__title">{title}</h2>
      <div className="page-header__rule" />
      {lede !== undefined && <p className="page-header__lede">{lede}</p>}
    </header>
  )
}
