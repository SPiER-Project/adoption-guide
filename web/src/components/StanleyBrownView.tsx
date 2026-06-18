import { useState } from 'react'
import { Link } from 'react-router-dom'
import Renderer from '@formbox/renderer'
import { theme } from '@formbox/hs-theme'
import { generateCarePlan } from '../lib/carePlanMappers'
import type { GeneratedCarePlan } from '../lib/carePlanMappers'
import { CarePlanDisplay } from './CarePlanDisplay'
import { FhirJsonViewer } from './FhirJsonViewer'
import { usePatient } from '../context/PatientContext'
import type { QuestionnaireResponseResource } from '../types/fhir'

import stanleyBrownQuestionnaire from '../../../FHIR-Resources/Stanley-Brown/fhir/questionnaires/questionnaire.json'

export function StanleyBrownView() {
  const [response, setResponse] = useState<QuestionnaireResponseResource | null>(null)
  const [carePlan, setCarePlan] = useState<GeneratedCarePlan | null>(null)
  const { addCarePlan, addResponse } = usePatient()

  function handleSubmit(submittedResponse: QuestionnaireResponseResource) {
    const responseToUse = submittedResponse || response
    if (responseToUse) {
      const plan = generateCarePlan(responseToUse)
      setCarePlan(plan)

      // Persist to localStorage
      addCarePlan(plan.resource)
      addResponse('Stanley-Brown Safety Plan', responseToUse)

      setTimeout(() => {
        document.querySelector('.careplan-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  return (
    <div className="form-wrapper">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/patient/assessments">← Screenings</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Stanley-Brown Safety Plan</span>
      </nav>
      <div className="form-card">
        <Renderer
          fhirVersion="r4"
          // Renderer is generic over formbox's strict FHIR types; the raw imported
          // Questionnaire JSON doesn't structurally match, so cast at this boundary.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          questionnaire={stanleyBrownQuestionnaire as any}
          theme={theme}
          onChange={(newResponse) => setResponse(newResponse as unknown as QuestionnaireResponseResource)}
          onSubmit={(r) => handleSubmit(r as unknown as QuestionnaireResponseResource)}
        />
      </div>

      {carePlan && (
        <div className="form-card">
          <CarePlanDisplay carePlan={carePlan} />
        </div>
      )}

      <aside className="debug-sidebar">
        <FhirJsonViewer data={stanleyBrownQuestionnaire} title="FHIR Questionnaire Definition" />
        {response && !carePlan && (
          <FhirJsonViewer data={response} title="Live FHIR QuestionnaireResponse" defaultOpen />
        )}
      </aside>
    </div>
  )
}
