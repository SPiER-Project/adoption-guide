import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Renderer from '@formbox/renderer'
import { theme } from '@formbox/hs-theme'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { CarePlanDisplay } from './CarePlanDisplay'
import { mapResponseToObservations } from '../lib/observationMappers'
import { stampLaunchStage } from '../lib/launchStage'
import type { GeneratedCarePlan } from '../lib/carePlanMappers'
import type { RiskAlert } from '../lib/observationMappers'
import type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '../types/fhir'

const LEVEL_CONFIG: Record<string, { className: string; label: string }> = {
  acute:    { className: 'alert--acute',    label: 'ACUTE' },
  high:     { className: 'alert--high',     label: 'HIGH' },
  moderate: { className: 'alert--moderate', label: 'MODERATE' },
  low:      { className: 'alert--low',      label: 'LOW' },
  none:     { className: 'alert--none',     label: 'NONE' },
}

interface QuestionnaireViewProps {
  title: string
  questionnaire: FhirResource
  persistName?: string
  carePlanMapper?: (response: QuestionnaireResponseResource) => GeneratedCarePlan
}

interface SubmitResult {
  riskAlert: RiskAlert
  observations: ObservationResource[]
}

export function QuestionnaireView({ title, questionnaire, persistName, carePlanMapper }: QuestionnaireViewProps) {
  const [response, setResponse] = useState<QuestionnaireResponseResource | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [carePlan, setCarePlan] = useState<GeneratedCarePlan | null>(null)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [searchParams] = useSearchParams()
  const { addResponse, addCarePlan } = usePatient()

  function handleSubmit(submittedResponse: QuestionnaireResponseResource) {
    const base = submittedResponse || response
    if (base && persistName) {
      // Stamp the QR with the source Questionnaire's canonical URL (FHIR R4
      // QuestionnaireResponse.questionnaire). Downstream lookup matches Tools
      // by this URL — see catalog/tools.ts → toolForQuestionnaireUrl. Build a
      // new object rather than mutating the (state-derived) response.
      const qUrl = questionnaire.url as string | undefined
      const qVersion = questionnaire.version as string | undefined
      let responseToUse: QuestionnaireResponseResource =
        qUrl && !base.questionnaire
          ? { ...base, questionnaire: qVersion ? `${qUrl}|${qVersion}` : qUrl }
          : base
      // Disambiguate a questionnaire shared by tools at different pathway stages
      // (e.g. CAMS SSF-5 Section A) by stamping the launching tool's stage — the
      // tool id arrives as a `?tool=` query param on the launchAction route.
      responseToUse = stampLaunchStage(responseToUse, searchParams.get('tool'))
      addResponse(persistName, responseToUse)
      setSubmitted(true)

      // Preview the observation results for immediate display
      const mapperResult = mapResponseToObservations(responseToUse)
      if (mapperResult) {
        setSubmitResult(mapperResult)
      }

      // Generate CarePlan if mapper provided
      if (carePlanMapper) {
        const plan = carePlanMapper(responseToUse)
        if (!plan.isEmpty) {
          setCarePlan(plan as GeneratedCarePlan)
          addCarePlan(plan.resource)
          setTimeout(() => {
            document.querySelector('.careplan-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
          return
        }
      }

      // Scroll to result summary if no care plan
      setTimeout(() => {
        document.querySelector('.submit-result-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  return (
    <div className="form-wrapper">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/patient/chart">← Patient chart</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{title}</span>
      </nav>
      <div className="form-card">
        <Renderer
          fhirVersion="r4"
          // Renderer is generic over formbox's strict FHIR types; the raw imported
          // Questionnaire JSON doesn't structurally match, so cast at this boundary.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          questionnaire={questionnaire as any}
          theme={theme}
          onChange={(newResponse) => setResponse(newResponse as unknown as QuestionnaireResponseResource)}
          onSubmit={persistName ? (r => handleSubmit(r as unknown as QuestionnaireResponseResource)) : undefined}
        />
        {submitted && !carePlan && submitResult && (
          <div className={`submit-result-summary ${LEVEL_CONFIG[submitResult.riskAlert.level].className}`}>
            <div className="submit-result-header">
              <span className={`risk-pill risk-pill--sm risk-pill--${submitResult.riskAlert.level}`}>
                {LEVEL_CONFIG[submitResult.riskAlert.level].label}
              </span>
              <span className="submit-result-title">{submitResult.riskAlert.summary}</span>
            </div>
            <p className="submit-result-detail">{submitResult.riskAlert.detail}</p>
            {submitResult.observations.length > 0 && (
              <div className="submit-result-obs">
                {submitResult.observations.slice(0, 6).map((obs, idx) => (
                  <span key={idx} className="submit-result-obs-chip">
                    <span className="chip-label">{obs.code?.text || obs.code?.coding?.[0]?.display}:</span>
                    <span className="chip-value">
                      {obs.valueInteger !== undefined && obs.valueInteger}
                      {obs.valueBoolean !== undefined && (obs.valueBoolean ? 'Yes' : 'No')}
                      {obs.valueString !== undefined && obs.valueString}
                      {obs.valueCodeableConcept && (obs.valueCodeableConcept.text || obs.valueCodeableConcept.coding?.[0]?.display)}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className="submit-result-actions">
              <Link to="/patient/chart#activity" className="submit-result-link">View in chart</Link>
              {submitResult.riskAlert.suggestedAction && (
                <Link to={submitResult.riskAlert.suggestedAction.path} className="submit-result-action-btn">
                  {submitResult.riskAlert.suggestedAction.label} &rarr;
                </Link>
              )}
            </div>
          </div>
        )}
        {submitted && !carePlan && !submitResult && (
          <div className="submit-success-notice">
            Response saved to patient chart.{' '}
            <Link to="/patient/chart#activity">View in chart</Link>
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
