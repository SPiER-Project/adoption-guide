/**
 * The parsed Suicide Safer Care Pathway, or the parse error.
 *
 * `loadPathway` throws rather than degrading (see its header in
 * `@spier/core/lib/pathway`: an empty render model would present as a pathway
 * with no steps rather than as a build problem), so every surface that renders
 * it needs the same try/catch. Doing it once here means the guide page and the
 * embedded panel report the failure identically — and that neither of them can
 * accidentally render a half-read artifact as though it were the protocol.
 *
 * Its own module rather than a second export from `PathwayView.tsx`: that file
 * exports components, and mixing a hook in costs Fast Refresh for every
 * component in it (`react-refresh/only-export-components`).
 */
import { useMemo } from 'react'
import { loadPathway, type PathwayModel } from '@spier/core/lib/pathway'

export interface LoadedPathway {
  model: PathwayModel | null
  error: string | null
}

export function usePathway(): LoadedPathway {
  return useMemo(() => {
    try {
      return { model: loadPathway(), error: null as string | null }
    } catch (e) {
      return { model: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [])
}
