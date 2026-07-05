# SPiER CDS Hooks service

A stateless [CDS Hooks 2.0](https://cds-hooks.org/specification/current/) service
that surfaces the SPiER suicide-safer pathway's *next step* and *risk alerts* as
CDS Hooks cards, for a `patient-view` hook.

It is a thin [Hono](https://hono.dev) wrapper over the adoption-guide app's
**browser-free derivation code** — the same `observationMappers`,
`derivePathwayStatus`, and `buildCdsCards` the in-app Patient Chart uses — so the
hosted endpoint and the app emit byte-identical cards. Nothing is persisted.

## Endpoints

| Method + path | Purpose |
| --- | --- |
| `GET /cds-services` | Discovery — advertises the `spier-patient-view` service. |
| `POST /cds-services/spier-patient-view` | `patient-view` invocation → `{ cards: [...] }`. |
| `POST /cds-services/spier-patient-view/feedback` | Feedback — accepted (200), not stored. |

CORS is wide open (`*`) so the service is callable from the public
[CDS Hooks Sandbox](https://sandbox.cds-hooks.org) and EHR test harnesses.

### How cards are derived

- **Live path** — when the CDS client includes the patient's completed
  `QuestionnaireResponse`s in `prefetch`, they are run through the app's
  observation mappers to produce risk alerts and a pathway stage. Behaves like a
  connected EHR: no curated narrative fallback.
- **Fallback path** — with no prefetch, the service serves the app's bundled
  population scenario matching `context.patientId` (`patient-001` … `patient-011`),
  including that patient's curated `recommendedNextStep`. Unknown ids return an
  empty (spec-valid) `{ cards: [] }`.

The prefetch template requests:
`QuestionnaireResponse?patient={{context.patientId}}&status=completed&_sort=-authored`.

## Develop

This package imports app source from `../../web/src`, whose catalog and scenario
loaders use Vite's `import.meta.glob`. That is why the Worker is **built with
Vite** (`@cloudflare/vite-plugin`) rather than plain wrangler/esbuild: the globs
(and the generated FHIR JSON they load) are transformed and inlined at build
time. The generated FHIR must therefore exist first — the `predev`/`prebuild`
hooks run the web app's `copy-fhir`.

```bash
# One-time (fresh checkout): install the web app's deps so copy-fhir can run.
npm --prefix ../../web install

npm install          # this package's deps
npm run dev          # vite dev server on http://localhost:5173 (runs in workerd)
npm run typecheck    # tsc --noEmit
npm test             # vitest — card derivation + HTTP routing + CORS
npm run verify       # typecheck + test
npm run build        # production Worker bundle → dist/
```

> **Note on `vite dev` + CORS:** the Vite dev server answers CORS preflight
> (`OPTIONS`) requests with its *own* default headers before the request reaches
> the Worker, so a live `curl -X OPTIONS localhost:5173` is not representative of
> production. The deployed Worker's CORS is covered by `src/app.test.ts`
> (`app.request(...)` against the real Hono app).

### Try it locally

```bash
curl -s localhost:5173/cds-services | jq
curl -s -X POST localhost:5173/cds-services/spier-patient-view \
  -H 'Content-Type: application/json' \
  -d '{"hook":"patient-view","hookInstance":"1","context":{"patientId":"patient-006"}}' | jq
```

## Deploy (Cloudflare Workers)

`wrangler.jsonc` targets Cloudflare Workers. After `wrangler login`:

```bash
npm run deploy       # wrangler deploy (uses the Vite-built bundle)
```

Then point the CDS Hooks Sandbox's *Discovery Endpoint* at
`https://<worker-name>.<subdomain>.workers.dev/cds-services`.
