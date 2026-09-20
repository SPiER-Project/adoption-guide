# The Adoption Guide Worker

One Cloudflare Worker (`spier-adoption-guide`) hosting **two** tenants, both from
the same Static Assets binding (`./web-dist`, the web app's `vite build` output
at base `/`):

- the **Adoption Guide SPA**;
- the **rendered HL7 IG** at `/ig/*` — staged there by `deploy.yml` and never
  built here. A file over the 25 MiB per-file cap (today just `full-ig.zip`) is
  not held and 302s to the Pages render.

⚠️ **The CDS Hooks API is NOT here any more (2026-09-20).** It is its own Worker,
`spier-cds` — see [`services/cds`](../cds/README.md) for why. `src/app.test.ts`
carries the *negative* test that `/cds-services` reaches the asset binding like
any other path and never a JSON handler, mirroring the one
[`services/clinical`](../clinical/README.md) already had: "someone copies a route
across for parity" is the failure both are guarding.

⚠️ **The Worker's NAME is unchanged on purpose.** `spier-adoption-guide` is the
live URL for the guide and the IG, and moving it would break every published
link. The package is `@spier/guide` and the directory is `services/guide`, so the
three finally agree about what this serves — they never did while the API lived
here.

⚠️ **This is not the only Worker serving a SPiER SMART surface.**
[`services/clinical`](../clinical/README.md) serves the `clinical` build — the
two SMART apps, no guide routes, no synthetic patient — on its own origin, and
that is the one the mock EHR frames and the one a real EHR would. What the two
share about being an asset host — the catch-all, the SPA fallback, and the one
`frame-ancestors` policy — is [`packages/worker-http`](../../packages/worker-http/src/spaAssets.ts),
gated by `npm run check:csp`.

## Routes

| Method + path | Purpose |
| --- | --- |
| `GET /` (+ any other path) | The SPA (Static Assets; SPA fallback for unknown paths). |
| `GET /ig/*` | The rendered HL7 IG — Static Assets, staged into `web-dist/ig` by `deploy.yml`. A file over the 25 MiB asset cap (today just `full-ig.zip`) is not held here and 302s to the Pages render. |

## Build & run

`src/index.ts` is Vite-bundled to `dist/index.js`. The SPA is a separate
`vite build`, staged into `./web-dist` and served by wrangler's Static Assets.

⚠️ **This Worker's verify is OFFLINE, as of the CDS split.** It imports
`@spier/worker-http` and nothing else — no catalog, no mappers, no generated
FHIR — so `npm run verify` needs neither `copy-fhir` nor a root install, exactly
like `services/clinical`. Do not add the FHIR dance back for symmetry with
`services/cds`; the day something here needs the catalog is the day it earns it.

```bash
# One-time on a fresh checkout: install the web app's deps.
npm --prefix ../.. install

npm install          # this package's deps
npm run build        # build:web → stage:assets → build:worker (dist/index.js + web-dist/)
npm run dev          # build the above, then `wrangler dev` (workerd) on :8787
npm run typecheck    # tsc --noEmit
npm test             # vitest — frame-ancestors, the IG, the oversized fallback
npm run verify       # typecheck + lint + check:csp + test
```

`npm run build` orchestrates three steps: `build:web` (web app at base `/`),
`stage:assets` (copy `../../dist` → `./web-dist`), `build:worker` (bundle the
Worker). `dist/` and `web-dist/` are gitignored.

### Try it locally

```bash
npm run dev   # http://localhost:8788 — the guide SPA and, if staged, /ig/
```

## Deploy (Cloudflare Workers)

`wrangler.jsonc` targets one Worker (`spier-adoption-guide`) with a Static Assets
binding. After `wrangler login`:

```bash
npm run deploy       # build + wrangler deploy (Worker script + web-dist assets)
```

On push to `main`, the **`cloudflare` job in `.github/workflows/deploy.yml`**
does the same — and additionally stages the rendered IG into `web-dist/ig`, which
a local `npm run deploy` does not. Adopted 2026-09-18.

⚠️ **Workers Builds (the dashboard's Git integration) must stay disconnected.**
It deployed this Worker until 2026-09-18 and was turned off when the Actions job
landed. Reconnecting it does not add redundancy — it races a second deploy
against the first on the same trigger, and its builder has no Java, Ruby or
Jekyll, so whichever build wins may be the one with no IG under `/ig`. This is
the same collision that deleted `.github/workflows/deploy-cloudflare.yml` in
#143, for the opposite reason: that file had no `CLOUDFLARE_*` secrets and only
ever produced a failing check. The secrets exist now (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, added 2026-09-18).

⚠️ **A local `npm run deploy` ships a Worker with no IG.** `stage:assets` starts
with `rm -rf web-dist`, and nothing local renders the IG, so `/ig/*` would 404
until the next push to `main`. Use it for the SPA; let CI deploy what the public
sees.

The app is at `https://<worker-name>.<subdomain>.workers.dev/`. The CDS Hooks
Sandbox's *Discovery Endpoint* points at the **CDS Worker** now, not here — see
[`services/cds`](../cds/README.md).

> **Transition note:** during the GitHub Pages → Cloudflare migration the app is
> hosted on both. The rendered IG is built only on GitHub Pages, so `/ig/*`
> redirects there. At cutover: render the IG into `web-dist/ig`, drop the
> redirect, flip `APP_BASE_URL` in `packages/core/src/lib/cdsHooks/cards.ts`, and retire the
> GitHub Pages workflow.
