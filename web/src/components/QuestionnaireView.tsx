import { useState } from 'react'
import { Link } from 'react-router-dom'
import Renderer from '@formbox/renderer'
import { theme } from '@formbox/hs-theme'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { CarePlanDisplay } from './CarePlanDisplay'
import type { GeneratedCarePlan } from '../carePlanMapper'

interface QuestionnaireViewProps {
  title: string
  questionnaire: any
  persistName?: string
  carePlanMapper?: (response: any) => { resource: any; activities: any[]; isEmpty: boolean }
}

export function QuestionnaireView({ title, questionnaire, persistName, carePlanMapper }: QuestionnaireViewProps) {
  const [response, setResponse] = useState<any>(null)
  const [submitted, setSubmitted] = useState(false)
  const [carePlan, setCarePlan] = useState<GeneratedCarePlan | null>(null)
  const { addResponse, addCarePlan } = usePatient()

  function handleSubmit(submittedResponse: any) {
    const responseToUse = submittedResponse || response
    if (responseToUse && persistName) {
      addResponse(persistName, responseToUse)
      setSubmitted(true)

      // Generate CarePlan if mapper provided
      if (carePlanMapper) {
        const plan = carePlanMapper(responseToUse)
        if (!plan.isEmpty) {
          setCarePlan(plan as GeneratedCarePlan)
          addCarePlan(plan.resource)
          setTimeout(() => {
            document.querySelector('.careplan-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        }
      }
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
        {submitted && !carePlan && (
          <div className="submit-success-notice">
            Response saved to patient chart.{' '}
            <Link to="/chart/screenings">View in Screenings</Link>
          </div>
        )}
      </div>

      {carePlan && (
        <div className="form-card">
          <CarePlanDisplay carePlan={carePlan} />
        </div>
      )}

      <aside className="debug-sidebar">
        <FhirJsonViewer data={questionnaire} title="FHIR Questionnaire Definition" />
        {response && !carePlan && (
          <FhirJsonViewer data={response} title="Live FHIR QuestionnaireResponse" defaultOpen />
        )}
      </aside>
    </div>
  )
}
