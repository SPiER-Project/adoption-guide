import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Renderer from '@formbox/renderer'
import { theme } from '@formbox/hs-theme'
import type { RendererProperties } from '@formbox/renderer'

/**
 * Exactly what formbox's `Renderer` accepts for `questionnaire` at the version
 * this component renders.
 *
 * ⚠️ `RendererProperties<'r4'>`, not `ComponentProps<typeof Renderer>`. The
 * component is generic over the FHIR version, so `ComponentProps` collapses the
 * prop to `fhir4.Questionnaire | fhir5.Questionnaire` — a union that `fhirVersion="r4"`
 * then refuses. Naming the instantiation keeps the cast below as narrow as the
 * call site actually is.
 */
type RendererQuestionnaire = RendererProperties<'r4'>['questionnaire']
import { usePatient } from '../context/PatientContext'
import { usePageHeaderOwner } from '../context/PageHeaderOwnerContext'
import { useTrail } from '../context/useTrail'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from '@spier/ui/PageHeader'
import { InstrumentHeader } from './InstrumentHeader'
import { CarePlanDisplay } from './CarePlanDisplay'
import { NextStep } from './NextStep'
import { RiskPill } from './RiskPill'
import { mapResponseToObservations } from '@spier/core/lib/observationMappers'
import { QUESTIONNAIRE_BY_URL } from '@spier/core/data/questionnaires'
import { stripCanonicalVersion } from '@spier/core/data/catalog'
import { stampLaunchStage } from '../lib/launchStage'
import type { GeneratedCarePlan } from '@spier/core/lib/carePlanMappers'
import type { RiskAlert } from '@spier/core/lib/observationMappers'
import type { PathwayRecord } from '@spier/core/lib/pathwayEvaluation'
import type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'
import { EmptyState } from '@spier/ui/EmptyState'
import { Notice } from '@spier/ui/Notice'

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
  /**
   * What this submit wrote, folded into the record the confirmation beat
   * evaluates. The save is asynchronous — a round trip under SMART — and the
   * beat renders the instant the submit lands, so without this the next action
   * would be answered from the chart as it stood BEFORE the response that was
   * just filled in (see `NextStep`).
   */
  const [pending, setPending] = useState<PathwayRecord | undefined>(undefined)
  const [searchParams] = useSearchParams()
  const { addResponse, addCarePlan, writebackReport } = usePatient()
  // Where this surface's chart and other tool views live — the clinician's
  // routes in the clinical app, the tool pages in the guide, and no chart at
  // all there. The literals are the app's, not this view's (SurfaceLinksContext).
  // Whether THIS view draws the page header. On the clinician's routes it is
  // the page and does; on the guide's tool page the page has already drawn one
  // naming the tool, and a second here would be two page titles (PageHeaderOwnerContext).
  const ownsHeader = usePageHeaderOwner() === 'view'
  const trail = useTrail()
  // The same trail the recorders draw — see `WorkflowForm`'s note on why the
  // pill-with-a-back-arrow went.
  const header = ownsHeader ? <PageHeader eyebrow={trail} title={title} /> : null

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

      const justWritten: PathwayRecord = {
        responses: [
          {
            id: String(responseToUse.id ?? ''),
            questionnaireName: persistName,
            completedAt: new Date().toISOString(),
            resource: responseToUse,
          },
        ],
        observations: mapperResult?.observations ?? [],
        riskAlerts: mapperResult ? [mapperResult.riskAlert] : [],
      }

      // Generate CarePlan if mapper provided
      if (carePlanMapper) {
        const plan = carePlanMapper(responseToUse)
        if (!plan.isEmpty) {
          setCarePlan(plan)
          addCarePlan(plan.resource)
          setPending({ ...justWritten, carePlans: [plan.resource] })
          setTimeout(() => {
            document.querySelector('.careplan-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
          return
        }
      }

      setPending(justWritten)

      // Scroll to result summary if no care plan
      setTimeout(() => {
        document.querySelector('.submit-result-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  // ⚠️ **The mapper's `suggestedAction` is deliberately not rendered here any
  // more.** Until 2026-09-21 this view resolved it to a button and stood it
  // beside "View in chart", so a filler's per-instrument hint — which knows one
  // response and nothing else about the chart — competed with the chart's own
  // answer (clinical-app audit §4.6, §1.5). It is not deleted: it rides on the
  // `RiskAlert`, which is part of the record `NextStep` evaluates, so it still
  // informs the one action instead of being a second one.

  if (!questionnaire) {
    // Unreachable through the catalog: `questionnaireUrl` is typed as a
    // QUESTIONNAIRE_URLS value at every call site, and check:catalog asserts the
    // registry covers every Questionnaire under ig/input/resources/questionnaires/. Rendered rather
    // than thrown so a stale deep link degrades to a message instead of a blank
    // route with a console error.
    return (
      <div className="form-view">
        {header}
        <EmptyState title="Instrument unavailable">
          This assessment is not part of the current build.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="form-view">
      {header}

      <div className="form-wrapper">
        <div className="form-card">
          <InstrumentHeader name={questionnaire.title} description={questionnaire.description} />
          <Renderer
            fhirVersion="r4"
            // Renderer is generic over formbox's strict FHIR types; the raw imported
            // Questionnaire JSON doesn't structurally match, so cast at this boundary.
            // ⚠️ To the PROP's own type rather than `any`. Both say "trust me" to
            // the compiler, but this one still fails if formbox changes what the
            // prop accepts, and it does not launder an `any` into the render tree.
            questionnaire={questionnaire as unknown as RendererQuestionnaire}
            // ⚠️ **`theme` is an error type, and the fault is upstream.**
            // `@formbox/hs-theme`'s shipped `dist/index.d.ts` imports from
            // `'../../../../packages/theme/lib'` — a path outside the published
            // package, which does not exist — so every one of its exports
            // resolves to an error. `skipLibCheck: true` swallows the TS2307,
            // exactly as it does for fhirclient 3's missing `types/types.d.ts`
            // (see `@spier/core/types/smartClient`). The difference is what to do
            // about it: there we READ the client's members, so declaring the five
            // we use was worth it; this value is opaque, travels straight back
            // into the same vendor's component, and is never read here. So the
            // rule is suppressed at the one line rather than a large vendor type
            // being re-declared and left to drift.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
              <NextStep pending={pending} />
            </div>
          )}
          {/* ⚠️ The care-plan branch had NO confirmation beat at all before
              2026-09-21 — a Stanley-Brown submit rendered the plan and stopped,
              so the one instrument that most obviously leads somewhere was the
              one that said nothing about where. It gets the same beat, under
              the plan rather than above it. */}
          {submitted && !carePlan && !submitResult && (
            <Notice tone="success">
              Response saved.
              <NextStep pending={pending} />
            </Notice>
          )}
        </div>

        {carePlan && (
          <div className="form-card">
            <CarePlanDisplay carePlan={carePlan} />
            <NextStep pending={pending} />
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
