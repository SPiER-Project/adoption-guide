import '@formbox/hs-theme/style.css'
import { RouteFallback } from '@spier/app-shell/components/RouteFallback'
import '@spier/app-shell/css/App.css'
import '@spier/app-shell/css/CarePlan.css'

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'

/**
 * The two SMART apps: the patient chart and the population dashboard.
 *
 * ⚠️ **This is one of TWO route tables now.** It used to be one table with
 * `IS_DEMO ?` folding the guide's pages out at build time; the flag is gone and
 * a page this app does not declare is not reachable here.
 * `check:tool-view-routes` reads every app's table and holds them to the ONE
 * tool-view definition, so the 29 views cannot drift between the apps.
 *
 * ⚠️ **Nobody browsed here.** A clinician was LAUNCHED into this app from their
 * EHR, which is why `/` lands on the chart and why the chrome is `Shell`'s
 * choice between the embedded panel and a launched tab. There is no guide route
 * and no `/ig/` — see `services/clinical/README.md`.
 */

// Context Providers. Each context is split in two — the provider component in
// *Provider.tsx, its context object and hook in *Context.ts — so the provider
// module stays component-only and Fast Refresh preserves its state on edit.
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import { SmartProvider } from '@spier/app-shell/context/SmartProvider'
import { PatientProvider } from '@spier/app-shell/context/PatientProvider'
import { ToolConfigProvider } from './context/ToolConfigProvider'
// Where the shared form views link on THIS surface — the chart, the caseload,
// a tool's catalog launch path. The views hold no route literal of their own
// since 2026-09-20 (they were dead on the guide); this app supplies them.
import { SurfaceLinksContext } from '@spier/tool-views/context/SurfaceLinksContext'
import { CLINICAL_SURFACE_LINKS } from './surfaceLinks'

// SMART on FHIR — the real launch legs for this app.
import { SmartLaunch } from '@spier/app-shell/components/SmartLaunch'
import { SmartRedirect } from '@spier/app-shell/components/SmartRedirect'

// Shell — kept eager so the nav/sidebar chrome is always in the main chunk.
import { Shell } from './components/Shell'

// Cross-tab patient-context sync (simulated FHIRcast). Eager + always mounted
// so a chart tab is listening regardless of which route the user loaded first.
import { FhircastListener } from '@spier/app-shell/components/FhircastListener'

// Every instrument filler and workflow recorder, defined ONCE and rendered by
// two route families: the clinician's /patient/* paths below, and the guide's
// tool pages (/guide/tools/TL-0NN) in apps/guide. See packages/tool-views for
// why they must be one definition rather than two.
import { TOOL_VIEWS } from '@spier/tool-views/data/toolViews'

const ToolConfiguration = lazy(() => import('./pages/ToolConfiguration').then(m => ({ default: m.ToolConfiguration })))
const PatientChart = lazy(() => import('./pages/PatientChart').then(m => ({ default: m.PatientChart })))
const PathwayProtocol = lazy(() => import('./pages/PathwayProtocol').then(m => ({ default: m.PathwayProtocol })))
const PathwayStage = lazy(() => import('./pages/PathwayStage').then(m => ({ default: m.PathwayStage })))
const PopulationView = lazy(() => import('./pages/PopulationView').then(m => ({ default: m.PopulationView })))
const PopulationSummaryEmbed = lazy(() => import('./pages/PopulationSummaryEmbed').then(m => ({ default: m.PopulationSummaryEmbed })))
const MeasureDashboard = lazy(() => import('./pages/MeasureDashboard').then(m => ({ default: m.MeasureDashboard })))

function LegacyChartRedirect() {
  const { patientId } = useParams<{ patientId: string }>()
  return <Navigate to={patientId ? `/patient/record/${patientId}` : '/patient/record'} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <FhircastListener />
      <Routes>
      {/* SMART on FHIR — outside the app shell */}
      <Route path="/launch" element={<SmartLaunch />} />
      <Route path="/redirect" element={<SmartRedirect />} />

      {/* ⚠️ `/` is the chart, not a front door. On the guide this pointed at
          /overview; there is no overview here, and nobody arrives at this app
          without having been launched into it. */}
      <Route path="/" element={<Navigate to="/patient/record" replace />} />

      <Route element={<Shell />}>
        {/* The SMART app's own settings. Top-level rather than under /patient:
            it is a fact about the DEPLOYMENT, not about a patient, and it
            applies to the caseload as much as to the chart. Reachable in both
            chromes because it is one route table (see Shell.tsx) — in panel
            chrome the page says why it has no effect there. */}
        <Route path="/settings" element={<ToolConfiguration />} />

        {/* The patient-level app: the chart, the instruments and the recorders.
            Not a "lens" since #493 — the sidebar stopped switching between them,
            and /patient/chart is the guide page that explains this one. */}
        <Route path="/patient">
          <Route index element={<Navigate to="record" replace />} />
          {/* The chart app. It answered on `chart` until Phase 0 of
              docs/plans/user-scoped-smart-launch.md, which needed that URL for
              the page that EXPLAINS this app: the guide explains and hosts,
              the mock EHR holds and launches, and a visitor typing
              /patient/chart is asking the guide a question rather than opening
              a clinician's chart. This is the app itself — the panel's landing
              route (see SmartRedirect) and the target of every filler's "View
              in chart". */}
          <Route path="record" element={<PatientChart />} />
          <Route path="record/:patientId" element={<PatientChart />} />
          {/* /patient/chart is published, linked from CDS cards in the wild and
              named in docs/mock-ehr-demo-script.md, so it resolves rather than
              404s — to the explainer, which is what someone arriving at it now
              wants. The per-patient form keeps the id: a launched chart URL
              must not silently lose its patient. */}
          {/* ⚠️ On the guide this pointed at /guide/provider-app, the page that
              EXPLAINS this app. That branch left with the guide; here it has
              only ever meant "you wanted the chart". */}
          <Route path="chart" element={<Navigate to="/patient/record" replace />} />
          <Route path="chart/:patientId" element={<LegacyChartRedirect />} />
          {/* The published protocol, beside the chart rather than in the guide
              (Phase 4 of docs/plans/suicide-safer-care-pathway.md). This is the
              route the embedded SMART panel reaches from the chart's pathway
              rail: /guide/pathway is the implementer's framing — a pager into
              Tools and the Data Dictionary — which is the wrong surface to send
              a clinician in a host chart into. Same renderer, same artifact,
              provenance leading; it renders the DEFINITION and reads no patient
              data, exactly like the guide page. */}
          <Route path="pathway" element={<PathwayProtocol />} />
          {/* A page per pathway stage: the instrument the published pathway
              names, with the deployment's alternatives one disclosure away.
              Linked from the chart's stage rail, which is the only way in —
              an unknown stageId redirects back to the chart rather than
              rendering a blank page. */}
          <Route path="pathway/:stageId" element={<PathwayStage />} />
          <Route path="assessments" element={<Navigate to="/patient/record" replace />} />
          <Route path="assessments/phq-9" element={TOOL_VIEWS['phq-9']} />
          <Route path="assessments/asq" element={TOOL_VIEWS['asq']} />
          <Route path="assessments/bssa" element={TOOL_VIEWS['bssa']} />
          <Route path="assessments/pss-3" element={TOOL_VIEWS['pss-3']} />
          <Route path="assessments/safe-t" element={TOOL_VIEWS['safe-t']} />
          <Route path="assessments/sbq-r" element={TOOL_VIEWS['sbq-r']} />
          <Route path="assessments/cssrs-screener" element={TOOL_VIEWS['cssrs-screener']} />
          <Route path="assessments/cssrs-full" element={TOOL_VIEWS['cssrs-full']} />
          <Route path="assessments/cssrs-since-last-contact" element={TOOL_VIEWS['cssrs-since-last-contact']} />
          <Route path="assessments/cssrs-pediatric" element={TOOL_VIEWS['cssrs-pediatric']} />
          <Route path="assessments/stanley-and-brown" element={TOOL_VIEWS['stanley-and-brown']} />
          <Route path="assessments/cams-section-a" element={TOOL_VIEWS['cams-section-a']} />
          <Route path="assessments/cams-section-b" element={TOOL_VIEWS['cams-section-b']} />
          <Route path="assessments/cams-outcome-disposition" element={TOOL_VIEWS['cams-outcome-disposition']} />
          <Route path="assessments/cams-stabilization-plan" element={TOOL_VIEWS['cams-stabilization-plan']} />
          <Route path="assessments/cams-therapeutic-worksheet" element={TOOL_VIEWS['cams-therapeutic-worksheet']} />
          <Route path="assessments/crisis-response-plan" element={TOOL_VIEWS['crisis-response-plan']} />
          <Route path="assessments/pss-full" element={TOOL_VIEWS['pss-full']} />
          {/* Non-Questionnaire workflow recorders */}
          {/* caring-contact used to render the generic Communication recorder,
              which stamped neither the SPiERCaringContact profile nor the
              opt-out extension — so the Stage-8 adherence measure could not see
              its output and its opt-out exclusion could never fire. */}
          <Route path="workflow/caring-contact" element={TOOL_VIEWS['caring-contact']} />
          <Route path="workflow/transition" element={TOOL_VIEWS['transition']} />
          {/* Stage 5 — Coordinate Handoffs. rapid-referral used to render the
              generic Communication recorder; TL-017 is a ServiceRequest so the
              referral can be tracked past "sent" — see SafetyReferralView. The
              old path is kept as a redirect so existing links don't 404. */}
          <Route path="workflow/referral" element={TOOL_VIEWS['referral']} />
          <Route path="workflow/rapid-referral" element={<Navigate to="/patient/workflow/referral" replace />} />
          <Route path="workflow/discharge-packet" element={TOOL_VIEWS['discharge-packet']} />
          <Route path="workflow/follow-up-appointment" element={TOOL_VIEWS['follow-up-appointment']} />
          <Route path="workflow/sharing-consent" element={TOOL_VIEWS['sharing-consent']} />
          {/* Stage 6 — Track Follow-Up */}
          <Route path="workflow/outreach" element={TOOL_VIEWS['outreach']} />
          {/* Stage 7 — Track Risk Over Time */}
          <Route path="workflow/risk-episode" element={TOOL_VIEWS['risk-episode']} />
          <Route path="workflow/safety-tasks" element={TOOL_VIEWS['safety-tasks']} />
          {/* Stage 4 — Document Safety Actions */}
          <Route path="workflow/lethal-means" element={TOOL_VIEWS['lethal-means']} />
          <Route path="workflow/crisis-resources" element={TOOL_VIEWS['crisis-resources']} />
          <Route path="care-plans" element={<Navigate to="/patient/record#care-plans" replace />} />
          <Route path="encounters" element={<Navigate to="/patient/record#encounters" replace />} />
        </Route>

        {/* The population-level app: the caseload and the measures over it. */}
        {/* Population lens. `/population` itself is unchanged and load-bearing:
            the mock EHR embeds it as `?embed=1#/population`, so it stays the
            index rather than becoming /population/caseload. */}
        <Route path="/population">
          {/* ⚠️ `/population` was the caseload itself until Phase 0. It is now
              the guide page that explains the dashboard product — the same
              move as /patient/chart above, and for the same reason. The live
              caseload is `caseload`. */}
          {/* ⚠️ On the guide this pointed at /guide/dashboard, the explainer.
              Here it means the live caseload. `/population` itself stays the
              index rather than becoming /population/caseload: the mock EHR
              embeds it as `?embed=1#/population`. */}
          <Route index element={<Navigate to="caseload" replace />} />
          <Route path="caseload" element={<PopulationView />} />
          {/* The summary and alerts with no table and no page header — what the
              mock EHR frames at the top of its front door. See the module
              header for why the whole lens is the wrong thing to embed. */}
          <Route path="summary" element={<PopulationSummaryEmbed />} />
          <Route path="measures" element={<MeasureDashboard />} />
        </Route>
      </Route>

      {/* Anything else → the chart. ⚠️ This is also what answers /guide/* and
          /overview here: those are apps/guide's, and returning a clinician to
          their patient is the only sane landing. check:surface-links exists
          because a component shipping in both apps can still LINK into the
          other one, and this catch-all makes that silent. */}
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
            <SurfaceLinksContext.Provider value={CLINICAL_SURFACE_LINKS}>
              <AppRoutes />
            </SurfaceLinksContext.Provider>
          </ToolConfigProvider>
        </PatientProvider>
      </SmartProvider>
    </PresentationProvider>
  )
}
