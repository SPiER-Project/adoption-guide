/**
 * Absolute URLs for SPiER's hosted CDS Hooks service.
 *
 * These are intentionally absolute — the CDS Service guide page renders them as
 * copy-pasteable curl commands and external links, and they must resolve to the
 * live Cloudflare Worker regardless of which host is serving the SPA (GitHub
 * Pages or the Worker itself). Do not derive from `import.meta.env.BASE_URL`.
 *
 * ⚠️ **Its own origin since 2026-09-20.** The service moved out of the
 * adoption-guide Worker into `spier-cds` (services/cds), because the IG, the
 * Adoption Guide and the clinical demo are three offerings and this is a fourth
 * thing SPiER publishes — an integration contract an adopter configures inside
 * their own EHR, not a path on a documentation host. The guide page's fetch is
 * cross-origin now; the service has always sent `Access-Control-Allow-Origin: *`
 * for the CDS Hooks Sandbox's benefit, which makes that header load-bearing
 * rather than incidental.
 */

/** CDS Hooks 2.0 discovery document — advertises the `spier-patient-view` service. */
export const CDS_DISCOVERY_URL =
  'https://spier-cds.bbthorson.workers.dev/cds-services'

/** The `spier-patient-view` service id (a `patient-view` hook). */
export const CDS_SERVICE_ID = 'spier-patient-view'

/** POST target for invoking the `spier-patient-view` service. */
export const CDS_INVOKE_URL = `${CDS_DISCOVERY_URL}/${CDS_SERVICE_ID}`

/** The public CDS Hooks Sandbox — add the discovery URL there to try the service. */
export const CDS_SANDBOX_URL = 'https://sandbox.cds-hooks.org'
