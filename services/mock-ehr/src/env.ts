/**
 * The Worker's environment: bindings, vars, and the defaults behind the vars.
 *
 * Split out of app.ts when that file was 1,185 lines and every route module
 * needed the same three things: the `Env` shape, a null-safe `envOf`, and the
 * two hosted-origin defaults. Nothing here handles a request.
 */
import type { DemoStore } from './demoStore'
// Type-only: see the header of fhircastHub.ts for why this must never become a
// value import.
import type { FhircastHub } from './fhircastHub'
import type { Grant, SmartEnv } from './smart'
import { DEPLOY_ORIGINS } from '@spier/core/lib/deployOrigins'

export interface Env extends SmartEnv {
  /**
   * Durable Object holding written resources and the live capability profile.
   * Absent in unit tests (which pass their own `DemoState`) and in a
   * misconfigured deploy — see `storeFor`, which refuses to fake it.
   */
  DEMO_STORE?: DurableObjectNamespace<DemoStore>
  /** The FHIRcast hub (step 6). Absent in unit tests that do not need it. */
  FHIRCAST_HUB?: DurableObjectNamespace<FhircastHub>
  /**
   * The CDS Hooks service (`services/cds`), bound Worker-to-Worker.
   *
   * ⚠️ **Not a convenience — a plain `fetch()` to its URL CANNOT work from this
   * Worker.** Both live on `*.bbthorson.workers.dev`, one zone, and Cloudflare
   * refuses a same-zone Worker subrequest with HTTP 404 / `error code: 1042`.
   * See the long note in `wrangler.jsonc`.
   *
   * Optional because the unit tests pass no env at all; `routes/cds.ts` falls
   * back to `fetch` for them. `wrangler dev` DOES bind it (through the local dev
   * registry), so a local run needs `services/cds` running or the invoke 503s
   * with "Worker not found" — a real exercise of the deployed path.
   */
  CDS?: { fetch: typeof fetch }
  /** Profile a freshly started isolate begins with (wrangler.jsonc `vars`). */
  MOCK_CAPABILITY_PROFILE?: string
  /** Where the panel app lives, for the launch URL the control page builds. */
  MOCK_PANEL_BASE_URL?: string
  /**
   * Where the CDS Hooks service lives — a DIFFERENT Worker from the panel since
   * the SMART apps moved to `services/clinical`. Blank = the adoption-guide
   * Worker, which is where the service is.
   */
  MOCK_CDS_BASE_URL?: string
  /**
   * The `sub` this host presents to the CDS service — the client id that
   * service knows it by. Blank = `spier-mock-ehr`. A real adopter registers
   * with the service and puts the id it was issued here.
   */
  MOCK_CDS_CLIENT_ID?: string
}


/** The Hono generics every route module and the composition root share. */
export type AppEnv = { Bindings: Env; Variables: { grant?: Grant } }

/**
 * Default panel origin for a minted launch URL; overridden by the env var.
 *
 * ⚠️ **The clinical Worker, not the adoption-guide one.** The host frames the
 * build a real EHR would get: the two SMART apps, no guide routes, no synthetic
 * patient. Pointing it at the guide build still *worked* — that build contains
 * the same two apps — but it framed a panel whose in-app links can reach
 * `/guide` pages, which is precisely the class `web`'s `check:surface-links`
 * exists to catch and which the clinical build removes outright.
 */
export const DEFAULT_PANEL_BASE_URL = `${DEPLOY_ORIGINS.clinical}/`

/**
 * Default origin for the CDS Hooks service.
 *
 * ⚠️ **This used to be derived from the panel's own origin, and that derivation
 * became false the day `services/clinical` shipped.** One Worker served the SPA
 * and `/cds-services/*`, so "the service is where the panel is" was a fact worth
 * deriving rather than configuring. Keeping the derivation would have left a
 * blank `MOCK_CDS_BASE_URL` silently pointing the chart's CDS fetch at a Worker
 * that has no such route, which is a 200 of HTML rather than an error anyone
 * would read.
 *
 * ⚠️ **Updated 2026-09-20: the service is on its OWN Worker now** (`spier-cds`,
 * services/cds), not the adoption-guide one. Three origins are in play from this
 * host — the panel (clinical), the CDS service, and the guide — and none of them
 * is derivable from either of the others. That is the whole reason each is a
 * named default rather than a computed one.
 */
export const DEFAULT_CDS_BASE_URL = `${DEPLOY_ORIGINS.cds}/`

/**
 * The path the CDS Hooks service answers on, at whichever origin hosts it.
 *
 * ⚠️ Hand-written here rather than imported, because importing the service
 * module would pull the whole card builder into this Worker's bundle for one
 * string. `app.test.ts` asserts it against the real `SERVICE_ID` instead, so the
 * drift is gated without the weight. (A mismatch would not fail silently — the
 * chart page renders the fetch error — but "visible in a browser" is not a gate.)
 */
export const CDS_SERVICE_PATH = '/cds-services/spier-patient-view'

/**
 * `c.env` is undefined when the app is driven through `app.request()` with no
 * env — which is how every test calls it, and how a misconfigured deploy would
 * behave too. Reading a var off undefined throws inside middleware and surfaces
 * as a 500, which is the least informative failure available; normalize once.
 */
export function envOf(c: { env?: Env }): Env {
  return c.env ?? {}
}


/** The panel's base URL for this deployment: the var, else the clinical Worker. */
export function panelBaseFor(env: Env): string {
  return env.MOCK_PANEL_BASE_URL || DEFAULT_PANEL_BASE_URL
}

/** The CDS Hooks service's ORIGIN for this deployment; the path is `CDS_SERVICE_PATH`. */
export function cdsOriginFor(env: Env): string {
  return new URL(env.MOCK_CDS_BASE_URL || DEFAULT_CDS_BASE_URL).origin
}
