import '@formbox/hs-theme/style.css'
import './App.css'
import './CarePlan.css'

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'

// FHIR Questionnaires — sourced from the single registry (web/src/data/questionnaires.ts).
import {
  asqQuestionnaire,
  bssaQuestionnaire,
  pss3Questionnaire,
  safetQuestionnaire,
  phq9Questionnaire,
  sbqrQuestionnaire,
  cssrsScreener,
  cssrsSinceLastContact,
  cssrsPediatric,
  cssrsFull,
  camsSectionA,
  camsSectionB,
  camsOutcomeDisposition,
  camsStabilizationPlan,
  camsTherapeuticWorksheet,
  crpQuestionnaire,
  pssFullQuestionnaire,
} from '@spier/core/data/questionnaires'
import { generateStabilizationCarePlan } from '@spier/core/lib/carePlanMappers'
import { generateTherapeuticCarePlan } from '@spier/core/lib/carePlanMappers'
import { generateCrisisResponseCarePlan } from '@spier/core/lib/carePlanMappers'

// Context Providers. Each context is split in two — the provider component in
// *Provider.tsx, its context object and hook in *Context.ts — so the provider
// module stays component-only and Fast Refresh preserves its state on edit.
// Consumers import the hook from the *Context module, the path they always used.
import { PresentationProvider } from './context/PresentationProvider'
import { SmartProvider } from './context/SmartProvider'
import { PatientProvider } from './context/PatientProvider'
import { ToolConfigProvider } from './context/ToolConfigProvider'

// SMART on FHIR
import { SmartLaunch } from './components/SmartLaunch'
import { SmartRedirect } from './components/SmartRedirect'

// Shell — kept eager so the nav/sidebar chrome is always in the main chunk.
import { Shell } from './components/Shell'

// Cross-tab patient-context sync (simulated FHIRcast). Eager + always mounted
// so a chart tab is listening regardless of which lens the user loaded first.
import { FhircastListener } from './components/FhircastListener'

// Route pages and views are code-split (React.lazy) so each lens loads on
// demand. Named exports are adapted to lazy()'s default-export contract.
const Overview = lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })))
const AdoptionGuide = lazy(() => import('./pages/AdoptionGuide').then(m => ({ default: m.AdoptionGuide })))
const PatientJourney = lazy(() => import('./pages/PatientJourney').then(m => ({ default: m.PatientJourney })))
const DataDictionary = lazy(() => import('./pages/DataDictionary').then(m => ({ default: m.DataDictionary })))
const MeasureDashboard = lazy(() => import('./pages/MeasureDashboard').then(m => ({ default: m.MeasureDashboard })))
const CdsServiceGuide = lazy(() => import('./pages/CdsServiceGuide').then(m => ({ default: m.CdsServiceGuide })))
const EhrAdoptionRubric = lazy(() => import('./pages/EhrAdoptionRubric').then(m => ({ default: m.EhrAdoptionRubric })))
const AdoptionReadiness = lazy(() => import('./pages/AdoptionReadiness').then(m => ({ default: m.AdoptionReadiness })))
const ToolConfiguration = lazy(() => import('./pages/ToolConfiguration').then(m => ({ default: m.ToolConfiguration })))
const Roadmap = lazy(() => import('./pages/Roadmap').then(m => ({ default: m.Roadmap })))
const PatientChart = lazy(() => import('./pages/PatientChart').then(m => ({ default: m.PatientChart })))
const PopulationView = lazy(() => import('./pages/PopulationView').then(m => ({ default: m.PopulationView })))
const PopulationSummaryEmbed = lazy(() => import('./pages/PopulationSummaryEmbed').then(m => ({ default: m.PopulationSummaryEmbed })))
const StanleyBrownView = lazy(() => import('./components/StanleyBrownView').then(m => ({ default: m.StanleyBrownView })))
const QuestionnaireView = lazy(() => import('./components/QuestionnaireView').then(m => ({ default: m.QuestionnaireView })))
const WorkflowActionView = lazy(() => import('./components/WorkflowActionView').then(m => ({ default: m.WorkflowActionView })))
const RiskEpisodeView = lazy(() => import('./components/RiskEpisodeView').then(m => ({ default: m.RiskEpisodeView })))
const SafetyTaskView = lazy(() => import('./components/SafetyTaskView').then(m => ({ default: m.SafetyTaskView })))
const DischargePacketView = lazy(() => import('./components/DischargePacketView').then(m => ({ default: m.DischargePacketView })))
const SafetyReferralView = lazy(() => import('./components/SafetyReferralView').then(m => ({ default: m.SafetyReferralView })))
const FollowUpAppointmentView = lazy(() => import('./components/FollowUpAppointmentView').then(m => ({ default: m.FollowUpAppointmentView })))
const SharingConsentView = lazy(() => import('./components/SharingConsentView').then(m => ({ default: m.SharingConsentView })))
const OutreachAttemptView = lazy(() => import('./components/OutreachAttemptView').then(m => ({ default: m.OutreachAttemptView })))
const CaringContactView = lazy(() => import('./components/CaringContactView').then(m => ({ default: m.CaringContactView })))
const LethalMeansCounselingView = lazy(() => import('./components/LethalMeansCounselingView').then(m => ({ default: m.LethalMeansCounselingView })))

function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      Loading…
    </div>
  )
}

function LegacyWorkflowRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={slug ? `/guide/pathway/${slug}/plan` : '/guide/pathway'} replace />
}

// The Adoption Guide lens lived at /adoption-guide (and, before that,
// /implementation-guide). It is now /guide; preserve any subpath so old
// bookmarks for either prior route keep working.
function LegacyGuideRedirect() {
  const params = useParams()
  const rest = params['*']
  return <Navigate to={`/guide${rest ? `/${rest}` : ''}`} replace />
}

function LegacyAssessmentRedirect() {
  const { tool } = useParams<{ tool: string }>()
  return <Navigate to={tool ? `/patient/assessments/${tool}` : '/patient/assessments'} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <FhircastListener />
      <Routes>
      {/* SMART on FHIR — outside the EHR shell */}
      <Route path="/launch" element={<SmartLaunch />} />
      <Route path="/redirect" element={<SmartRedirect />} />

      {/* The front door used to be a standalone portal outside the shell, with
          its own header, footer and nav. It said the same thing the guide's
          Overview said, from a second chrome the rest of the app never showed —
          two front doors a visitor had to choose between. The two pages are now
          one, inside the shell, and `/` lands on it. */}
      <Route path="/" element={<Navigate to="/overview" replace />} />

      {/* EHR Shell wraps the demo lenses */}
      <Route element={<Shell />}>
        {/* Overview — the front door, a top-level lens rather than a guide
            section (the sidebar lists it above the Adoption Guide). */}
        <Route path="/overview" element={<Overview />} />

        {/* Adoption Guide lens */}
        <Route path="/guide" element={<AdoptionGuide />}>
          <Route index element={<Navigate to="pathway" replace />} />
          <Route path="pathway" element={<PatientJourney />} />
          <Route path="tool-configuration" element={<ToolConfiguration />} />
          <Route path="data-dictionary" element={<DataDictionary />} />
          {/* Measures moved to the EHR side (step D, #391): it is the only guide
              section that read patient data, and the guide explains and
              configures the pathway rather than holding a caseload. The redirect
              stays — /guide/measures is a published tool launch path and is
              already linked from CDS cards in the wild. */}
          <Route path="measures" element={<Navigate to="/population/measures" replace />} />
          <Route path="cds-service" element={<CdsServiceGuide />} />
          <Route path="adoption-readiness" element={<AdoptionReadiness />} />
          <Route path="adoption-rubric" element={<EhrAdoptionRubric />} />
          <Route path="roadmap" element={<Roadmap />} />
        </Route>

        {/* Patient View lens */}
        <Route path="/patient">
          <Route index element={<Navigate to="chart" replace />} />
          <Route path="chart" element={<PatientChart />} />
          <Route path="chart/:patientId" element={<PatientChart />} />
          <Route path="assessments" element={<Navigate to="/patient/chart" replace />} />
          <Route path="assessments/phq-9" element={
            <QuestionnaireView title="PHQ-9 Depression Screening" questionnaire={phq9Questionnaire} persistName="PHQ-9" />
          } />
          <Route path="assessments/asq" element={
            <QuestionnaireView title="ASQ — Suicide Risk Screening" questionnaire={asqQuestionnaire} persistName="ASQ Screening" />
          } />
          <Route path="assessments/bssa" element={
            <QuestionnaireView title="BSSA — Brief Suicide Safety Assessment" questionnaire={bssaQuestionnaire} persistName="BSSA" />
          } />
          <Route path="assessments/pss-3" element={
            <QuestionnaireView title="PSS-3 — Patient Safety Screener" questionnaire={pss3Questionnaire} persistName="PSS-3" />
          } />
          <Route path="assessments/safe-t" element={
            <QuestionnaireView title="SAFE-T — Suicide Assessment Five-Step Evaluation and Triage" questionnaire={safetQuestionnaire} persistName="SAFE-T" />
          } />
          <Route path="assessments/sbq-r" element={
            <QuestionnaireView title="SBQ-R — Suicide Behaviors Questionnaire" questionnaire={sbqrQuestionnaire} persistName="SBQ-R" />
          } />
          <Route path="assessments/cssrs-screener" element={
            <QuestionnaireView title="C-SSRS Screener (Recent)" questionnaire={cssrsScreener} persistName="C-SSRS Screener" />
          } />
          <Route path="assessments/cssrs-full" element={
            <QuestionnaireView title="C-SSRS Full (Lifetime/Recent)" questionnaire={cssrsFull} persistName="C-SSRS Full" />
          } />
          <Route path="assessments/cssrs-since-last-contact" element={
            <QuestionnaireView title="C-SSRS — Since Last Visit / Since Last Contact" questionnaire={cssrsSinceLastContact} persistName="C-SSRS Since Last Visit" />
          } />
          <Route path="assessments/cssrs-pediatric" element={
            <QuestionnaireView title="C-SSRS — Pediatric / Adolescent Screener" questionnaire={cssrsPediatric} persistName="C-SSRS Pediatric" />
          } />
          <Route path="assessments/stanley-and-brown" element={<StanleyBrownView />} />
          <Route path="assessments/cams-section-a" element={
            <QuestionnaireView title="CAMS SSF-5: Section A" questionnaire={camsSectionA} persistName="CAMS SSF-5: Section A" />
          } />
          <Route path="assessments/cams-section-b" element={
            <QuestionnaireView title="CAMS SSF-5: Section B" questionnaire={camsSectionB} persistName="CAMS SSF-5: Section B" />
          } />
          <Route path="assessments/cams-outcome-disposition" element={
            <QuestionnaireView title="CAMS SSF-5: Outcome / Disposition" questionnaire={camsOutcomeDisposition} persistName="CAMS SSF-5: Outcome/Disposition" />
          } />
          <Route path="assessments/cams-stabilization-plan" element={
            <QuestionnaireView title="CAMS: Stabilization Plan" questionnaire={camsStabilizationPlan} persistName="CAMS Stabilization Plan" carePlanMapper={generateStabilizationCarePlan} />
          } />
          <Route path="assessments/cams-therapeutic-worksheet" element={
            <QuestionnaireView title="CAMS: Therapeutic Worksheet" questionnaire={camsTherapeuticWorksheet} persistName="CAMS Therapeutic Worksheet" carePlanMapper={generateTherapeuticCarePlan} />
          } />
          <Route path="assessments/crisis-response-plan" element={
            <QuestionnaireView title="Crisis Response Plan (CRP)" questionnaire={crpQuestionnaire} persistName="Crisis Response Plan" carePlanMapper={generateCrisisResponseCarePlan} />
          } />
          <Route path="assessments/pss-full" element={
            <QuestionnaireView title="Patient Safety Screener / Suicide Risk Screener (Full)" questionnaire={pssFullQuestionnaire} persistName="PSS Full" />
          } />
          {/* Non-Questionnaire workflow recorders */}
          {/* caring-contact used to render the generic Communication recorder,
              which stamped neither the SPiERCaringContact profile nor the
              opt-out extension — so the Stage-8 adherence measure could not see
              its output and its opt-out exclusion could never fire. */}
          <Route path="workflow/caring-contact" element={<CaringContactView />} />
          <Route path="workflow/transition" element={
            <WorkflowActionView toolId="TL-009" title="Record a Transition Checkpoint" actionNoun="transition" summaryPlaceholder="e.g. Pre-discharge transfer of care — accepting provider confirmed" />
          } />
          {/* Stage 5 — Coordinate Handoffs. rapid-referral used to render the
              generic Communication recorder; TL-017 is a ServiceRequest so the
              referral can be tracked past "sent" — see SafetyReferralView. The
              old path is kept as a redirect so existing links don't 404. */}
          <Route path="workflow/referral" element={<SafetyReferralView />} />
          <Route path="workflow/rapid-referral" element={<Navigate to="/patient/workflow/referral" replace />} />
          <Route path="workflow/discharge-packet" element={<DischargePacketView />} />
          <Route path="workflow/follow-up-appointment" element={<FollowUpAppointmentView />} />
          <Route path="workflow/sharing-consent" element={<SharingConsentView />} />
          {/* Stage 6 — Track Follow-Up */}
          <Route path="workflow/outreach" element={<OutreachAttemptView />} />
          {/* Stage 7 — Track Risk Over Time */}
          <Route path="workflow/risk-episode" element={<RiskEpisodeView />} />
          <Route path="workflow/safety-tasks" element={<SafetyTaskView />} />
          {/* Stage 4 — Document Safety Actions */}
          <Route path="workflow/lethal-means" element={<LethalMeansCounselingView />} />
          <Route path="workflow/crisis-resources" element={
            <WorkflowActionView toolId="TL-013" title="Record Crisis Resources Shared" actionNoun="crisis resources shared" summaryPlaceholder="e.g. 988 Lifeline + Crisis Text Line + safety-plan copy given to patient" />
          } />
          <Route path="care-plans" element={<Navigate to="/patient/chart#care-plans" replace />} />
          <Route path="encounters" element={<Navigate to="/patient/chart#encounters" replace />} />
        </Route>

        {/* Population View placeholder */}
        {/* Population lens. `/population` itself is unchanged and load-bearing:
            the mock EHR embeds it as `?embed=1#/population`, so it stays the
            index rather than becoming /population/caseload. */}
        <Route path="/population">
          <Route index element={<PopulationView />} />
          {/* The summary and alerts with no table and no page header — what the
              mock EHR frames at the top of its front door. See the module
              header for why the whole lens is the wrong thing to embed. */}
          <Route path="summary" element={<PopulationSummaryEmbed />} />
          <Route path="measures" element={<MeasureDashboard />} />
        </Route>

        {/* Legacy /chart/* redirects — keep for one cycle */}
        <Route path="/chart" element={<Navigate to="/patient/chart" replace />} />
        <Route path="/chart/dashboard" element={<Navigate to="/patient/chart" replace />} />
        <Route path="/chart/screenings" element={<Navigate to="/patient/assessments" replace />} />
        <Route path="/chart/screenings/:tool" element={<LegacyAssessmentRedirect />} />
        <Route path="/chart/careplan" element={<Navigate to="/patient/care-plans" replace />} />
        <Route path="/chart/encounters" element={<Navigate to="/patient/encounters" replace />} />
        <Route path="/chart/implementation-guide" element={<Navigate to="/guide" replace />} />
        <Route path="/chart/workflow" element={<Navigate to="/guide/pathway" replace />} />
        <Route path="/chart/workflow/:slug/plan" element={<LegacyWorkflowRedirect />} />
        <Route path="/chart/ehr-rubric" element={<Navigate to="/guide/adoption-rubric" replace />} />
        <Route path="/chart/data-dictionary" element={<Navigate to="/guide/data-dictionary" replace />} />
        <Route path="/chart/tools" element={<Navigate to="/guide/pathway" replace />} />

        {/* The guide's Overview merged with the old standalone front door and
            moved up to /overview. Declared here rather than as a child of
            /guide so the redirect doesn't first paint the guide's header and
            pager. LegacyGuideRedirect funnels /adoption-guide/overview and
            /implementation-guide/overview through this same hop. */}
        <Route path="/guide/overview" element={<Navigate to="/overview" replace />} />

        {/* Legacy guide routes → /guide/* (lens renamed from /implementation-guide, then /adoption-guide) */}
        <Route path="/implementation-guide" element={<LegacyGuideRedirect />} />
        <Route path="/implementation-guide/*" element={<LegacyGuideRedirect />} />
        <Route path="/adoption-guide" element={<LegacyGuideRedirect />} />
        <Route path="/adoption-guide/*" element={<LegacyGuideRedirect />} />
      </Route>

      {/* Anything else → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <PresentationProvider>
      <SmartProvider>
        <PatientProvider>
          <ToolConfigProvider>
            <AppRoutes />
          </ToolConfigProvider>
        </PatientProvider>
      </SmartProvider>
    </PresentationProvider>
  )
}
