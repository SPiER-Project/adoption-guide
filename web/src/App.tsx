import '@formbox/hs-theme/style.css'
import './App.css'
import './CarePlan.css'

import { Routes, Route, Navigate, useParams } from 'react-router-dom'

// FHIR Questionnaires
import asqQuestionnaire from '../../FHIR-Resources/ASQ/fhir/questionnaires/questionnaire.json'
import phq9Questionnaire from '../../FHIR-Resources/PHQ-9/fhir/questionnaires/questionnaire.json'
import sbqrQuestionnaire from '../../FHIR-Resources/SBQ-R/fhir/questionnaires/questionnaire.json'
import cssrsScreener from '../../FHIR-Resources/C-SSRS/fhir/questionnaires/screener.json'
import cssrsFull from '../../FHIR-Resources/C-SSRS/fhir/questionnaires/full-lifetime-recent.json'
import camsSectionA from '../../FHIR-Resources/CAMS/fhir/questionnaires/SSF5_SectionA.json'
import camsSectionB from '../../FHIR-Resources/CAMS/fhir/questionnaires/SSF5_SectionB.json'
import camsStabilizationPlan from '../../FHIR-Resources/CAMS/fhir/questionnaires/Stabilization_Plan.json'
import camsTherapeuticWorksheet from '../../FHIR-Resources/CAMS/fhir/questionnaires/Therapeutic_Worksheet.json'
import { generateStabilizationCarePlan } from './lib/carePlanMappers'
import { generateTherapeuticCarePlan } from './lib/carePlanMappers'

// Context Providers
import { SmartProvider } from './context/SmartContext'
import { PatientProvider } from './context/PatientContext'
import { ToolConfigProvider } from './context/ToolConfigContext'

// SMART on FHIR
import { SmartLaunch } from './components/SmartLaunch'
import { SmartRedirect } from './components/SmartRedirect'

// Shell
import { EhrShell } from './components/EhrShell'

// Top-level pages
import { Home } from './pages/Home'

// Implementation Guide
import { ImplementationGuide } from './pages/ImplementationGuide'
import { IgOverview } from './pages/IgOverview'
import { PatientJourney } from './pages/PatientJourney'
import { DataDictionary } from './pages/DataDictionary'
import { EhrAdoptionRubric } from './pages/EhrAdoptionRubric'
import { AdoptionReadiness } from './pages/AdoptionReadiness'
import { ToolConfiguration } from './pages/ToolConfiguration'
import { Roadmap } from './pages/Roadmap'
import { PilotPlan } from './pages/PilotPlan'

// Patient View
import { PatientChart } from './pages/PatientChart'

// Population View
import { PopulationView } from './pages/PopulationView'

// Questionnaire Views
import { StanleyBrownView } from './components/StanleyBrownView'
import { QuestionnaireView } from './components/QuestionnaireView'

// Non-Questionnaire workflow recorders (issue #52)
import { WorkflowActionView } from './components/WorkflowActionView'

function LegacyWorkflowRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={slug ? `/implementation-guide/pathway/${slug}/plan` : '/implementation-guide/pathway'} replace />
}

function LegacyAssessmentRedirect() {
  const { tool } = useParams<{ tool: string }>()
  return <Navigate to={tool ? `/patient/assessments/${tool}` : '/patient/assessments'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* SMART on FHIR — outside the EHR shell */}
      <Route path="/launch" element={<SmartLaunch />} />
      <Route path="/redirect" element={<SmartRedirect />} />

      {/* Front door — a standalone portal above the apps, outside the EHR shell */}
      <Route path="/" element={<Home />} />

      {/* EHR Shell wraps the demo lenses */}
      <Route element={<EhrShell />}>
        {/* Implementation Guide lens */}
        <Route path="/implementation-guide" element={<ImplementationGuide />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<IgOverview />} />
          <Route path="pathway" element={<PatientJourney />} />
          <Route path="pathway/:slug/plan" element={<PilotPlan />} />
          <Route path="tool-configuration" element={<ToolConfiguration />} />
          <Route path="data-dictionary" element={<DataDictionary />} />
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
          <Route path="assessments/sbq-r" element={
            <QuestionnaireView title="SBQ-R — Suicide Behaviors Questionnaire" questionnaire={sbqrQuestionnaire} persistName="SBQ-R" />
          } />
          <Route path="assessments/cssrs-screener" element={
            <QuestionnaireView title="C-SSRS Screener (Recent)" questionnaire={cssrsScreener} persistName="C-SSRS Screener" />
          } />
          <Route path="assessments/cssrs-full" element={
            <QuestionnaireView title="C-SSRS Full (Lifetime/Recent)" questionnaire={cssrsFull} persistName="C-SSRS Full" />
          } />
          <Route path="assessments/stanley-and-brown" element={<StanleyBrownView />} />
          <Route path="assessments/cams-section-a" element={
            <QuestionnaireView title="CAMS SSF-5: Section A" questionnaire={camsSectionA} persistName="CAMS SSF-5: Section A" />
          } />
          <Route path="assessments/cams-section-b" element={
            <QuestionnaireView title="CAMS SSF-5: Section B" questionnaire={camsSectionB} persistName="CAMS SSF-5: Section B" />
          } />
          <Route path="assessments/cams-stabilization-plan" element={
            <QuestionnaireView title="CAMS: Stabilization Plan" questionnaire={camsStabilizationPlan} persistName="CAMS Stabilization Plan" carePlanMapper={generateStabilizationCarePlan} />
          } />
          <Route path="assessments/cams-therapeutic-worksheet" element={
            <QuestionnaireView title="CAMS: Therapeutic Worksheet" questionnaire={camsTherapeuticWorksheet} persistName="CAMS Therapeutic Worksheet" carePlanMapper={generateTherapeuticCarePlan} />
          } />
          {/* Non-Questionnaire workflow recorders */}
          <Route path="workflow/caring-contact" element={
            <WorkflowActionView toolId="TL-010" title="Log a Caring Contact" actionNoun="caring contact" summaryPlaceholder="e.g. 7-day caring contact: check-in call" />
          } />
          <Route path="workflow/rapid-referral" element={
            <WorkflowActionView toolId="TL-017" title="Send a Rapid Referral" actionNoun="referral" summaryPlaceholder="e.g. Urgent outpatient BH referral — receiving clinic notified" />
          } />
          <Route path="workflow/transition" element={
            <WorkflowActionView toolId="TL-009" title="Record a Transition Checkpoint" actionNoun="transition" summaryPlaceholder="e.g. Pre-discharge transfer of care — accepting provider confirmed" />
          } />
          <Route path="care-plans" element={<Navigate to="/patient/chart#care-plans" replace />} />
          <Route path="encounters" element={<Navigate to="/patient/chart#encounters" replace />} />
        </Route>

        {/* Population View placeholder */}
        <Route path="/population" element={<PopulationView />} />

        {/* Legacy /chart/* redirects — keep for one cycle */}
        <Route path="/chart" element={<Navigate to="/patient/chart" replace />} />
        <Route path="/chart/dashboard" element={<Navigate to="/patient/chart" replace />} />
        <Route path="/chart/screenings" element={<Navigate to="/patient/assessments" replace />} />
        <Route path="/chart/screenings/:tool" element={<LegacyAssessmentRedirect />} />
        <Route path="/chart/careplan" element={<Navigate to="/patient/care-plans" replace />} />
        <Route path="/chart/encounters" element={<Navigate to="/patient/encounters" replace />} />
        <Route path="/chart/implementation-guide" element={<Navigate to="/implementation-guide" replace />} />
        <Route path="/chart/workflow" element={<Navigate to="/implementation-guide/pathway" replace />} />
        <Route path="/chart/workflow/:slug/plan" element={<LegacyWorkflowRedirect />} />
        <Route path="/chart/ehr-rubric" element={<Navigate to="/implementation-guide/adoption-rubric" replace />} />
        <Route path="/chart/data-dictionary" element={<Navigate to="/implementation-guide/data-dictionary" replace />} />
        <Route path="/chart/tools" element={<Navigate to="/implementation-guide/pathway" replace />} />
      </Route>

      {/* Anything else → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <SmartProvider>
      <PatientProvider>
        <ToolConfigProvider>
          <AppRoutes />
        </ToolConfigProvider>
      </PatientProvider>
    </SmartProvider>
  )
}
