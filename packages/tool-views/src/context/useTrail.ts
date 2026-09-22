import { useLocation } from 'react-router-dom'
import type { Crumb } from '@spier/ui/PageHeader'
import { useSurfaceLinks } from './SurfaceLinksContext'

/**
 * The trail above a form view: the surface's ancestors for where the reader
 * actually is, or its `parent` when the surface offers none.
 *
 * ⚠️ **One definition, used by both headers.** `QuestionnaireView` and
 * `WorkflowForm` each draw a `PageHeader` on the clinician's routes, and the
 * copy of four lines that would sit in both is exactly what `check:dupes`
 * fails — and what would drift the day one surface's trail changes.
 *
 * ⚠️ **`useLocation`, not a prop on each of the 29 views.** They are one element
 * definition rendered by two route families; a view that declared its own trail
 * would be declaring one surface's hierarchy inside shared code, which is the
 * defect `SurfaceLinksContext` exists for.
 *
 * ⚠️ **It never returns an empty trail.** A header with no eyebrow sits 24px
 * higher than every other page (`PageHeader`'s own note), so "this surface has
 * no ancestors to name" falls back to naming the parent rather than to nothing.
 */
export function useTrail(): Crumb[] {
  const links = useSurfaceLinks()
  const { pathname } = useLocation()
  const trail = links.trailFor?.(pathname)
  return trail && trail.length > 0 ? trail : [{ label: links.parent.label, to: links.parent.href }]
}
