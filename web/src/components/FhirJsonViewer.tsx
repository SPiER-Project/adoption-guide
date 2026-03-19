import { useState } from 'react'
import '../css/FhirJsonViewer.css'

interface FhirJsonViewerProps {
  data: any
  title?: string
  defaultOpen?: boolean
}

export function FhirJsonViewer({ data, title = 'FHIR JSON', defaultOpen = false }: FhirJsonViewerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="fhir-viewer">
      <button
        className="fhir-viewer-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
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
