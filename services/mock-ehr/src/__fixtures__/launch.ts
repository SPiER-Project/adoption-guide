/**
 * A real SMART launch, for tests.
 *
 * Deliberately NOT a hand-minted token. Every test that reads `/fhir` now goes
 * through `/authorize` → redirect → `POST /token` with a genuine PKCE verifier,
 * so the auth stub is exercised by the whole suite rather than by the handful
 * of cases that name it. A hand-minted token would let the stub rot while the
 * read tests stayed green — the same shape as a test encoding the wrong
 * assumption and then defending it (#327).
 */
import app from '../app'
import { base64urlEncode, s256 } from '../tokens'

/** A registered redirect URI — see DEFAULT_REDIRECT_URIS in smart.ts. */
export const TEST_REDIRECT_URI = 'http://localhost:5173/'
export const TEST_CLIENT_ID = 'spier-client'
export const TEST_SCOPE = 'launch openid fhirUser patient/Patient.read patient/Observation.read'

export interface LaunchResult {
  accessToken: string
  /** The full token response, so a test can assert the launch context. */
  tokenResponse: Record<string, unknown>
}

function randomVerifier(): string {
  return base64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
}

/**
 * Drive the full authorization-code + PKCE flow and return the access token.
 * `launch` (an opaque minted context) and `patient` (the standalone shortcut)
 * are both supported, mirroring `/authorize`.
 */
export async function launchFor(
  origin: string,
  context: { patient?: string; launch?: string },
): Promise<LaunchResult> {
  const verifier = randomVerifier()
  const challenge = await s256(verifier)

  const authorizeUrl = new URL(`${origin}/authorize`)
  authorizeUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: TEST_CLIENT_ID,
    scope: TEST_SCOPE,
    redirect_uri: TEST_REDIRECT_URI,
    aud: `${origin}/fhir`,
    state: 'test-state',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...(context.launch ? { launch: context.launch } : {}),
    ...(context.patient ? { patient: context.patient } : {}),
  }).toString()

  const authorized = await app.request(authorizeUrl.toString())
  if (authorized.status !== 302) {
    throw new Error(`/authorize did not redirect: HTTP ${authorized.status} ${await authorized.text()}`)
  }
  const location = new URL(authorized.headers.get('location') ?? '')
  const error = location.searchParams.get('error')
  if (error) throw new Error(`/authorize refused: ${error} — ${location.searchParams.get('error_description')}`)
  const code = location.searchParams.get('code')
  if (!code) throw new Error('/authorize redirected without a code')

  const tokenRes = await app.request(`${origin}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: TEST_REDIRECT_URI,
      client_id: TEST_CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  })
  const tokenResponse = await tokenRes.json() as Record<string, unknown>
  if (!tokenRes.ok) throw new Error(`/token failed: ${JSON.stringify(tokenResponse)}`)
  return { accessToken: String(tokenResponse.access_token), tokenResponse }
}

/** Just the header, for the many tests that only need to be let in. */
export async function authHeaderFor(origin: string, patient: string): Promise<Record<string, string>> {
  const { accessToken } = await launchFor(origin, { patient })
  return { authorization: `Bearer ${accessToken}` }
}
