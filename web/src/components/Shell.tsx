import { AppShell } from './AppShell'
import { PanelShell } from './PanelShell'
import { usePresentation } from '../context/PresentationContext'

/**
 * Chooses the chrome without forking the route table.
 *
 * The panel plan §3 is explicit about this: thirty-odd routes are too many to
 * duplicate, so `App.tsx` keeps ONE `<Route element={<Shell/>}>` and the choice
 * happens here. Every route is reachable in both chromes by construction, which
 * is what stops the panel becoming a second app with its own drift.
 */
export function Shell() {
  const { chromeMode } = usePresentation()
  return chromeMode === 'panel' ? <PanelShell /> : <AppShell />
}
