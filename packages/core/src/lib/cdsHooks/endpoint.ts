/**
 * Absolute URLs for SPiER's hosted CDS Hooks service.
 *
 * These are intentionally absolute — the CDS Service guide page renders them as
 * copy-pasteable curl commands and external links, and they must resolve to the
 * live Cloudflare Worker regardless of which host is serving the SPA (GitHub
 * Pages or the Worker itself). Do not derive from `import.meta.env.BASE_URL`.
 */

/** CDS Hooks 2.0 discovery document — advertises the `spier-patient-view` service. */
export const CDS_DISCOVERY_URL =
  'https://spier-adoption-guide.bbthorson.workers.dev/cds-services'

/** The `spier-patient-view` service id (a `patient-view` hook). */
export const CDS_SERVICE_ID = 'spier-patient-view'

/** POST target for invoking the `spier-patient-view` service. */
export const CDS_INVOKE_URL = `${CDS_DISCOVERY_URL}/${CDS_SERVICE_ID}`

/** The public CDS Hooks Sandbox — add the discovery URL there to try the service. */
export const CDS_SANDBOX_URL = 'https://sandbox.cds-hooks.org'
