/**
 * The one bordered panel: a section of a page, a summary strip, an item in a
 * list of records, a CDS card.
 *
 * Seventy-six surfaces set border + radius + padding + background before
 * this existed, in 29 (padding, radius) combinations with no combination
 * over 15% (maintainability audit 2026-09-15, §2.4). The decisions, once:
 *
 *   surface  `--surface-card` on a 1px `--border-default`, `--card-radius`
 *            (the density's corner: the website's 2xl in the guide, lg in
 *            the clinical apps). Tone `muted` swaps the ground for
 *            `--surface-muted` (a panel that explains rather than holds);
 *            `brand` for a peach-soft ground (the pathway simulator).
 *            ⚠️ There was a `wash` tone — the brand gradient at its soft
 *            weight, the website's stat band — and its one consumer was the
 *            caseload summary, where a peach-to-sky ramp sat behind risk
 *            counts and its peach end read as the high-risk tile. The same
 *            reason the clinical apps turn off the gradient button label: a
 *            colour ramp beside clinical data reads as a clinical signal.
 *   padding  `roomy` (`--card-pad`: `--space-6` in the guide, `--space-4` in
 *            the clinical apps) for a page section; `compact`
 *            (`--space-3 --space-4`) for an item inside one.
 *   accent   a 3px left edge, for a card whose edge colour MEANS something
 *            and differs between cards — a CDS card's indicator. The page
 *            supplies that colour as a `border-left-color` className
 *            modifier and nothing else; the plum default is a fallback.
 *            ⚠️ It was the plum edge on every pathway step, stage tool,
 *            record reading and explainer aside: the same stripe on every
 *            item of a list tells the items apart by nothing, and a rounded
 *            card with a coloured left edge is the most-copied decoration
 *            there is. An edge that does not vary is not an accent.
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
  tone?: 'card' | 'muted' | 'brand'
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
