import { useState } from 'react'
import { Link } from 'react-router-dom'
import Renderer from '@formbox/renderer'
import { theme } from '@formbox/hs-theme'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'

interface QuestionnaireViewProps {
  title: string
  questionnaire: any
  persistName?: string // if provided, response will be saved to localStorage on submit
}

export function QuestionnaireView({ title, questionnaire, persistName }: QuestionnaireViewProps) {
  const [response, setResponse] = useState<any>(null)
  const [submitted, setSubmitted] = useState(false)
  const { addResponse } = usePatient()

  function handleSubmit(submittedResponse: any) {
    const responseToUse = submittedResponse || response
    if (responseToUse && persistName) {
      addResponse(persistName, responseToUse)
      setSubmitted(true)
    }
  }

  return (
    <div className="form-wrapper">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/chart/screenings">← Screenings</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{title}</span>
      </nav>
      <div className="form-card">
        <Renderer
          fhirVersion="r4"
          questionnaire={questionnaire}
          theme={theme}
          onChange={(newResponse: any) => setResponse(newResponse)}
          onSubmit={persistName ? handleSubmit : undefined}
        />
        {submitted && (
          <div className="submit-success-notice">
            Response saved to patient chart.{' '}
            <Link to="/chart/screenings">View in Screenings</Link>
          </div>
        )}
      </div>

      <aside className="debug-sidebar">
        <FhirJsonViewer data={questionnaire} title="FHIR Questionnaire Definition" />
        {response && (
          <FhirJsonViewer data={response} title="Live FHIR QuestionnaireResponse" defaultOpen />
        )}
      </aside>
    </div>
  )
}
