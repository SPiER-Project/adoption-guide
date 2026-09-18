/**
 * Serving a SPiER SMART surface from Cloudflare Static Assets.
 *
 * Two Workers serve a build of `web/` over a Static Assets binding — the
 * adoption-guide Worker (`services/cds-hooks`, the `demo` surface plus the CDS
 * Hooks API and the rendered IG) and the clinical Worker (`services/clinical`,
 * the `clinical` surface and nothing else). Everything they share about *being
 * an asset host* lives here.
 *
 * ⚠️ **The `frame-ancestors` value is the reason this file exists, not a
 * convenience.** The clinical Worker is the one a real EHR frames, so it is the
 * one where a permissive or stale list is an actual clickjacking surface — and
 * it is also the one nobody would think to re-check after editing the guide's
 * copy. A constant in two files is a policy that can differ; a constant in one
 * file is a policy. `scripts/check-worker-csp.mjs` holds the rule that keeps a
 * copy from coming back.
 *
 * ⚠️ **React-free and DOM-free, like `packages/core`** — its consumers are
 * Workers. `Request`/`Response`/`URL` are the fetch API, present in workerd; no
 * `window`, no `document`, nothing from Node.
 */

/**
 * Who may embed a SPiER SMART surface in a frame.
 *
 * The embedded-panel work launches the app INSIDE a host chart on a different
 * origin, so framing has to be permitted deliberately.
 * [`docs/plans/embedded-panel-smart-launch.md`](../../../docs/plans/embedded-panel-smart-launch.md)
 * §6 calls this "the first thing that will break", and it is worth knowing which
 * direction the breakage runs: with no CSP at all a browser frames these apps
 * from anywhere, so this header can only ever REDUCE what works. If a panel
 * renders blank inside the mock EHR, this list is the first thing to check — the
 * browser console names the blocked ancestor exactly.
 *
 * `'self'` keeps an app's own same-origin iframes working (the step-0 width
 * spike used one). Deliberately not a wildcard, which would make the header
 * decorative.
 */
export const DEFAULT_FRAME_ANCESTORS = "'self' https://spier-mock-ehr.bbthorson.workers.dev"

/** The Static Assets binding, as both Workers declare it. */
export interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>
}

export interface SpaAssetsEnv {
  ASSETS: AssetsBinding
  /**
   * Space-separated `frame-ancestors` sources, overriding
   * {@link DEFAULT_FRAME_ANCESTORS} for one deployment. Blank = the default.
   */
  PANEL_FRAME_ANCESTORS?: string
}

/**
 * Re-wrap an asset response so the CSP can be attached: a response from the
 * binding has immutable headers, so it cannot be set in place.
 *
 * ⚠️ `new Response(body, asset)` rather than `{ ...asset }` — a Response's
 * status/headers live on the prototype as getters, so spreading one yields an
 * empty object and silently resets the status to 200.
 */
export function withFrameAncestors(asset: Response, env: SpaAssetsEnv): Response {
  const response = new Response(asset.body, asset)
  response.headers.set(
    'content-security-policy',
    `frame-ancestors ${env.PANEL_FRAME_ANCESTORS || DEFAULT_FRAME_ANCESTORS}`,
  )
  return response
}

/**
 * What a Worker does with a request it has no route for: ask Static Assets, and
 * on a real miss fall back to the SPA index.
 *
 * ⚠️ **This depends on `not_found_handling: "none"` in the caller's
 * `wrangler.jsonc`** — the one SPA setting nobody expects. Under
 * `"single-page-application"` the binding answers *every* miss with index.html
 * and a 200, so `asset.status === 404` is never true and `onMiss` never runs.
 * That is not hypothetical: it is how a missing `/ig/full-ig.zip` came back as
 * HTML that a browser saved as a `.zip` (#533 → #534). With `"none"` a miss is
 * a real 404, which is what lets the two cases be told apart at all.
 *
 * @param onMiss  Consulted before the SPA fallback, for a 404 the caller wants
 *                to answer differently — the guide Worker sends an IG path it
 *                does not hold to the Pages render. Return `undefined` to take
 *                the SPA fallback. Its response is returned as-is, WITHOUT the
 *                CSP: a redirect has no document to frame.
 */
export async function serveSpaAsset(
  request: Request,
  env: SpaAssetsEnv,
  onMiss?: (url: URL) => Response | undefined,
): Promise<Response> {
  const url = new URL(request.url)
  const asset = await env.ASSETS.fetch(request)

  if (asset.status === 404) {
    const handled = onMiss?.(url)
    if (handled) return handled

    // The SPA fallback the binding used to do for us. Both apps are
    // HashRouters, so this is near-vestigial — but removing it would turn a
    // stray /foo from "the app loads" into a 404.
    //
    // A plain GET, not a clone of the inbound request: this path is reached by
    // any method, and replaying a POST at the index is not what SPA fallback
    // meant. Status is whatever the index asset returns, so a missing index
    // surfaces as an error rather than a 200 with no body.
    const index = await env.ASSETS.fetch(new Request(new URL('/', url).toString()))
    return withFrameAncestors(index, env)
  }

  return withFrameAncestors(asset, env)
}
