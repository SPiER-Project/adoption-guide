/**
 * Per-source liveness floors.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * #500 re-proved every gate that reads a tree step E moved, by hiding the tree
 * and requiring the gate to go red. Three gates did not: they globbed a
 * directory that was gone, found nothing, and reported success. The fixes there
 * were per-gate "this tree must exist" guards.
 *
 * ⚠️ **That closes the tree-is-GONE case and not the tree-is-SMALLER one**, and
 * the second is the one nothing was watching. A glob that narrows, a rename that
 * catches nine files of ten, a bucket quietly dropped from a list — each leaves
 * the directory present, the gate green, and the coverage a fraction of what the
 * output claims. `validate-fhir` printed `0 unwrapped from the population
 * scenarios` and passed; it would equally have printed `3` and passed.
 *
 * So the floor is not a nicety on top of the existence check. It is the half
 * that survives a partial move, which is the likelier accident.
 *
 * ─── The convention, inherited from check-codings.mjs ────────────────────────
 *
 * That gate worked all of this out first, against two real defects, and its
 * rules are copied here rather than re-derived:
 *
 *  1. **Per source AND per dimension. Never a single total.** A global floor was
 *     check-codings' first version and testing found the hole: deleting both
 *     TypeScript paths still left enough codings elsewhere to clear the total.
 *     #236 then found the same hole one level down — a per-source floor that
 *     either vocabulary could clear alone. Each dimension proves its own
 *     liveness or the guard has a blind spot shaped like the thing it guards.
 *
 *  2. **Roughly HALF the real count, rounded down.** High enough that a dead or
 *     rerouted scan cannot clear it; low enough that ordinary edits do not trip
 *     it. A floor proves *liveness*, not completeness — removing things is
 *     allowed to lower the count.
 *
 *  3. **A floor goes stale upward and nothing re-checks it.** #43 doubled a
 *     source's inventory while its floor sat still, silently dropping it from
 *     ~50% of the real count to 25% (#232). So `report()` prints actual, floor
 *     and ratio on every run, and says so out loud when a floor has drifted
 *     below a quarter of reality. That note is deliberately NOT a failure: a
 *     stale floor is weak, not wrong, and failing a green build over it would
 *     teach people to raise floors thoughtlessly.
 */

/** A floor has gone slack when the real count is this many times it. */
const STALE_RATIO = 4

/**
 * @param {{source: string, dimension: string, actual: number, floor: number}[]} entries
 * @param {(msg: string) => void} fail  the caller's own failure fn
 * @returns {boolean} true when every floor held
 */
export function reportFloors(entries, fail) {
  const short = entries.filter((e) => e.actual < e.floor)
  for (const e of entries) {
    const slack = e.floor > 0 && e.actual >= e.floor * STALE_RATIO
    console.log(
      `  scanned ${e.source}: ${e.dimension} ${e.actual} (floor ${e.floor})` +
        (slack ? ` ⚠ floor is now under 1/${STALE_RATIO} of the real count — raise it` : ''),
    )
  }
  for (const e of short) {
    fail(
      `${e.source}: ${e.dimension} ${e.actual} is below the floor of ${e.floor}. ` +
        `Either this source moved or the scan broke — refusing to report success ` +
        `on a check that inspected almost nothing. If the drop is deliberate, lower the floor in the same commit.`,
    )
  }
  return short.length === 0
}
