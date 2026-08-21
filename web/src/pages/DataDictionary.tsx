import { useMemo, useState } from 'react'
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
 * Shared concepts, rendered above the stage tables.
 *
 * This section exists because of one concrete reading failure: LOINC 93374-7
 * occupied five rows in five different stage groups, and nothing on the page
 * said they were the same concept reached five ways. The concept row names it
 * once; expanding shows every route into it side by side, which is the
 * comparison a consumer actually needs before acting on a tier.
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
  const [expanded, setExpanded] = useState<string | null>(null)
  if (concepts.length === 0) return null

  return (
    <section className="dd-stage-section">
      <div className="dd-stage-header">
        <h3 className="dd-stage-title">Shared concepts</h3>
        <span className="dd-stage-count">
          {concepts.length} {concepts.length === 1 ? 'concept' : 'concepts'}
        </span>
      </div>
      <p className="dd-concept-intro">
        Concepts that more than one instrument expresses. Each is one meaning with several routes
        into it — expand to compare the routes.
      </p>

      {concepts.map(concept => {
        const bindings = bindingsForConcept(concept.id)
        const isOpen = expanded === concept.id
        return (
          <div key={concept.id} className="dd-concept">
            <button
              type="button"
              className="dd-concept-toggle"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : concept.id)}
            >
              <span className="dd-concept-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              <span className="dd-concept-name">{concept.name}</span>
              <span className="dd-concept-code">
                <CodeLink coding={concept.code} />
                <span className="dd-code-display">{concept.code.display}</span>
              </span>
              <span className="dd-concept-count">
                {bindings.length} {bindings.length === 1 ? 'binding' : 'bindings'}
              </span>
            </button>

            {isOpen && (
              <div className="dd-concept-body">
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
                  <table className="dd-table">
                    <thead>
                      <tr>
                        <th>Binding</th>
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

export function DataDictionary() {
  const [search, setSearch] = useState('')
  const [resourceFilter, setResourceFilter] = useState('All')

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

  // Only show a concept if at least one of its bindings survived the filters —
  // otherwise the section would advertise routes the reader cannot see.
  const visibleConcepts = useMemo(() => {
    const ids = new Set(filtered.map(b => b.conceptId).filter((c): c is string => !!c))
    return CONCEPTS.filter(c => ids.has(c.id))
  }, [filtered])

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

      {grouped.length === 0 && (
        <p className="dd-empty-state">No entries match your filters.</p>
      )}

      <SharedConcepts concepts={visibleConcepts} toolIndex={toolIndex} />

      {grouped.map(group => (
        <section key={group.stageId} className="dd-stage-section">
          <div className="dd-stage-header">
            <h3 className="dd-stage-title">{group.stageTitle}</h3>
            <span className="dd-stage-count">{group.bindings.length} {group.bindings.length === 1 ? 'element' : 'elements'}</span>
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
                {group.bindings.map(b => {
                  const referencedStages = stagesReferencedBy(b, toolIndex)
                  const crossStages = referencedStages.filter(sid => sid !== group.stageId)
                  const concept = b.conceptId ? conceptIndex.get(b.conceptId) : undefined
                  return (
                    <tr key={b.id}>
                      <td className="dd-cell-field">
                        {b.name}
                        {concept && (
                          <div className="dd-concept-ref">
                            <span className="dd-cross-label">One route into:</span>
                            <span className="dd-concept-chip">{concept.name}</span>
                          </div>
                        )}
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
                        {b.code ? (
                          <>
                            {/*
                              Only the code itself is a link — the display stays plain
                              text so the code remains easy to select and copy, which is
                              what people actually do with this column.
                            */}
                            <CodeLink coding={b.code} />
                            <span className="dd-code-display">{b.code.display}</span>
                          </>
                        ) : (
                          <span className="dd-code-none" title="This element carries no code of its own">—</span>
                        )}
                      </td>
                      <td className="dd-cell-system">
                        {/*
                          Code system and value system are shown as separate lines
                          rather than one column that has to pick. A row can now
                          honestly carry both, which several do — an Observation coded
                          with one concept and valued from another vocabulary.
                        */}
                        {b.code && <SystemCell system={b.code.system} note={b.value ? 'code' : undefined} />}
                        {b.value && <SystemCell system={b.value.system} note="values" />}
                        {/*
                          The bindable set sits under the value system it narrows,
                          not in a column of its own: only 18 of 24 value blocks
                          name one, and an empty column reads as a missing set
                          rather than as an unbound value.
                        */}
                        {b.value?.valueSet && <ValueSetLine canonical={b.value.valueSet} />}
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
                      <td className="dd-cell-desc">{b.description}</td>
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
