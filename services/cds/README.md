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
| `CDS_JWT_ENFORCE` | `off` (skip), `warn` (verify, log failures, never block — **current default**), or `require` (401 on any failure). |
| `CDS_JWT_AUDIENCE` | Accepted `aud` — this service's canonical invoke URL(s), comma-separated. |
| `CDS_JWT_TRUSTED_ISSUERS` | Optional comma-separated allowlist of accepted `iss` values. |
| `CDS_JWT_JWKS_URL` | Fixed JWK Set URL used when a token carries no `jku` header. |
| `CDS_JWT_JKU_ALLOWED_HOSTS` | Comma-separated hosts a token's `jku` header may point at (see SSRF note). |

Secrets (e.g. a JWKS URL you'd rather not commit) go via
`wrangler secret put CDS_JWT_JWKS_URL` and override the `vars` value.

### `jku` is an SSRF vector — it is allowlisted, never blindly fetched

A JWT's `jku` (JWK Set URL) header is **client-controlled**. Fetching it naively
would let any caller make the Worker issue an outbound request to a URL of their
choice. This service refuses a `jku` whose host is not in
`CDS_JWT_JKU_ALLOWED_HOSTS` **before any network call**; leave that var blank to
ignore `jku` entirely and rely on `CDS_JWT_JWKS_URL` / registered issuers.

### Rollout: `warn` → `require`

Shipping in `warn` first: failures are logged via Workers observability without
blocking, so we can confirm real callers present valid tokens before flipping to
`require`. **The in-app demo / SMART path calls the service without a JWT**, so it
must be handled before `require`: either exempt it (it is same-origin — a future
option is to skip enforcement for same-origin requests) or have the SPA mint a
dev token. Until then, keep `warn` and keep discovery open.

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
curl -s localhost:8790/cds-services | jq
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
