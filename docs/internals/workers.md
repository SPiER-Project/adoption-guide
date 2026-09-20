# The four Workers

the repo root's `npm run verify` covers none of them. Each has its own CI-gated verify;
the mock EHR has a CSS gate no CSS linter could provide, and the two that serve
Static Assets share a CSP gate.

## Three offerings, four deployables

The **IG**, the **Adoption Guide** and the **clinical product demonstration** are
three separate offerings. Both demos **pull from the IG**: the guide and the
clinical app read the same compiled artifacts out of
`packages/fhir-artifacts/generated/`, which is SUSHI's output from
`ig/input/fsh/`. Neither restates an artifact the IG defines; when they disagree
with it, the IG is right and the gates say so.

The **CDS Hooks service** is the fourth deployable and belongs to the standard
rather than to either demo — its URL is an integration contract an adopter
configures inside their own EHR.

| Offering | Worker | Serves |
|---|---|---|
| Implementation Guide | `spier-adoption-guide` (`services/guide`) | the rendered IG at `/ig/*` |
| Adoption Guide | `spier-adoption-guide` (`services/guide`) | the guide SPA |
| Clinical demonstration | `spier-clinical` (`services/clinical`) | the two SMART apps |
| CDS Hooks service | `spier-cds` (`services/cds`) | `/cds-services/*`, JSON only |

⚠️ The IG and the Adoption Guide share one Worker and are still two offerings —
one is the published standard, the other is a site explaining how to adopt it.
The mock EHR (`spier-mock-ehr`) is not an offering at all: it is the demo host.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

## One toolchain, four services — shared since 2026-09-20

#387's "no npm workspaces" gave the repo one root install; the cost is that each
service carries its own copy of the Worker toolchain — eslint, typescript-eslint,
vite, vitest, `@types/node`, wrangler and `@cloudflare/workers-types`. Four
copies of a version range is four chances to fork, and they did: on 2026-09-20
two services were on `wrangler ~4.107.0` and two on `^4.0.0`, with a note in
`services/clinical/package.json` explaining a pin that by then described a state
that no longer existed.

⚠️ **`wrangler` and `@cloudflare/workers-types` are COUPLED inside a single
manifest, and that is what made the fork stick.** wrangler 4.135 declares a
`peerOptional` on `@cloudflare/workers-types` `^5.20260918.1`, so a manifest
asking for `wrangler ^4.135` *and* `@cloudflare/workers-types ^4` fails
`npm install` with ERESOLVE on its own — nothing about the sibling services is
involved, because each has its own install (#387). The bump is therefore two
lines per service, never one.

⚠️ **The note that recorded this got the mechanism wrong, and that is why the
pin outlived its reason.** `services/clinical/package.json` read "conflicts with
the 4.x line the *other two services* install", which describes a cross-service
constraint that does not exist and makes the fix sound like a four-way
negotiation rather than two lines in one file. So the pin stayed, and it held
**three HIGH advisories** open across two services (undici cross-user
disclosure, miniflare, sharp) for as long as it stood — the fix for all three
was the wrangler version the pin forbade.

The four now move together: `wrangler ^4.135.0` and
`@cloudflare/workers-types ^5.20260920.1` in every service, and a `//cloudflare`
note in each manifest saying so. ⚠️ **Until 2026-09-20 nothing enforced it** —
the note was the whole guard. `scripts/check-service-toolchain.mjs`
(`npm run check:toolchain` in every service's `verify`) now fails the moment
any two `services/*/package.json` devDependency maps differ, so "bump the set"
is a rule the gate holds rather than a sentence to remember.

⚠️ **The version ranges were the visible fork; the config files were the quiet
one.** Each service also carried its own `eslint.config.js`, `tsconfig.json`,
`vite.config.ts` and `vitest.config.ts` — twelve files meant to be identical.
They were not: the tsconfigs disagreed on `paths` (guide declared five aliases,
clinical one) and on `baseUrl`; `services/mock-ehr`'s vitest aliases used the
object form, which PREFIX-matches, while the others used the anchored
exact + prefix pair; `services/cds`'s vite config aliased a package it never
imported. None of it broke anything, which is exactly why it drifted. The
bodies live once now, in
[`packages/worker-tooling`](../../packages/worker-tooling/README.md): a
service's config file is a `defineConfig(...)` around an imported body, its
tsconfig is `"extends"` plus `include`, and the same gate fails a config that
stops importing the body, adds a local alias or `compilerOptions`, or lets the
tsconfig `paths` and the Vite aliases name different packages.

⚠️ **Nothing under `packages/worker-tooling` imports a dependency, and that is
the constraint #387 imposes, not a style.** A bare `import 'vite'` from a file
under `packages/` resolves against the ROOT install's Vite, not the service's;
so the eslint body takes its six dependencies as arguments, the vite/vitest
bodies return plain objects for the service's own `defineConfig` to type, and
the `.d.mts` files describe those objects structurally. Moving a `defineConfig`
call INTO the package would look tidier and silently build every service's
config from the wrong package versions.

In `services/guide/` — **the guide SPA and the rendered IG:**
```
npm install && npm run verify   # typecheck + eslint + check:csp + vitest
```
the repo root's `npm run verify` does NOT cover this package, but the `guide` CI
job does.

⚠️ **Its verify became OFFLINE at the CDS split (2026-09-20).** It used to import
the web catalog — a change to `tool-ui-metadata.ts` or the population scenarios
could break it — because the Worker hosted the CDS API, whose card derivation
reads both. That left with the API. This Worker now imports
`@spier/worker-http` and nothing else, so it needs neither `copy-fhir` nor a root
install. Do not add the FHIR dance back for symmetry with `services/cds`.

In `services/cds/` — **the CDS Hooks service, on its own origin:**
```
npm install && npm run verify   # copy-fhir + typecheck + eslint + check:csp + vitest
```
⚠️ **This is where the catalog dependency went.** Card derivation imports the
catalog, the mappers and `@spier/demo-population`, so this job needs the
generated FHIR tree and a root install — the inverse of the guide's.

⚠️ **`SMART_LAUNCH_URL` is required and the invoke route 500s without it.** It
was derived from the request origin, which was true while one Worker served both
the API and the app and became false at the `apps/` split (#552): the cards'
intents target `/patient/assessments/*` and only `apps/clinical` registers
`/patient`. A test asserted the old behaviour and kept passing, because it
checked the link equalled the *request* origin — still true — and never that the
origin could route the launch. An assertion that encodes an assumption cannot
notice the assumption expiring.

In `services/clinical/` — **the newest one, and the one a real EHR frames:**
```
npm install && npm run verify   # typecheck + eslint + check:csp + vitest
```
It serves `dist-clinical` (`VITE_SURFACE=clinical`) and nothing else. Its
verify is the odd one out for a reason worth protecting: **no `copy-fhir`, no
web install.** This Worker imports nothing from `web/src` — it serves the built
bytes — so it runs offline in seconds. The day something here needs the catalog
is the day it grows the FHIR-cache dance the other two carry; until then, adding
it for symmetry buys a slower job and nothing else.

⚠️ **Its negative tests are the load-bearing ones.** `/cds-services` and `/ig/`
both resolve on the adoption-guide Worker, so the failure being guarded is
someone copying a route across for parity — which would put a second CDS
endpoint on an origin `CDS_JWT_AUDIENCE` does not name, and ~4,000 files of
implementer documentation inside a clinician's app. They assert that the path
reaches the ASSETS binding **like any other path**, not that it 404s: under the
SPA fallback a miss is a 200 either way, so a 404 assertion would pass
vacuously. `services/clinical/README.md` has the table of what lives where.

⚠️ **One `frame-ancestors` policy, in `packages/worker-http/src/spaAssets.ts`.**
Two Workers now serve a SPiER SMART surface over Static Assets, and a header
that drifts between them is a clickjacking surface on the clinical one
specifically — which is also the copy nobody thinks to re-read after editing the
guide's. `node scripts/check-worker-csp.mjs` runs from both services' verify
(it scans the whole repo, so either caller is sufficient) and holds five rules:

1. **Liveness** — the shared module still sets the header. Without it the other
   four pass trivially against a module that does nothing.
2. **No second copy** — no service source may put `content-security-policy` or
   `frame-ancestors` in a *string*. Comments are stripped first: every Worker's
   prose legitimately discusses the header, and a gate that fires on its own
   documentation gets switched off inside a week — the lesson
   `check-core-boundary.mjs` already records.
3. **Every asset host uses it** — a Worker whose `wrangler.jsonc` declares an
   `assets` block must **value**-import `serveSpaAsset` or `withFrameAncestors`.
   ⚠️ The first version tested only for a mention of the package, and a planted
   defect passed it: deleting the `serveSpaAsset` import left `import type {
   SpaAssetsEnv } from '@spier/worker-http/spaAssets'` behind, which satisfied
   the match while the Worker attached no CSP at all. A type import is erased at
   build time; it cannot set a header.
4. **`not_found_handling: "none"`** on every such Worker. The shared module's
   `onMiss` hook and its explicit SPA fallback both depend on a miss being a real
   404; under `"single-page-application"` the binding answers every miss with
   index.html and a 200, so that branch is dead code and a dropped file comes
   back as HTML (#533 → #534). A wrangler edit is exactly how that returns.
5. It **fails when it reads nothing** — no `services/`, no asset host, or a
   missing shared module are all hard errors rather than a green count of zero.

All five were planted and watched go red before the gate was trusted, and rule 3
is on this list in the form the plant forced rather than the form it was written
in.

In `services/mock-ehr/` — **the same deal, and it has a CSS gate of its own:**
```
npm install && npm run verify   # copy-fhir + typecheck + eslint + check:host-css + vitest
```
`npm run check:host-css` is this Worker's stand-in for stylelint's
`color-no-hex` and the root's `check:tokens`, neither of which can see it — its
pages are template strings inside TypeScript, with no stylesheet for a CSS
linter to read. Two rules: **no hex outside the `TOKENS` block** in
`src/hostChrome.ts`, and **every `var(--…)` resolves**. Both fail when they read
nothing, and the whole thing exists because the comment version had already
failed once: `hostChrome.ts` was extracted *from* `controlPage.ts` to give the
palette one definition, and `controlPage.ts` then hand-typed four of those hexes
in its own `<!doctype>` document for as long as it existed.

⚠️ **The pages' behaviour was invisible to every one of those tools, for the
same reason the CSS was.** Until 2026-09-20 each page's JavaScript was a string
inside its `.ts` builder — `chartScript()` alone was 408 lines of ES5 in a
template literal, with the page's values interpolated as `var PATIENT = ${…}`.
`tsc` did not type it, eslint did not read it, no test could import a function
from it, and the `innerHTML` concatenation the 2026-09-20 audit found (B11) had
lived there precisely because nothing looked. The three behaviours are
`src/client/{home,chart,settings}.ts` now — a browser project with a DOM `lib`,
built by `vite.client.config.ts` and served by the Worker at
`/client/<name>.js?v=<content hash>` — and the page hands its module its inputs
as a `<script type="application/json">` block. The same PR split the 1,185-line
`app.ts` into six route modules mounted at `/` with their full paths; the
tests, which drive `app.request()` against those paths, are what proved the
split changed nothing. `src/clientAssets.test.ts` fails a page that grows an
inline `<script>` again.

## Hosted origins: one file, and the configs that repeat it

Until 2026-09-20 the five hosted origins — four `workers.dev` Workers and the
GitHub Pages site — were typed as literals in nine places across seven source
files, plus four `wrangler.jsonc` vars. Each rename found them one at a time:
`SMART_LAUNCH_URL` was derived from the wrong origin for a release after the
`apps/` split (`services/cds/README.md`), and `CDS_JWT_AUDIENCE` named the
adoption-guide Worker after the API had left it. They come from
`deploy-origins.json` at the repo root now, typed through
`packages/core/src/lib/deployOrigins.ts`, and `scripts/check-deploy-origins.mjs`
(`npm run check:origins`, in the root `verify`) holds the two places that
cannot import.

⚠️ **Two importers read the JSON relatively, and that is the alias cost of
#387 showing through, not a shortcut.** `packages/worker-http/src/spaAssets.ts`
builds `DEFAULT_FRAME_ANCESTORS` from `origins.mockEhr`, and
`services/guide/src/index.ts` builds its IG fallback from `origins.pages`; both
are bundled by Workers that have no `@spier/core` alias and are meant to stay
importable by an asset host that knows nothing about the domain layer. The
gate's rule 1 forbids the literal either way, so a relative import is the only
form left to a module in that position.

⚠️ **`wrangler.jsonc` cannot import, so its copies are checked, not derived.**
`services/cds` carries four (the SMART launch URL, the JWT audience, the trusted
issuer, the JWKS URL) and each must equal an origin in the file or a path under
one. A blank `PANEL_FRAME_ANCESTORS` in an asset Worker means the code default
(`'self'` + the mock EHR); a non-blank one may admit only `'self'`-style
keywords and origins from the file, because the clinical Worker's header is a
clickjacking surface and "it is config" is not a reason to let an unknown host
through it.

⚠️ **GitHub Pages is a dependency, not a spare copy.** `services/guide/src/index.ts`
redirects any IG download over the Workers per-file size cap to the Pages
render, so the `pages` key is load-bearing for every link on the IG's Downloads
page. Retiring Pages is a change to that route and to `deploy.yml`'s Pages job,
made together, not the removal of one key — and `check:origins` rule 5 would
fail the orphaned key the moment nothing read it.

⚠️ **The mock EHR is deliberately NOT styled like SPiER**, and that is a demo
claim rather than a preference. Its pages say *"Everything below this bar is
drawn by SPiER, not by the host"*, so the host is slate and steel and SPiER's
raspberry appears in exactly one role — `--guest-brand`, on the `.guest__title`
wordmark above a frame SPiER drew. A host control tinted with it puts the guest's
colour on the host's button, on the page whose whole subject is which pixels
belong to whom. `services/mock-ehr/README.md` § *The look of the host* has the
reasoning, including why `hostChrome.ts`'s original argument for matching the app
was reversed.

