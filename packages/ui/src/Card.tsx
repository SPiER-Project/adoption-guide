/**
 * The one bordered panel: a section of a page, a summary strip, an item in a
 * list of records, a CDS card.
 *
 * Seventy-six surfaces set border + radius + padding + background before
 * this existed, in 29 (padding, radius) combinations with no combination
 * over 15% (maintainability audit 2026-09-15, §2.4). The decisions, once:
 *
 *   surface  `--surface-card` on a 1px `--border-default`, `--radius-2xl`
 *            (the website's card corner). Tone `muted` swaps the ground for
 *            `--surface-muted` (a panel that explains rather than holds);
 *            `brand` for a peach-soft ground (the pathway simulator);
 *            `wash` for the brand gradient at its soft weight, the website's
 *            stat band (the caseload summary).
 *   padding  `roomy` (`--space-5`) for a page section; `compact`
 *            (`--space-3 --space-4`) for an item inside one.
 *   accent   a 3px left edge in `--brand-primary`, for the panel that is the
 *            page's point (a pathway step, the concept layer). A page with
 *            a domain colour for that edge — a CDS card's indicator — keeps
 *            ONLY the `border-left-color` rule, as a className modifier.
 *
 * A page may pass `className` for LAYOUT — where the card sits, how its
 * children flow, a state modifier — never for what it looks like. No radius,
 * padding, border or background belongs in that class.
 *
 * Not a Card: an interactive tile that selects or expands (`.preset-card`) —
 * that is a control, and gets its affordances from its own rules.
 */
import type { ReactNode } from 'react'
import { cx } from './cx'
import './Card.css'

export function Card({
  as: Tag = 'div',
  padding = 'roomy',
  tone = 'card',
  accent,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  children,
}: {
  as?: 'div' | 'section' | 'article' | 'aside' | 'li'
  padding?: 'roomy' | 'compact'
  tone?: 'card' | 'muted' | 'brand' | 'wash'
  accent?: boolean
  /** Layout and state only — see the header. */
  className?: string
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  children: ReactNode
}) {
  return (
    <Tag
      className={cx('card', `card--${padding}`, tone !== 'card' && `card--${tone}`, accent && 'card--accent', className)}
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
    >
      {children}
    </Tag>
  )
}
