/**
 * CDS Hooks bearer-JWT validation.
 *
 * Per CDS Hooks 2.0 a CDS Client SHALL send `Authorization: Bearer <JWT>` on
 * every service call, and the service SHOULD verify the signature + registered
 * claims (`aud` = this service's invoke URL, `iss`, `exp`, `iat`, and a
 * best-effort `jti` replay guard). Discovery (`GET /cds-services`) stays open —
 * this middleware guards invoke + feedback only.
 *
 * Runtime is Cloudflare Workers: Web Crypto (`crypto.subtle`) only, no Node
 * `crypto`. `jose` runs on Web Crypto, so it works here and in the Node test env.
 *
 * SECURITY — the JWT's `jku` (JWK Set URL) header is client-controlled and is a
 * classic SSRF vector: a naive implementation would `fetch` whatever URL the
 * caller puts there, from inside the Worker. We NEVER fetch an arbitrary `jku`:
 * its host must be in `CDS_JWT_JKU_ALLOWED_HOSTS`, otherwise the token is
 * rejected *before any network call*. When no `jku` is present we fall back to
 * the operator-configured `CDS_JWT_JWKS_URL`.
 *
 * Spec: https://cds-hooks.org/specification/current/#trusting-cds-clients
 */
import { createRemoteJWKSet, customFetch, decodeProtectedHeader, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import type { MiddlewareHandler } from 'hono'

/** Enforcement policy for the bearer token. */
export type CdsJwtEnforce = 'off' | 'warn' | 'require'

/**
 * JWT-policy configuration, supplied via `wrangler.jsonc` `vars` (and/or
 * secrets). All optional — an unset/blank field means "not configured".
 */
export interface CdsJwtEnv {
  /**
   * `off` skips validation entirely; `warn` verifies but only logs failures
   * (never blocks — the rollout default); `require` returns 401 on any failure.
   * Anything unrecognized is treated as `warn`.
   */
  CDS_JWT_ENFORCE?: string
  /**
   * Accepted `aud` value(s) — this service's canonical invoke URL(s),
   * comma-separated. A token whose `aud` matches none is rejected.
   */
  CDS_JWT_AUDIENCE?: string
  /** Optional comma-separated allowlist of accepted `iss` values. */
  CDS_JWT_TRUSTED_ISSUERS?: string
  /** Fixed JWK Set URL used when a token carries no `jku` header. */
  CDS_JWT_JWKS_URL?: string
  /**
   * Comma-separated allowlist of hosts a token's `jku` header may point at.
   * A `jku` whose host is absent here is rejected WITHOUT being fetched (SSRF
   * guard). Leave unset to ignore `jku` entirely and use `CDS_JWT_JWKS_URL`.
   */
  CDS_JWT_JKU_ALLOWED_HOSTS?: string
  /**
   * The ONE host whose key set is fetched through the `CLIENT` service binding
   * rather than over the network. See `CLIENT` below for why that is needed at
   * all, and `boundFetchFor` for why it is a single host and not the allowlist.
   */
  CDS_JWT_BOUND_JWKS_HOST?: string
  /**
   * The demo host (`services/mock-ehr`), bound Worker-to-Worker.
   *
   * ⚠️ **Not a convenience — a plain `fetch()` to its JWKS CANNOT work from this
   * Worker**, and this is the return leg of the bug #581 fixed outbound. Both
   * Workers live on `*.bbthorson.workers.dev`, one zone, and Cloudflare refuses
   * a same-zone Worker subrequest. #581 bound this service INTO the host so the
   * invoke could arrive; the host's token carries `jku` pointing back at its own
   * `/.well-known/jwks.json`, and verifying it is a subrequest in the other
   * direction — refused identically. The invoke stopped failing with
   * `error code: 1042` and started failing with jose's "Expected 200 OK from the
   * JSON Web Key Set HTTP response", one hop later.
   *
   * ⚠️ **An adopter's EHR needs no binding.** A client on any other zone is an
   * ordinary `fetch`, which is the path every line below still takes by default.
   * This exists because the demo's client and service happen to be two Workers
   * on one account.
   *
   * Optional: the unit tests pass no binding and take the `fetch` path.
   */
  CLIENT?: { fetch: typeof fetch }
}

/** Hono context variables set by this middleware. */
export interface CdsJwtVariables {
  /** Verified JWT claims, available to downstream handlers on success. */
  cdsClaims?: JWTPayload
}

/** Clock-skew tolerance for `exp`/`iat`/`nbf` checks. */
const CLOCK_TOLERANCE = '60s'

/**
 * Cache of remote JWK Sets keyed by URL. `createRemoteJWKSet` caches keys
 * internally and re-fetches on an unknown `kid` (rotation), so we reuse one
 * resolver per URL for the isolate's lifetime rather than re-creating it per
 * request.
 */
const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/**
 * The fetch this key set is retrieved with: the service binding for the one
 * bound host, a plain `fetch` for everyone else.
 *
 * ⚠️ **One host, named by its own var — deliberately NOT "any allowlisted
 * host".** A service binding ignores the URL's host when it routes: whatever
 * URL you hand it, the request arrives at the bound Worker. So sending every
 * allowlisted `jku` through the binding would mean a token naming allowlisted
 * host B silently got its keys from bound host A, and the signature would
 * verify against the wrong client's key. The allowlist stays the security
 * boundary; this only decides the transport, for exactly one host.
 */
function boundFetchFor(url: string, env: CdsJwtEnv): typeof fetch | null {
  const bound = (env.CDS_JWT_BOUND_JWKS_HOST ?? '').trim()
  if (!bound || !env.CLIENT) return null
  try {
    return new URL(url).host === bound ? env.CLIENT.fetch.bind(env.CLIENT) : null
  } catch {
    return null
  }
}

function remoteJwks(url: string, env: CdsJwtEnv): ReturnType<typeof createRemoteJWKSet> {
  const bound = boundFetchFor(url, env)
  // ⚠️ The transport is part of the cache key. The map lives for the isolate's
  // lifetime and the same URL can be resolved both ways — a unit test with no
  // binding and a real request with one — so keying on the URL alone would hand
  // the second caller a resolver wired to the first caller's fetch.
  const key = `${bound ? 'bound' : 'net'} ${url}`
  let set = jwksByUrl.get(key)
  if (!set) {
    // `customFetch` swaps the transport and nothing else: jose keeps its own key
    // cache and its re-fetch on an unknown `kid`, which is the rotation handling
    // a hand-rolled fetch + `createLocalJWKSet` would have had to reimplement.
    set = bound
      ? createRemoteJWKSet(new URL(url), { [customFetch]: bound })
      : createRemoteJWKSet(new URL(url))
    jwksByUrl.set(key, set)
  }
  return set
}

/**
 * Best-effort `jti` replay window. A stateless Worker can't do true one-time-use
 * (that needs shared state — KV / Durable Object); this only catches replays
 * that hit the same isolate before the token expires. Documented as best-effort.
 */
const seenJti = new Map<string, number>()

function isReplay(jti: string, expSeconds: number | undefined): boolean {
  const now = Date.now()
  for (const [id, expiresAt] of seenJti) {
    if (expiresAt <= now) seenJti.delete(id)
  }
  if (seenJti.has(jti)) return true
  const expiresAt = typeof expSeconds === 'number' ? expSeconds * 1000 : now + 60_000
  seenJti.set(jti, expiresAt)
  return false
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function enforceMode(env: CdsJwtEnv): CdsJwtEnforce {
  const mode = (env.CDS_JWT_ENFORCE ?? 'warn').trim().toLowerCase()
  return mode === 'off' || mode === 'require' ? mode : 'warn'
}

/**
 * Resolve the key set to verify `token` against. Throws (rejecting the token)
 * before any network call when a `jku` host is not allowlisted. Returns null
 * when no key source is available at all.
 */
function resolveKeySet(
  token: string,
  env: CdsJwtEnv,
): ReturnType<typeof createRemoteJWKSet> | null {
  const header = decodeProtectedHeader(token) // throws on a malformed token
  const jku = typeof header.jku === 'string' ? header.jku : undefined

  if (jku) {
    let host: string
    try {
      host = new URL(jku).host
    } catch {
      throw new Error('Invalid jku header')
    }
    const allowed = parseList(env.CDS_JWT_JKU_ALLOWED_HOSTS)
    if (!allowed.includes(host)) {
      // SSRF guard: refuse the token instead of fetching an untrusted URL.
      throw new Error(`jku host not allowlisted: ${host}`)
    }
    return remoteJwks(jku, env)
  }

  if (env.CDS_JWT_JWKS_URL) return remoteJwks(env.CDS_JWT_JWKS_URL, env)
  return null
}

/**
 * Hono middleware factory. Reads policy from `c.env` at request time, so it is
 * applied as `cdsJwt()` on the invoke + feedback routes:
 *
 *   app.post(path, cdsJwt(), handler)
 *
 * In `warn` mode a failure is logged (via Workers observability) and the request
 * proceeds; in `require` mode it returns 401.
 */
export function cdsJwt(): MiddlewareHandler {
  return async (c, next) => {
    // Tolerate absent bindings (e.g. unit tests that don't pass an env): treat
    // as empty config, which resolves to the non-blocking `warn` default.
    const env = (c.env ?? {}) as CdsJwtEnv
    const mode = enforceMode(env)
    if (mode === 'off') return next()

    // In `warn` mode any failure logs and continues; in `require` it 401s.
    const reject = (reason: string): Response | Promise<void> => {
      if (mode === 'warn') {
        console.warn(`[cds-jwt] would reject request (enforce=warn): ${reason}`)
        return next()
      }
      console.warn(`[cds-jwt] rejected request (enforce=require): ${reason}`)
      return c.json({ error: reason }, 401)
    }

    const authorization = c.req.header('Authorization')
    const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    if (!bearer) return reject('Missing bearer token')

    let keySet: ReturnType<typeof createRemoteJWKSet> | null
    try {
      keySet = resolveKeySet(bearer, env)
    } catch (error) {
      return reject(error instanceof Error ? error.message : 'Unresolvable signing key')
    }
    if (!keySet) return reject('No verification key configured')

    const audience = parseList(env.CDS_JWT_AUDIENCE)
    const issuers = parseList(env.CDS_JWT_TRUSTED_ISSUERS)
    try {
      const { payload } = await jwtVerify(bearer, keySet, {
        audience: audience.length ? audience : undefined,
        issuer: issuers.length ? issuers : undefined,
        clockTolerance: CLOCK_TOLERANCE,
        requiredClaims: ['exp', 'iat'],
      })
      if (typeof payload.jti === 'string' && isReplay(payload.jti, payload.exp)) {
        return reject('Token replay detected (jti already used)')
      }
      c.set('cdsClaims', payload)
      return next()
    } catch (error) {
      return reject(error instanceof Error ? error.message : 'Token verification failed')
    }
  }
}
