# `services/clinical` — the SMART apps, on their own origin

The Worker that serves SPiER's **`clinical` build surface**: the provider app
and the population dashboard, with no adoption guide and no synthetic patient.

```
https://spier-clinical.bbthorson.workers.dev/
```

It is ~30 lines of Worker over a Static Assets binding. Everything interesting
about it is what it *does not* serve, and why it exists separately at all.

## What it serves

`web/dist-clinical` — the output of `VITE_SURFACE=clinical vite build`
([`web/src/lib/surface.ts`](../../web/src/lib/surface.ts)). That build registers
the two SMART apps and **no `/guide` route**, and resolves
`@spier/demo-population` to an empty shim, so the 14 demo patients are not
compiled in at all.

⚠️ **That is a chart-safety property, not a bundle-size one.** A clinician
launched into this origin from a real EHR cannot reach a caseload containing
Jane Doe, because there is no Jane Doe in the bundle. See
[`docs/plans/surfaces-and-distribution.md`](../../docs/plans/surfaces-and-distribution.md)
§3. `web`'s `npm run check:surface` reads **both** builds and asserts every
marker in both directions, so a marker that stops being derived fails rather
than proving nothing.

## What it deliberately does not serve

| | Where it lives instead | Why not here |
|---|---|---|
| `/cds-services` | `services/cds-hooks` | Cards come from `buildCdsCards` **in-process**; the only runtime caller of the HTTP endpoint is `CdsServiceGuide.tsx`, a guide page absent from this build. And `CDS_JWT_AUDIENCE` is baked to the adoption-guide Worker's published URL — moving the endpoint is a re-registration with every caller, not a redeploy. |
| `/ig/` | `services/cds-hooks` + GitHub Pages | ~4,000 files of implementer documentation. A clinician's app is not where it belongs, and the audience that reads it already has two hosts that answer. |
| the adoption guide | `services/cds-hooks` | It is the other product. The split is earned by open-sourcing these two apps, not by screen design. |

`src/app.test.ts` asserts all three as **negative** tests — a path that reaches
the ASSETS binding like any other, rather than a 404, because under the SPA
fallback a miss is a 200 either way and a 404 assertion would pass vacuously.
The failure being guarded is somebody copying a route across from the guide
Worker "for parity".

## The `frame-ancestors` header is the reason there is a Worker here at all

A Static Assets binding on its own cannot set a response header, and **this is
the Worker a real EHR frames.** So the policy —
`DEFAULT_FRAME_ANCESTORS`, the re-wrap, the explicit SPA fallback — lives once,
in [`packages/worker-http/src/spaAssets.ts`](../../packages/worker-http/src/spaAssets.ts),
shared with `services/cds-hooks`.

⚠️ **A header that drifts between the two Workers is a clickjacking surface on
this one specifically** — and this is also the copy nobody would think to
re-read after editing the guide's. `node scripts/check-worker-csp.mjs` holds
five rules that keep a second copy from coming back, including a liveness rule
so the other four cannot pass against a shared module that does nothing. Each
one was planted and watched go red before the gate was trusted.

⚠️ **`not_found_handling: "none"`, not `"single-page-application"`** — the one
SPA setting nobody expects, and the gate checks it. Both apps are HashRouters,
so SPA fallback never carried a real navigation; what it *did* do was answer
every miss with `index.html` and a **200**, which makes the shared module's 404
branch dead code. See #533 → #534.

## Commands

```sh
npm install                 # once; fresh checkouts need it
npm run verify              # typecheck + eslint + check:csp + vitest
npm run build               # clinical web build → web-dist/ → Worker bundle
npm run dev                 # the above, then `wrangler dev` (port 8789 via .claude/launch.json)
npm run deploy              # build + `wrangler deploy`
```

`npm run verify` is **fast and offline** — unlike the other two services it
needs no `copy-fhir`, because this Worker imports nothing from `web/src`. Its
own CI job is in `.github/workflows/web-lint.yml`; the deploy is the `clinical`
job in `.github/workflows/deploy.yml`, which is independent of the Pages/IG jobs
because this Worker holds no IG.

⚠️ **`web`'s `npm run verify` does not cover this package**, the same as the
other two services.

## Launching into it

A SMART launch arrives at the bare app base with `?iss=…&launch=…`;
`web/src/main.tsx` routes it into `#/launch` before the router mounts. **The
registered URI is the bare base with no fragment** — an OAuth redirect URI
cannot carry one, and a fragment already in place would put the appended query
string after the `#`, where `location.search` cannot see it.

Two registrars point here:

- **`services/mock-ehr`** — `MOCK_PANEL_BASE_URL` in its `wrangler.jsonc`, with
  `MOCK_CDS_BASE_URL` naming the adoption-guide Worker, because the CDS service
  stayed behind. Its `DEFAULT_REDIRECT_URIS` carries this origin.
- **Medplum** — one field on one `ClientApplication`:
  ```sh
  node scripts/medplum-register-launch.mjs --app https://spier-clinical.bbthorson.workers.dev/ --apply
  ```
  ⚠️ A second `ClientApplication` will not give you both this and localhost:
  `clientIdForIssuer` keys on the **issuer's** origin, and both would be
  `api.medplum.com`. Flip the one field back with
  `--app http://localhost:5173/ --apply` for local work.
