/**
 * Build a QuestionnaireResponse **the way SPiER's own form builds one** — by
 * reading the answer shape off the real Questionnaire JSON rather than by
 * hand-writing it in the test.
 *
 * ── Why this exists ──────────────────────────────────────────
 *
 * Issue #327: every C-SSRS mapper read `answer.valueBoolean`, and not one SPiER
 * Questionnaire declares a `boolean` item — each yes/no question is `type:
 * choice` bound to SNOMED Yes (373066001) / No (373067005). So a screener filled
 * in through the app derived `tier: none` no matter what was endorsed. Six
 * mapper test files had certified those mappers as working, because each one
 * hand-built `valueBoolean` items: the suite proved the mappers correct against
 * input the app never produces.
 *
 * A test fixture that asserts the shape of the app's data has to *derive* that
 * shape from the artifact that defines it.
 *
 * ── Where the derivation lives now ───────────────────────────
 *
 * ⚠️ It is NOT in this file any more. The Care Pathway page's C-SSRS simulator
 * needs the same derivation at runtime — it feeds a synthetic response through
 * the shipped mapper — so it moved to `lib/nativeQuestionnaireResponse.ts` and
 * this fixture became a URL-resolving wrapper around it. Copying it here
 * instead would have left the runtime and the tests free to disagree about the
 * app's own data shape, which is #327 with extra steps.
 *
 * TEST-ONLY: this module's URL lookup is the test-facing half; nothing in
 * `src/` outside `*.test.ts` imports it.
 */
import { QUESTIONNAIRE_BY_URL } from '@spier/core/data/questionnaires'
import {
  buildNativeQuestionnaireResponse,
  type NativeAnswer,
} from '@spier/core/lib/nativeQuestionnaireResponse'
import type { QuestionnaireResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'

export type { NativeAnswer }

/**
 * A QuestionnaireResponse for `questionnaireUrl` answering `answers`, nested
 * under the same group chain the Questionnaire declares.
 *
 * ```ts
 * nativeQr(CSSRS_SCREENER, { q1: true, q5: true, q6: false })
 * // → item[ideation-section][q1] = { valueCoding: SNOMED 373066001 "Yes" }
 * ```
 *
 * Throws on an unknown Questionnaire or an unknown linkId — a renamed item
 * fails the test that reads it instead of silently answering nothing.
 */
export function nativeQr(
  questionnaireUrl: string,
  answers: Record<string, NativeAnswer>,
): QuestionnaireResponseResource {
  const q = QUESTIONNAIRE_BY_URL[questionnaireUrl] as QuestionnaireResource | undefined
  if (!q) throw new Error(`nativeQr: no Questionnaire registered for ${questionnaireUrl}`)
  return buildNativeQuestionnaireResponse(q, answers)
}

/**
 * The same answers as flat `valueBoolean` items — the shape `fallbackDispatch`
 * normalizes a foreign QR into (#230).
 *
 * Kept so each mapper test can prove **both** shapes still read. It is a
 * deliberate second-class citizen: `nativeQr` is what the app produces, and the
 * risk-ladder cases are asserted against that one.
 */
export function booleanQr(
  questionnaireUrl: string,
  answers: Record<string, boolean>,
): QuestionnaireResponseResource {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: questionnaireUrl,
    item: Object.entries(answers).map(([linkId, valueBoolean]) => ({ linkId, answer: [{ valueBoolean }] })),
  } as QuestionnaireResponseResource
}
