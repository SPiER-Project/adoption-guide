import { useState } from 'react'
import { useInspect } from '../context/InspectContext'
import '../css/FhirJsonViewer.css'

interface FhirJsonViewerProps {
  data: unknown
  title?: string
  defaultOpen?: boolean
}

/**
 * A collapsible dump of a FHIR resource.
 *
 * ⚠️ **Renders NOTHING outside the Adoption Guide, and that is the point.**
 * Inspection is on inside `/guide` and off everywhere else — see
 * `context/InspectContext.ts` for the invariant and why it is a context rather
 * than a prop. The gate sits here, on the leaf, so a surface that renders this
 * without thinking about it gets the clinician's answer by default rather than
 * showing a clinician raw JSON.
 *
 * ⚠️ **The leaf gate is necessary and not sufficient.** Three call sites wrap
 * this in chrome of their own — `CodeDrawer`'s `<aside>`, PatientDocuments'
 * disclosure row, PatientPathway's `.cds-card-json` — and an empty wrapper is
 * its own defect. Each of those checks `useInspect()` too. Returning `null` here
 * is the backstop for a NEW call site, not the whole rule.
 */
export function FhirJsonViewer({ data, title = 'FHIR JSON', defaultOpen = false }: FhirJsonViewerProps) {
  const inspect = useInspect()
  // Hooks run before the bail-out so the order is stable whichever branch a
  // render takes — `inspect` is constant per subtree, but a conditional hook
  // would still be a rule-of-hooks violation and eslint reads it as one.
  const [isOpen, setIsOpen] = useState(defaultOpen)
  if (!inspect) return null

  return (
    <div className="fhir-viewer">
      <button
        className="fhir-viewer-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
      >
        <span className="fhir-viewer-toggle-icon">{isOpen ? '\u25BC' : '\u25B6'}</span>
        <span className="fhir-viewer-toggle-title">{title}</span>
      </button>
      {isOpen && (
        <div className="fhir-viewer-panel">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
