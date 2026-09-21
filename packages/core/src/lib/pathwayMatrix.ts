/**
 * The tier branch as a table: one row per obligation, one column per tier.
 *
 * The source diagram draws the per-tier obligations as a matrix — obligation
 * rows, tier columns, and a cell spanning every tier a row applies to at one
 * value ("Provide patient with 988 Crisis Hotline…" is one cell across all of
 * them). The PlanDefinition cannot say that directly: `action` nests, so each
 * tier group carries its own copy of the obligation, and two of the three
 * obligations are therefore stated three times. Rendered as three columns that
 * is the repetition the adoption-guide UX audit measured (§3, 2026-09-20);
 * rendered as a matrix the repetition is one spanning cell, which is what the
 * diagram meant.
 *
 * So this folds the tier groups back into rows. Two rules:
 *
 *   1. A ROW is an obligation title. Titles are what the reader sees, and the
 *      FSH gives a repeated obligation the same title in every tier on purpose
 *      (suicide-safer-care-pathway.fsh, the note above the tier branch). A
 *      tier that lists one title twice is a shape this model cannot draw and
 *      throws, the way `pathway.ts` throws on what it cannot read.
 *   2. A CELL spans the ADJACENT tiers whose copy of the obligation says the
 *      same thing — description and documentation, compared verbatim. Tiers
 *      whose copies differ get separate cells, so a tier-specific sentence is
 *      shown against its tier rather than silently merged or dropped.
 *
 * Row order follows the tier with the most obligations (high, today), then any
 * title it lacks in first-seen order, so a row's position is stable however
 * the lower tiers are ordered.
 *
 * React-free and DOM-free (`npm run check:core-boundary`); tests beside it.
 */
import type { PathwayAction, PathwayCoding } from './pathway'

export type TierMatrixCell =
  /** The obligation is owed at these tiers, and they say the same thing about it. */
  | { kind: 'owed'; action: PathwayAction; tierCodes: string[]; span: number }
  /** The obligation is not owed at this tier. */
  | { kind: 'none'; tierCode: string }

export interface TierMatrixRow {
  /** The obligation title — the row's identity. */
  title: string
  description?: string
  stage?: PathwayCoding
  definitionCanonical?: string
  definitionLabel?: string
  /** Left to right in tier order; `span`s add up to the number of tiers. */
  cells: TierMatrixCell[]
}

const tierCodeOf = (tier: PathwayAction): string => tier.tier?.code ?? 'unknown'

/** What two copies of one obligation must agree on to share a cell. */
const signature = (action: PathwayAction): string =>
  JSON.stringify([action.description ?? '', action.documentation])

export function buildTierMatrix(tiers: PathwayAction[]): TierMatrixRow[] {
  if (tiers.length === 0) {
    throw new Error('pathwayMatrix: no tier groups — a branch with no tiers has no table to draw')
  }

  // Row order: the widest tier first, then the rest, each contributing the
  // titles not yet seen. Stable sort, so equal widths keep artifact order.
  const byWidth = [...tiers].sort((a, b) => b.children.length - a.children.length)
  const titles: string[] = []
  for (const tier of byWidth) {
    for (const child of tier.children) {
      if (!titles.includes(child.title)) titles.push(child.title)
    }
  }

  return titles.map(title => {
    // The obligation's copy in each tier, or undefined where it is not owed.
    const copies = tiers.map(tier => {
      const matches = tier.children.filter(child => child.title === title)
      if (matches.length > 1) {
        throw new Error(
          `pathwayMatrix: tier "${tierCodeOf(tier)}" lists "${title}" ${matches.length} times — ` +
            'one row per obligation cannot draw a tier that owes the same obligation twice',
        )
      }
      return matches[0]
    })

    const cells: TierMatrixCell[] = []
    for (let i = 0; i < tiers.length; i++) {
      const copy = copies[i]
      if (!copy) {
        cells.push({ kind: 'none', tierCode: tierCodeOf(tiers[i]) })
        continue
      }
      const sig = signature(copy)
      let span = 1
      while (i + span < tiers.length) {
        const next = copies[i + span]
        if (!next || signature(next) !== sig) break
        span++
      }
      cells.push({
        kind: 'owed',
        action: copy,
        tierCodes: tiers.slice(i, i + span).map(tierCodeOf),
        span,
      })
      i += span - 1
    }

    const first = copies.find((c): c is PathwayAction => c !== undefined)
    if (!first) {
      // Unreachable by construction — every title came from some tier's
      // children — so reaching it means the two loops above disagree.
      throw new Error(`pathwayMatrix: "${title}" was collected from the tiers but found in none of them`)
    }
    return {
      title,
      description: first.description,
      stage: first.stage,
      definitionCanonical: first.definitionCanonical,
      definitionLabel: first.definitionLabel,
      cells,
    }
  })
}
