import { LaunchShell } from './LaunchShell'
import { PanelShell } from './PanelShell'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'

/**
 * Chooses the chrome without forking the route table.
 *
 * The panel plan §3 is explicit about this: thirty-odd routes are too many to
 * duplicate, so `App.tsx` keeps ONE `<Route element={<Shell/>}>` and the choice
 * happens here. Every route is reachable in every chrome by construction, which
 * is what stops a chrome becoming a second app with its own drift.
 *
 * Two chromes, answering one question — is someone else drawing the frame?
 *
 *   panel      embedded as a SMART activity: the host owns the surrounding UI,
 *              so ours collapses to a patient identity strip.
 *   otherwise  `LaunchShell` — this app in its own tab. Nobody browsed here; a
 *              clinician was LAUNCHED here from their EHR.
 *
 * ⚠️ **It used to read TWO axes and pick between THREE chromes**, because the
 * adoption guide shipped from the same route table and wanted its own browsing
 * chrome (`AppShell`) on the demo build. That is gone: the guide is
 * `apps/guide` now and owns `AppShell` outright, so this file reads chrome mode
 * alone. The old version carried a careful note that reading `IS_DEMO` here was
 * not the conflation `PresentationContext` warns against — that argument was
 * sound and is simply no longer needed, which is the better outcome.
 */
export function Shell() {
  const { chromeMode } = usePresentation()
  return chromeMode === 'panel' ? <PanelShell /> : <LaunchShell />
}
