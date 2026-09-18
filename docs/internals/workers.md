# The three Workers

`web/`'s `npm run verify` covers none of them. Each has its own CI-gated verify;
the mock EHR has a CSS gate no CSS linter could provide, and the two that serve
Static Assets share a CSP gate.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

In `services/cds-hooks/` — **easy to forget, and CI gates it:**
```
npm install && npm run verify   # typecheck + eslint + vitest for the Worker
```
`web/`'s `npm run verify` does NOT cover this package, but the `cds-hooks` CI job
does. It imports the web catalog, so a change to `tool-ui-metadata.ts` (launch
actions especially) or to the population scenarios can break its tests without
anything in `web/` failing.

In `services/clinical/` — **the newest one, and the one a real EHR frames:**
```
npm install && npm run verify   # typecheck + eslint + check:csp + vitest
```
It serves `web/dist-clinical` (`VITE_SURFACE=clinical`) and nothing else. Its
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
`color-no-hex` and `web/`'s `check:tokens`, neither of which can see it — its
pages are template strings inside TypeScript, with no stylesheet for a CSS
linter to read. Two rules: **no hex outside the `TOKENS` block** in
`src/hostChrome.ts`, and **every `var(--…)` resolves**. Both fail when they read
nothing, and the whole thing exists because the comment version had already
failed once: `hostChrome.ts` was extracted *from* `controlPage.ts` to give the
palette one definition, and `controlPage.ts` then hand-typed four of those hexes
in its own `<!doctype>` document for as long as it existed.

⚠️ **The mock EHR is deliberately NOT styled like SPiER**, and that is a demo
claim rather than a preference. Its pages say *"Everything below this bar is
drawn by SPiER, not by the host"*, so the host is slate and steel and SPiER's
raspberry appears in exactly one role — `--guest-brand`, on the `.guest__title`
wordmark above a frame SPiER drew. A host control tinted with it puts the guest's
colour on the host's button, on the page whose whole subject is which pixels
belong to whom. `services/mock-ehr/README.md` § *The look of the host* has the
reasoning, including why `hostChrome.ts`'s original argument for matching the app
was reversed.

