import '@formbox/hs-theme/style.css'
import './App.css'
import './CarePlan.css'

import { Routes, Route, Navigate } from 'react-router-dom'

// FHIR Questionnaires
import asqQuestionnaire from '../../ASQ/fhir/questionnaires/questionnaire.json'
import phq9Questionnaire from '../../PHQ-9/fhir/questionnaires/questionnaire.json'
import sbqrQuestionnaire from '../../SBQ-R/fhir/questionnaires/questionnaire.json'
import cssrsScreener from '../../C-SSRS/fhir/questionnaires/screener.json'
import cssrsFull from '../../C-SSRS/fhir/questionnaires/full-lifetime-recent.json'
import camsSectionA from '../../CAMS/fhir/questionnaires/SSF5_SectionA.json'
import camsSectionB from '../../CAMS/fhir/questionnaires/SSF5_SectionB.json'
import camsStabilizationPlan from '../../CAMS/fhir/questionnaires/Stabilization_Plan.json'
import { generateStabilizationCarePlan } from './camsCarePlanMapper'
import { generateTherapeuticCarePlan } from './camsTherapeuticCarePlanMapper'
import camsTherapeuticWorksheet from '../../CAMS/fhir/questionnaires/Therapeutic_Worksheet.json'

// Context Providers
import { SmartProvider } from './context/SmartContext'
import { PatientProvider } from './context/PatientContext'

// SMART on FHIR
import { SmartLaunch } from './components/SmartLaunch'
import { SmartRedirect } from './components/SmartRedirect'

// Shell
import { EhrShell } from './components/EhrShell'

// Chart Pages
import { Dashboard } from './pages/Dashboard'
import { ScreeningsTab } from './pages/ScreeningsTab'
import { CarePlanTab } from './pages/CarePlanTab'
import { EncountersTab } from './pages/EncountersTab'
import { DataDictionary } from './pages/DataDictionary'
import { PatientJourney } from './pages/PatientJourney'
import { EhrAdoptionRubric } from './pages/EhrAdoptionRubric'
import { PilotPlan } from './pages/PilotPlan'

// Questionnaire Views
import { StanleyBrownView } from './components/StanleyBrownView'
import { QuestionnaireView } from './components/QuestionnaireView'

function AppRoutes() {
  return (
    <Routes>
      {/* SMART on FHIR — outside the EHR shell */}
      <Route path="/launch" element={<SmartLaunch />} />
      <Route path="/redirect" element={<SmartRedirect />} />

      {/* EHR Shell wraps all chart routes */}
      <Route path="/chart" element={<EhrShell />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="screenings" element={<ScreeningsTab />} />
        <Route path="screenings/phq-9" element={
          <QuestionnaireView title="PHQ-9 Depression Screening" questionnaire={phq9Questionnaire} persistName="PHQ-9" />
        } />
        <Route path="screenings/asq" element={
          <QuestionnaireView title="ASQ — Suicide Risk Screening" questionnaire={asqQuestionnaire} persistName="ASQ Screening" />
        } />
        <Route path="screenings/sbq-r" element={
          <QuestionnaireView title="SBQ-R — Suicide Behaviors Questionnaire" questionnaire={sbqrQuestionnaire} persistName="SBQ-R" />
        } />
        <Route path="screenings/cssrs-screener" element={
          <QuestionnaireView title="C-SSRS Screener (Recent)" questionnaire={cssrsScreener} persistName="C-SSRS Screener" />
        } />
        <Route path="screenings/cssrs-full" element={
          <QuestionnaireView title="C-SSRS Full (Lifetime/Recent)" questionnaire={cssrsFull} persistName="C-SSRS Full" />
        } />
        <Route path="screenings/stanley-and-brown" element={<StanleyBrownView />} />
        <Route path="screenings/cams-section-a" element={
          <QuestionnaireView title="CAMS SSF-5: Section A" questionnaire={camsSectionA} persistName="CAMS SSF-5: Section A" />
        } />
        <Route path="screenings/cams-section-b" element={
          <QuestionnaireView title="CAMS SSF-5: Section B" questionnaire={camsSectionB} persistName="CAMS SSF-5: Section B" />
        } />
        <Route path="screenings/cams-stabilization-plan" element={
          <QuestionnaireView title="CAMS: Stabilization Plan" questionnaire={camsStabilizationPlan} persistName="CAMS Stabilization Plan" carePlanMapper={generateStabilizationCarePlan} />
        } />
        <Route path="screenings/cams-therapeutic-worksheet" element={
          <QuestionnaireView title="CAMS: Therapeutic Worksheet" questionnaire={camsTherapeuticWorksheet} persistName="CAMS Therapeutic Worksheet" carePlanMapper={generateTherapeuticCarePlan} />
        } />
        <Route path="careplan" element={<CarePlanTab />} />
        <Route path="encounters" element={<EncountersTab />} />
        <Route path="workflow" element={<PatientJourney />} />
        <Route path="workflow/:slug/plan" element={<PilotPlan />} />
        <Route path="ehr-rubric" element={<EhrAdoptionRubric />} />
        <Route path="data-dictionary" element={<DataDictionary />} />
        <Route path="implementation-guide" element={<Navigate to="/chart/workflow" replace />} />
        <Route path="tools" element={<Navigate to="/chart/workflow" replace />} />
      </Route>

      {/* Default: redirect to dashboard */}
      <Route path="/" element={<Navigate to="/chart/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/chart/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <SmartProvider>
      <PatientProvider>
        <AppRoutes />
      </PatientProvider>
    </SmartProvider>
  )
}
