/**
 * The Population view's caseload table (issue #278).
 *
 * Renders whichever view it is handed by walking that view's column keys
 * through `COLUMNS` — so the four tables the deck asks for are four entries in
 * `CASELOAD_VIEWS`, not four components. See `lib/caseloadViews.ts` for the
 * registry and the reasoning; `caseloadColumns.tsx` for how each cell renders.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ChevronsUpDown, Check, Filter } from 'lucide-react'
import { COLUMNS } from './caseloadColumns'
import { RiskPill } from './RiskPill'
import type { CaseloadView, FilterKey, FilterOption, SortCol, SortDir, SortState } from '../lib/caseloadViews'
import type { DerivedRegistryRow } from '@spier/core/lib/registry'

const MENU_EDGE_GAP = 8

function SortIcon({ dir }: { dir: SortDir | null }) {
  const Icon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ChevronsUpDown
  return (
    <Icon
      className={`caseload-sort-icon ${dir ? 'caseload-sort-icon--active' : ''}`}
      size={12}
      aria-hidden="true"
    />
  )
}

function FunnelIcon() {
  return <Filter className="caseload-funnel-icon" size={12} aria-hidden="true" />
}

function SortHeader({
  label,
  col,
  sort,
  onSort,
}: {
  label: string
  col: SortCol
  sort: SortState
  onSort: (col: SortCol) => void
}) {
  const active = sort.col === col
  return (
    <button
      type="button"
      className={`caseload-sort-button ${active ? 'caseload-sort-button--active' : ''}`}
      onClick={() => onSort(col)}
    >
      <span>{label}</span>
      <SortIcon dir={active ? sort.dir : null} />
    </button>
  )
}

/**
 * Column-header filter: the header label doubles as the trigger for a
 * single-select menu of the values present in the column, each with its row
 * count. Replaces the separate chip toolbar that used to sit above the table.
 */
export function HeaderFilter({
  label,
  srLabel,
  options,
  value,
  onChange,
}: {
  label: string
  srLabel: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = pos !== null

  const openMenu = () => {
    if (open) {
      setPos(null)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
  }

  // The menu is `position: fixed`, not absolute inside the <th>: the table lives
  // in a wrapper with `overflow-x: auto`, and per spec a non-visible overflow on
  // one axis computes the other to `auto` too — so an absolutely positioned
  // panel would be clipped by the scroll container instead of overlaying rows.
  // The cost of escaping that container is having to keep the panel glued to its
  // trigger by hand, which is what this does. Measuring every frame rather than
  // listening for scroll is deliberate: the trigger moves with page scroll, with
  // the wrapper's own horizontal scroll, and with any relayout, and a `scroll`
  // listener only covers the first two. The loop exists only while a menu is
  // open, and re-renders only when the rounded position actually changes.
  useEffect(() => {
    if (!open) return
    let frame = requestAnimationFrame(function track() {
      frame = requestAnimationFrame(track)
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return
      const t = trigger.getBoundingClientRect()
      // Horizontally scrolled out of the table's viewport: nothing left to anchor
      // to, so dismiss rather than leave the panel stranded over other columns.
      const scroller = trigger.closest('.caseload-table-wrapper')?.getBoundingClientRect()
      if (scroller && (t.right < scroller.left || t.left > scroller.right)) {
        setPos(null)
        return
      }
      const top = t.bottom + 4
      const left = Math.min(t.left, window.innerWidth - menu.offsetWidth - MENU_EDGE_GAP)
      setPos(p =>
        p && Math.round(p.top) === Math.round(top) && Math.round(p.left) === Math.round(left)
          ? p
          : { top, left },
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const menuItems = () => [
    ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []),
  ]

  useEffect(() => {
    if (!open) return
    const items = menuItems()
    ;(items.find(i => i.getAttribute('aria-checked') === 'true') ?? items[0])?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setPos(null)
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = menuItems()
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`caseload-filter-trigger ${value !== 'all' ? 'caseload-filter-trigger--active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={value === 'all' ? `Filter by ${srLabel}` : `Filter by ${srLabel} (1 active)`}
        onClick={openMenu}
      >
        <span>{label}</span>
        <FunnelIcon />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="caseload-filter-menu"
          role="menu"
          aria-label={`Filter by ${srLabel}`}
          style={{ top: pos.top, left: pos.left }}
          onKeyDown={onMenuKeyDown}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={opt.value === value}
              className="caseload-filter-option"
              onClick={() => {
                onChange(opt.value)
                setPos(null)
                triggerRef.current?.focus()
              }}
            >
              <span className="caseload-filter-option-check" aria-hidden="true">
                {opt.value === value ? <Check size={12} /> : null}
              </span>
              {opt.riskLevel ? (
                <RiskPill level={opt.riskLevel} label={opt.label} sm />
              ) : (
                <span className="caseload-filter-option-label">{opt.label}</span>
              )}
              <span className="caseload-filter-option-count">{opt.count}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function CaseloadTable({
  view,
  rows,
  sort,
  onSort,
  filters,
  filterValues,
  onFilterChange,
  onOpenChart,
  wrapperRef,
  tableRef,
}: {
  view: CaseloadView
  rows: DerivedRegistryRow[]
  sort: SortState
  onSort: (col: SortCol) => void
  filters: Record<FilterKey, { srLabel: string; options: FilterOption[] }>
  filterValues: Record<FilterKey, string>
  onFilterChange: (key: FilterKey, value: string) => void
  onOpenChart: (row: DerivedRegistryRow) => void
  wrapperRef: React.Ref<HTMLElement>
  tableRef: React.Ref<HTMLTableElement>
}) {
  // A view naming a column key that COLUMNS does not have renders one fewer
  // column rather than crashing the page — the keys are strings, so nothing
  // type-checks them.
  const columns = useMemo(
    () => view.columns.filter(key => COLUMNS[key]).map(key => ({ key, col: COLUMNS[key] })),
    [view],
  )

  const ariaSort = (col?: SortCol): 'ascending' | 'descending' | undefined => {
    if (!col || sort.col !== col) return undefined
    return sort.dir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <section className="caseload-table-wrapper" ref={wrapperRef}>
      <table className="caseload-table" ref={tableRef}>
        <thead>
          <tr>
            {columns.map(({ key, col }) => {
              const filterKey = col.filter
              const filter = filterKey ? filters[filterKey] : null
              const showBoth = col.sortCol && filter && !col.filterIsLabel
              return (
                <th
                  key={key}
                  scope="col"
                  className={col.className}
                  aria-sort={ariaSort(col.sortCol)}
                >
                  {showBoth && filterKey && col.sortCol ? (
                    <span className="caseload-th-controls">
                      <SortHeader label={col.header} col={col.sortCol} sort={sort} onSort={onSort} />
                      <HeaderFilter
                        label=""
                        srLabel={filter.srLabel}
                        options={filter.options}
                        value={filterValues[filterKey]}
                        onChange={v => onFilterChange(filterKey, v)}
                      />
                    </span>
                  ) : filter && filterKey ? (
                    <HeaderFilter
                      label={col.header}
                      srLabel={filter.srLabel}
                      options={filter.options}
                      value={filterValues[filterKey]}
                      onChange={v => onFilterChange(filterKey, v)}
                    />
                  ) : col.sortCol ? (
                    <SortHeader label={col.header} col={col.sortCol} sort={sort} onSort={onSort} />
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="caseload-row" onClick={() => onOpenChart(row)}>
              {columns.map(({ key, col }) => (
                <td key={key} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="caseload-empty">No patients match the active filters.</p>}
    </section>
  )
}
