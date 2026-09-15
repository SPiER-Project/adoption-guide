/**
 * The heading row for a section below the page title: an <h3>, optional meta
 * text on the right (a count, a one-line summary), and — when the section can
 * be collapsed — the title as the toggle.
 *
 * This is the ONLY section heading row. Eleven hand-rolled copies of it had
 * drifted to four gaps, five margins and three type sizes by 2026-09-15; the
 * page template gate (`check:template`) already fixes the <h2> level, and
 * this component fixes the <h3> level the same way — by owning it.
 *
 * ── Why the sections became collapsible ─────────────────────────────────────
 *
 * Reviewed as a user in the embedded panel (2026-09-01): the episode record
 * (17 artifacts across 4 contacts) and the document list (10 rows) rendered
 * fully expanded below the pathway rail, so the panel ran to dozens of screens
 * and the thing a clinician came for — where the patient is and what to do —
 * was the top few percent of it. In the full app shell there is a sidebar and
 * a wide column, so the sections stay open there; in panel chrome they start
 * collapsed, and the count on the header says what is inside.
 *
 * One component rather than three copies of the header markup, because the
 * three sections had already drifted into three copies of it. (It was
 * `ChartSectionHeader` until the audit found eight more copies outside the
 * chart.)
 */
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import '../css/SectionHeader.css'

export function SectionHeader({
  title,
  meta,
  collapsible,
  id,
}: {
  title: string
  /** "3 episodes", "10 total", "4 of 5 tiers written back" — right of the title. */
  meta?: ReactNode
  /** Present when the section body can be hidden; the title becomes the control. */
  collapsible?: { open: boolean; onToggle: () => void; controls: string }
  /** On the <h3>, for a section's `aria-labelledby`. */
  id?: string
}) {
  return (
    <header className="section-header">
      <h3 className="section-header__title" id={id}>
        {collapsible ? (
          <button
            type="button"
            className="section-header__toggle"
            aria-expanded={collapsible.open}
            aria-controls={collapsible.controls}
            onClick={collapsible.onToggle}
          >
            <span className="section-header__caret" aria-hidden>
              {collapsible.open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            {title}
          </button>
        ) : (
          title
        )}
      </h3>
      {meta !== undefined && <p className="section-header__meta">{meta}</p>}
    </header>
  )
}
