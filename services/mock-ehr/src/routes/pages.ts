/**
 * The host chrome: the front door, one chart, the settings bench, the tab
 * mark — and the three built client scripts those pages load.
 *
 * ⚠️ **No page ships an inline `<script>` any more.** Each page's behaviour is a
 * TypeScript module under `src/client/`, built by `vite.client.config.ts` into
 * `src/client/dist/` and served here at `/client/<name>.js?v=<hash>`; the page
 * hands the module its inputs through a `<script type="application/json">`
 * block. That is what puts the behaviour under `tsc`, eslint and the tests —
 * the inline strings were 500 lines no tool could see into (see
 * `clientAssets.ts`).
 */
import { Hono } from 'hono'
import { DEMO_PATIENTS, DEMO_PATIENTS_BY_ID, HELD_RESOURCES } from '../fixtures'
import { controlPage } from '../controlPage'
import { homePage, patientChartPage } from '../chartPage'
import { FAVICON_SVG } from '../hostChrome'
import { authRequired } from '../smart'
import { CDS_SERVICE_PATH, cdsOriginFor, envOf, panelBaseFor, type AppEnv } from '../env'
import { liveProfile } from '../profile'
import { fhirBase } from '../fhirResponses'
import { clientScriptUrl, serveClientScript } from '../clientAssets'

export const pageRoutes = new Hono<AppEnv>()

/**
 * A built client module. Immutable for a year: every URL the pages emit carries
 * `?v=<content hash>`, and Rollup names any shared chunk by content too, so a
 * changed file is a changed URL and the cached copy can never be wrong.
 */
pageRoutes.get('/client/:file', (c) => serveClientScript(c.req.param('file')) ?? c.notFound())

// ── Host chrome (step 5) ─────────────────────────────────────────────────────
// The patient list and one chart, with the panel framed inside it. This is what
// exercises `frame-ancestors` on the panel host — see chartPage.ts.

/**
 * The front door: the host's patient list, and the two launches it offers.
 *
 * ⚠️ `/` used to serve the operator's bench and the demo was two undiscoverable
 * clicks away. See `homePage` for the report that prompted the change.
 *
 * ⚠️ It also used to embed SPiER's caseload summary in an `<iframe>` carrying no
 * launch context. #401 replaced that with a real user-scoped launch, so this
 * handler no longer builds a panel URL at all — the button POSTs to
 * `/_admin/launch` and follows what the server returns, exactly as the chart's
 * launch button does.
 */
pageRoutes.get('/', async (c) => {
  return c.html(homePage(DEMO_PATIENTS, { scriptUrl: clientScriptUrl('home') }))
})

/**
 * The tab mark, served rather than linked to a static file: this Worker has no
 * Static Assets binding (see wrangler.jsonc) — it serves FHIR and its own
 * pages, and adding an assets bucket for one 400-byte SVG would be the larger
 * change.
 *
 * Cached for a day. The icon changes about as often as the palette does, and a
 * browser that re-fetches it on every page load is a needless request on a
 * demo whose whole point is being watched live.
 */
pageRoutes.get('/favicon.svg', (c) =>
  c.body(FAVICON_SVG, 200, {
    'content-type': 'image/svg+xml; charset=utf-8',
    'cache-control': 'public, max-age=86400',
  }))


// `/chart` was the patient list before the list became the front door. Kept as a
// redirect rather than deleted: it is in the README, in two plan docs and in
// anyone's history, and a 404 on a URL we published is a worse answer than a
// redirect.
pageRoutes.get('/chart', (c) => c.redirect('/', 301))

pageRoutes.get('/chart/:patientId', async (c) => {
  const patient = DEMO_PATIENTS_BY_ID.get(c.req.param('patientId'))
  if (!patient) return c.notFound()
  const panelBase = panelBaseFor(envOf(c))
  const panelOrigin = new URL(panelBase).origin
  // The panel and the CDS service are on DIFFERENT Workers now (the apps moved
  // to services/clinical; the service stayed on the adoption-guide Worker), so
  // each has its own default and neither is derived from the other. Only the
  // origin is taken from the var; the service path is this Worker's to know
  // (see CDS_SERVICE_PATH).
  const cdsOrigin = cdsOriginFor(envOf(c))
  // ⚠️ No capability profile is passed any more, and that is not a regression.
  // The chart is the demo surface; the switch is operator equipment and lives on
  // /settings. Flipping it there in a second tab still changes what THIS chart's
  // panel is told, because the live profile is held in the Durable Object rather
  // than in module memory — see `liveProfile`. That was not true when the switch
  // was added to this page, which is part of why it was added here.
  return c.html(patientChartPage(patient, {
    cdsEndpoint: `${cdsOrigin}${CDS_SERVICE_PATH}`,
    panelOrigin,
    // Everyone except the patient whose chart this is — the FHIRcast affordance
    // announces a move to a DIFFERENT patient, so offering this one would
    // demonstrate nothing.
    otherPatients: DEMO_PATIENTS.filter(p => p.id !== patient.id),
    scriptUrl: clientScriptUrl('chart'),
  }))
})

/**
 * The operator's bench — moved off `/` deliberately. Everything here is server
 * equipment (the capability switch, a top-level launch, the FHIR base), and none
 * of it tells a visitor what to do.
 */
pageRoutes.get('/settings', async (c) => c.html(controlPage(
  await liveProfile(c),
  fhirBase(c.req.url),
  HELD_RESOURCES.length,
  DEMO_PATIENTS,
  authRequired(envOf(c)),
  { scriptUrl: clientScriptUrl('settings') },
)))

