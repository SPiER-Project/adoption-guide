/**
 * What a lazy route shows while its chunk loads. Both apps render it as the
 * `<Suspense>` fallback around their route tables; its one rule is
 * `.route-loading` in this package's `App.css`, which is why the component
 * lives here and not in either app.
 *
 * It was defined byte-identically in both `App.tsx` files — the first thing
 * `check:dupes` found once it could parse them (C3 of the 2026-09-20 audit).
 */
export function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      Loading…
    </div>
  )
}
