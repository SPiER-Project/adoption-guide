/**
 * smart — the SMART on FHIR authorization stub: discovery, `/authorize`,
 * `/token`, and the bearer check the FHIR API applies.
 *
 * This is panel step 2. Step 1's read API was deliberately open; this is what
 * puts a real EHR launch in front of it.
 *
 * ── What is verified, and why it is not optional ────────────────────────────
 * The panel plan is blunt that "a stub that ignores PKCE is exactly the
 * shortcut that makes the demo prove nothing", so:
 *
 *   - `code_challenge` + `code_challenge_method=S256` are **required** on
 *     `/authorize`, and the verifier is checked with real SHA-256 at `/token`.
 *   - `redirect_uri` must match a registered URI **exactly**, and a bad one is
 *     never redirected to — that is the open-redirect rule, and getting it
 *     wrong is the classic OAuth stub bug.
 *   - `aud` must be this server's FHIR base. SMART requires the app to name the
 *     server it thinks it is talking to; not checking it makes the parameter
 *     decorative.
 *   - the access token is bound to ONE patient, and a request for another
 *     patient's data is a 403. A token that reads every patient would make
 *     "patient-scoped" a claim this server does not actually support.
 *
 * ⚠️ **PKCE can be skipped by omission, not just by laziness.** fhirclient only
 * sends a challenge when discovery advertises
 * `code_challenge_methods_supported: ["S256"]` (see `shouldIncludeChallenge` in
 * fhirclient's smart.js). Drop that array from the discovery document and the
 * client stops sending PKCE, this server stops requiring what it never
 * receives, and the demo quietly proves less while everything still works. The
 * discovery document and the `/authorize` requirement are two halves of one
 * decision — `smart.test.ts` asserts both.
 *
 * ── What this stub deliberately does NOT do ─────────────────────────────────
 *   - **No `id_token`.** `openid fhirUser` is requested by the app and not
 *     honoured here. A real one needs a signing key and a published JWKS; a
 *     fake one is precisely the shortcut named above. `client.user` is
 *     therefore null, which is honest and harmless.
 *   - **No scope enforcement.** The granted scopes are echoed and carried on
 *     the token, but this server does not refuse a read because a scope was
 *     missing. Do not describe the mock as proving SMART scopes work. The
 *     patient binding above IS enforced; that is a different thing.
 *   - **No refresh tokens, no `offline_access`.**
 */
import { s256, sign, spend, verify } from './tokens'

export interface SmartEnv {
  /** HMAC secret for launch contexts, codes and tokens. Not a security control. */
  MOCK_SIGNING_SECRET?: string
  /** `require` (default) or `off` — whether /fhir demands a bearer token. */
  MOCK_AUTH_ENFORCE?: string
  /** Comma-separated exact redirect URIs, replacing the defaults below. */
  MOCK_REDIRECT_URIS?: string
  /** Comma-separated client ids. Default: the app's own. */
  MOCK_CLIENT_IDS?: string
}

/**
 * Registered redirect URIs. The app computes its own as
 * `import.meta.env.BASE_URL` resolved against its origin, so the two hosted
 * forms differ by path: `/` on the Worker, `/adoption-guide/` on GitHub Pages.
 * Localhost entries are the Vite dev server.
 */
const DEFAULT_REDIRECT_URIS = [
  'https://spier-adoption-guide.bbthorson.workers.dev/',
  'https://spier-project.github.io/adoption-guide/',
  'http://localhost:5173/',
  'http://localhost:4173/',
]

/** The app's client id, from web/src/components/SmartLaunch.tsx. */
const DEFAULT_CLIENT_IDS = ['spier-client']

const CODE_TTL_SECONDS = 60
const TOKEN_TTL_SECONDS = 60 * 60

function list(value: string | undefined, fallback: string[]): string[] {
  const parsed = (value ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return parsed.length ? parsed : fallback
}

function secretOf(env: SmartEnv): string | undefined {
  return env.MOCK_SIGNING_SECRET || undefined
}

/** Whether /fhir requires a bearer token. Anything but `off` means require. */
export function authRequired(env: SmartEnv): boolean {
  return (env.MOCK_AUTH_ENFORCE ?? 'require') !== 'off'
}

// ── Launch context ───────────────────────────────────────────────────────────

export interface LaunchContext {
  patient: string
  /** SMART `intent` — the spec-blessed carrier for "open C-SSRS Full". */
  intent?: string
  /** `false` tells the panel the host already draws a patient banner. */
  needPatientBanner?: boolean
  exp: number
}

/** Mint the opaque `launch` value an EHR hands the app. Valid for 10 minutes. */
export function mintLaunch(
  context: Omit<LaunchContext, 'exp'>,
  env: SmartEnv,
  now = Date.now(),
): Promise<string> {
  return sign({ ...context, exp: Math.floor(now / 1000) + 600 }, secretOf(env))
}

// ── Discovery ────────────────────────────────────────────────────────────────

export function smartConfiguration(origin: string): Record<string, unknown> {
  return {
    issuer: `${origin}/fhir`,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    token_endpoint_auth_methods_supported: ['none'],
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    // ⚠️ Load-bearing — see the header. Removing this stops the client sending
    // PKCE at all, and nothing else goes red.
    code_challenge_methods_supported: ['S256'],
    scopes_supported: [
      'launch', 'openid', 'fhirUser',
      'patient/Patient.read',
      'patient/QuestionnaireResponse.read', 'patient/QuestionnaireResponse.write',
      'patient/Observation.read', 'patient/Observation.write',
      'patient/CarePlan.read', 'patient/CarePlan.write',
      'patient/Communication.read', 'patient/Communication.write',
      'patient/DocumentReference.write', 'patient/Condition.write',
    ],
    capabilities: [
      'launch-ehr',
      'client-public',
      'context-ehr-patient',
      'permission-patient',
    ],
  }
}

// ── /authorize ───────────────────────────────────────────────────────────────

interface AuthCode extends LaunchContext {
  scope: string
  clientId: string
  redirectUri: string
  challenge: string
  jti: string
}

export type AuthorizeResult =
  /** Redirect the browser here (success, or an OAuth error the app can read). */
  | { kind: 'redirect'; location: string }
  /**
   * Refuse without redirecting. Only for an untrustworthy `redirect_uri` or
   * `client_id`: bouncing an error to an unregistered URI is the open-redirect
   * bug this exists to avoid.
   */
  | { kind: 'refuse'; status: 400; error: string; description: string }

export async function authorize(
  params: URLSearchParams,
  env: SmartEnv,
  fhirBase: string,
  now = Date.now(),
): Promise<AuthorizeResult> {
  const get = (name: string) => params.get(name) ?? ''
  const state = get('state')
  const redirectUri = get('redirect_uri')
  const clientId = get('client_id')

  // Trust the redirect target BEFORE anything is sent to it.
  if (!list(env.MOCK_CLIENT_IDS, DEFAULT_CLIENT_IDS).includes(clientId)) {
    return {
      kind: 'refuse', status: 400, error: 'invalid_client',
      description: `Unregistered client_id '${clientId}'.`,
    }
  }
  if (!list(env.MOCK_REDIRECT_URIS, DEFAULT_REDIRECT_URIS).includes(redirectUri)) {
    return {
      kind: 'refuse', status: 400, error: 'invalid_request',
      description:
        `redirect_uri '${redirectUri}' is not registered for this client. Exact match is required; `
        + 'this server will not redirect an error to an unregistered URI.',
    }
  }

  const fail = (error: string, description: string): AuthorizeResult => {
    const url = new URL(redirectUri)
    url.searchParams.set('error', error)
    url.searchParams.set('error_description', description)
    if (state) url.searchParams.set('state', state)
    return { kind: 'redirect', location: url.toString() }
  }

  if (get('response_type') !== 'code') {
    return fail('unsupported_response_type', 'Only response_type=code is supported.')
  }
  // `aud` is the app naming the server it believes it is talking to.
  const aud = get('aud').replace(/\/+$/, '')
  if (aud !== fhirBase.replace(/\/+$/, '')) {
    return fail('invalid_request', `aud '${get('aud')}' does not match this server's FHIR base '${fhirBase}'.`)
  }
  const challenge = get('code_challenge')
  if (!challenge || get('code_challenge_method') !== 'S256') {
    return fail(
      'invalid_request',
      'PKCE is required: send code_challenge with code_challenge_method=S256. '
      + '(If the client did not send one, check that discovery still advertises '
      + 'code_challenge_methods_supported.)',
    )
  }

  // Resolve the launch context. `launch` is the EHR-launch path; `patient` is
  // the standalone shortcut for testing before host chrome exists (step 5).
  let context: Omit<LaunchContext, 'exp'> | null = null
  const launch = get('launch')
  if (launch) {
    const decoded = await verify<LaunchContext>(launch, secretOf(env), now)
    if (!decoded) return fail('invalid_request', 'The launch context is unknown or expired.')
    context = { patient: decoded.patient, intent: decoded.intent, needPatientBanner: decoded.needPatientBanner }
  } else if (get('patient')) {
    context = { patient: get('patient') }
  }
  if (!context) {
    return fail('invalid_request', 'No launch context: pass `launch` (EHR launch) or `patient` (standalone testing).')
  }

  // No consent screen: this auto-approves. Whether the mock should show one is
  // an open question in the handoff, and shipping one silently would answer it.
  const code = await sign(
    {
      ...context,
      scope: get('scope'),
      clientId,
      redirectUri,
      challenge,
      jti: crypto.randomUUID(),
      exp: Math.floor(now / 1000) + CODE_TTL_SECONDS,
    } satisfies AuthCode,
    secretOf(env),
  )

  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  if (state) url.searchParams.set('state', state)
  return { kind: 'redirect', location: url.toString() }
}

// ── /token ───────────────────────────────────────────────────────────────────

export type TokenResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string; description: string }

export async function token(
  form: URLSearchParams,
  env: SmartEnv,
  now = Date.now(),
): Promise<TokenResult> {
  const get = (name: string) => form.get(name) ?? ''
  const bad = (description: string, error = 'invalid_grant'): TokenResult =>
    ({ ok: false, status: 400, error, description })

  if (get('grant_type') !== 'authorization_code') {
    return bad('Only grant_type=authorization_code is supported.', 'unsupported_grant_type')
  }
  const code = await verify<AuthCode>(get('code'), secretOf(env), now)
  if (!code) return bad('The authorization code is invalid or expired.')
  if (!spend(code.jti)) return bad('This authorization code has already been redeemed.')
  if (get('redirect_uri') !== code.redirectUri) {
    return bad('redirect_uri does not match the one used at /authorize.')
  }
  if (get('client_id') !== code.clientId) {
    return bad('client_id does not match the one used at /authorize.')
  }

  const verifier = get('code_verifier')
  if (!verifier) return bad('Missing code_verifier — PKCE is required.')
  if (await s256(verifier) !== code.challenge) {
    return bad('code_verifier does not match the code_challenge from /authorize.')
  }

  const accessToken = await sign(
    { patient: code.patient, scope: code.scope, exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS },
    secretOf(env),
  )
  return {
    ok: true,
    body: {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      scope: code.scope,
      patient: code.patient,
      // Both are SMART launch-context parameters the panel reads off
      // `client.state.tokenResponse`; omitted when the launch did not set them.
      ...(code.needPatientBanner === undefined ? {} : { need_patient_banner: code.needPatientBanner }),
      ...(code.intent ? { intent: code.intent } : {}),
    },
  }
}

// ── Bearer check ─────────────────────────────────────────────────────────────

export interface Grant { patient: string; scope: string }

/** Decode a `Authorization: Bearer …` header, or null if it does not verify. */
export async function grantFor(
  authorization: string | undefined,
  env: SmartEnv,
  now = Date.now(),
): Promise<Grant | null> {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '')
  if (!match) return null
  return verify<Grant & { exp: number }>(match[1], secretOf(env), now)
}
