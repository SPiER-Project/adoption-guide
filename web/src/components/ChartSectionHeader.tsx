/**
 * The heading row every chart section renders: a title, an optional count, and
 * — when the section can be collapsed — the title as the toggle.
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
 * three sections had already drifted into three copies of it.
 */
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function ChartSectionHeader({
  title,
  count,
  collapsible,
}: {
  title: string
  /** "3 episodes", "10 total" — rendered to the right of the title. */
  count?: ReactNode
  /** Present when the section body can be hidden; the title becomes the control. */
  collapsible?: { open: boolean; onToggle: () => void; controls: string }
}) {
  return (
    <header className="chart-section-header">
      <h3 className="chart-section-title">
        {collapsible ? (
          <button
            type="button"
            className="chart-section-toggle"
            aria-expanded={collapsible.open}
            aria-controls={collapsible.controls}
            onClick={collapsible.onToggle}
          >
            <span className="chart-section-caret" aria-hidden>
              {collapsible.open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            {title}
          </button>
        ) : (
          title
        )}
      </h3>
      {count !== undefined && <span className="chart-section-count">{count}</span>}
    </header>
  )
}
