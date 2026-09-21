/**
 * The one disclosure: a labelled section that costs one line until it is asked
 * for. The ninth surface owner, added 2026-09-20.
 *
 * ── Why a ninth ────────────────────────────────────────────────────────────
 *
 * The mock-EHR pass settled the pattern this repo now applies everywhere —
 * **task first, caveats and reference demoted into closed drawers, never
 * deleted** — and the adoption-guide audit applies it to the guide. Before this
 * existed the same object was hand-rolled six times, and two of the six
 * (`.ar-legend-block` on Adoption Readiness, `.rubric-legend-criterion` on the
 * Adoption Rubric) were **byte-identical CSS in two stylesheets**: same border,
 * same `--radius-2xl`, same summary padding, same hover. `check:dupes` reads
 * functions, not stylesheets, so nothing was ever going to catch that pair.
 *
 * Three looks, because three were already in use and a fourth would be a
 * decision someone has to make deliberately:
 *
 *   rule   (default) a hairline above, a body-size label, an optional quiet
 *          hint on the same line. A reference section under prose — the tool
 *          page's catalogue detail, and the two drawers every "see it running"
 *          page closes its content into.
 *   boxed  a bordered block with a tinted summary. A legend or a glossary,
 *          stacked with its siblings.
 *   quiet  small, muted, marker-led. A secondary aside inside something else.
 *
 * ⚠️ **The summary stays `display: list-item`.** A `<summary>` set to `flex`
 * loses its `::marker`, and a drawer with no triangle does not read as one —
 * so the label and the hint are inline spans inside it, never a flex row.
 *
 * ── What is deliberately NOT a Disclosure ──────────────────────────────────
 *
 * Three `<details>` on the clinician's surfaces keep their own markup, each
 * for a reason written at its own call site:
 *
 *   - `PopulationAlertsPanel`'s alert rows — the summary is a composed data row
 *     (a count Pill, a patient name, the alert labels), not a label. Scanning
 *     it without opening it is the whole point.
 *   - `InstrumentHeader`'s "About this instrument" and `PathwayStage`'s
 *     "Use a different instrument" — both carry a recorded judgement about
 *     their weight inside a clinician's form, and the audit PR that added this
 *     component is about the guide's copy. Adopting them is a follow-up that
 *     should be looked at in the clinical chrome, not inherited from here.
 *
 * A page may pass `className` for **layout only** — where the drawer sits,
 * what it is spaced against — never a radius, padding, border or background.
 */
import type { ReactNode } from 'react'
import { cx } from './cx'
import './Disclosure.css'

export type DisclosureVariant = 'rule' | 'boxed' | 'quiet'

export function Disclosure({
  summary,
  hint,
  variant = 'rule',
  defaultOpen = false,
  className,
  children,
}: {
  /** The label on the closed line. Says what is inside without opening it. */
  summary: ReactNode
  /** An optional quieter note beside the label — a count, a one-line gloss. */
  hint?: ReactNode
  variant?: DisclosureVariant
  /**
   * ⚠️ Opening by default is a judgement, not a convenience: a drawer that
   * starts open is a section with a triangle on it, and the reason this
   * component exists is that the page fits on one screen when they are closed.
   */
  defaultOpen?: boolean
  /** Layout only — never a radius, padding, border or background. */
  className?: string
  children: ReactNode
}) {
  return (
    <details
      className={cx('disclosure', `disclosure--${variant}`, className)}
      open={defaultOpen}
    >
      <summary className="disclosure__summary">
        <span className="disclosure__label">{summary}</span>
        {hint !== undefined && <span className="disclosure__hint">{hint}</span>}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  )
}
