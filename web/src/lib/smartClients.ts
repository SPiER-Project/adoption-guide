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
 * An unrecognised issuer falls back to `spier-client`, which keeps every
 * existing mock launch working unchanged.
 *
 * ⚠️ **A `client_id` is not a secret.** It travels in the `/authorize` query
 * string in the clear, and this is a public client: no secret, PKCE, exactly as
 * `SmartLaunch` already configures. Putting the value here rather than in an
 * env var is deliberate — a build-time variable would let the deployed app and
 * this table disagree, which is the failure this file exists to prevent.
 */

/** The registration used when an issuer is unknown — SPiER's own mock EHR. */
export const DEFAULT_CLIENT_ID = 'spier-client'

/**
 * Registrations by issuer ORIGIN. Keyed on origin rather than the full `iss`
 * because a server's FHIR base carries a path (`https://api.medplum.com/fhir/R4`)
 * that is not part of its identity as a registrar, and matching the whole string
 * would miss a launch from the same server at a different base.
 */
const CLIENT_IDS: Readonly<Record<string, string>> = {
  // Medplum hosted — ClientApplication "SPiER SMART App" in the
  // "SPiER Adoption Guide" project. Public client, PKCE, redirect registered
  // for both localhost:5173 and the workers.dev deploy.
  //
  // ⚠️ Its `launchIdentifierSystems` is deliberately UNSET. That setting makes
  // the token's patient context carry OUR identifier (`patient-011`) instead of
  // Medplum's UUID, which sounds like exactly what SPiER wants and is backwards:
  // `SmartDataSource` puts `client.patient.id` straight into
  // `?patient=<id>`, and Medplum resolves only UUIDs — so every chart search
  // would return nothing against a launch that otherwise looked perfect. The
  // identifier's job is finding the patient to launch, not addressing them.
  'https://api.medplum.com': '29f945f9-1dd8-413c-a321-398755d91b90',
}

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
