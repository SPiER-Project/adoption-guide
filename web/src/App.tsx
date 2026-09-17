import '@formbox/hs-theme/style.css'
import './App.css'
import './CarePlan.css'

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'


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
import { IS_DEMO } from './lib/surface'

// Every instrument filler and workflow recorder, defined ONCE and rendered by
// two route families: the clinician's /patient/* paths below, and the guide's
// /guide/tools/:slug/try. See data/toolViews.tsx for why they must be one
// definition rather than two.
import { TOOL_VIEWS } from './data/toolViews'

// Route pages and views are code-split (React.lazy) so each lens loads on
// demand. Named exports are adapted to lazy()'s default-export contract.
/**
 * A page that exists on the demo surface only is declared as
 * `IS_DEMO ? lazy(() => import(…)) : NotOnThisSurface`. `IS_DEMO` is a
 * build-time literal, so on the clinical build the ternary folds and the
 * dynamic import is dropped with it: the guide's chunks are not emitted
 * rather than emitted-and-dark. (Inline, not through a helper — an import
 * inside an arrow passed to a function is reachable as far as the bundler
 * knows, and would be kept.) The fallback is never rendered — no clinical
 * route points at it — but the symbol has to be a component so the JSX below
 * typechecks on both surfaces.
 */
function NotOnThisSurface() {
  return <Navigate to="/" replace />
}

const Overview = IS_DEMO ? lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview }))) : NotOnThisSurface
const AdoptionGuide = IS_DEMO ? lazy(() => import('./pages/AdoptionGuide').then(m => ({ default: m.AdoptionGuide }))) : NotOnThisSurface
const CarePathway = IS_DEMO ? lazy(() => import('./pages/CarePathway').then(m => ({ default: m.CarePathway }))) : NotOnThisSurface
const PatientJourney = IS_DEMO ? lazy(() => import('./pages/PatientJourney').then(m => ({ default: m.PatientJourney }))) : NotOnThisSurface
const DataDictionary = IS_DEMO ? lazy(() => import('./pages/DataDictionary').then(m => ({ default: m.DataDictionary }))) : NotOnThisSurface
const MeasureDashboard = lazy(() => import('./pages/MeasureDashboard').then(m => ({ default: m.MeasureDashboard })))
const CdsServiceGuide = IS_DEMO ? lazy(() => import('./pages/CdsServiceGuide').then(m => ({ default: m.CdsServiceGuide }))) : NotOnThisSurface
const ProviderAppGuide = IS_DEMO ? lazy(() => import('./pages/ProviderAppGuide').then(m => ({ default: m.ProviderAppGuide }))) : NotOnThisSurface
const PopulationDashboardGuide = IS_DEMO ? lazy(() => import('./pages/PopulationDashboardGuide').then(m => ({ default: m.PopulationDashboardGuide }))) : NotOnThisSurface
const EhrAdoptionRubric = IS_DEMO ? lazy(() => import('./pages/EhrAdoptionRubric').then(m => ({ default: m.EhrAdoptionRubric }))) : NotOnThisSurface
const AdoptionReadiness = IS_DEMO ? lazy(() => import('./pages/AdoptionReadiness').then(m => ({ default: m.AdoptionReadiness }))) : NotOnThisSurface
const ToolTryIt = IS_DEMO ? lazy(() => import('./pages/ToolTryIt').then(m => ({ default: m.ToolTryIt }))) : NotOnThisSurface
const ToolConfiguration = lazy(() => import('./pages/ToolConfiguration').then(m => ({ default: m.ToolConfiguration })))
const PatientChart = lazy(() => import('./pages/PatientChart').then(m => ({ default: m.PatientChart })))
const PathwayProtocol = lazy(() => import('./pages/PathwayProtocol').then(m => ({ default: m.PathwayProtocol })))
const PopulationView = lazy(() => import('./pages/PopulationView').then(m => ({ default: m.PopulationView })))
const PopulationSummaryEmbed = lazy(() => import('./pages/PopulationSummaryEmbed').then(m => ({ default: m.PopulationSummaryEmbed })))

function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      Loading…
    </div>
  )
}

function LegacyWorkflowRedirect() {
  const { slug } = useParams<{ slug: string }>()
  // These pointed at the tool catalogue, which moved from /guide/pathway to
  // /guide/tools in Phase 3 of docs/plans/suicide-safer-care-pathway.md.
  return <Navigate to={slug ? `/guide/tools/${slug}/plan` : '/guide/tools'} replace />
}

// The Adoption Guide lens lived at /adoption-guide (and, before that,
// /implementation-guide). It is now /guide; preserve any subpath so old
// bookmarks for either prior route keep working.
function LegacyGuideRedirect() {
  const params = useParams()
  const rest = params['*']
  return <Navigate to={`/guide${rest ? `/${rest}` : ''}`} replace />
}

// /patient/chart/:patientId → /patient/record/:patientId. A plain <Navigate>
// cannot do this: the id has to survive, and dropping it would land a launched
// chart on whichever patient happened to be stored.
function LegacyChartRedirect() {
  const { patientId } = useParams<{ patientId: string }>()
  return <Navigate to={patientId ? `/patient/record/${patientId}` : '/patient/record'} replace />
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
      {/* SMART on FHIR — outside the app shell */}
      <Route path="/launch" element={<SmartLaunch />} />
      <Route path="/redirect" element={<SmartRedirect />} />

      {/* The front door used to be a standalone portal outside the shell, with
          its own header, footer and nav. It said the same thing the guide's
          Overview said, from a second chrome the rest of the app never showed —
          two front doors a visitor had to choose between. The two pages are now
          one, inside the shell, and `/` lands on it. */}
      {IS_DEMO ? (
        <Route path="/" element={<Navigate to="/overview" replace />} />
      ) : (
        <Route path="/" element={<Navigate to="/patient/record" replace />} />
      )}

      {/* The app shell wraps the demo lenses */}
      <Route element={<Shell />}>
        {/* Overview — the front door, a top-level lens rather than a guide
            section (the sidebar lists it above the Adoption Guide). */}
        {/* The guide lenses exist on the demo surface only — see lib/surface.ts. */}
        {IS_DEMO && (
          <>
          <Route path="/overview" element={<Overview />} />

          {/* Adoption Guide lens */}
          <Route path="/guide" element={<AdoptionGuide />}>
            <Route index element={<Navigate to="pathway" replace />} />
            {/* ⚠️ /guide/pathway is REPURPOSED, not renamed. It served the
                stage-organized tool catalogue until Phase 3 of
                docs/plans/suicide-safer-care-pathway.md; it is now the pathway
                itself, rendered from PlanDefinition/SPiERSuicideSaferCarePathway,
                and the catalogue lives one route down at /guide/tools. Anchored
                deep links (/guide/pathway#stage-…) are forwarded by CarePathway
                itself — see the note there. */}
            <Route path="pathway" element={<CarePathway />} />
            {/* ⚠️ Declared in this exact `<Route path="x" element={<Comp />}>`
                form on purpose: check-guide-boundary.mjs reads the route table to
                find each section's component, and a different shape would make it
                fail to resolve the page rather than silently skip it. */}
            <Route path="provider-app" element={<ProviderAppGuide />} />
            {/* Renamed 2026-09-17: the app is the clinician's, launched from a
                patient's chart. `/guide/patient-app` was published and was what
                /patient/chart pointed at, so it redirects rather than 404s.
                check:catalog validates every <Navigate> target, so this cannot
                rot into the catch-all. */}
            <Route path="patient-app" element={<Navigate to="/guide/provider-app" replace />} />
            <Route path="dashboard" element={<PopulationDashboardGuide />} />
            <Route path="tools" element={<PatientJourney />} />
            {/* Adoption Readiness is a SUBSECTION of Tools since 2026-09-17: it
                renders one row per catalogued instrument, entirely from the
                catalog, so it is a second view of Tools rather than a peer of it.
                ⚠️ Declared in guideSections.ts `subsections` as well, and that is
                what makes it CHECKED — check:guide-boundary derives the guide's
                page set from that file, and a route under /guide that the file
                does not name is walked by nothing. */}
            <Route path="tools/readiness" element={<AdoptionReadiness />} />
            {/* Tool Configuration moved to /settings on 2026-09-15: it is a
                setting of the SMART app, which owns the tool catalog, not a
                section of a guide that explains and hosts. The redirect stays —
                the path was published and is linked from the chart, both surface
                explainers and docs/mock-ehr-demo-script.md. */}
            <Route path="tool-configuration" element={<Navigate to="/settings" replace />} />
            <Route path="data-dictionary" element={<DataDictionary />} />
            {/* Measures moved to the EHR side (step D, #391): it is the only guide
                section that read patient data, and the guide explains and
                configures the pathway rather than holding a caseload. The redirect
                stays — /guide/measures is a published tool launch path and is
                already linked from CDS cards in the wild. */}
            <Route path="measures" element={<Navigate to="/population/measures" replace />} />
            <Route path="cds-service" element={<CdsServiceGuide />} />
            {/* Published path, kept as a redirect after the move under Tools. */}
            <Route path="adoption-readiness" element={<Navigate to="/guide/tools/readiness" replace />} />
            <Route path="adoption-rubric" element={<EhrAdoptionRubric />} />
            {/* /guide/roadmap was published, so it gets a redirect rather than
                falling through to the catch-all. The page mirrored GitHub Issues
                onto the site; the issues are the roadmap now, and Adoption
                Readiness is what survives of "where is each tool".
                ⚠️ Points at the real page, not at /guide/adoption-readiness,
                which became a redirect itself on 2026-09-17. Two chained
                <Navigate>s work but cost a render, and check:catalog reads a
                redirect's target literally — it would report this one as
                resolving while a reader bounced twice. */}
            <Route path="roadmap" element={<Navigate to="/guide/tools/readiness" replace />} />
          </Route>

          {/* The implementer's view of an instrument: the same recorder the
              clinician's /patient/* route renders, with the FHIR opened up.
              ⚠️ A SIBLING of the /guide layout above, not a child of it — the
              recorders render their own PageHeader, and nesting them inside
              AdoptionGuide would put two on one page (check:template forbids
              it). ToolTryIt provides InspectContext itself for the same reason.
              ⚠️ Also deliberately not a guideSections entry; see the note at the
              top of pages/ToolTryIt.tsx for why a route that writes to patient
              context must not be declared a guide page. */}
          <Route path="/guide/tools/:slug/try" element={<ToolTryIt />} />
          </>
        )}

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
          {IS_DEMO ? (
            <Route path="chart" element={<Navigate to="/guide/provider-app" replace />} />
          ) : (
            <Route path="chart" element={<Navigate to="/patient/record" replace />} />
          )}
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
          {IS_DEMO ? (
            <Route index element={<Navigate to="/guide/dashboard" replace />} />
          ) : (
            <Route index element={<Navigate to="caseload" replace />} />
          )}
          <Route path="caseload" element={<PopulationView />} />
          {/* The summary and alerts with no table and no page header — what the
              mock EHR frames at the top of its front door. See the module
              header for why the whole lens is the wrong thing to embed. */}
          <Route path="summary" element={<PopulationSummaryEmbed />} />
          <Route path="measures" element={<MeasureDashboard />} />
        </Route>

        {IS_DEMO && (
          <>
          {/* Legacy /chart/* redirects — keep for one cycle */}
          <Route path="/chart" element={<Navigate to="/patient/record" replace />} />
          <Route path="/chart/dashboard" element={<Navigate to="/patient/record" replace />} />
          <Route path="/chart/screenings" element={<Navigate to="/patient/assessments" replace />} />
          <Route path="/chart/screenings/:tool" element={<LegacyAssessmentRedirect />} />
          <Route path="/chart/careplan" element={<Navigate to="/patient/care-plans" replace />} />
          <Route path="/chart/encounters" element={<Navigate to="/patient/encounters" replace />} />
          <Route path="/chart/implementation-guide" element={<Navigate to="/guide" replace />} />
          {/* Both of these meant "the tool catalogue", which is /guide/tools now. */}
          <Route path="/chart/workflow" element={<Navigate to="/guide/tools" replace />} />
          <Route path="/chart/workflow/:slug/plan" element={<LegacyWorkflowRedirect />} />
          <Route path="/chart/ehr-rubric" element={<Navigate to="/guide/adoption-rubric" replace />} />
          <Route path="/chart/data-dictionary" element={<Navigate to="/guide/data-dictionary" replace />} />
          <Route path="/chart/tools" element={<Navigate to="/guide/tools" replace />} />

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
          </>
        )}
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
