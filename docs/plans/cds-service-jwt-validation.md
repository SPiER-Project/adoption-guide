# Plan: JWT validation on the CDS Hooks service

## Current state

`services/cds-hooks/` is a Hono app on Cloudflare Workers (one Worker also serves
the SPA via the `ASSETS` binding). Endpoints:

- `GET /cds-services` — discovery (`src/index.ts:48`)
- `POST /cds-services/spier-patient-view` — invoke (`src/index.ts:54`)
- `POST /cds-services/spier-patient-view/feedback` (`src/index.ts:68`)

**No auth exists.** `Authorization` is in the CORS `allowHeaders` list
(`src/index.ts:39`) but is **never read**. No JWT library is installed (deps:
only `hono`). `wrangler.jsonc` has no secrets/env bindings beyond `ASSETS`.

## What the CDS Hooks spec requires

Per CDS Hooks 2.0, a CDS Client SHALL send `Authorization: Bearer <JWT>` on each
service call. The service SHOULD validate it:

- **Signature** — verify against the client's public key. Discovery is via the
  JWT's `jku` (JWK Set URL) header or a pre-registered key; algorithm from `alg`
  (typically RS384 per the CDS Hooks crypto guidance, though RS256/ES384 appear).
- **Registered claims** — `iss` (client's issuer/FHIR base), `aud` (must equal
  **this service's** invoke URL), `exp`, `iat`, `jti` (one-time-use / replay
  guard). `sub` optional.
- Discovery (`GET /cds-services`) is typically **unauthenticated** — validate only
  on invoke (and feedback).

## Constraints

- Cloudflare Workers: **Web Crypto (`crypto.subtle`) available; no Node `crypto`.**
  Pick a Workers-compatible library.
- Fetching a `jku` JWKS at request time means an outbound `fetch` per cold key —
  cache it (module-scope map, or a KV binding) with a TTL.

## Library choice

Recommend **`jose`** — pure Web Crypto, Workers-friendly, handles JWKS fetching
+ caching (`createRemoteJWKSet`) and claim validation (`jwtVerify` with
`audience`/`issuer`/`clockTolerance`). Alternative: `@hono/jwt` middleware (lighter
but HS-focused and less turnkey for remote JWKS/RS384). Go with `jose`.

## Design

### 1. Config via wrangler + secrets

Add to `wrangler.jsonc` a `vars` block and/or secrets for policy:

- `CDS_JWT_ENFORCE` (`"off" | "warn" | "require"`) — start in `warn` so the demo
  and existing callers don't break; flip to `require` later.
- `CDS_JWT_AUDIENCE` — the canonical invoke URL(s) this service accepts as `aud`
  (e.g. `https://spier-adoption-guide.bbthorson.workers.dev/cds-services/spier-patient-view`).
- `CDS_JWT_TRUSTED_ISSUERS` (optional allowlist) and/or
  `CDS_JWT_JWKS_URL` for a fixed key source when a client has no `jku`.

Extend the `Env` interface in `src/index.ts:23`.

### 2. Middleware

New `src/auth.ts` exporting a Hono middleware `cdsJwt(env)`:

```ts
// pseudo
1. If CDS_JWT_ENFORCE === 'off' → next()
2. Read Authorization; missing/!Bearer:
     - 'warn'   → log + next()
     - 'require'→ 401 { error: 'Missing bearer token' }
3. Resolve key set:
     - prefer header 'jku' if it passes an allowlist of hosts (SSRF guard!),
     - else CDS_JWT_JWKS_URL, else a registered issuer→JWKS map.
4. jwtVerify(token, keySet, {
     audience: CDS_JWT_AUDIENCE,
     issuer: allowlist (if configured),
     clockTolerance: '60s',
   })
5. Enforce jti replay window (best-effort; see Risks).
6. On failure: 'warn' → log + next(); 'require' → 401.
7. Stash verified claims on c.set('cdsClaims', payload) for downstream use.
```

Apply it to the invoke + feedback routes only (not discovery):

```ts
app.post(`/cds-services/${SERVICE_ID}`, cdsJwt(c.env), handler)
app.post(`/cds-services/${SERVICE_ID}/feedback`, cdsJwt(c.env), handler)
```

### 3. SSRF hardening on `jku`

A client-controlled `jku` is an SSRF vector inside the Worker. **Do not fetch
arbitrary URLs.** Require `jku` host ∈ an allowlist (config), or ignore `jku`
entirely and rely on `CDS_JWT_JWKS_URL` / registered issuers. Call this out
explicitly — it's the highest-risk part.

### 4. Rollout: warn → require

Deploy `warn` first (logs would-be rejections via the existing
`observability`), confirm real callers send valid tokens, then set `require`.
The in-app SMART/demo flows call the service with prefetch and may not send a
JWT — keep discovery open and keep `warn` until the demo path is sorted (or have
the SPA mint/accept a dev token).

## Files touched

- `services/cds-hooks/package.json` — add `jose`.
- `services/cds-hooks/src/auth.ts` (new) — the middleware.
- `services/cds-hooks/src/index.ts` — `Env` fields, apply middleware to
  invoke/feedback.
- `services/cds-hooks/wrangler.jsonc` — `vars` (enforce mode, audience, issuer
  allowlist); JWKS host allowlist. Secrets via `wrangler secret put` if any.
- `services/cds-hooks/README.md` — document the auth policy + env vars.

## Tests (`src/app.test.ts` / new `src/auth.test.ts`)

- `enforce=off` → invoke succeeds with no token (back-comp).
- `enforce=require`, no token → 401.
- `enforce=require`, valid signed token (generate a test RSA keypair with `jose`,
  serve a static JWKS) with correct `aud`/`iss`/`exp` → 200 + cards.
- Wrong `aud` → 401. Expired `exp` → 401. Bad signature → 401.
- `enforce=warn`, bad token → 200 (logged, not blocked).
- `jku` pointing at a non-allowlisted host → rejected without fetching.
- Discovery `GET /cds-services` never requires a token.

## Risks

- **`jku` SSRF** — must allowlist or disable (see §3). Top risk.
- **Replay (`jti`)** — true one-time-use needs shared state (KV/Durable Object).
  A stateless Worker can only do a best-effort in-memory window per isolate.
  Document as best-effort; consider a KV binding if strict replay protection is
  required.
- **Breaking existing callers** — the `warn` mode + open discovery mitigate this;
  don't ship `require` until the app/demo path provides a token or is exempted.
- **Clock skew** — allow `clockTolerance`.
- **Key rotation** — `createRemoteJWKSet` handles re-fetch on unknown `kid`;
  ensure caching TTL is sane.
