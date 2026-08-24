import { useMemo, useState } from 'react'
import { useScrollToHash } from '../hooks/useScrollToHash'
import {
  STAGES,
  TOOLS,
  BINDINGS,
  CONCEPTS,
  bindingsForConcept,
  systemLabel,
  codeHref,
  valueSetHref,
  valueSetLabel,
  type Coding,
  type Binding,
  type Concept,
  type Tool,
} from '@spier/core/data/catalog'
import '../css/DataDictionary.css'

/**
 * Anchor id for a section, and the ONE place the scheme is written.
 *
 * Consumed by the jump nav and by the section that renders it, so a renamed
 * stage cannot leave the nav pointing at an id nothing declares. `dd-` prefixed
 * because these ids share a document with whatever the guide layout renders.
 */
const sectionAnchor = (stageId: string) => `dd-${stageId}`
const NORMALIZATION_ANCHOR = 'dd-normalization'

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
      .filter((s): s is string => !!s)
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
    b.usedBy.map(tid => toolIndex.get(tid)?.stageId).filter((s): s is string => !!s)
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
function CodeLink({ coding }: { coding: Coding }) {
  const href = codeHref(coding.system, coding.code)
  if (!href) return <>{coding.code}</>
  const external = href.startsWith('http')
  return (
    <a
      className="dd-code-link"
      href={href}
      title={`${coding.system}#${coding.code}`}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {coding.code}
    </a>
  )
}

/**
 * A system, shown by its short label with the full URL on hover. `note`
 * distinguishes the value-side vocabulary from the code — the two used to
 * compete for one column, which is the defect #260 set out to fix.
 */
function SystemCell({ system, note }: { system: string; note?: string }) {
  return (
    <span className="dd-system" title={system}>
      {systemLabel(system)}
      {note && <span className="dd-system-note">{note}</span>}
    </span>
  )
}

/**
 * The bindable ValueSet a coded value is drawn from (#281).
 *
 * A system says which vocabulary the codes come from; the ValueSet says which
 * subset of it is *allowed here*, which is the question an implementer building a
 * picker actually has. 18 of the 24 value blocks name one and none of them
 * reached the page before this.
 *
 * SPiER-local canonicals resolve inside our own published IG, so — like a
 * SPiER-local code — this opens in the same tab. `check:catalog` proves the
 * target exists, so an absent link means "no ValueSet named", never a broken one.
 */
function ValueSetLine({ canonical }: { canonical: string }) {
  const href = valueSetHref(canonical)
  const label = valueSetLabel(canonical)
  return (
    <span className="dd-valueset">
      <span className="dd-valueset-label">bindable set</span>
      {href ? (
        <a className="dd-code-link" href={href} title={canonical}>{label}</a>
      ) : (
        <span title={canonical}>{label}</span>
      )}
    </span>
  )
}

/**
 * The normalization layer, rendered above the stage tables.
 *
 * ── Why this is the first thing on the page ─────────────────────────────────
 *
 * It exists because of one concrete reading failure: LOINC 93374-7 occupied
 * five rows in five different stage groups, and nothing said they were the same
 * concept reached five ways. But naming it was not enough — it shipped as a
 * collapsed accordion headed *"Shared concepts · 1 concept"* above a 90-row
 * table, which reads as a footnote. The catalogue of instruments is the obvious
 * half of what SPiER offers; **the claim that they all land on one actionable
 * value is the half nobody can see by scrolling**, and it was the half hidden
 * behind a caret.
 *
 * So: named for what it is, open by default, and counted in the terms that make
 * the point — how many instruments arrive, not how many rows are involved.
 * Collapsing is still available; defaulting to collapsed is not, because with a
 * single concept the closed state hides the entire section.
 *
 * ⚠️ **Every number here is derived, not written down.** Concepts, routes and
 * instrument counts all come from `bindingsForConcept`, so a sixth route or a
 * second concept changes the prose without anyone editing it. A hand-typed "five
 * instruments" would have been wrong the moment the episode extension landed —
 * which is exactly what the concept's own description had to be careful about.
 *
 * The bindings still appear in their own stage sections — collapsing them into
 * here only would hide a C-SSRS row from the C-SSRS stage. Each one carries a
 * chip pointing back up here instead.
 */
function SharedConcepts({
  concepts,
  toolIndex,
}: {
  concepts: Concept[]
  toolIndex: Map<string, Tool>
}) {
  // Open by default. `false` is reachable by clicking; it is not the entry state.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  if (concepts.length === 0) return null

  /**
   * ⚠️ **Tools, and the word matters — this said "instruments" and contradicted
   * the paragraph underneath it.** `usedBy` holds catalog tool ids, and one
   * instrument family owns several: C-SSRS alone contributes Screener, Full,
   * Since Last Contact and Pediatric. So this counts 11 where the concept's own
   * description correctly says *five instruments* reach the tier. Both numbers
   * are right about different things, and printing the derived one under the
   * label "instruments" made the page argue with itself two lines apart.
   */
  const toolCount = new Set(
    concepts.flatMap(c => bindingsForConcept(c.id).flatMap(b => b.usedBy)),
  ).size
  const routeCount = concepts.reduce((n, c) => n + bindingsForConcept(c.id).length, 0)

  return (
    <section className="dd-stage-section dd-concept-layer" id={NORMALIZATION_ANCHOR}>
      <div className="dd-stage-header">
        <h3 className="dd-stage-title">Cross-instrument normalization</h3>
        <span className="dd-stage-count">
          {concepts.length} {concepts.length === 1 ? 'concept' : 'concepts'} &middot; {routeCount}{' '}
          {routeCount === 1 ? 'route' : 'routes'} &middot; {toolCount}{' '}
          {toolCount === 1 ? 'tool' : 'tools'}
        </span>
      </div>
      <p className="dd-concept-intro">
        Every instrument below asks its own questions in its own vocabulary. <strong>This is where
        they become one value a consumer can act on without knowing which tool produced it.</strong>{' '}
        Each concept is a single meaning with several routes into it; the routes are listed side by
        side, because comparing them is what an implementer has to do before trusting a tier.
      </p>

      {concepts.map(concept => {
        const bindings = bindingsForConcept(concept.id)
        const isOpen = !collapsed.has(concept.id)
        return (
          <div key={concept.id} className="dd-concept">
            {/*
              ⚠️ **The toggle and the code link are SIBLINGS, and that is a bug
              fix rather than a layout preference.** This was one `<button>` with
              the `CodeLink` anchor nested inside it — interactive content inside
              a button, which is invalid HTML: the browser gets two competing
              activation targets, so the LOINC link is unreliable to click and
              assistive tech announces the pair inconsistently. The button now
              owns the caret and the name; the link sits beside it.
            */}
            <div className="dd-concept-head">
              <button
                type="button"
                className="dd-concept-toggle"
                aria-expanded={isOpen}
                aria-controls={`${concept.id}-body`}
                onClick={() =>
                  setCollapsed(prev => {
                    const next = new Set(prev)
                    if (next.has(concept.id)) next.delete(concept.id)
                    else next.add(concept.id)
                    return next
                  })
                }
              >
                <span className="dd-concept-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                <span className="dd-concept-name">{concept.name}</span>
              </button>
              <span className="dd-concept-code">
                <CodeLink coding={concept.code} />
                <span className="dd-code-display">{concept.code.display}</span>
              </span>
              <span className="dd-concept-count">
                {bindings.length} {bindings.length === 1 ? 'route' : 'routes'}
              </span>
            </div>

            {isOpen && (
              <div className="dd-concept-body" id={`${concept.id}-body`}>
                <p className="dd-cell-desc">{concept.description}</p>
                {concept.valueSet && (
                  <p className="dd-concept-valueset">
                    Harmonized value set:{' '}
                    {/*
                      Linked rather than printed as bare text (#281). The canonical
                      stays in the title, because the URL is what someone pastes
                      into their own terminology tooling.
                    */}
                    {valueSetHref(concept.valueSet) ? (
                      <a
                        className="dd-code-link"
                        href={valueSetHref(concept.valueSet)}
                        title={concept.valueSet}
                      >
                        {valueSetLabel(concept.valueSet)}
                      </a>
                    ) : (
                      <code>{concept.valueSet}</code>
                    )}
                  </p>
                )}
                <div className="dd-table-wrapper">
                  <table className="dd-table dd-table--fixed">
                    {/* Same budget as the stage tables. Omitting it here was an
                        oversight in #432, and a visible one: this table kept auto
                        layout, so its rows ran 92–110px against the 64px median
                        below and the section read as the scruffier half of its
                        own page. */}
                    <colgroup>
                      <col className="dd-rcol-route" />
                      <col className="dd-rcol-value" />
                      <col className="dd-rcol-resource" />
                      <col className="dd-rcol-path" />
                      <col className="dd-rcol-usedby" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Route in</th>
                        <th>Value drawn from</th>
                        <th>FHIR Resource</th>
                        <th>FHIR Path</th>
                        <th>Used By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bindings.map(b => (
                        <tr key={b.id}>
                          <td className="dd-cell-field">{b.name}</td>
                          <td className="dd-cell-system">
                            {b.value ? <SystemCell system={b.value.system} /> : '—'}
                            {b.value?.valueSet && <ValueSetLine canonical={b.value.valueSet} />}
                          </td>
                          <td>
                            <span className={`dd-resource-badge dd-resource-badge--${b.fhirResource.toLowerCase()}`}>
                              {b.fhirResource}
                            </span>
                          </td>
                          <td className="dd-cell-path">{b.fhirPath}</td>
                          <td>
                            <div className="dd-tools">
                              {b.usedBy.map(tid => {
                                const tool = toolIndex.get(tid)
                                if (!tool) return null
                                return (
                                  <span key={tid} className="dd-tool-chip" title={tool.name}>
                                    {tool.shortName ?? tool.name}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/**
 * How many Used-By chips a summary row shows before collapsing to a count.
 *
 * Measured: the widest `usedBy` list rendered three wrapped lines in a 142px
 * column, so the chips alone tripled a row's height. Two plus a count fits one
 * line at every column width this table uses, and the full list is one click
 * away in the detail row.
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
            <span className="dd-code-none" title="This element carries no code of its own">—</span>
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
          <span className={`dd-resource-badge dd-resource-badge--${b.fhirResource.toLowerCase()}`}>
            {b.fhirResource}
          </span>
        </td>
        <td className="dd-cell-path">{b.fhirPath}</td>
        <td>
          <div className="dd-tools">
            {shown.map(t => (
              <span key={t.id} className="dd-tool-chip" title={t.name}>
                {t.shortName ?? t.name}
              </span>
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
                    <span key={t.id} className="dd-tool-chip" title={t.name}>
                      {t.shortName ?? t.name}
                    </span>
                  ))}
                </span>
              </p>
            )}
            {concept && (
              <p className="dd-detail-line">
                <span className="dd-detail-label">One route into</span>
                <span className="dd-concept-chip">{concept.name}</span>
              </p>
            )}
            {crossStages.length > 0 && (
              <p className="dd-detail-line">
                <span className="dd-detail-label">Also used in</span>
                <span className="dd-tools">
                  {crossStages.map(sid => (
                    <span key={sid} className="dd-cross-chip">{stageById.get(sid)?.title ?? sid}</span>
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
        Structured data fields, terminology codes, and FHIR resource mappings across the suicide safer care pathway.
        Bindings are grouped by the pathway stage whose tools first produce them — codes used in multiple stages are flagged inline.
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
        <p className="dd-empty-state">No entries match your filters.</p>
      )}

      <SharedConcepts concepts={visibleConcepts} toolIndex={toolIndex} />

      {grouped.map(group => (
        <section key={group.stageId} className="dd-stage-section" id={sectionAnchor(group.stageId)}>
          <div className="dd-stage-header">
            <h3 className="dd-stage-title">{group.stageTitle}</h3>
            <span className="dd-stage-count">{group.bindings.length} {group.bindings.length === 1 ? 'element' : 'elements'}</span>
          </div>

          <div className="dd-table-wrapper">
            <table className="dd-table dd-table--fixed">
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
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
