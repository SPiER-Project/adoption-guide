import '@formbox/hs-theme/style.css'
import { RouteFallback } from '@spier/app-shell/components/RouteFallback'
import '@spier/app-shell/css/App.css'
import '@spier/app-shell/css/CarePlan.css'

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'

/**
 * The Adoption Guide: the case for the pathway, the published artifacts, and a
 * playground for every instrument.
 *
 * ⚠️ **This is one of TWO route tables now, and that is the whole point of the
 * apps/ split.** It used to be one table with `IS_DEMO ?` folding the other
 * app's pages out at build time. The flag is gone; a page this app does not
 * declare is not reachable here, full stop. `check:tool-view-routes` reads
 * every app's table and holds them to the ONE tool-view definition.
 *
 * ⚠️ **It carries no patient data and no data source of its own.** The fillers
 * below write into an unseeded local store — the blank "play with forms" state
 * — which is what lets an instrument be tried with nothing running. The chart
 * experience belongs to the mock EHR; see `data/surfaces.ts`.
 */

// Context Providers. Each context is split in two — the provider component in
// *Provider.tsx, its context object and hook in *Context.ts — so the provider
// module stays component-only and Fast Refresh preserves its state on edit.
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import { SmartProvider } from '@spier/app-shell/context/SmartProvider'
import { PatientProvider } from '@spier/app-shell/context/PatientProvider'

// SMART on FHIR. ⚠️ Kept even though the guide never INITIATES a launch: these
// two routes were unguarded before the split, so removing them here would be a
// behaviour change inside what is otherwise a move. A launch aimed at this
// origin still lands somewhere sane rather than at the catch-all.
import { SmartLaunch } from '@spier/app-shell/components/SmartLaunch'
import { SmartRedirect } from '@spier/app-shell/components/SmartRedirect'

// ⚠️ AppShell directly, not the `Shell` chooser. That component picked between
// three chromes by reading chrome mode AND the build surface; this app has one
// chrome, so the choice disappears rather than moving. `Shell` is now
// apps/clinical's, and picks between panel and launch.
import { AppShell } from './components/AppShell'

// Published paths of the CLINICAL app, kept working on this origin. Each used
// to be a <Navigate> to its new home; those homes are apps/clinical routes on
// another origin since the apps split, so the hop is cross-origin. See the
// component for the defect (every one landed on the Overview, silently).
import { ClinicalRedirect } from './components/ClinicalRedirect'

// Cross-tab patient-context sync (simulated FHIRcast).
import { FhircastListener } from '@spier/app-shell/components/FhircastListener'

const Overview = lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })))
const AdoptionGuide = lazy(() => import('./pages/AdoptionGuide').then(m => ({ default: m.AdoptionGuide })))
const CarePathway = lazy(() => import('./pages/CarePathway').then(m => ({ default: m.CarePathway })))
const CarePathwayProtocol = lazy(() => import('./pages/CarePathwayProtocol').then(m => ({ default: m.CarePathwayProtocol })))
const PatientJourney = lazy(() => import('./pages/PatientJourney').then(m => ({ default: m.PatientJourney })))
const DataDictionary = lazy(() => import('./pages/DataDictionary').then(m => ({ default: m.DataDictionary })))
const CdsServiceGuide = lazy(() => import('./pages/CdsServiceGuide').then(m => ({ default: m.CdsServiceGuide })))
const ProviderAppGuide = lazy(() => import('./pages/ProviderAppGuide').then(m => ({ default: m.ProviderAppGuide })))
const PopulationDashboardGuide = lazy(() => import('./pages/PopulationDashboardGuide').then(m => ({ default: m.PopulationDashboardGuide })))
const EhrAdoptionRubric = lazy(() => import('./pages/EhrAdoptionRubric').then(m => ({ default: m.EhrAdoptionRubric })))
const AdoptionReadiness = lazy(() => import('./pages/AdoptionReadiness').then(m => ({ default: m.AdoptionReadiness })))
const WhySpier = lazy(() => import('./pages/WhySpier').then(m => ({ default: m.WhySpier })))
const ToolPage = lazy(() => import('./pages/ToolPage').then(m => ({ default: m.ToolPage })))

function LegacyWorkflowRedirect() {
  const { slug } = useParams<{ slug: string }>()
  // These pointed at the tool catalogue, which moved from /guide/pathway to
  // /guide/tools in Phase 3 of docs/plans/suicide-safer-care-pathway.md. The
  // slug lands on that tool's own page since 2026-09-20 (ToolPage resolves a
  // tool id or a form slug); it used to go to `/guide/tools/<slug>/plan`,
  // which no route answered.
  return <Navigate to={slug ? `/guide/tools/${slug}` : '/guide/tools'} replace />
}

// /guide/tools/:slug/try was the implementer's view of one instrument until
// 2026-09-20, keyed by the form's slug. A tool is a page now, keyed by its id,
// and ToolPage canonicalises a form slug to the owning tool's page — so the
// published path keeps working with the slug carried across.
function LegacyTryRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={slug ? `/guide/tools/${slug}` : '/guide/tools'} replace />
}

// The Adoption Guide lens lived at /adoption-guide (and, before that,
// /implementation-guide). It is now /guide; preserve any subpath so old
// bookmarks for either prior route keep working.
function LegacyGuideRedirect() {
  const params = useParams()
  const rest = params['*']
  return <Navigate to={`/guide${rest ? `/${rest}` : ''}`} replace />
}

// /chart/screenings/:tool → the clinical app's /patient/assessments/:tool. The
// tool has to survive the hop, so it is a component rather than one literal.
function LegacyAssessmentRedirect() {
  const { tool } = useParams<{ tool: string }>()
  return <ClinicalRedirect clinicalPath={tool ? `/patient/assessments/${tool}` : '/patient/assessments'} />
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
      <Route path="/" element={<Navigate to="/overview" replace />} />

      <Route element={<AppShell />}>
        {/* Overview — the front door, a top-level lens rather than a guide
            section (the sidebar lists it above the Adoption Guide). */}
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
            {/* The published protocol is a SUBSECTION of Care Pathway since
                2026-09-20: /guide/pathway explains what a pathway does and lets
                a reader try one, and this is the same artifact rendered in full
                for the implementer — spine, gates, provenance, JSON. Reached by
                one link from the explainer, not a sidebar row.
                ⚠️ Declared in guideSections.ts `subsections` as well, with the
                FULL sub-path; that is what makes it CHECKED — check:guide-boundary
                derives the guide's page set from that file. */}
            <Route path="pathway/protocol" element={<CarePathwayProtocol />} />
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
                explainers and docs/mock-ehr-demo-script.md.
                ⚠️ /settings is a route of apps/clinical, on another origin, so
                this is a cross-origin hop and not a <Navigate> — which, since the
                apps split, resolved to this app's catch-all and put the reader on
                the Overview. */}
            <Route path="tool-configuration" element={<ClinicalRedirect clinicalPath="/settings" />} />
            <Route path="data-dictionary" element={<DataDictionary />} />
            {/* Measures moved to the EHR side (step D, #391): it is the only guide
                section that read patient data, and the guide explains and
                configures the pathway rather than holding a caseload. The redirect
                stays — /guide/measures is a published tool launch path and is
                already linked from CDS cards in the wild. */}
            <Route path="measures" element={<ClinicalRedirect clinicalPath="/population/measures" />} />
            <Route path="cds-service" element={<CdsServiceGuide />} />
            {/* Published path, kept as a redirect after the move under Tools. */}
            <Route path="adoption-readiness" element={<Navigate to="/guide/tools/readiness" replace />} />
            <Route path="adoption-rubric" element={<EhrAdoptionRubric />} />
            {/* The long form of the argument, which the Overview used to carry
                in full — see the note on this section in guideSections.ts.
                ⚠️ Same `<Route path="x" element={<Comp />}>` shape as its
                siblings: check:guide-boundary and check:surface both resolve a
                section's component by matching that literal form, and a
                different one makes them skip the page rather than fail. */}
            <Route path="why-spier" element={<WhySpier />} />
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

          {/* One catalogued tool as a page: its name and purpose, the same
              form the clinician's /patient/* route renders with the FHIR opened
              up, and the catalogue detail below (adoption-guide audit §4.3,
              2026-09-20). Keyed by tool id; a form slug redirects to its owner.
              ⚠️ A SIBLING of the /guide layout above, not a child of it — the
              page renders its own PageHeader, and nesting it inside
              AdoptionGuide would put two on one page (check:template forbids
              it). It provides InspectContext itself for the same reason.
              ⚠️ Declared in guideSections.ts `subsections` as `tools/:toolRef`
              — the FULL parameterised sub-path — so check:guide-boundary walks
              it and check:catalog asserts the route; both gates accept this
              absolute form for a sibling. The form writes to the guide's
              UNSEEDED patient context, which is context and not data, so the
              boundary gate's premise holds (see the page's header comment). */}
          <Route path="/guide/tools/:toolRef" element={<ToolPage />} />
          {/* The retired try route, kept as a redirect because it was published
              and linked from the catalogue, Adoption Readiness and the docs. */}
          <Route path="/guide/tools/:slug/try" element={<LegacyTryRedirect />} />

          {/* Legacy /chart/* redirects — keep for one cycle. The first six meant
              the chart, which is apps/clinical's, so they hop origins; the rest
              meant guide pages and stay <Navigate>s. */}
          <Route path="/chart" element={<ClinicalRedirect clinicalPath="/patient/record" />} />
          <Route path="/chart/dashboard" element={<ClinicalRedirect clinicalPath="/patient/record" />} />
          <Route path="/chart/screenings" element={<ClinicalRedirect clinicalPath="/patient/assessments" />} />
          <Route path="/chart/screenings/:tool" element={<LegacyAssessmentRedirect />} />
          <Route path="/chart/careplan" element={<ClinicalRedirect clinicalPath="/patient/care-plans" />} />
          <Route path="/chart/encounters" element={<ClinicalRedirect clinicalPath="/patient/encounters" />} />
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
      </Route>

      {/* Anything else → home. ⚠️ This is also what answers /patient/record and
          /population/caseload here: those pages are apps/clinical's, so a
          visitor following an old link lands on the front door rather than on a
          chart the guide no longer has. */}
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
          <AppRoutes />
        </PatientProvider>
      </SmartProvider>
    </PresentationProvider>
  )
}
