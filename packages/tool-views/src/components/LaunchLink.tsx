import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSurfaceLinks } from '../context/SurfaceLinksContext'

/**
 * A link from one tool view to another, resolved for the current surface.
 *
 * A recorder's hint says "open a Suicide-Risk Episode first" and names the
 * view by its slug; the surface says where that view lives — the clinician's
 * `/patient/workflow/risk-episode`, the guide's `/guide/tools/risk-episode/try`.
 * Where the surface has no route for the slug the text renders plain, so a
 * hint never carries a link to nowhere. See `SurfaceLinksContext`.
 */
export function LaunchLink({ slug, children }: { slug: string; children: ReactNode }) {
  const href = useSurfaceLinks().launchHref(slug)
  return href ? <Link to={href}>{children}</Link> : <>{children}</>
}
