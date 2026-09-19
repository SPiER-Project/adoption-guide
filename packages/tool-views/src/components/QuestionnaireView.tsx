import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Renderer from '@formbox/renderer'
import { theme } from '@formbox/hs-theme'
import { usePatient } from '../context/PatientContext'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from '@spier/ui/PageHeader'
import { InstrumentHeader } from './InstrumentHeader'
import { CarePlanDisplay } from './CarePlanDisplay'
import { RiskPill } from './RiskPill'
import { mapResponseToObservations } from '@spier/core/lib/observationMappers'
import { QUESTIONNAIRE_BY_URL } from '@spier/core/data/questionnaires'
import { stripCanonicalVersion } from '@spier/core/data/catalog'
import { stampLaunchStage } from '../lib/launchStage'
import type { GeneratedCarePlan } from '@spier/core/lib/carePlanMappers'
import type { RiskAlert } from '@spier/core/lib/observationMappers'
import type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'
import { EmptyState } from '@spier/ui/EmptyState'
import { Notice } from '@spier/ui/Notice'
import { Button } from '@spier/ui/Button'

const LEVEL_CONFIG: Record<string, { className: string; label: string }> = {
  acute:    { className: 'alert--acute',    label: 'ACUTE' },
  high:     { className: 'alert--high',     label: 'HIGH' },
  moderate: { className: 'alert--moderate', label: 'MODERATE' },
  low:      { className: 'alert--low',      label: 'LOW' },
  none:     { className: 'alert--none',     label: 'NONE' },
}

interface QuestionnaireViewProps {
  title: string
  /**
   * The Questionnaire's canonical URL — NOT the resource.
   *
   * ⚠️ **This prop is a URL on purpose, and it is load-bearing for bundle
   * shape.** `toolViews.tsx` builds its 29 entries at module scope and `App.tsx`
   * imports that map statically, so anything an entry *holds* is eager. While
   * this took a resource, all 18 hand-authored Questionnaires (166.8 KB) were
   * compiled into the entry chunk of both surfaces — including the clinical one
   * an EHR frames — although every view component here is already `lazy()`.
   * Taking the canonical instead defers the resource to this module, which is
   * lazy, so the JSON lands in the assessment chunk where it belongs.
   * `docs/plans/tool-bundling-audit-2026-09-19.md` §5.1 has the measurement, and
   * `npm run check:eager-forms` fails if a resource is made eager again.
   */
  questionnaireUrl: string
  persistName?: string
  carePlanMapper?: (response: QuestionnaireResponseResource) => GeneratedCarePlan
}

interface SubmitResult {
  riskAlert: RiskAlert
  observations: ObservationResource[]
}

export function QuestionnaireView({ title, questionnaireUrl, persistName, carePlanMapper }: QuestionnaireViewProps) {
  // Resolved here rather than passed in — see `questionnaireUrl` above. The
  // registry is the single owner of the hand-authored JSON imports, and this
  // module is the only eager-safe place to read it from.
  const questionnaire = QUESTIONNAIRE_BY_URL[stripCanonicalVersion(questionnaireUrl)] as
    | FhirResource
    | undefined
  const [response, setResponse] = useState<QuestionnaireResponseResource | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [carePlan, setCarePlan] = useState<GeneratedCarePlan | null>(null)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [searchParams] = useSearchParams()
  const { addResponse, addCarePlan, writebackReport } = usePatient()

  function handleSubmit(submittedResponse: QuestionnaireResponseResource) {
    const base = submittedResponse || response
    if (base && persistName) {
      // Stamp the QR with the source Questionnaire's canonical URL (FHIR R4
      // QuestionnaireResponse.questionnaire). Downstream lookup matches Tools
      // by this URL — see catalog/tools.ts → toolForQuestionnaireUrl. Build a
      // new object rather than mutating the (state-derived) response.
      // `questionnaire` is guarded before render, but handleSubmit is defined
      // above that guard, so TypeScript cannot see it is resolved here. Prefer
      // the prop's canonical over the resolved resource's own url: they are the
      // same value by construction (the registry is keyed by it), and reading
      // the prop keeps the stamp independent of the lookup.
      const qUrl = (questionnaire?.url as string | undefined) ?? questionnaireUrl
      const qVersion = questionnaire?.version as string | undefined
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

  if (!questionnaire) {
    // Unreachable through the catalog: `questionnaireUrl` is typed as a
    // QUESTIONNAIRE_URLS value at every call site, and check:catalog asserts the
    // registry covers every Questionnaire under FHIR-Resources/. Rendered rather
    // than thrown so a stale deep link degrades to a message instead of a blank
    // route with a console error.
    return (
      <div className="form-view">
        <PageHeader eyebrowStyle="pill" eyebrow={['Patient Chart', 'Assessment']} up="/patient/record" title={title} />
        <EmptyState title="Instrument unavailable">
          This assessment is not part of the current build.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="form-view">
      <PageHeader eyebrowStyle="pill" eyebrow={['Patient Chart', 'Assessment']} up="/patient/record" title={title} />

      <div className="form-wrapper">
        <div className="form-card">
          <InstrumentHeader name={questionnaire.title} description={questionnaire.description} />
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
                <RiskPill
                  level={submitResult.riskAlert.level}
                  label={LEVEL_CONFIG[submitResult.riskAlert.level].label}
                  sm
                />
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
                <Button to="/patient/record#activity" variant="link" size="sm">View in chart</Button>
                {submitResult.riskAlert.suggestedAction && (
                  <Button to={submitResult.riskAlert.suggestedAction.path} size="sm" arrow>
                    {submitResult.riskAlert.suggestedAction.label}
                  </Button>
                )}
              </div>
            </div>
          )}
          {submitted && !carePlan && !submitResult && (
            <Notice tone="success">
              Response saved to patient chart.{' '}
              <Link to="/patient/record#activity">View in chart</Link>
            </Notice>
          )}
        </div>

        {carePlan && (
          <div className="form-card">
            <CarePlanDisplay carePlan={carePlan} />
          </div>
        )}

        <CodeDrawer>
          <FhirJsonViewer data={questionnaire} title="FHIR Questionnaire Definition" />
          {response && !carePlan && (
            <FhirJsonViewer data={response} title="Live FHIR QuestionnaireResponse" defaultOpen />
          )}
          {/* Panel plan §2's third section: what the writeback ladder actually
              created. §2 is emphatic that this is "only truthful because of §5 —
              it reports what happened, not what would have", so it renders ONLY
              a real WritebackReport and never a hypothetical.

              ⚠️ §9 asks for a "what would be written" fallback when there is no
              server. That is the half forked on the Track-1 decision (see
              docs/plans/next-session-handoff.md), so it is deliberately NOT
              built here — the empty state below states the absence instead,
              which is true under either answer. */}
          {writebackReport ? (
            <FhirJsonViewer data={writebackReport} title="Written to the EHR (writeback ladder)" />
          ) : (
            <EmptyState>
              <strong>Nothing written back yet.</strong> Submitting against a connected
              EHR records each ladder tier&rsquo;s outcome here.
            </EmptyState>
          )}
        </CodeDrawer>
      </div>
    </div>
  )
}
