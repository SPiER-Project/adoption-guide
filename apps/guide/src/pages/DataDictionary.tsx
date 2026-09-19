import { useMemo, useState } from 'react'
import { useScrollToHash } from '@spier/app-shell/hooks/useScrollToHash'
import {
  STAGES,
  TOOLS,
  BINDINGS,
  CONCEPTS,
  systemLabel,
  type Binding,
  type Concept,
  type Tool,
  type StageId,
} from '@spier/core/data/catalog'
import '../css/DataDictionary.css'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { EmptyState } from '@spier/ui/EmptyState'
import { Pill } from '@spier/ui/Pill'
import { DataTable } from '@spier/ui/DataTable'
import { SharedConcepts, NORMALIZATION_ANCHOR } from '../components/SharedConcepts'
import { CodeLink, SystemCell, ValueSetLine } from '../components/DictionaryCodeCells'

/**
 * Anchor id for a section, and the ONE place the scheme is written.
 *
 * Consumed by the jump nav and by the section that renders it, so a renamed
 * stage cannot leave the nav pointing at an id nothing declares. `dd-` prefixed
 * because these ids share a document with whatever the guide layout renders.
 */
const sectionAnchor = (stageId: string) => `dd-${stageId}`

interface StageGroup {
  stageId: string
  stageTitle: string
  bindings: Binding[]
}

/**
 * Primary stage for a binding: the earliest-ordered stage among tools that use it.
 * Bindings with no using tool land in a special "Cross-cutting / Unassigned" bucket.
 */
function groupBindingsByStage(bindings: Binding[]): StageGroup[] {
  const stageOrder = new Map(STAGES.map((s, i) => [s.id, i]))
  const toolStage = new Map(TOOLS.map(t => [t.id, t.stageId]))

  const groups: Record<string, Binding[]> = {}
  for (const stage of STAGES) groups[stage.id] = []
  const unassigned: Binding[] = []

  for (const b of bindings) {
    const stages = b.usedBy
      .map(tid => toolStage.get(tid))
      .filter((s): s is StageId => !!s)
    if (stages.length === 0) {
      unassigned.push(b)
      continue
    }
    const primary = stages.reduce((a, c) =>
      (stageOrder.get(a) ?? Infinity) <= (stageOrder.get(c) ?? Infinity) ? a : c
    )
    groups[primary].push(b)
  }

  const result: StageGroup[] = STAGES
    .filter(s => groups[s.id].length > 0)
    .map(s => ({ stageId: s.id, stageTitle: s.title, bindings: groups[s.id] }))

  if (unassigned.length > 0) {
    result.push({ stageId: '__unassigned', stageTitle: 'Unassigned', bindings: unassigned })
  }
  return result
}

function stagesReferencedBy(b: Binding, toolIndex: Map<string, Tool>): string[] {
  const stageIds = new Set(
    b.usedBy.map(tid => toolIndex.get(tid)?.stageId).filter((s): s is StageId => !!s)
  )
  return [...stageIds]
}

/** Every system a binding names, for search. */
function systemsOf(b: Binding): string[] {
  return [b.code?.system, b.value?.system].filter((s): s is string => !!s)
}

/**
 * The code, linked to its definition where one is reachable.
 *
 * SPiER-local codes resolve inside our own published IG, so they open in the
 * same tab like any other internal navigation; external terminology opens in a
 * new tab, since leaving the guide to read LOINC is a detour, not a
 * destination. `rel="noreferrer"` on the outbound ones keeps the referrer off
 * third-party servers — this page is a clinical-terminology surface and there
 * is no reason to tell loinc.org which SPiER page a reader came from.
 */
const USED_BY_CHIP_LIMIT = 2

/**
 * One binding: a skimmable summary row plus a detail row that holds the prose.
 *
 * ── The row-height bug this fixes, and why it was not "too many columns" ────
 *
 * `.dd-table` is `width: 100%` with the DEFAULT `table-layout: auto`, and three
 * columns were `white-space: nowrap` — Field, Code and `.dd-cell-path`. Auto
 * layout gives an unbreakable column whatever it asks for, so Path claimed the
 * width of the longest path in each table: **measured at 580–1256px, in one case
 * for a cell holding 21 characters.** Description was the only column that could
 * shrink, so it did — to **112px**, where a 386-character sentence stacked into
 * **655px** of text. Its `max-width: 300px` never applied; under auto layout a
 * max-width is a hint the browser is free to squeeze past.
 *
 * So the prose column was the victim, not the culprit, and the table measured
 * 2065px wide inside a 1134px column with rows at median 111px / p90 402px /
 * max 675px.
 *
 * Two things follow, and both are needed — either alone leaves it unskimmable:
 *
 *  1. **A column budget.** `table-layout: fixed` plus a `<colgroup>`, and the
 *     path wraps instead of setting the table's width. See DataDictionary.css.
 *  2. **Prose leaves the grid.** Even with a perfect budget, 386 characters at a
 *     fair share of 1134px is ~9 lines. A description is not something anyone
 *     skims across 90 rows, so it moves to a detail row, along with the two
 *     chip stacks that were doing the same thing to the Field column.
 *
 * ⚠️ **Search matches the description, so a hidden description could make a
 * result inexplicable** — a row appears with no visible reason. `autoOpen` is
 * the answer: a row whose description matched the query starts expanded. The
 * explicit toggle still wins, via `toggled[id] ?? autoOpen`, so closing an
 * auto-opened row works and is remembered.
 */
function BindingRow({
  binding: b,
  concept,
  crossStages,
  stageById,
  toolIndex,
  open,
  onToggle,
}: {
  binding: Binding
  concept?: Concept
  crossStages: string[]
  stageById: Map<string, { title: string }>
  toolIndex: Map<string, Tool>
  open: boolean
  onToggle: () => void
}) {
  const detailId = `dd-detail-${b.id}`
  const tools = b.usedBy.map(tid => toolIndex.get(tid)).filter((t): t is Tool => !!t)
  const shown = tools.slice(0, USED_BY_CHIP_LIMIT)
  const hidden = tools.length - shown.length
  // Anything the summary row cannot show. Empty means the detail row would be
  // blank, and a disclosure that opens onto nothing is worse than none.
  const hasDetail =
    !!b.description || !!concept || crossStages.length > 0 || hidden > 0 || !!b.value?.valueSet

  return (
    <>
      <tr className={open ? 'dd-row dd-row--open' : 'dd-row'}>
        <td className="dd-cell-field">{b.name}</td>
        <td className="dd-cell-code">
          {b.code ? (
            <>
              {/*
                Only the code itself is a link — the display stays plain text so
                the code remains easy to select and copy, which is what people
                actually do with this column.
              */}
              <CodeLink coding={b.code} />
              {/* Clamped to one line here and shown in full in the detail row.
                  The LOINC displays run to 70+ characters and were four wrapped
                  lines of the old row height on their own. `title` carries the
                  full string for a hover, and the detail row for everyone else. */}
              <span className="dd-code-display dd-code-display--clamp" title={b.code.display}>
                {b.code.display}
              </span>
            </>
          ) : (
            <EmptyState as="span" title="This element carries no code of its own">—</EmptyState>
          )}
        </td>
        <td className="dd-cell-system">
          {/*
            Code system and value system are shown as separate lines rather than
            one column that has to pick. A row can now honestly carry both, which
            several do — an Observation coded with one concept and valued from
            another vocabulary. The bindable ValueSet that used to sit under the
            value system is in the detail row: it is a third line, and it is the
            one an implementer looks up deliberately rather than skims.
          */}
          {b.code && <SystemCell system={b.code.system} note={b.value ? 'code' : undefined} />}
          {b.value && <SystemCell system={b.value.system} note="values" />}
          {!b.code && !b.value && '—'}
        </td>
        <td>
          <Pill variant="label" className={`dd-resource-badge--${b.fhirResource.toLowerCase()}`}>
            {b.fhirResource}
          </Pill>
        </td>
        <td className="dd-cell-path">{b.fhirPath}</td>
        <td>
          <div className="dd-tools">
            {shown.map(t => (
              <Pill key={t.id} variant="label" title={t.name}>
                {t.shortName ?? t.name}
              </Pill>
            ))}
            {hidden > 0 && (
              <span className="dd-tool-more" title={tools.map(t => t.name).join(', ')}>
                +{hidden}
              </span>
            )}
          </div>
        </td>
        <td className="dd-cell-toggle">
          {hasDetail && (
            <button
              type="button"
              className="dd-detail-toggle"
              aria-expanded={open}
              aria-controls={detailId}
              /* The row's own name is in the first cell, but a screen reader
                 reaching this button out of context needs to know which row it
                 opens — hence the binding name in the label rather than a bare
                 "Details". */
              aria-label={`Details for ${b.name}`}
              onClick={onToggle}
            >
              <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>
          )}
        </td>
      </tr>
      {/* Rendered at every state and hidden with `hidden` rather than removed, so
          `aria-controls` always resolves to a real element — the same rule the
          old header overflow menu followed. */}
      <tr className="dd-detail-row" hidden={!open || !hasDetail}>
        <td id={detailId} colSpan={7}>
          <div className="dd-detail">
            {b.description && <p className="dd-detail-desc">{b.description}</p>}
            {b.code && (
              <p className="dd-detail-line">
                <span className="dd-detail-label">Code display</span>
                <span>{b.code.display}</span>
              </p>
            )}
            {b.value?.valueSet && (
              <p className="dd-detail-line">
                <span className="dd-detail-label">Values drawn from</span>
                <ValueSetLine canonical={b.value.valueSet} />
              </p>
            )}
            {tools.length > 0 && (
              <p className="dd-detail-line">
                <span className="dd-detail-label">Used by</span>
                <span className="dd-tools">
                  {tools.map(t => (
                    <Pill key={t.id} variant="label" title={t.name}>
                      {t.shortName ?? t.name}
                    </Pill>
                  ))}
                </span>
              </p>
            )}
            {concept && (
              <p className="dd-detail-line">
                <span className="dd-detail-label">One route into</span>
                <Pill variant="label">{concept.name}</Pill>
              </p>
            )}
            {crossStages.length > 0 && (
              <p className="dd-detail-line">
                <span className="dd-detail-label">Also used in</span>
                <span className="dd-tools">
                  {crossStages.map(sid => (
                    <Pill key={sid} variant="label" tone="accent">{stageById.get(sid)?.title ?? sid}</Pill>
                  ))}
                </span>
              </p>
            )}
          </div>
        </td>
      </tr>
    </>
  )
}

/**
 * Jump nav for the section list.
 *
 * ⚠️ **Buttons calling `jumpTo`, not `<a href="#…">`.** This app is a
 * `HashRouter`, so a bare fragment href is read as a ROUTE — `#dd-clarify-risk`
 * would navigate to a route of that name and land on the 404 path, not scroll.
 * `jumpTo` from `useScrollToHash` writes the double-hash form the router
 * understands (`#/guide/data-dictionary#dd-clarify-risk`) and scrolls, so the
 * URL stays copyable and a pasted one still works on a cold load.
 *
 * It is also the only thing that honours `scroll-margin-top` here: the manual
 * scroll in `scrollToAnchor` reads the computed value and subtracts it, because
 * neither `scrollIntoView` nor native fragment navigation is involved. That
 * matters more since the app bar became sticky — `--anchor-scroll-offset` now
 * includes its height.
 */
function JumpNav({
  sections,
  onJump,
}: {
  sections: Array<{ anchor: string; label: string; count: number }>
  onJump: (anchor: string) => void
}) {
  if (sections.length <= 1) return null
  return (
    <nav className="dd-jump" aria-label="Jump to section">
      {sections.map(s => (
        <button key={s.anchor} type="button" className="dd-jump-link" onClick={() => onJump(s.anchor)}>
          {s.label}
          <span className="dd-jump-count">{s.count}</span>
        </button>
      ))}
    </nav>
  )
}

export function DataDictionary() {
  const [search, setSearch] = useState('')
  const [resourceFilter, setResourceFilter] = useState('All')
  /**
   * Explicit open/closed per row, layered OVER `autoOpen` below. A plain
   * `Set` of open ids could not express "the search opened this and I closed
   * it", so this records the decision rather than the state.
   */
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  // Installs the deep-link scroll effect AND returns the in-page jump.
  const { jumpTo } = useScrollToHash()

  const resources = useMemo(() => {
    const set = new Set(BINDINGS.map(b => b.fhirResource))
    return ['All', ...Array.from(set).sort()]
  }, [])

  const toolIndex = useMemo(() => new Map(TOOLS.map(t => [t.id, t])), [])
  const stageById = useMemo(() => new Map(STAGES.map(s => [s.id, s])), [])
  const conceptIndex = useMemo(() => new Map(CONCEPTS.map(c => [c.id, c])), [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return BINDINGS.filter(b => {
      if (resourceFilter !== 'All' && b.fhirResource !== resourceFilter) return false
      if (!q) return true
      // Systems are searchable by BOTH the full URL and the short label, so a
      // query for "LOINC" and one for "loinc.org" both land. Both the code
      // system and the value system are searched.
      const systems = systemsOf(b)
      return (
        b.name.toLowerCase().includes(q) ||
        (b.code?.code.toLowerCase().includes(q) ?? false) ||
        (b.code?.display.toLowerCase().includes(q) ?? false) ||
        systems.some(s => s.toLowerCase().includes(q)) ||
        systems.some(s => systemLabel(s).toLowerCase().includes(q)) ||
        (b.conceptId ? (conceptIndex.get(b.conceptId)?.name.toLowerCase().includes(q) ?? false) : false) ||
        b.description.toLowerCase().includes(q) ||
        b.fhirPath.toLowerCase().includes(q) ||
        b.usedBy.some(tid => toolIndex.get(tid)?.name.toLowerCase().includes(q))
      )
    })
  }, [search, resourceFilter, toolIndex, conceptIndex])

  const grouped = useMemo(() => groupBindingsByStage(filtered), [filtered])

  /**
   * Rows whose DESCRIPTION matched the query, which is the one field the
   * summary row no longer shows. Without this a search lands on rows with no
   * visible reason for matching — the cost of moving prose into a detail row,
   * paid back here rather than left for the reader to puzzle over.
   */
  const autoOpen = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return new Set<string>()
    return new Set(filtered.filter(b => b.description.toLowerCase().includes(q)).map(b => b.id))
  }, [search, filtered])

  // Only show a concept if at least one of its bindings survived the filters —
  // otherwise the section would advertise routes the reader cannot see.
  const visibleConcepts = useMemo(() => {
    const ids = new Set(filtered.map(b => b.conceptId).filter((c): c is string => !!c))
    return CONCEPTS.filter(c => ids.has(c.id))
  }, [filtered])

  /**
   * What the nav offers, derived from what the page actually renders — so a
   * filter that empties a stage removes its jump target instead of offering a
   * link to a section that is not there.
   */
  const jumpSections = useMemo(() => {
    const list = grouped.map(g => ({
      anchor: sectionAnchor(g.stageId),
      label: g.stageTitle,
      count: g.bindings.length,
    }))
    if (visibleConcepts.length === 0) return list
    return [
      {
        anchor: NORMALIZATION_ANCHOR,
        label: 'Normalization',
        count: visibleConcepts.length,
      },
      ...list,
    ]
  }, [grouped, visibleConcepts])

  return (
    <div className="data-dictionary">
      <p className="dd-description">
        Every field and terminology code SPiER's tools produce, grouped by the pathway stage that first captures it.
      </p>

      <div className="dd-filters">
        <input
          type="text"
          className="dd-search"
          placeholder="Search fields, codes, tools, descriptions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="dd-select"
          value={resourceFilter}
          onChange={e => setResourceFilter(e.target.value)}
        >
          {resources.map(r => (
            <option key={r} value={r}>{r === 'All' ? 'All Resources' : r}</option>
          ))}
        </select>
        <span className="dd-count">{filtered.length} of {BINDINGS.length} entries</span>
      </div>

      <JumpNav sections={jumpSections} onJump={jumpTo} />

      {grouped.length === 0 && (
        <EmptyState panel>No entries match your filters.</EmptyState>
      )}

      <SharedConcepts concepts={visibleConcepts} toolIndex={toolIndex} />

      {grouped.map(group => (
        <section key={group.stageId} className="dd-stage-section" id={sectionAnchor(group.stageId)}>
          <SectionHeader
            title={group.stageTitle}
            meta={`${group.bindings.length} ${group.bindings.length === 1 ? 'element' : 'elements'}`}
          />

          <DataTable framed fixed>
              {/*
                The column budget. `table-layout: fixed` means these percentages
                are honoured rather than negotiated, which is the whole fix — see
                the note on BindingRow for what auto layout did instead. Path
                gets the largest share because it is the only column whose
                content is genuinely long AND worth reading in full; Code is
                clamped, and prose is in the detail row.
              */}
              <colgroup>
                <col className="dd-col-field" />
                <col className="dd-col-code" />
                <col className="dd-col-system" />
                <col className="dd-col-resource" />
                <col className="dd-col-path" />
                <col className="dd-col-usedby" />
                <col className="dd-col-toggle" />
              </colgroup>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Code</th>
                  <th>System</th>
                  <th>FHIR Resource</th>
                  <th>FHIR Path</th>
                  <th>Used By</th>
                  <th><span className="dd-sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {group.bindings.map(b => {
                  const referencedStages = stagesReferencedBy(b, toolIndex)
                  return (
                    <BindingRow
                      key={b.id}
                      binding={b}
                      concept={b.conceptId ? conceptIndex.get(b.conceptId) : undefined}
                      crossStages={referencedStages.filter(sid => sid !== group.stageId)}
                      stageById={stageById}
                      toolIndex={toolIndex}
                      open={toggled[b.id] ?? autoOpen.has(b.id)}
                      onToggle={() =>
                        setToggled(prev => ({
                          ...prev,
                          [b.id]: !(prev[b.id] ?? autoOpen.has(b.id)),
                        }))
                      }
                    />
                  )
                })}
              </tbody>
          </DataTable>
        </section>
      ))}
    </div>
  )
}
