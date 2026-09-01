/**
 * Plumbing every SPiER card obeys, regardless of which builder emits it.
 *
 * Extracted from `cards.ts` when the problem-list guidance card (Phase 5 of
 * docs/plans/suicide-safer-care-pathway.md) became a second builder. Both the
 * 140-character `summary` cap and the `uuid` degrade-to-undefined rule are
 * properties of the *wire format*, not of any one card, so a second copy of
 * either would be a second opinion on the spec.
 */

/** CDS Hooks caps `Card.summary` at 140 characters. */
export const MAX_SUMMARY = 140

/** Truncate to the CDS Hooks 140-char cap with an ellipsis. */
export function truncateSummary(text: string): string {
  return text.length <= MAX_SUMMARY ? text : `${text.slice(0, MAX_SUMMARY - 1).trimEnd()}…`
}

/**
 * A per-response card id, or `undefined` where the platform has no CSPRNG.
 *
 * Available in browsers and Node ≥19; degrades rather than throwing so the
 * builders never fail on a card's *optional* field.
 */
export function makeUuid(): string | undefined {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : undefined
}
