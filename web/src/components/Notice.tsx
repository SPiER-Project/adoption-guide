/**
 * The one notice box: a tinted panel that tells the reader something about
 * the state of what they are looking at — a scope caveat, a load in progress,
 * an error, a success, a demo disclaimer, a prose callout.
 *
 * Sixteen sites in six recipes before this existed, split between two idioms
 * (a left accent bar, or a full tinted border) with the bar at 3px in
 * nineteen places and 4px in six, and `role` chosen ad hoc (maintainability
 * audit 2026-09-15, §2.4). One recipe now: a tinted ground, a 1px border and
 * a 3px left edge in the tone colour, `--radius-md`, `--space-3 --space-4`,
 * body-size text capped at the reading measure. The tone decides the role
 * unless the caller says otherwise — `warning` and `danger` are alerts, the
 * rest are status.
 *
 * Not a Notice: the consent gate (three tones with domain meaning, see
 * WorkflowForm.css), the FHIRcast banner (a toolbar, not a message), and the
 * pathway-pending panel (a definition list). Those keep their own markup.
 */
import type { ReactNode, Ref } from 'react'
import { cx } from '../lib/cx'
import '../css/Notice.css'

export type NoticeTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'

export function Notice({
  tone = 'neutral',
  title,
  role,
  as: Tag = 'div',
  ariaLabel,
  ref,
  children,
}: {
  tone?: NoticeTone
  /** A bold first line; the body follows it. */
  title?: ReactNode
  /** Defaults from the tone: warning/danger → alert, everything else → status. */
  role?: 'status' | 'alert' | 'note'
  as?: 'div' | 'aside' | 'section'
  ariaLabel?: string
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}) {
  const resolvedRole = role ?? (tone === 'warning' || tone === 'danger' ? 'alert' : 'status')
  return (
    <Tag className={cx('notice', `notice--${tone}`)} role={resolvedRole} aria-label={ariaLabel} ref={ref as Ref<never>}>
      {title !== undefined && <strong className="notice__title">{title}</strong>}
      {children}
    </Tag>
  )
}
