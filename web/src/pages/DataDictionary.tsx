import { useMemo, useState } from 'react'
import {
  STAGES,
  TOOLS,
  DATA_ELEMENTS,
  systemLabel,
  codeHref,
  type Coding,
  type DataElement,
  type Tool,
} from '../data/catalog'
import '../css/DataDictionary.css'

interface StageGroup {
  stageId: string
  stageTitle: string
  elements: DataElement[]
}

/**
 * Primary stage for an element: the earliest-ordered stage among tools that use it.
 * Elements with no using tool land in a special "Cross-cutting / Unassigned" bucket.
 */
function groupElementsByStage(elements: DataElement[]): StageGroup[] {
  const stageOrder = new Map(STAGES.map((s, i) => [s.id, i]))
  const toolStage = new Map(TOOLS.map(t => [t.id, t.stageId]))

  const groups: Record<string, DataElement[]> = {}
  for (const stage of STAGES) groups[stage.id] = []
  const unassigned: DataElement[] = []

  for (const el of elements) {
    const stages = el.usedBy
      .map(tid => toolStage.get(tid))
      .filter((s): s is string => !!s)
    if (stages.length === 0) {
      unassigned.push(el)
      continue
    }
    const primary = stages.reduce((a, b) =>
      (stageOrder.get(a) ?? Infinity) <= (stageOrder.get(b) ?? Infinity) ? a : b
    )
    groups[primary].push(el)
  }

  const result: StageGroup[] = STAGES
    .filter(s => groups[s.id].length > 0)
    .map(s => ({ stageId: s.id, stageTitle: s.title, elements: groups[s.id] }))

  if (unassigned.length > 0) {
    result.push({ stageId: '__unassigned', stageTitle: 'Unassigned', elements: unassigned })
  }
  return result
}

function stagesReferencedBy(el: DataElement, toolIndex: Map<string, Tool>): string[] {
  const stageIds = new Set(
    el.usedBy.map(tid => toolIndex.get(tid)?.stageId).filter((s): s is string => !!s)
  )
  return [...stageIds]
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

export function DataDictionary() {
  const [search, setSearch] = useState('')
  const [resourceFilter, setResourceFilter] = useState('All')

  const resources = useMemo(() => {
    const set = new Set(DATA_ELEMENTS.map(e => e.fhirResource))
    return ['All', ...Array.from(set).sort()]
  }, [])

  const toolIndex = useMemo(() => new Map(TOOLS.map(t => [t.id, t])), [])
  const stageById = useMemo(() => new Map(STAGES.map(s => [s.id, s])), [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return DATA_ELEMENTS.filter(el => {
      if (resourceFilter !== 'All' && el.fhirResource !== resourceFilter) return false
      if (!q) return true
      // Systems are searchable by BOTH the full URL and the short label, so a
      // query for "LOINC" and one for "loinc.org" both land.
      const system = el.coding?.system ?? el.answerSystem
      return (
        el.name.toLowerCase().includes(q) ||
        (el.coding?.code.toLowerCase().includes(q) ?? false) ||
        (el.coding?.display.toLowerCase().includes(q) ?? false) ||
        (system?.toLowerCase().includes(q) ?? false) ||
        (system ? systemLabel(system).toLowerCase().includes(q) : false) ||
        el.description.toLowerCase().includes(q) ||
        el.fhirPath.toLowerCase().includes(q) ||
        el.usedBy.some(tid => toolIndex.get(tid)?.name.toLowerCase().includes(q))
      )
    })
  }, [search, resourceFilter, toolIndex])

  const grouped = useMemo(() => groupElementsByStage(filtered), [filtered])

  return (
    <div className="data-dictionary">
      <p className="dd-description">
        Structured data fields, terminology codes, and FHIR resource mappings across the suicide safer care pathway.
        Elements are grouped by the pathway stage whose tools first produce them — codes used in multiple stages are flagged inline.
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
        <span className="dd-count">{filtered.length} of {DATA_ELEMENTS.length} entries</span>
      </div>

      {grouped.length === 0 && (
        <p className="dd-empty-state">No entries match your filters.</p>
      )}

      {grouped.map(group => (
        <section key={group.stageId} className="dd-stage-section">
          <div className="dd-stage-header">
            <h3 className="dd-stage-title">{group.stageTitle}</h3>
            <span className="dd-stage-count">{group.elements.length} {group.elements.length === 1 ? 'element' : 'elements'}</span>
          </div>

          <div className="dd-table-wrapper">
            <table className="dd-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Code</th>
                  <th>System</th>
                  <th>FHIR Resource</th>
                  <th>FHIR Path</th>
                  <th>Used By</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {group.elements.map(el => {
                  const referencedStages = stagesReferencedBy(el, toolIndex)
                  const crossStages = referencedStages.filter(sid => sid !== group.stageId)
                  return (
                    <tr key={el.id}>
                      <td className="dd-cell-field">
                        {el.name}
                        {crossStages.length > 0 && (
                          <div className="dd-cross-stage">
                            <span className="dd-cross-label">Also used in:</span>
                            {crossStages.map(sid => (
                              <span key={sid} className="dd-cross-chip">{stageById.get(sid)?.title ?? sid}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="dd-cell-code">
                        {el.coding ? (
                          <>
                            {/*
                              Only the code itself is a link — the display stays plain
                              text so the code remains easy to select and copy, which is
                              what people actually do with this column.
                            */}
                            <CodeLink coding={el.coding} />
                            <span className="dd-code-display">{el.coding.display}</span>
                          </>
                        ) : (
                          <span className="dd-code-none" title="This element carries no code of its own">—</span>
                        )}
                      </td>
                      <td className="dd-cell-system">
                        {el.coding ? (
                          <span title={el.coding.system}>{systemLabel(el.coding.system)}</span>
                        ) : el.answerSystem ? (
                          <span title={el.answerSystem}>
                            {systemLabel(el.answerSystem)}
                            <span className="dd-system-note">answer values</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`dd-resource-badge dd-resource-badge--${el.fhirResource.toLowerCase()}`}>
                          {el.fhirResource}
                        </span>
                      </td>
                      <td className="dd-cell-path">{el.fhirPath}</td>
                      <td>
                        <div className="dd-tools">
                          {el.usedBy.map(tid => {
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
                      <td className="dd-cell-desc">{el.description}</td>
                    </tr>
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
