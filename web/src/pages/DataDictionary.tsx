import { useState, useMemo } from 'react'
import { DATA_DICTIONARY } from '../data/dataDictionaryData'
import '../css/DataDictionary.css'

export function DataDictionary() {
  const [search, setSearch] = useState('')
  const [toolFilter, setToolFilter] = useState('All')
  const [resourceFilter, setResourceFilter] = useState('All')

  const tools = useMemo(() => {
    const set = new Set(DATA_DICTIONARY.map(e => e.tool))
    return ['All', ...Array.from(set).sort()]
  }, [])

  const resources = useMemo(() => {
    const set = new Set(DATA_DICTIONARY.map(e => e.fhirResource))
    return ['All', ...Array.from(set).sort()]
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return DATA_DICTIONARY.filter(entry => {
      if (toolFilter !== 'All' && entry.tool !== toolFilter) return false
      if (resourceFilter !== 'All' && entry.fhirResource !== resourceFilter) return false
      if (q) {
        return (
          entry.fieldName.toLowerCase().includes(q) ||
          entry.code.toLowerCase().includes(q) ||
          entry.codeDisplay.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q) ||
          entry.fhirPath.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [search, toolFilter, resourceFilter])

  return (
    <div className="data-dictionary">
      <h2 className="page-title">Data Dictionary</h2>
      <p className="dd-description">
        Reference for all structured data fields, terminology codes, and FHIR resource mappings
        used across SPiER clinical tools.
      </p>

      <div className="dd-filters">
        <input
          type="text"
          className="dd-search"
          placeholder="Search fields, codes, descriptions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="dd-select"
          value={toolFilter}
          onChange={e => setToolFilter(e.target.value)}
        >
          {tools.map(t => <option key={t} value={t}>{t === 'All' ? 'All Tools' : t}</option>)}
        </select>
        <select
          className="dd-select"
          value={resourceFilter}
          onChange={e => setResourceFilter(e.target.value)}
        >
          {resources.map(r => <option key={r} value={r}>{r === 'All' ? 'All Resources' : r}</option>)}
        </select>
        <span className="dd-count">{filtered.length} of {DATA_DICTIONARY.length} entries</span>
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
              <th>Tool</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, idx) => (
              <tr key={idx}>
                <td className="dd-cell-field">{entry.fieldName}</td>
                <td className="dd-cell-code">{entry.code}</td>
                <td className="dd-cell-system">{entry.codeSystem}</td>
                <td>
                  <span className={`dd-resource-badge dd-resource-badge--${entry.fhirResource.toLowerCase()}`}>
                    {entry.fhirResource}
                  </span>
                </td>
                <td className="dd-cell-path">{entry.fhirPath}</td>
                <td>
                  <span className={`dd-tool-badge ${entry.tool === 'Stanley-Brown' ? 'dd-tool-badge--sb' : entry.tool === 'CAMS' ? 'dd-tool-badge--cams' : 'dd-tool-badge--both'}`}>
                    {entry.tool}
                  </span>
                </td>
                <td className="dd-cell-desc">{entry.description}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="dd-empty">No entries match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
