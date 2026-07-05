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
