/**
 * A catalogued tool's purpose, as a clinician reads it.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * `Tool.purpose` is `ActivityDefinition.purpose`, published in the IG, and its
 * reader is an implementer. Every one of the 43 is written the same way — the
 * clinical claim first, then one or more sentences placing the activity in
 * SPiER's machinery:
 *
 *   "Flag whether a patient has suicide-related signs warranting further
 *    clarification. **Belongs to the Identify Possible Risk stage of the SPiER
 *    pathway.**"
 *
 *   "Assess suicide risk after a positive screen… **Its result also crosswalks
 *    into the concept layer, so it can serve as the screen itself where a site
 *    leads with it.**"
 *
 * The stage page and the *Why this?* drawer rendered the whole string to a
 * clinician (clinical-app audit §1.9, last row). "Belongs to the Define the
 * Risk Picture stage of the SPiER pathway" is an accurate sentence addressed to
 * someone who is not in the room.
 *
 * ── The rule, and why it is this one ──────────────────────────────────────
 *
 * **The first sentence.** It is the act, in every one of the 43, because that
 * is how the FSH is written and `toolCopy.test.ts` asserts it stays that way
 * over the whole catalogue rather than over a sample.
 *
 * ⚠️ **Not a word list, and not an edit to the artifact.** A deny list of
 * "pathway", "stage", "concept layer" would have to grow with SPiER's own
 * vocabulary and would cut a sentence that happened to use one of those words
 * clinically; editing the published `purpose` would take the placement away
 * from the implementer, who needs it, to give the clinician a shorter sentence.
 * One published string, one rendered string — the same split the stage
 * definitions got in `packages/core/src/data/catalog/stageBlurbs.ts`.
 *
 * ⚠️ **What it cannot see.** A purpose whose FIRST sentence names the
 * machinery. The test pins the catalogue against the clinical rule set the
 * jargon gate uses, so that case fails here rather than shipping.
 */
import type { Tool } from '@spier/core/data/catalog'

/**
 * Split on a sentence end followed by a space and a capital, and never after a
 * known abbreviation.
 *
 * ⚠️ **The abbreviation guard is a list, so it is only as long as the list.**
 * `Dr. Posner` and `e.g. the ASQ` are the two shapes a clinical purpose
 * plausibly carries; nothing in the 43 published today has either, and
 * `toolCopy.test.ts` walks the WHOLE catalogue rather than a sample precisely
 * so a purpose authored with a third one fails here instead of shipping a
 * half-sentence to a clinician.
 */
const ABBREVIATIONS = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'St', 'No', 'vs', 'approx', 'e\\.g', 'i\\.e']
const SENTENCE_END = new RegExp(`(?<!\\b(?:${ABBREVIATIONS.join('|')})\\.)(?<=[.!?])\\s+(?=[A-Z(])`)

export function toolPurposeLine(tool: Pick<Tool, 'purpose'>): string {
  const purpose = tool.purpose?.trim() ?? ''
  if (!purpose) return ''
  return purpose.split(SENTENCE_END)[0].trim()
}
