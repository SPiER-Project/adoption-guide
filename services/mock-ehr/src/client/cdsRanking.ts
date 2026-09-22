/**
 * How the chart ranks the recommendations a CDS service returned: one on the
 * surface, the rest behind a disclosure.
 *
 * ⚠️ **A module of its own, and DOM-free, so the rule can be tested directly.**
 * It lived inside `renderCards` first, and the only way to assert it from
 * `chartPage.test.ts` — which has no DOM — was to grep the BUILT client bundle
 * for the source expression. That test passed for the wrong reason the moment
 * the minifier rewrote the ternary, and would have gone on passing if the rule
 * had been deleted and the expression left behind in a comment. A pure function
 * is the version that can actually fail.
 */

/** The half of a CDS Hooks card this ranking reads. */
export interface RankableCard {
  /** `critical` | `warning` | `info` — the spec's own urgency field. */
  indicator?: string
}

export interface RankedCards<T> {
  /** On the surface of the module. */
  primary: T[]
  /** Inside the closed "Also due" disclosure. */
  rest: T[]
}

/**
 * CDS Hooks' three indicators, most urgent first. An unknown indicator sorts
 * last rather than throwing: a service may add one, and a card this host cannot
 * rank is still a card it must show.
 */
const INDICATOR_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 }

const rankOf = (card: RankableCard): number => INDICATOR_RANK[card.indicator ?? 'info'] ?? 2

/**
 * Split the cards into the one that is next and the ones that merely remain.
 *
 * ⚠️ **Ranked by `indicator`, and NOT by SPiER's `spier-primary` extension.**
 * This was written the other way first, on the reasoning that the pathway
 * evaluator marks exactly one card as the next step and the host should render
 * the service's own ranking rather than invent one. #581 had already settled the
 * question in the opposite direction, for a better reason: reading
 * `spier-primary` here would make **this host's chart depend on a vendor
 * extension to render its own page**, which is precisely the claim a mock EHR
 * exists to avoid making. `indicator` is in the spec, so any CDS service — not
 * only SPiER's — gets ranked correctly, and an adopter reading this page as an
 * example is shown a dependency they can actually satisfy.
 *
 * The sort is STABLE, so cards of equal urgency keep the order the service sent
 * them, which is where SPiER's own ranking survives: its primary card is the
 * first of its tier.
 *
 * ⚠️ **Only the top card is promoted, and a tie does not promote both.** The
 * module's surface answers "what is next", singular; two rows there is the
 * "four equally loud things to press" defect this consolidation removed.
 */
export function rankCards<T extends RankableCard>(cards: T[]): RankedCards<T> {
  if (cards.length === 0) return { primary: [], rest: [] }
  const sorted = [...cards].sort((a, b) => rankOf(a) - rankOf(b))
  return { primary: sorted.slice(0, 1), rest: sorted.slice(1) }
}
