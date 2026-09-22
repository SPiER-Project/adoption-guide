import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from './cx'
import './PageHeader.css'

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
 * Padding is deliberately absent. `.app-shell__body` is the sole owner of the
 * page's inset (see AppShell.css); a header that padded itself is exactly how
 * the guide and the Population view ended up 24px further in than the other two.
 * `npm run check:template` enforces both halves of that.
 */
/**
 * One segment of the trail. A bare string is a segment with nowhere to go; a
 * `{ label, to }` is a link.
 *
 * ⚠️ **`to` per segment, rather than a second `up`.** The header carried ONE
 * link — `up`, on the first segment, with a back arrow — which is a back button
 * wearing a trail's clothes: on `/patient/assessments/crisis-resources` it read
 * `← PATIENT CHART` and said nothing about the four levels between the chart and
 * the form (Brad, 2026-09-22). A trail whose segments each resolve is the thing
 * that answers "where am I"; the arrow form stays for the pages that really do
 * have exactly one ancestor.
 */
export type Crumb = string | { label: string; to: string }

interface PageHeaderProps {
  /**
   * The trail above the title: what this page sits inside. `['Adoption Guide',
   * 'Learn']` renders as `ADOPTION GUIDE / LEARN`, and a segment given as
   * `{ label, to }` is a link to that ancestor. The separator is the
   * component's business, not the caller's, so a caller cannot introduce a
   * second punctuation style.
   *
   * Required, and the rule is "name the page's parent" — what `up` points at
   * for a drill-in (`Patient Chart` → an assessment; `Caseload` → Measures), the
   * project for a page with no parent above it (`SPiER` → Patient Chart, and
   * `SPiER` → Caseload). ⚠️ The examples here used to be `Patient View` and
   * `Population View`, which were lens names, and the lenses are gone — a rule
   * illustrated with a retired vocabulary teaches the wrong answer to whoever
   * copies it next. It started out optional, and the
   * one page that skipped it had its title sitting 24px higher than the other
   * three: an absent eyebrow is a layout difference, not just a missing label.
   */
  eyebrow: Crumb | Crumb[]
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
  /**
   * How the trail is drawn. `text` (default): terracotta small caps, the
   * website's section label. `pill`: the same words inside an outlined
   * terracotta pill — the website's treatment on every page BELOW the home
   * page, so here it marks a drill-in (a page with `up`), never a lens.
   */
  eyebrowStyle?: 'text' | 'pill'
  /** The page title. Rendered as the page's only `<h2>`. */
  title: ReactNode
  /**
   * One paragraph on what the page is for. Body prose belongs below the header;
   * this is the sentence a reader needs before deciding to read any of it.
   */
  lede?: ReactNode
}

const labelOf = (crumb: Crumb): string => (typeof crumb === 'string' ? crumb : crumb.label)

export function PageHeader({ eyebrow, up, eyebrowStyle = 'text', title, lede }: PageHeaderProps) {
  const trail = Array.isArray(eyebrow) ? eyebrow : [eyebrow]

  return (
    <header className="page-header">
      {/* ⚠️ A `<nav>`, not a `<p>`, as soon as any segment is a link — which is
          what a breadcrumb is, and what lets a screen reader skip it. The
          element is chosen by the CONTENT rather than by a prop: a caller
          cannot render a trail of links and forget to say so. */}
      <p
        className={cx('page-header__eyebrow', eyebrowStyle === 'pill' && 'page-header__eyebrow--pill')}
        role={trail.some(c => typeof c !== 'string') ? 'navigation' : undefined}
        aria-label={trail.some(c => typeof c !== 'string') ? 'Breadcrumb' : undefined}
      >
        {trail.map((part, i) => (
          <span key={labelOf(part)}>
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
            {typeof part !== 'string' ? (
              <Link to={part.to} className="page-header__crumb">
                {part.label}
              </Link>
            ) : i === 0 && up !== undefined ? (
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
        {/* ⚠️ The separator between the trail and the TITLE, drawn only in panel
            chrome — where `PageHeader.css` collapses the header onto one line,
            so the title is the trail's last segment and reads as one without
            it. In a standalone tab the title is a heading below the trail and a
            trailing slash would be punctuation with nothing after it. */}
        <span className="page-header__eyebrow-sep page-header__eyebrow-sep--title" aria-hidden="true">
          {' '}
          /
        </span>
      </p>
      <h2 className="page-header__title">{title}</h2>
      <div className="page-header__rule" />
      {lede !== undefined && <p className="page-header__lede">{lede}</p>}
    </header>
  )
}
