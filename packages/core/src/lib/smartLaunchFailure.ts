/**
 * Why opening the app from the EHR failed, as a CODE the app words for itself.
 *
 * ⚠️ **The same leak as the chart's banner, one step earlier.** Until
 * 2026-10-07 the launch and redirect pages printed `err.message` from
 * fhirclient: "403 Forbidden\nURL: https://…/token" with the server's
 * `error_description` appended, "access_denied: The user denied…", "No 'state'
 * parameter found. Please (re)launch the app.", "Failed to fetch the
 * conformance statement from …/metadata". `check:jargon` reads string
 * literals and could not see any of it — these are built at runtime inside
 * fhirclient. `dataSource/failure.ts` holds the reasoning for the class; this
 * file is the same rule applied to the launch.
 *
 * Classifying a fhirclient error means reading fhirclient's OWN message text,
 * because most of what it throws is a plain `Error`. That is fragile by
 * nature, and it is safe by construction: an unrecognised message falls to
 * `failed`, which is worded like every other kind, so a fhirclient upgrade that
 * rewords one can make the page less specific but never makes it print the
 * message. `apps/clinical/src/pages/smartLaunchError.test.tsx` drives the real
 * library to each of these, so a reworded message fails there rather than
 * silently downgrading.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import { httpStatusOf, isAuthorizationStatus } from './dataSource/failure'

/**
 * - `refused`      — the EHR's sign-in declined this app: an OAuth `error`
 *                    redirect, a 401 / 403, or a token request it rejected
 *                    (which includes a code redeemed twice).
 * - `not-launched` — the page was opened without a launch from the EHR: no
 *                    server named, or no sign-in in progress to complete.
 * - `unreachable`  — the EHR or its sign-in service could not be reached, or
 *                    answered with a server error.
 * - `record-unread`— signed in, then the patient's own record could not be read.
 * - `failed`       — anything else. The fallback, and safe to be wrong into.
 */
export type SmartLaunchFailureKind =
  | 'refused'
  | 'not-launched'
  | 'unreachable'
  | 'record-unread'
  | 'failed'

export interface SmartLaunchFailure {
  kind: SmartLaunchFailureKind
  /** The thrown message, verbatim. Wire vocabulary — for the console only. */
  detail: string
}

/**
 * Where in the launch the error was thrown:
 * - `authorize` — `FHIR.oauth2.authorize()`, before the browser leaves for the EHR.
 * - `complete`  — `FHIR.oauth2.ready()`, redeeming the code the EHR sent back.
 * - `patient`   — reading the patient in context, after a successful sign-in.
 */
export type SmartLaunchStep = 'authorize' | 'complete' | 'patient'

/**
 * OAuth 2.0 error codes (RFC 6749 §4.1.2.1) as fhirclient's `ready()` reports
 * them: `${error}: ${error_description}`. The two that mean "try later" are a
 * server's problem; the rest are a refusal.
 */
const OAUTH_REFUSAL = /^(access_denied|unauthorized_client|invalid_request|invalid_scope|invalid_client|invalid_grant|unsupported_response_type)\b/
const OAUTH_UNAVAILABLE = /^(server_error|temporarily_unavailable)\b/

/** fhirclient's own messages for "there is no launch here to complete". */
const NOT_LAUNCHED = [
  /^No server url found\b/, // authorize(): no `iss` and no `fhirServiceUrl`
  /^No 'state' parameter found\b/, // ready(): opened without a redirect
  /^No state found\b/, // ready(): a state key whose session is gone
  /^'code' url parameter is required\b/, // ready(): a redirect with no code
]

/** fhirclient's wrapper when neither discovery document could be fetched. */
const DISCOVERY_FAILED = /^Failed to fetch the (well-known json|conformance statement)\b/

/** `fetch`'s network failure, in Chrome, Firefox and Safari's words. */
const NETWORK_FAILED = /^(Failed to fetch|NetworkError when attempting to fetch resource|Load failed)\b/

/** fhirclient's assertion when a token response carries no token. */
const NO_TOKEN = /^Failed to obtain access token\b/

export function toSmartLaunchFailure(err: unknown, during: SmartLaunchStep): SmartLaunchFailure {
  const detail = err instanceof Error ? err.message : String(err)
  return { kind: classify(err, detail, during), detail }
}

function classify(err: unknown, message: string, during: SmartLaunchStep): SmartLaunchFailureKind {
  const status = httpStatusOf(err)
  if (status !== undefined) {
    if (isAuthorizationStatus(status)) return 'refused'
    // The token endpoint answers a rejected grant with 400 (RFC 6749 §5.2).
    if (status === 400 && during === 'complete') return 'refused'
    if (status >= 500) return 'unreachable'
    return during === 'patient' ? 'record-unread' : 'failed'
  }
  if (err instanceof TypeError && NETWORK_FAILED.test(message)) return 'unreachable'
  if (OAUTH_REFUSAL.test(message) || NO_TOKEN.test(message)) return 'refused'
  if (OAUTH_UNAVAILABLE.test(message) || DISCOVERY_FAILED.test(message)) return 'unreachable'
  if (NOT_LAUNCHED.some(re => re.test(message))) return 'not-launched'
  return during === 'patient' ? 'record-unread' : 'failed'
}
