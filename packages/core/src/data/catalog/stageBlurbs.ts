/**
 * One sentence per stage, addressed to the person doing it.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * `Stage.description` is the pathway CodeSystem's `definition`, and its reader
 * is an **EHR vendor**: every one of the eight begins "The EHR supports…" or
 * "The EHR finds…" — a statement about what a product must be able to hold.
 * That is the right sentence in the published artifact and on the Adoption
 * Guide, and the wrong one on a rail a clinician opens beside a patient
 * (clinical-app audit §1.9, §4.3): "The EHR supports documenting the current
 * risk status" tells the person holding the panel nothing they can act on.
 *
 * So the app gets a clinician display and the artifact keeps its own words —
 * the same split `documentation` displays got in the FSH on 2026-09-20, and the
 * reason nothing here edits `ig/input/fsh/spier-codesystem.fsh`. One published
 * string, one rendered string, and neither is a translation of the other: these
 * say what the CLINICIAN does at the stage, which is a different claim from
 * what the EHR must support.
 *
 * ⚠️ **`Record<StageId, string>`, not `Partial<…>`.** `StageId` is generated
 * from the CodeSystem by `copy-fhir`, so a stage added or renamed in the FSH
 * is a compile error here rather than a rail row that silently loses its
 * sentence — the same guarantee `satisfies StageId` gives the single-stage
 * constants in `lib/`. A partial map would have made the missing case
 * invisible, which is how the blurb would have gone stale.
 *
 * ⚠️ **What it cannot say.** These are the stage's standing purpose, not this
 * patient's position in it — nothing here reads a record. What is *due* comes
 * from `lib/pathwayEvaluation.ts`, and the rail carries it as a count on the
 * row rather than as a second sentence.
 */
import type { StageId } from '@spier/fhir-artifacts/generated/stage-ids.generated'

export const STAGE_BLURB: Record<StageId, string> = {
  'identify-possible-risk':
    'Ask whether this patient is at risk — a screening question, or a short screener.',
  'clarify-risk':
    'Find out what is going on: thoughts, plan, intent, past attempts, access to means.',
  'define-risk-picture':
    'Settle on how much risk this patient is carrying now, and say what that rests on.',
  'document-safety-actions':
    'Write down what is being done to keep this patient safer, and keep it current.',
  'coordinate-handoffs':
    'Hand the safety picture on — to the next clinician, the next setting, the people at home.',
  'track-follow-up': 'Check that the outreach and the follow-up appointment actually happened.',
  'track-risk-over-time':
    'Keep this patient’s risk episode open and in view until it is safe to close it.',
  'measure-and-share':
    'See how this is going across everyone in your care, and share what it shows.',
}

/** The clinician's sentence for a stage, or null when the id is not one. */
export function stageBlurb(stageId: string): string | null {
  return (STAGE_BLURB as Record<string, string>)[stageId] ?? null
}
