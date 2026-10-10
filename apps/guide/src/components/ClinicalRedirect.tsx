import { useEffect } from 'react'
import { DEPLOY_ORIGINS } from '@spier/core/lib/deployOrigins'
import { RouteFallback } from '@spier/app-shell/components/RouteFallback'

/**
 * A published path of the clinical app, reached on the guide's origin.
 *
 * `/guide/measures`, `/guide/tool-configuration` and the `/chart/*` family were
 * published when one app served both surfaces, and each kept a `<Navigate>`
 * to its new home. After the apps split (2026-09-19) those homes are routes of
 * `apps/clinical`, on another origin — so on the guide every one of those
 * redirects sent the reader to a path this app does not have, and the `*`
 * catch-all put them on the Overview. A redirect that lands on the front door
 * is worse than a 404: it looks like a choice.
 *
 * So the hop is cross-origin, to the clinical Worker's HashRouter path. The
 * origin comes from `deploy-origins.json` like every other hosted origin
 * (`check:origins`). `clinicalPath` is deliberately not called `path` or `to`:
 * `scripts/lib/route-table.mjs` reads the first ` path="…"` in a `<Route>` tag
 * and `check:surface-links` reads every `to="…"`, and this prop is neither a
 * route of this app nor a navigation within it.
 */
export function ClinicalRedirect({ clinicalPath }: { clinicalPath: string }) {
  useEffect(() => {
    window.location.replace(`${DEPLOY_ORIGINS.clinical}/#${clinicalPath}`)
  }, [clinicalPath])
  return <RouteFallback />
}

/**
 * A SMART EHR launch that reached the guide's origin, handed to the clinical
 * app — query string intact, which is where `iss` and `launch` travel.
 *
 * The guide cannot run a launch itself: it mounts no SMART session and no
 * server-backed data source (docs/internals/repo-layout.md), so a launch
 * completed here would have nowhere to read or write. No EHR is configured to
 * launch this origin; this is what a misconfigured one gets instead of the
 * front door. The clinical app's bootstrap routes the same query into its own
 * `/launch`.
 */
export function ClinicalLaunchHandoff() {
  useEffect(() => {
    window.location.replace(`${DEPLOY_ORIGINS.clinical}/${window.location.search}`)
  }, [])
  return <RouteFallback />
}
