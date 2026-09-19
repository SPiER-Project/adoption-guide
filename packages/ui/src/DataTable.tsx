/**
 * The one data table shell: the scroll wrapper, the <table>, and everything
 * about how a header cell and a body cell look. The page still writes its
 * own <thead> and <tbody> — the five tables' bodies are genuinely different
 * (a fixed column budget with a <colgroup>, row headers, sort buttons in the
 * header row) and a `columns[]` API would have meant rewriting cell logic to
 * fit a component, which is the wrong direction.
 *
 * Five tables set this shell themselves before it existed, with four cell
 * paddings, five header type signatures, two divider weights and three body
 * sizes (maintainability audit 2026-09-15, §2.4). The decisions, once:
 *
 *   header   `--font-size-xs`, 700, uppercase, `--tracking-caps`,
 *            `--text-muted` on `--surface-muted`, no wrapping
 *   cells    `compact` (`--space-2 --space-3`, default) or `comfortable`
 *            (`--space-3 --space-4`, the caseload), body text at
 *            `--font-size-base`, top-aligned, tabular figures, a 1px
 *            `--border-default` divider, and a `--surface-page` hover
 *   frame    `framed` puts the table in a Card-like box (1px border,
 *            `--radius-lg`, `--surface-card`); either way the wrapper scrolls
 *            horizontally so a wide table never scrolls the page
 *   fixed    `table-layout: fixed`, for a table that declares a <colgroup>
 *            column budget
 *
 * `tableClassName` is for a page's LAYOUT rules on the table itself (a
 * `min-width`, a `code` style inside it) — never a cell padding, a header
 * colour or a border.
 */
import type { ReactNode, Ref } from 'react'
import { cx } from './cx'
import './DataTable.css'

export function DataTable({
  as: Tag = 'div',
  density = 'compact',
  framed,
  fixed,
  tableClassName,
  wrapperRef,
  tableRef,
  after,
  children,
}: {
  as?: 'div' | 'section'
  density?: 'compact' | 'comfortable'
  framed?: boolean
  fixed?: boolean
  tableClassName?: string
  wrapperRef?: Ref<HTMLElement>
  tableRef?: Ref<HTMLTableElement>
  /** Rendered inside the wrapper, after the table — an empty state for zero rows. */
  after?: ReactNode
  children: ReactNode
}) {
  return (
    <Tag className={cx('data-table', framed && 'data-table--framed')} ref={wrapperRef as Ref<never>}>
      <table
        className={cx('data-table__table', `data-table__table--${density}`, fixed && 'data-table__table--fixed', tableClassName)}
        ref={tableRef}
      >
        {children}
      </table>
      {after}
    </Tag>
  )
}
