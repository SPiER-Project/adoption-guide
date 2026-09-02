/**
 * Which tools the patient chart may recommend, given the chrome it is in.
 *
 * ── The defect this closes (2026-09-02) ─────────────────────────────────────
 *
 * The mock EHR's chart for patient-006 said "2 cards returned" and showed
 * *Start Stabilization Plan*; the panel docked beside it said "1 recommended
 * action" and never showed it. Same patient, same card builder, two answers —
 * for the one chart the demo script tells a presenter to open, whose story is
 * that the stabilization plan is still to do.
 *
 * The cause was two rules for "is this tool enabled". The CDS Hooks service
 * (`services/cds-hooks/src/service.ts`) treats every catalogued tool as enabled.
 * The chart used the Tool Configuration preset — the adoption guide's
 * "what does a site like ours have turned on?" sandbox, which starts on Common
 * Mid-Tier: the catalog's `core` tools. CAMS SSF-5 and CAMS Stabilization are
 * both `optional`, so the preset switched off exactly the tool the alert named,
 * and `buildCdsCards` drops an alert card whose tool is disabled.
 *
 * ── Why the panel offers everything, rather than the service offering less ──
 *
 * The preset is implementer equipment. It is set on a guide page the panel
 * cannot reach (no sidebar; the "Configure tools" link is already hidden in
 * panel chrome), it lives in the panel origin's localStorage rather than in
 * anything the host said, and it exists to let someone exploring the standalone
 * demo ask "what would a minimal site see?". Inside a host chart there is no
 * implementer and no such question: the host IS the site, its chart already
 * holds the CAMS session that produced the alert, and gating the clinician's
 * recommendations by a sandbox setting from a different surface is arbitrary.
 * Making the service match the preset instead would have deleted the card from
 * the host page too — the demo's own story for that chart
 * (`services/mock-ehr/src/demoStories.ts`) promises it.
 *
 * So: in panel chrome every catalogued tool is offered, which is the rule the
 * service already applies. The standalone chart keeps honouring the preset,
 * because there the preset is the point. If the service ever grows a real
 * per-site configuration, this is the function that should read the same one.
 */
import type { ChromeMode } from '../context/PresentationContext'

export function toolEnablementFor(
  chromeMode: ChromeMode,
  siteRule: (toolId: string) => boolean,
): (toolId: string) => boolean {
  return chromeMode === 'panel' ? () => true : siteRule
}
