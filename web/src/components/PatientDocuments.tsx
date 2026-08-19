/**
 * Patient-level documents — every FHIR resource captured for this patient,
 * regardless of encounter or stage. The "show me everything" view. Extracted
 * from `PatientChart` (#126).
 *
 * No CSS import, matching every sibling chart section — `PatientChart.css` is
 * imported once by the page.
 */
import { useMemo, useState } from 'react'
import { FhirJsonViewer } from './FhirJsonViewer'
import { carePlanDisplayName, type RenderableResource } from '../lib/chartDisplay'
import { stageForResponse } from '../lib/patientPathway'
import type { FhirResourceLike, StoredResponseLike } from '../lib/patientPathway'
import type { StoredResponse } from '../types/fhir'

// Sortable sentinel for FHIR resources missing an authoritative timestamp.
// Keeps the date-driven memo deterministic and pushes undated rows to the bottom
// when sorting newest-first. Moved here with its only consumer.
const UNDATED_SENTINEL = '1970-01-01T00:00:00.000Z'

type DocFilter = 'all' | 'responses' | 'careplans' | 'observations'

export function PatientDocuments({
  responses,
  carePlans,
  observations,
}: {
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
}) {
  const [filter, setFilter] = useState<DocFilter>('all')
  const [openDoc, setOpenDoc] = useState<string | null>(null)

  type DocEntry =
    | { kind: 'response'; key: string; title: string; when: string; resource: FhirResourceLike; stageTag?: string }
    | { kind: 'careplan'; key: string; title: string; when: string; resource: FhirResourceLike; stageTag?: string }
    | { kind: 'observation'; key: string; title: string; when: string; resource: FhirResourceLike; stageTag?: string }

  const docs: DocEntry[] = useMemo(() => {
    const all: DocEntry[] = []
    for (const rawR of responses) {
      const r = rawR as StoredResponse
      all.push({
        kind: 'response',
        key: r.id,
        title: r.questionnaireName,
        when: r.completedAt,
        resource: r.resource,
        stageTag: stageForResponse(r.resource),
      })
    }
    for (const cp of carePlans) {
      const cpRead = cp as RenderableResource
      all.push({
        kind: 'careplan',
        key: cpRead.id ?? `cp-${all.length}`,
        title: carePlanDisplayName(cpRead),
        // Stable sentinel so this useMemo stays deterministic across recomputes
        // when an artifact is missing its timestamp. Undated entries sort to the bottom.
        when: cpRead._savedAt ?? UNDATED_SENTINEL,
        resource: cp,
      })
    }
    for (const obs of observations) {
      const obsRead = obs as RenderableResource
      all.push({
        kind: 'observation',
        key: obsRead.id ?? `obs-${all.length}`,
        title: obsRead.code?.text || obsRead.code?.coding?.[0]?.display || 'Observation',
        when: obsRead.effectiveDateTime ?? UNDATED_SENTINEL,
        resource: obs,
      })
    }
    all.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    return all
  }, [responses, carePlans, observations])

  const filtered = docs.filter(d => {
    if (filter === 'all') return true
    if (filter === 'responses') return d.kind === 'response'
    if (filter === 'careplans') return d.kind === 'careplan'
    return d.kind === 'observation'
  })

  return (
    <section id="documents" className="documents-section">
      <header className="chart-section-header">
        <h3 className="chart-section-title">Patient Documents</h3>
        <span className="chart-section-count">{docs.length} total</span>
      </header>
      <p className="documents-note">
        Every FHIR resource captured for this patient, regardless of encounter or stage. The
        "show me everything" view.
      </p>
      <div className="documents-filters">
        {(['all', 'responses', 'careplans', 'observations'] as DocFilter[]).map(opt => (
          <button
            key={opt}
            type="button"
            className={`filter-chip ${filter === opt ? 'filter-chip--active' : ''}`}
            onClick={() => setFilter(opt)}
          >
            {opt === 'all' && `All (${docs.length})`}
            {opt === 'responses' && `Responses (${docs.filter(d => d.kind === 'response').length})`}
            {opt === 'careplans' && `Care Plans (${docs.filter(d => d.kind === 'careplan').length})`}
            {opt === 'observations' && `Observations (${docs.filter(d => d.kind === 'observation').length})`}
          </button>
        ))}
      </div>
      <ul className="documents-list">
        {filtered.length === 0 && <li className="documents-empty">No documents.</li>}
        {filtered.map(d => {
          const isOpen = openDoc === d.key
          return (
            <li key={d.key} className="document-row">
              <button
                type="button"
                className="document-row-header"
                onClick={() => setOpenDoc(isOpen ? null : d.key)}
                aria-expanded={isOpen}
              >
                <span className={`document-kind document-kind--${d.kind}`}>
                  {d.kind === 'response' ? 'QR' : d.kind === 'careplan' ? 'CP' : 'OBS'}
                </span>
                <span className="document-title">{d.title}</span>
                <span className="document-when">
                  {d.when === UNDATED_SENTINEL ? 'Undated' : new Date(d.when).toLocaleDateString()}
                </span>
                <span className="document-toggle">{isOpen ? '▼' : '▶'}</span>
              </button>
              {isOpen && (
                <div className="document-body">
                  <FhirJsonViewer data={d.resource} title={`FHIR ${d.kind}`} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
