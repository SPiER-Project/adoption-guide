import { useEffect, useRef, useState } from 'react'
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
import { PatientChartHint } from './PatientChartHint'
import { RiskPill } from './RiskPill'
import { mapResponseToObservations } from '@spier/core/lib/observationMappers'
import { QUESTIONNAIRE_BY_URL } from '@spier/core/data/questionnaires'
import { stripCanonicalVersion } from '@spier/core/data/catalog'
import { stampLaunchStage } from '../lib/launchStage'
import type { GeneratedCarePlan } from '@spier/core/lib/carePlanMappers'
import type { RiskAlert } from '@spier/core/lib/observationMappers'
import type { PathwayRecord } from '@spier/core/lib/pathwayEvaluation'
import type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'
import { Button } from '@spier/ui/Button'
import { Disclosure } from '@spier/ui/Disclosure'
import { EmptyState } from '@spier/ui/EmptyState'
import { Notice } from '@spier/ui/Notice'
import '../css/SubmitReview.css'

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

/**
 * Where the clinician is: filling the form in, looking at what it produced, or
 * done.
 *
 * ⚠️ **`review` is a state the form did not have before 2026-09-22, and adding
 * it moved the write.** See the component header.
 */
type Phase = 'filling' | 'review' | 'saved'

/**
 * Everything one submit produced, computed BEFORE anything is written.
 *
 * Every field here comes out of a pure function over the submitted
 * QuestionnaireResponse — `mapResponseToObservations` and the instrument's
 * `carePlanMapper` — which is what makes a review step possible at all: the
 * results a clinician is deciding about are derivable without touching the
 * chart, and the same derivation runs again inside `addResponse` when they
 * decide to keep them.
 */
interface SubmitResult {
  response: QuestionnaireResponseResource
  riskAlert: RiskAlert | null
  observations: ObservationResource[]
  /** Absent for an instrument with no care-plan mapper, and for an empty plan. */
  carePlan: GeneratedCarePlan | null
  /**
   * What this submit will add to the chart, as the record the pathway evaluator
   * reads — so the recommendation is the one the chart will give once the save
   * lands, rather than the one it gives without this response (see `NextStep`).
   */
  pending: PathwayRecord
}

/**
 * One instrument, filled in — and, since 2026-09-22, the three beats around it.
 *
 * ── Submit stopped meaning save (Brad, 2026-09-22) ──────────────────────────
 *
 * The form used to write on submit and then render its result summary UNDER the
 * still-filled form. Two things were wrong with that and Brad named both:
 *
 *  1. **A computed item read as a question.** The C-SSRS Screener's *Suicide
 *     Risk Level* is derived from q1–q6 by the mapper and is `readOnly` in the
 *     published artifact, but it rendered as an empty radio group at the bottom
 *     of the form, in the same typeface as the six items the clinician answers.
 *  2. **There was no moment between filling a suicide-risk instrument in and it
 *     being in the patient's chart.** The submit did the write; the summary was
 *     a report of something already done.
 *
 * So the flow is now: fill in → **Submit** → a screen carrying the results and
 * the recommendation → **Save to the chart**, or start the form again.
 *
 * ⚠️ **The computed item is hidden in the QUESTIONNAIRE, not filtered here.**
 * Every item a clinician is not asked to answer — the three C-SSRS risk levels,
 * the PHQ-9 and SBQ-R totals — carries the standard R4
 * `questionnaire-hidden` extension in `ig/input/resources/questionnaires/`, and
 * `@formbox/renderer` honours it. That is the portable answer: the Questionnaire
 * is the artifact SPiER publishes, so an EHR rendering it with its own filler
 * hides the same items, which a React-side filter could not achieve. It also
 * leaves the answer IN the response — formbox gates the response snapshot on
 * `enableWhen`, never on hidden — so the two `calculatedExpression` totals still
 * land in the QuestionnaireResponse and still satisfy their declared
 * `observationExtract` contract (`npm run check:extract`).
 *
 * ⚠️ **The writeback ladder is untouched, and deliberately so.** `addResponse`
 * still runs the whole of it in the order it always has — QuestionnaireResponse
 * first so the server-assigned id can be remapped into what references it, then
 * the derived Observations (`docs/plans/smart-filler-writeback-ladder.md`). The
 * only thing that changed is WHEN it is called: on a button the clinician
 * presses rather than on the renderer's submit. Nothing about tier order,
 * provenance or the correlation Encounter moved.
 *
 * ⚠️ **The review screen offers no way off itself except the two buttons.** The
 * response exists only in this component until the save, so a navigation control
 * here would discard a completed suicide-risk instrument silently — which is why
 * `NextStep` renders in `preview` mode on that screen: the recommendation in
 * words, and no button that leaves.
 */
export function QuestionnaireView({ title, questionnaireUrl, persistName, carePlanMapper }: QuestionnaireViewProps) {
  // Resolved here rather than passed in — see `questionnaireUrl` above. The
  // registry is the single owner of the hand-authored JSON imports, and this
  // module is the only eager-safe place to read it from.
  const questionnaire = QUESTIONNAIRE_BY_URL[stripCanonicalVersion(questionnaireUrl)] as
    | FhirResource
    | undefined
  const [response, setResponse] = useState<QuestionnaireResponseResource | null>(null)
  const [phase, setPhase] = useState<Phase>('filling')
  const [result, setResult] = useState<SubmitResult | null>(null)
  /**
   * Which instrument the state above belongs to.
   *
   * ⚠️ **The instrument changes under this component without it remounting.**
   * `TOOL_VIEWS` holds one `<QuestionnaireView>` element per slug and both apps
   * render them from the same position in the tree, so React reconciles the 18
   * fillers as ONE instance: walking from the PHQ-9's page to the C-SSRS's
   * changes `questionnaireUrl` and keeps every piece of state here. The form
   * body was always fine — formbox rebuilds from the `questionnaire` prop — but
   * a results screen that survives is the PREVIOUS instrument's results under
   * the new instrument's name, with no form in sight. Found in the browser,
   * 2026-09-22; the old code had the same leak in a form mild enough to miss
   * (a stale summary under a correct form).
   *
   * Reset during render rather than in an effect: React's own answer for
   * adjusting state when a prop changes, and the one that never paints the
   * wrong thing first.
   */
  const [filledInstrument, setFilledInstrument] = useState(questionnaireUrl)
  if (filledInstrument !== questionnaireUrl) {
    setFilledInstrument(questionnaireUrl)
    setResponse(null)
    setResult(null)
    setPhase('filling')
  }
  const [searchParams] = useSearchParams()
  const { addResponse, addCarePlan, writebackReport } = usePatient()
  // Whether THIS view draws the page header. On the clinician's routes it is
  // the page and does; on the guide's tool page the page has already drawn one
  // naming the tool, and a second here would be two page titles (PageHeaderOwnerContext).
  const ownsHeader = usePageHeaderOwner() === 'view'
  const trail = useTrail()
  // The same trail the recorders draw — see `WorkflowForm`'s note on why the
  // pill-with-a-back-arrow went.
  const header = ownsHeader ? <PageHeader eyebrow={trail} title={title} /> : null

  // The form is long enough to scroll and the results replace it, so without
  // this a submit at the bottom of a C-SSRS leaves the reader looking at the
  // middle of a screen whose content has entirely changed.
  const reviewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase !== 'filling') reviewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [phase])

  function handleSubmit(submittedResponse: QuestionnaireResponseResource) {
    const base = submittedResponse || response
    if (!base || !persistName) return

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

    const mapperResult = mapResponseToObservations(responseToUse)
    // `isEmpty` is the mapper saying the clinician filled in none of the plan;
    // an empty safety plan on a chart is worse than no safety plan, so it is
    // neither shown nor offered for saving.
    const plan = carePlanMapper ? carePlanMapper(responseToUse) : null

    setResult({
      response: responseToUse,
      riskAlert: mapperResult?.riskAlert ?? null,
      observations: mapperResult?.observations ?? [],
      carePlan: plan && !plan.isEmpty ? plan : null,
      pending: {
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
        carePlans: plan && !plan.isEmpty ? [plan.resource] : [],
      },
    })
    setPhase('review')
  }

  /**
   * The write, and the ONLY one this view makes.
   *
   * ⚠️ The order is the ladder's and is not this component's to choose:
   * `addResponse` runs the whole writeback (QuestionnaireResponse first, then
   * the Observations derived from it, then the correlation Encounter and any
   * episode a positive screen opens). The CarePlan is a separate artifact and
   * follows, as it always has.
   */
  function handleSave() {
    // The phase guard is the double-press: two clicks inside one frame would
    // otherwise run the whole ladder twice and put two of the same screen on
    // the chart. React commits `saved` before the second event dispatches, so
    // this is belt-and-braces — but the cost of being wrong is a duplicate
    // suicide-risk assessment in a patient's record.
    if (phase !== 'review' || !result || !persistName) return
    addResponse(persistName, result.response)
    if (result.carePlan) addCarePlan(result.carePlan.resource)
    setPhase('saved')
  }

  /**
   * ⚠️ **Nothing resets the renderer, and nothing needs to.** `@formbox/renderer`
   * owns the answers in a store it builds on mount, and there is no reset on its
   * props — but the results screen REPLACES the form rather than sitting under
   * it, so the renderer has already unmounted by the time this runs and mounts
   * again empty. A `key` bump here would be ceremony over an unmount that has
   * happened; if the results ever move back alongside the form, it stops being
   * ceremony and this is the comment to read.
   */
  function handleRestart() {
    setResult(null)
    setResponse(null)
    setPhase('filling')
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

  const reviewing = phase === 'review'

  return (
    <div className="form-view">
      {header}

      <div className="form-wrapper">
        <div className="form-card">
          <InstrumentHeader name={questionnaire.title} description={questionnaire.description} />
          {phase === 'filling' ? (
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
          ) : (
            result && (
              <div className="submit-review" ref={reviewRef}>
                {phase === 'saved' && <Notice tone="success">Saved to the chart.</Notice>}

                {result.riskAlert && (
                  <div className={`submit-result-summary ${LEVEL_CONFIG[result.riskAlert.level].className}`}>
                    <div className="submit-result-header">
                      <RiskPill
                        level={result.riskAlert.level}
                        label={LEVEL_CONFIG[result.riskAlert.level].label}
                        sm
                      />
                      <span className="submit-result-title">{result.riskAlert.summary}</span>
                    </div>
                    <p className="submit-result-detail">{result.riskAlert.detail}</p>
                    {/* ⚠️ **A closed drawer, because this screen is a
                        DECISION.** These were an open list until 2026-09-22,
                        which was survivable while they sat under a form the
                        clinician had already scrolled past — and is not, now
                        that they sit between the risk level and the button
                        that files it. Measured in the 470×900 panel the audit
                        holds this surface to: six C-SSRS items are 315px of a
                        468px panel, all of it the clinician's own answers of a
                        moment ago restated in the concepts' published names,
                        and they put *Save to the chart* 470px below the fold.
                        The house rule decides the rest — task first, the
                        detail one tap away, never deleted.

                        ⚠️ **No count on the summary**, and the first attempt
                        at one is why: a C-SSRS derives SEVEN values and this
                        list renders six, because the seventh is the risk level
                        that is already the headline above. A hint reading "7"
                        over six rows is a small lie on the one screen that has
                        to be trusted. The triangle says there is something
                        inside. */}
                    {result.observations.length > 0 && (
                      <Disclosure variant="quiet" summary="What this is based on">
                        <div className="submit-result-obs">
                          {result.observations.slice(0, 6).map((obs, idx) => (
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
                      </Disclosure>
                    )}
                  </div>
                )}

                {/* ⚠️ In the card rather than in a second one beside it. It was
                    its own `.form-card`, and `.form-wrapper` is a flex ROW — so
                    on a wide screen the generated plan sat next to the results
                    instead of under them, and the decision about whether to keep
                    it would have sat in whichever of the two happened to be
                    last. The review screen is one screen. */}
                {result.carePlan && <CarePlanDisplay carePlan={result.carePlan} />}

                <NextStep pending={result.pending} preview={reviewing} />

                {reviewing && (
                  <>
                    <PatientChartHint />
                    <Notice tone="warning" title="Not in the chart yet">
                      These results are on this screen only. Add them to the chart to keep them, or
                      start the form again.
                    </Notice>
                    <p className="submit-review__actions">
                      <Button variant="primary" accent onClick={handleSave}>
                        Save to the chart
                      </Button>
                      <Button variant="link" onClick={handleRestart}>
                        Start over
                      </Button>
                    </p>
                  </>
                )}
              </div>
            )
          )}
        </div>

        <CodeDrawer>
          <FhirJsonViewer data={questionnaire} title="FHIR Questionnaire Definition" />
          {/* On the review screen this is the resource the button will write,
              which is the one moment in the app where the draft and the record
              are genuinely different things. */}
          {(result?.response ?? response) && (
            <FhirJsonViewer
              data={result?.response ?? response}
              title="Live FHIR QuestionnaireResponse"
              defaultOpen
            />
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
