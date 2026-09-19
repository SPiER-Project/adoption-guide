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
 * The chart used the Tool Configuration preset — "what does a site like ours
 * have turned on?", which starts on Common Mid-Tier: the catalog's `core` tools.
 * CAMS SSF-5 and CAMS Stabilization are both `optional`, so the preset switched
 * off exactly the tool the alert named, and `buildCdsCards` drops an alert card
 * whose tool is disabled.
 *
 * ── Why the panel offers everything, rather than the service offering less ──
 *
 * ⚠️ **One of this rule's original four reasons is now FALSE, and the rule
 * still stands on the rest.** It used to lead with "the preset is set on a guide
 * page the panel cannot reach". On 2026-09-15 Tool Configuration moved out of
 * the Adoption Guide to `/settings` in this app — a SMART app's toolset is a
 * fact about the app's own deployment, not about the EHR — so the panel reaches
 * it now. Recorded rather than quietly deleted: a reason that expires is how a
 * rule outlives its justification, and the NEXT person to weaken this function
 * should know one leg already went.
 *
 * What holds it up is the leg that never depended on where the page lived:
 *
 *   1. **The host's own cards cannot see this setting.** They come from the
 *      hosted Worker, which is stateless and has no access to the panel
 *      origin's localStorage. A panel honouring the preset would contradict the
 *      host chart two inches away, about the same patient — the 2026-09-02
 *      defect, re-created from the other side.
 *   2. **Making the service match the preset instead** would delete the card
 *      from the host page too, and the demo's own story for that chart
 *      (`services/mock-ehr/src/demoStories.ts`) promises it.
 *   3. **In a host chart the host IS the site.** The preset exists so someone
 *      exploring the standalone app can ask "what would a minimal site see?";
 *      beside a real chart that already holds the CAMS session which produced
 *      the alert, there is no such question to ask.
 *
 * So: in panel chrome every catalogued tool is offered, which is the rule the
 * service already applies. The standalone chart keeps honouring the preset,
 * because there the preset is the point. `pages/ToolConfiguration.tsx` renders a
 * different callout in each chrome so this asymmetry is stated where someone
 * would otherwise flip a switch and watch nothing happen.
 *
 * ⚠️ **The real fix is a per-site toolset the SERVICE can read**, carried in
 * on the SMART launch or configured against the service, so host, panel and
 * endpoint agree from one source. This is the function that should read it.
 *
 * ── What changed on 2026-09-19, and what did NOT ───────────────────────────
 *
 * The stage CARD stopped being a catalogue. `buildCdsCards` now offers what the
 * published pathway names for the stage rather than every enabled tool at it —
 * one launch instead of up to eight, with a fallback to the enabled tools when
 * a site's preset excludes the pathway's instrument, so narrowing can never
 * withhold a recommendation.
 *
 * ⚠️ **That did not need the per-site toolset above, and the reason is worth
 * keeping.** The contradiction this function exists to prevent is the panel and
 * the host's own cards disagreeing about the same patient, which happens when
 * one of them consults browser-local state the other cannot see. The pathway is
 * not state: the hosted Worker, the embedded panel and the standalone chart all
 * bundle `PlanDefinition/SPiERSuicideSaferCarePathway`, so all three narrow to
 * the same instrument with nothing transported anywhere.
 *
 * ⚠️ **So this function is unchanged and the rule above still stands.** The
 * preset still governs what a site OFFERS, the panel still offers everything,
 * and the host's cards still cannot read this origin's localStorage. What is
 * smaller is the harm: "the panel offers every catalogued tool" used to mean a
 * clinician saw eight screeners in a 470px frame, and now means the alternatives
 * sit behind the stage page's disclosure while the card leads with one.
 */
import type { ChromeMode } from '@spier/tool-views/context/PresentationContext'

export function toolEnablementFor(
  chromeMode: ChromeMode,
  siteRule: (toolId: string) => boolean,
): (toolId: string) => boolean {
  return chromeMode === 'panel' ? () => true : siteRule
}
