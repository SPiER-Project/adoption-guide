import { AppShell } from './AppShell'
import { LaunchShell } from './LaunchShell'
import { PanelShell } from './PanelShell'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { IS_DEMO } from '../lib/surface'

/**
 * Chooses the chrome without forking the route table.
 *
 * The panel plan §3 is explicit about this: thirty-odd routes are too many to
 * duplicate, so `App.tsx` keeps ONE `<Route element={<Shell/>}>` and the choice
 * happens here. Every route is reachable in every chrome by construction, which
 * is what stops a chrome becoming a second app with its own drift.
 *
 * Three chromes, answering three questions:
 *
 *   panel        embedded as a SMART activity — the host owns the surrounding
 *                UI, so ours collapses to a patient identity strip.
 *   demo + not   the adoption guide's browsing chrome: an implementer reading,
 *     panel      comparing, and following links out to the spec.
 *   clinical +   `LaunchShell` — the clinical build in its own tab. Nobody
 *     not panel  browsed here; a clinician was LAUNCHED here from their EHR.
 *
 * ⚠️ **This reads BOTH axes, and that is not the conflation `PresentationContext`
 * warns against.** The warning is about the context carrying more than one axis
 * — chrome mode must not imply a data source or a build surface. Choosing a
 * component from two independent facts is the opposite: the context still holds
 * only `chromeMode`, `IS_DEMO` is still folded at build time, and the decision
 * that needs both lives in the one file whose whole job is deciding.
 *
 * Chrome mode is checked FIRST because it is the stronger claim: a panel launch
 * of the demo build is still someone else's chart, and drawing the guide's
 * header and footer inside it would be wrong on either surface.
 */
export function Shell() {
  const { chromeMode } = usePresentation()
  if (chromeMode === 'panel') return <PanelShell />
  return IS_DEMO ? <AppShell /> : <LaunchShell />
}
