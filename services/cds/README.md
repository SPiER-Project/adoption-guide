# The CDS Hooks Worker

One Cloudflare Worker (`spier-cds`) publishing SPiER's **CDS Hooks 2.0 service**
at `/cds-services/*` — a [Hono](https://hono.dev) app. Every response is JSON.
Nothing is persisted.

⚠️ **It serves nothing else.** No SPA, no Static Assets binding, no `/ig/`. A
request for anything other than a `/cds-services` route gets a 404, which is the
right answer for a request that has wandered to the wrong origin.

## Why it is its own Worker (2026-09-20)

This lived inside the adoption-guide Worker until now, and the recorded position
was that splitting it out "only becomes worth it when a real adopter needs the
endpoint URL". What changed is the framing: **the IG, the Adoption Guide and the
clinical product demonstration are three separate offerings**, and the CDS
service is a fourth thing SPiER *publishes*. Its URL is an integration contract
an adopter configures inside their own EHR — not a path on the host that happens
to serve a documentation site and ~4,000 rendered IG files.

Two concrete smells the move fixed:

- `CDS_JWT_AUDIENCE` was pinned to the *adoption-guide* Worker's URL. A service's
  audience is its own identity; pointing it at whatever site hosts it is how that
  value goes stale unnoticed. It is this Worker's own URL now.
- Every guide deploy redeployed the endpoint, and vice versa.

⚠️ **Not folded into [`services/clinical`](../clinical/README.md), deliberately.**
That Worker is the one a real EHR frames, and it carries a *negative* test that
it hosts no `/cds-services` — "someone copies a route across for parity" is the
failure being guarded. [`services/guide`](../guide/README.md) carries the same
negative test now. A clinician-facing SMART surface and a machine-facing API have
different audiences, different auth and different URLs.

## Routes

| Method + path | Purpose |
| --- | --- |
| `GET /cds-services` | CDS Hooks discovery — advertises `spier-patient-view`. Open: clients fetch it before they have a token. |
| `POST /cds-services/spier-patient-view` | `patient-view` invocation → `{ cards: [...] }`. |
| `POST /cds-services/spier-patient-view/feedback` | Feedback — accepted (200), not stored. |

CORS is wide open on these routes: the CDS Hooks Sandbox, EHR test tools and the
guide's CDS Service page all call them cross-origin. ⚠️ That last one became
cross-origin at this split — the header was always `*` for the sandbox's benefit,
which makes it load-bearing now rather than incidental.

### How CDS cards are derived

- **Live path** — when the CDS client includes the patient's completed
  `QuestionnaireResponse`s in `prefetch`, they run through the app's observation
  mappers to produce risk alerts + a pathway stage. Behaves like a connected EHR:
  no curated narrative fallback.
- **Fallback path** — no prefetch → the bundled population scenario for
  `context.patientId` (`patient-001` … `patient-011`), including that patient's
  curated `recommendedNextStep`. Unknown ids return `{ cards: [] }`.

## ⚠️ `SMART_LAUNCH_URL` is required

Where a card's `type: "smart"` link launches. The invoke route returns **500**
without it rather than falling back to this Worker's own origin, which serves no
app at all.

It used to be derived from the request URL, justified by "one Worker serves the
SPA and this API, so the origin that reached us *is* the app's origin". The
`apps/` split (#552) made that false and **nothing noticed**: the cards' intents
target `/patient/assessments/*`, which exist only in `apps/clinical` — the guide
app has no `/patient` route at all — so every card's SMART launch had been
pointing at an origin that could not route it.

A test asserted the old behaviour and kept passing throughout, because it checked
the link equalled the *request* origin (still true) and never that the origin
could route the launch. `src/app.test.ts` now pins the configured value and
asserts it is **not** the request origin.

## Bearer-token authentication

Per CDS Hooks 2.0 a CDS Client SHALL send `Authorization: Bearer <JWT>` on each
service call. `src/auth.ts` (`cdsJwt()` middleware, backed by
[`jose`](https://github.com/panva/jose) on Web Crypto) validates it on the
**invoke** and **feedback** routes. **Discovery (`GET /cds-services`) stays open**
— clients fetch it before they have a token.

On a valid token the middleware verifies the signature and the registered claims
(`aud` must equal this service's invoke URL, optional `iss` allowlist, `exp`/`iat`
with 60 s clock tolerance) and stashes the claims on the Hono context. `jti` gets
a **best-effort** in-isolate replay check — true one-time-use needs shared state
(KV / Durable Object) and is documented as a follow-up.

### Policy (`wrangler.jsonc` `vars`, overridable by secrets)

| Var | Meaning |
| --- | --- |
| `CDS_JWT_ENFORCE` | `off` (skip), `warn` (verify, log failures, never block), or `require` (401 on any failure — **what is deployed**). |
| `CDS_JWT_AUDIENCE` | Accepted `aud` — this service's canonical invoke URL(s), comma-separated. |
| `CDS_JWT_TRUSTED_ISSUERS` | Optional comma-separated allowlist of accepted `iss` values. |
| `CDS_JWT_JWKS_URL` | Fixed JWK Set URL used when a token carries no `jku` header. |
| `CDS_JWT_JKU_ALLOWED_HOSTS` | Comma-separated hosts a token's `jku` header may point at (see SSRF note). |
| `CDS_JWT_BOUND_JWKS_HOST` | The one host whose key set is fetched through the `CLIENT` binding instead of over the network (see below). |

Secrets (e.g. a JWKS URL you'd rather not commit) go via
`wrangler secret put CDS_JWT_JWKS_URL` and override the `vars` value.

### `jku` is an SSRF vector — it is allowlisted, never blindly fetched

A JWT's `jku` (JWK Set URL) header is **client-controlled**. Fetching it naively
would let any caller make the Worker issue an outbound request to a URL of their
choice. This service refuses a `jku` whose host is not in
`CDS_JWT_JKU_ALLOWED_HOSTS` **before any network call**; leave that var blank to
ignore `jku` entirely and rely on `CDS_JWT_JWKS_URL` / registered issuers.

### The demo client's key set arrives over a binding, not the network

⚠️ **Both demo Workers are on one zone, and Cloudflare refuses a same-zone
Worker subrequest.** `services/mock-ehr` binds this service as `CDS` so its
invoke can arrive (#581). Verifying the token that invoke carries is a
subrequest in the *other* direction — the host signs with a key it publishes at
its own `/.well-known/jwks.json` and names in the token's `jku` — and was
refused identically. The symptom moved rather than cleared: `error code: 1042`
became jose's `Expected 200 OK from the JSON Web Key Set HTTP response`, a 401
one hop further along, on a URL that returns 200 to every other client.

So this service binds the host back as `CLIENT`, and fetches
`CDS_JWT_BOUND_JWKS_HOST`'s key set through it.

⚠️ **One host, not the allowlist, and the distinction is load-bearing.** A
service binding ignores the URL's host when it routes: everything handed to it
arrives at the bound Worker. Sending every allowlisted `jku` through the binding
would mean a token naming allowlisted host B got its keys from bound host A, and
the signature would verify against the wrong client's key.
`CDS_JWT_JKU_ALLOWED_HOSTS` remains the only answer to *who is trusted*; this
var only decides *how one of them is reached*.

⚠️ **An adopter's EHR needs none of this.** A client on any other zone is an
ordinary `fetch`, which is the default path and the one every deployment other
than this demo takes.

### `warn` → `require`, and the client that made it possible

This ran in `warn` from #147 until 2026-09-20.

⚠️ **An endpoint in `warn` with no caller that can sign is not authenticated.**
`warn` verifies, logs the failure and then calls `next()` — so every property
this section describes was being computed and thrown away. What was actually
deployed was an open compute endpoint with a log line, reachable by any
unauthenticated POST from any origin. The rollout note that used to sit here
described `warn` as a staging step for confirming that "real callers present
valid tokens", which was never going to happen: the only caller was a browser,
and a browser cannot hold a signing key.

The fix was to build the missing half. `services/mock-ehr` is now a real **CDS
Client** (`src/cdsClient.ts`):

- it holds an **ES384** (P-384 + SHA-384) keypair, generated on first use and
  kept in its `DemoStore` Durable Object — per-isolate keys would mean the
  isolate serving the JWK Set publishing a key the signing isolate does not
  hold, rejecting valid tokens intermittently and never locally;
- it publishes the public half at **`/.well-known/jwks.json`**;
- its chart page calls this service **through the host** (`POST /_admin/cds`)
  rather than from the browser. That is what CDS Hooks describes — the EHR
  invokes the service — and it is the only arrangement in which the signature
  proves anything, since a browser that could sign would be a browser holding
  the host's private key.

The deployed policy registers exactly that client: `CDS_JWT_TRUSTED_ISSUERS` is
the host's origin, `CDS_JWT_JWKS_URL` its key set, and
`CDS_JWT_JKU_ALLOWED_HOSTS` its host — non-blank, which puts the SSRF guard on
the live path rather than only under test.

⚠️ **Two things stop working, and both are correct.** The CDS Hooks Sandbox
cannot invoke (it signs nothing), and a tokenless `curl` gets a 401. The guide
page says so; its invoke example carries an `Authorization` header now.

### The test that makes `require` safe to deploy

`src/cdsClientInterop.test.ts`. ⚠️ **Neither service can carry it alone, and
that is the point.** `auth.test.ts` proves this service rejects what it should,
but mints its own tokens with `jose` — so it proves the verifier against a
*hypothetical* client. The mock EHR's tests prove it emits a well-formed JWS but
cannot verify one. Two green suites either side of an interface neither crosses
is exactly the shape that ships a 401, and `warn` would have hidden it: the
cards would still have rendered.

So that file imports the **real** minting code out of `services/mock-ehr` (a
relative import across the two trees — there is no shared package, and inventing
one for two functions would be the heavier mistake) and runs its output through
the **real** middleware on the **real** route under the **deployed** policy.
Five defects were planted and watched go red before it was trusted: a SHA-256
digest under an `ES384` header, a P-256 curve under the same, publishing the
private JWK, `aud` set to the service origin instead of the invoke URL, and a
constant `jti`.

⚠️ The private-JWK plant passed the first time. An EC private JWK carries the
same `x`/`y` as the public one plus `d`, so the signature still verifies and
every behavioural test stays green — the only observable difference is a field
nothing was looking at. `cdsClient.test.ts` asserts it explicitly now.

### Local development

`wrangler.jsonc` deploys `require`, so `npm run dev` enforces it and a plain
`curl` gets a 401 — correct, and inconvenient when you are poking at card
derivation. Set `CDS_JWT_ENFORCE=off` in a local override for that; do not
commit it.

## Build & run

The Worker bundles app source from `packages/core`, whose catalog and scenario
loaders use Vite's `import.meta.glob` — so `src/index.ts` is **Vite-bundled** to
`dist/index.js` (globs + generated FHIR JSON inlined at build time). There is no
SPA build and no asset staging here.

```bash
# One-time on a fresh checkout: install the root deps (SUSHI lives there).
npm --prefix ../.. install

npm install          # this package's deps
npm run build        # vite build → dist/index.js
npm run dev          # build, then `wrangler dev` (workerd) on :8790
npm run typecheck    # tsc --noEmit
npm test             # vitest — card derivation + API routing + CORS + auth
npm run verify       # copy-fhir + typecheck + lint + check:csp + test
```

### Try it locally

```bash
npm run dev   # http://localhost:8790

# Discovery is open.
curl -s localhost:8790/cds-services | jq

# Invoke is NOT. This returns 401 against the committed config — see
# "Local development" above for the override.
curl -s -X POST localhost:8790/cds-services/spier-patient-view \
  -H 'Content-Type: application/json' \
  -d '{"hook":"patient-view","hookInstance":"1","context":{"patientId":"patient-006"}}' | jq
```

## Deploy (Cloudflare Workers)

`wrangler.jsonc` targets one Worker (`spier-cds`) with **no** Static Assets
binding. After `wrangler login`:

```bash
npm run deploy       # build + wrangler deploy
```

CI deploys it from `deploy.yml`'s `cds` job on every push to `main`.
