/**
 * The one way to say "nothing here".
 *
 * Fifteen elements said it before this existed, in four shapes: faint text,
 * faint italic text, a padded centred paragraph, and a dashed-border panel —
 * with three centring decisions and four type sizes between them
 * (maintainability audit 2026-09-15, §2.4). Two of those were real roles and
 * two were drift. The two roles:
 *
 *   - inline (default): a line inside a section or list — "No documents.",
 *     "No artifacts recorded at this contact.", or the "—" in an empty table
 *     cell (`as="span"`). Faint, italic, the note size, no box.
 *   - `panel`: the whole region is empty — a filtered table with no rows, a
 *     dictionary with no matches. Same text, centred, padded, in a dashed box
 *     so the region still has a shape.
 *
 * Links inside stay readable: they take the accent colour, not the faint one.
 */
import type { ReactNode } from 'react'
import { cx } from './cx'
import './EmptyState.css'

export function EmptyState({
  as: Tag = 'p',
  panel,
  title,
  children,
}: {
  /** `li` inside a list, `span` inside a table cell. */
  as?: 'p' | 'li' | 'span' | 'div'
  /** The whole region is empty, not one line of it. */
  panel?: boolean
  /** A tooltip, for the "—" in a table cell that should say why. */
  title?: string
  children: ReactNode
}) {
  return (
    <Tag className={cx('empty-state', panel && 'empty-state--panel')} title={title}>
      {children}
    </Tag>
  )
}
