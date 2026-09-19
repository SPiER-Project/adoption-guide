/**
 * Which `client_id` this app presents, per EHR.
 *
 * ⚠️ **A SMART app does not have *a* client_id.** It is registered separately
 * with every EHR it launches from, and each registration mints its own — that is
 * what registration *is*. This was a single hardcoded `'spier-client'` for as
 * long as the only launcher was `services/mock-ehr`, which accepts that literal
 * (`DEFAULT_CLIENT_IDS` in its `smart.ts`). The first real third-party server
 * ended that: Medplum issues a UUID and rejects anything else, so a launch from
 * it failed at `/authorize` with an unknown client before the app saw a thing.
 *
 * The `iss` the EHR sends *is* the key — it names the server whose registration
 * applies — so there is no second launch code path and nothing to keep in sync.
 * An unrecognised issuer falls back to the default, which keeps every existing
 * mock launch working unchanged.
 *
 * ── Where the values live, and why not an env var ──────────────────────────
 *
 * The registrations moved OUT of this file on 2026-09-18, into
 * `../config/smart-registrations.json`. They are configuration — a fact about
 * one deployment, replaced wholesale by anyone who deploys SPiER themselves —
 * and leaving them inline meant an open-source adopter inherited SPiER's own
 * Medplum registration and got a confusing `/authorize` failure rather than an
 * obvious file to edit.
 *
 * ⚠️ **It is a checked-in JSON file and deliberately NOT an environment
 * variable**, which is the property that had to survive the move. A build-time
 * variable lets the deployed app and the EHR's actual registration disagree, and
 * that disagreement is invisible until a launch fails at someone else's
 * authorization server. A file in the repo is one place, reviewable in a diff,
 * and — the part that actually closes the loop —
 * `scripts/medplum-register-launch.mjs` READS THIS FILE rather than restating a
 * UUID, so the registration it writes and the client_id the app presents cannot
 * drift apart.
 *
 * ⚠️ **A `client_id` is not a secret.** It travels in the `/authorize` query
 * string in the clear, and this is a public client: no secret, PKCE, exactly as
 * `SmartLaunch` already configures. Checking the file in is not an exposure; the
 * reason to replace it is that it is not *yours*, not that it is sensitive.
 *
 * ⚠️ Medplum's `launchIdentifierSystems` is deliberately UNSET, and that belongs
 * with the registration rather than here — see the header of
 * `scripts/medplum-register-launch.mjs`, which refuses to run if something has
 * set it. It looks like exactly what SPiER wants (the token's patient context
 * would carry `patient-011` instead of Medplum's UUID) and is backwards:
 * `SmartDataSource` puts `client.patient.id` straight into `?patient=<id>`, and
 * Medplum resolves only UUIDs, so every chart search would return nothing behind
 * a launch that looked perfect.
 */
import registrations from '../config/smart-registrations.json'

/** The registration used when an issuer is unknown — SPiER's own mock EHR. */
export const DEFAULT_CLIENT_ID: string = registrations.default

/**
 * Registrations by issuer ORIGIN. Keyed on origin rather than the full `iss`
 * because a server's FHIR base carries a path (`https://api.medplum.com/fhir/R4`)
 * that is not part of its identity as a registrar, and matching the whole string
 * would miss a launch from the same server at a different base.
 */
const CLIENT_IDS: Readonly<Record<string, string>> = registrations.byIssuerOrigin

/**
 * The `client_id` to present for a launch from `iss`.
 *
 * A malformed `iss` is treated as unknown rather than thrown on: the launch is
 * about to fail on that URL anyway, and failing here would replace the server's
 * own diagnostic with a stack trace from the app.
 */
export function clientIdForIssuer(iss: string | null | undefined): string {
  if (!iss) return DEFAULT_CLIENT_ID
  let origin: string
  try {
    origin = new URL(iss).origin
  } catch {
    return DEFAULT_CLIENT_ID
  }
  return CLIENT_IDS[origin] ?? DEFAULT_CLIENT_ID
}
