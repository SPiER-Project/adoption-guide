# SPiER on Cloudflare Workers

**One** Cloudflare Worker that hosts the whole SPiER adoption guide:

- the **adoption-guide SPA**, served from Static Assets (`./web-dist`, the web
  app's `vite build` output at base `/`);
- the **CDS Hooks 2.0 API** at `/cds-services/*` — a [Hono](https://hono.dev) app;
- a transitional **`/ig/*` redirect** to the rendered HL7 IG on GitHub Pages.

App ↔ API calls are same-origin (no CORS needed); external CDS clients calling
`/cds-services` get wide-open CORS. Nothing is persisted.

The CDS cards reuse the app's **browser-free derivation code** — the same
`observationMappers`, `derivePathwayStatus`, and `buildCdsCards` the in-app
Patient Chart uses — so the endpoint and the app emit byte-identical cards.

## Routes

| Method + path | Purpose |
| --- | --- |
| `GET /` (+ any non-API path) | The SPA (Static Assets; SPA fallback for unknown paths). |
| `GET /cds-services` | CDS Hooks discovery — advertises `spier-patient-view`. |
| `POST /cds-services/spier-patient-view` | `patient-view` invocation → `{ cards: [...] }`. |
| `POST /cds-services/spier-patient-view/feedback` | Feedback — accepted (200), not stored. |
| `GET /ig/*` | 302 → `https://spier-project.github.io/adoption-guide/ig/…`. |

### How CDS cards are derived

- **Live path** — when the CDS client includes the patient's completed
  `QuestionnaireResponse`s in `prefetch`, they run through the app's observation
  mappers to produce risk alerts + a pathway stage. Behaves like a connected EHR:
  no curated narrative fallback.
- **Fallback path** — no prefetch → the bundled population scenario for
  `context.patientId` (`patient-001` … `patient-011`), including that patient's
  curated `recommendedNextStep`. Unknown ids return `{ cards: [] }`.

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

The Worker bundles app source from `../../web/src`, whose catalog and scenario
loaders use Vite's `import.meta.glob` — so `src/index.ts` is **Vite-bundled** to
`dist/index.js` (globs + generated FHIR JSON inlined at build time). The SPA is a
separate `vite build`, staged into `./web-dist` and served by wrangler's Static
Assets. Both are self-contained (SUSHI is a local devDependency; `copy-fhir` runs
via the web build's `prebuild`).

```bash
# One-time on a fresh checkout: install the web app's deps.
npm --prefix ../../web install

npm install          # this package's deps
npm run build        # build:web → stage:assets → build:worker (dist/index.js + web-dist/)
npm run dev          # build the above, then `wrangler dev` (workerd) on :8787
npm run typecheck    # tsc --noEmit
npm test             # vitest — card derivation + API routing + CORS (via app.request)
npm run verify       # typecheck + test
```

`npm run build` orchestrates three steps: `build:web` (web app at base `/`),
`stage:assets` (copy `../../web/dist` → `./web-dist`), `build:worker` (bundle the
Worker). `dist/` and `web-dist/` are gitignored.

### Try it locally

```bash
npm run dev   # http://localhost:8787
curl -s localhost:8787/cds-services | jq
curl -s -X POST localhost:8787/cds-services/spier-patient-view \
  -H 'Content-Type: application/json' \
  -d '{"hook":"patient-view","hookInstance":"1","context":{"patientId":"patient-006"}}' | jq
```

## Deploy (Cloudflare Workers)

`wrangler.jsonc` targets one Worker (`spier-adoption-guide`) with a Static Assets
binding. After `wrangler login`:

```bash
npm run deploy       # build + wrangler deploy (Worker script + web-dist assets)
```

CI does the same on push to `main` via `.github/workflows/deploy-cloudflare.yml`
(needs repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`). The Worker
is created on first deploy — no pre-provisioning.

Point the CDS Hooks Sandbox's *Discovery Endpoint* at
`https://<worker-name>.<subdomain>.workers.dev/cds-services`; the app itself is at
`https://<worker-name>.<subdomain>.workers.dev/`.

> **Transition note:** during the GitHub Pages → Cloudflare migration the app is
> hosted on both. The rendered IG is built only on GitHub Pages, so `/ig/*`
> redirects there. At cutover: render the IG into `web-dist/ig`, drop the
> redirect, flip `APP_BASE_URL` in `web/src/lib/cdsHooks/cards.ts`, and retire the
> GitHub Pages workflow.
