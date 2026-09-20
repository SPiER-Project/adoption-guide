/**
 * Every instrument filler and workflow recorder, as a ready-to-render element,
 * keyed by its tool slug.
 *
 * ── Why this is a map and not 30 inline route elements ─────────────────────
 *
 * Until 2026-09-17 each of these was written once, inline, in `App.tsx`'s
 * `/patient/*` route block. That was fine while there was one way to reach them.
 * There are now two:
 *
 *   /patient/assessments/asq    the clinician's route — no FHIR view
 *   /guide/tools/asq/try        the implementer's route — FHIR view on
 *
 * They must render *the same thing*, because the guide's claim is that what an
 * implementer inspects is what a clinician uses. Two copies of a
 * `<QuestionnaireView title=… questionnaire=… persistName=… />` call would be
 * exactly the hand-duplicated drift CLAUDE.md warns about: a `persistName`
 * changed on one side and not the other is silent, and the demo would be
 * showing a different resource than the app writes.
 *
 * So the element is defined once here and both routes render it.
 *
 * ⚠️ **Keyed by SLUG, the last path segment, not by the sub-path.** `asq`, not
 * `assessments/asq`. The clinician's route keeps its `assessments/` and
 * `workflow/` grouping because those paths are published — the catalog's 36
 * `launchActions`, every CDS card's `type: "smart"` link and every SMART
 * `intent` resolve to them. The guide's route has no such history and reads
 * better flat. `SLUG_IS_UNIQUE` below is what makes one key serve both.
 *
 * ⚠️ **The lazy() calls live here, not in App.tsx, and that is deliberate.**
 * Moving the element definitions without moving the components would have made
 * App.tsx import them eagerly to build the map, collapsing the assessment chunk
 * into the main bundle — 391 KB gzip rather than 208 (see the shim note in
 * CLAUDE.md). Declaring them beside the map keeps every filler behind its own
 * dynamic import.
 *
 * ⚠️ These are NOT demo-only. A demo-only page is simply absent from
 * `apps/clinical/src/App.tsx`'s own route table — no conditional import, since
 * each app is now its own file; these ship on both surfaces, because the
 * clinical build is exactly the one a clinician fills an instrument in.
 */
import { lazy, type ReactNode } from 'react'
import { QUESTIONNAIRE_URLS } from '@spier/fhir-artifacts/generated/questionnaire-urls.generated'
import {
  generateCarePlan,
  generateStabilizationCarePlan,
  generateTherapeuticCarePlan,
  generateCrisisResponseCarePlan,
} from '@spier/core/lib/carePlanMappers'

const QuestionnaireView = lazy(() => import('../components/QuestionnaireView').then(m => ({ default: m.QuestionnaireView })))
const SafetyHandoffView = lazy(() => import('../components/SafetyHandoffView').then(m => ({ default: m.SafetyHandoffView })))
const CrisisResourcesView = lazy(() => import('../components/CrisisResourcesView').then(m => ({ default: m.CrisisResourcesView })))
const RiskEpisodeView = lazy(() => import('../components/RiskEpisodeView').then(m => ({ default: m.RiskEpisodeView })))
const SafetyTaskView = lazy(() => import('../components/SafetyTaskView').then(m => ({ default: m.SafetyTaskView })))
const DischargePacketView = lazy(() => import('../components/DischargePacketView').then(m => ({ default: m.DischargePacketView })))
const SafetyReferralView = lazy(() => import('../components/SafetyReferralView').then(m => ({ default: m.SafetyReferralView })))
const FollowUpAppointmentView = lazy(() => import('../components/FollowUpAppointmentView').then(m => ({ default: m.FollowUpAppointmentView })))
const SharingConsentView = lazy(() => import('../components/SharingConsentView').then(m => ({ default: m.SharingConsentView })))
const OutreachAttemptView = lazy(() => import('../components/OutreachAttemptView').then(m => ({ default: m.OutreachAttemptView })))
const CaringContactView = lazy(() => import('../components/CaringContactView').then(m => ({ default: m.CaringContactView })))
const LethalMeansCounselingView = lazy(() => import('../components/LethalMeansCounselingView').then(m => ({ default: m.LethalMeansCounselingView })))

/**
 * Slug → the view that records it.
 *
 * ⚠️ Every key must match the LAST segment of that tool's clinician route in
 * `App.tsx`, because the two are read together: the route renders
 * `TOOL_VIEWS['asq']` and the guide's try route resolves `:slug` against the
 * same map. `toolViews.test.ts` pins that they agree.
 */
export const TOOL_VIEWS: Record<string, ReactNode> = {
  // ── Instrument fillers (clinician route: /patient/assessments/<slug>) ────
  'phq-9': <QuestionnaireView title="PHQ-9 Depression Screening" questionnaireUrl={QUESTIONNAIRE_URLS['PHQ-9']} persistName="PHQ-9" />,
  'asq': <QuestionnaireView title="ASQ — Suicide Risk Screening" questionnaireUrl={QUESTIONNAIRE_URLS['ASQ-Screening-Tool']} persistName="ASQ Screening" />,
  'bssa': <QuestionnaireView title="BSSA — Brief Suicide Safety Assessment" questionnaireUrl={QUESTIONNAIRE_URLS['BSSA']} persistName="BSSA" />,
  'pss-3': <QuestionnaireView title="PSS-3 — Patient Safety Screener" questionnaireUrl={QUESTIONNAIRE_URLS['PSS-3']} persistName="PSS-3" />,
  'safe-t': <QuestionnaireView title="SAFE-T — Suicide Assessment Five-Step Evaluation and Triage" questionnaireUrl={QUESTIONNAIRE_URLS['SAFE-T']} persistName="SAFE-T" />,
  'sbq-r': <QuestionnaireView title="SBQ-R — Suicide Behaviors Questionnaire" questionnaireUrl={QUESTIONNAIRE_URLS['SBQ-R']} persistName="SBQ-R" />,
  'cssrs-screener': <QuestionnaireView title="C-SSRS Screener (Recent)" questionnaireUrl={QUESTIONNAIRE_URLS['C-SSRS-Screener']} persistName="C-SSRS Screener" />,
  'cssrs-full': <QuestionnaireView title="C-SSRS Full (Lifetime/Recent)" questionnaireUrl={QUESTIONNAIRE_URLS['C-SSRS-Full-Lifetime-Recent']} persistName="C-SSRS Full" />,
  'cssrs-since-last-contact': <QuestionnaireView title="C-SSRS — Since Last Visit / Since Last Contact" questionnaireUrl={QUESTIONNAIRE_URLS['C-SSRS-Since-Last-Contact']} persistName="C-SSRS Since Last Visit" />,
  'cssrs-pediatric': <QuestionnaireView title="C-SSRS — Pediatric / Adolescent Screener" questionnaireUrl={QUESTIONNAIRE_URLS['C-SSRS-Pediatric']} persistName="C-SSRS Pediatric" />,
  // ⚠️ Rendered by `StanleyBrownView`, its own near-copy of `QuestionnaireView`,
  // until 2026-09-17. The fork had no load-bearing divergence and had drifted
  // out of four things the shared view had grown: the `?tool=` launch-stage
  // stamp, the observation summary, the writeback panel, and honouring a care
  // plan's `isEmpty`. It also imported the Questionnaire JSON straight out of
  // `ig/input/resources/questionnaires/`, the only instrument to bypass the core registry. See
  // docs/internals/tool-views.md §2.
  'stanley-and-brown': <QuestionnaireView title="Stanley-Brown Safety Plan" questionnaireUrl={QUESTIONNAIRE_URLS['StanleyBrownSafetyPlan']} persistName="Stanley-Brown Safety Plan" carePlanMapper={generateCarePlan} />,
  'cams-section-a': <QuestionnaireView title="CAMS SSF-5: Section A" questionnaireUrl={QUESTIONNAIRE_URLS['CAMS-SSF5-SectionA']} persistName="CAMS SSF-5: Section A" />,
  'cams-section-b': <QuestionnaireView title="CAMS SSF-5: Section B" questionnaireUrl={QUESTIONNAIRE_URLS['CAMS-SSF5-SectionB']} persistName="CAMS SSF-5: Section B" />,
  'cams-outcome-disposition': <QuestionnaireView title="CAMS SSF-5: Outcome / Disposition" questionnaireUrl={QUESTIONNAIRE_URLS['CAMS-SSF5-OutcomeDisposition']} persistName="CAMS SSF-5: Outcome/Disposition" />,
  'cams-stabilization-plan': <QuestionnaireView title="CAMS: Stabilization Plan" questionnaireUrl={QUESTIONNAIRE_URLS['CAMS-Stabilization-Plan']} persistName="CAMS Stabilization Plan" carePlanMapper={generateStabilizationCarePlan} />,
  'cams-therapeutic-worksheet': <QuestionnaireView title="CAMS: Therapeutic Worksheet" questionnaireUrl={QUESTIONNAIRE_URLS['CAMS-Therapeutic-Worksheet']} persistName="CAMS Therapeutic Worksheet" carePlanMapper={generateTherapeuticCarePlan} />,
  'crisis-response-plan': <QuestionnaireView title="Crisis Response Plan (CRP)" questionnaireUrl={QUESTIONNAIRE_URLS['CrisisResponsePlan']} persistName="Crisis Response Plan" carePlanMapper={generateCrisisResponseCarePlan} />,
  'pss-full': <QuestionnaireView title="Patient Safety Screener / Suicide Risk Screener (Full)" questionnaireUrl={QUESTIONNAIRE_URLS['PSS-Full']} persistName="PSS Full" />,

  // ── Workflow recorders (clinician route: /patient/workflow/<slug>) ───────
  // ⚠️ THREE of these used to render one generic Communication recorder
  // (`WorkflowActionView`), which stamped no `meta.profile` and wrote a
  // `category` carrying text and no coding — so its output could satisfy
  // NEITHER the profile the tool's PlanDefinition action declares NOR the
  // `category:suicideRisk` slice #262 made required on all three. The generic
  // recorder is gone; each of the three now has a builder in packages/core
  // that stamps what its own IG page says it produces:
  //   caring-contact  #211 — the adherence measure could not see its output and
  //                   the opt-out exclusion could never fire
  //   transition      the handoff is the INDEX EVENT for every post-transition
  //                   measure, and `measures.ts` filters on the profile it did
  //                   not stamp. Half-blind, not blind: the TL-030 packet is the
  //                   other index resource and DID claim its profile
  //   crisis-resources no measure reads it — the cost was a conformance claim
  //                   the guide made and the app broke
  'caring-contact': <CaringContactView />,
  'transition': <SafetyHandoffView />,
  // ⚠️ Stage 5 — Coordinate Handoffs. rapid-referral used to render the generic
  // Communication recorder; TL-017 is a ServiceRequest so the referral can be
  // tracked past "sent" — see SafetyReferralView. The old path is kept as a
  // redirect in App.tsx so existing links don't 404.
  'referral': <SafetyReferralView />,
  'discharge-packet': <DischargePacketView />,
  'follow-up-appointment': <FollowUpAppointmentView />,
  'sharing-consent': <SharingConsentView />,
  // Stage 6 — Track Follow-Up
  'outreach': <OutreachAttemptView />,
  // Stage 7 — Track Risk Over Time
  'risk-episode': <RiskEpisodeView />,
  'safety-tasks': <SafetyTaskView />,
  // Stage 4 — Document Safety Actions
  'lethal-means': <LethalMeansCounselingView />,
  'crisis-resources': <CrisisResourcesView />,
}

/** Is `slug` something the guide can offer a "try it" link for? */
export function isToolViewSlug(slug: string | undefined): slug is string {
  return slug !== undefined && Object.prototype.hasOwnProperty.call(TOOL_VIEWS, slug)
}
