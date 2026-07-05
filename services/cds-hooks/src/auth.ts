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
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose'
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

function remoteJwks(url: string): ReturnType<typeof createRemoteJWKSet> {
  let set = jwksByUrl.get(url)
  if (!set) {
    set = createRemoteJWKSet(new URL(url))
    jwksByUrl.set(url, set)
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
    return remoteJwks(jku)
  }

  if (env.CDS_JWT_JWKS_URL) return remoteJwks(env.CDS_JWT_JWKS_URL)
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
