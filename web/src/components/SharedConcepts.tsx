import { useState } from 'react'
import { bindingsForConcept, valueSetHref, valueSetLabel, type Concept, type Tool } from '@spier/core/data/catalog'
import { Card } from './Card'
import { SectionHeader } from './SectionHeader'
import { Pill } from './Pill'
import { DataTable } from './DataTable'
import { CodeLink, SystemCell, ValueSetLine } from './DictionaryCodeCells'
import '../css/SharedConcepts.css'

/**
 * Anchor id for the normalization layer — shared with the page's jump nav, so
 * the nav cannot point at an id this section does not declare. `dd-` prefixed
 * because it shares a document with whatever the guide layout renders.
 */
export const NORMALIZATION_ANCHOR = 'dd-normalization'

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
export function SharedConcepts({
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
    <Card as="section" padding="compact" tone="muted" accent className="dd-stage-section dd-concept-layer" id={NORMALIZATION_ANCHOR}>
      <SectionHeader
        title="Cross-instrument normalization"
        meta={
          <>
            {concepts.length} {concepts.length === 1 ? 'concept' : 'concepts'} &middot; {routeCount}{' '}
            {routeCount === 1 ? 'route' : 'routes'} &middot; {toolCount}{' '}
            {toolCount === 1 ? 'tool' : 'tools'}
          </>
        }
      />
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
                <DataTable framed fixed>
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
                            <Pill variant="label" className={`dd-resource-badge--${b.fhirResource.toLowerCase()}`}>
                              {b.fhirResource}
                            </Pill>
                          </td>
                          <td className="dd-cell-path">{b.fhirPath}</td>
                          <td>
                            <div className="dd-tools">
                              {b.usedBy.map(tid => {
                                const tool = toolIndex.get(tid)
                                if (!tool) return null
                                return (
                                  <Pill key={tid} variant="label" title={tool.name}>
                                    {tool.shortName ?? tool.name}
                                  </Pill>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                </DataTable>
              </div>
            )}
          </div>
        )
      })}
    </Card>
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
