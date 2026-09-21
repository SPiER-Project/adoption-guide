/**
 * The slug of a catalog launch path: its last segment, with any query or hash
 * dropped. `/patient/assessments/cams-section-a?tool=TL-020` → `cams-section-a`.
 *
 * `TOOL_VIEWS` is keyed by this, and so is each surface's `launchHref`
 * (`SurfaceLinksContext`), which is what lets a view name another view by slug
 * and let the surface decide the route. Lived inline in the guide's tool
 * catalogue until the clinical app needed the same cut.
 */
export function launchSlug(path: string): string | undefined {
  return path.split(/[?#]/)[0].split('/').filter(Boolean).pop()
}
