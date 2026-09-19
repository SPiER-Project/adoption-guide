/**
 * Questionnaire registry — canonical URL → Questionnaire JSON, plus helpers to
 * resolve an answer's ordinal weight from the Questionnaire's `answerOption`.
 *
 * Why this exists: ordinal weights (the per-answer scores summed into a total,
 * e.g. PHQ-9) live on the *Questionnaire* `answerOption.extension[ordinalValue]`,
 * NOT on the QuestionnaireResponse `answer.valueCoding`. The renderer
 * (@formbox/renderer) does not copy that extension onto the captured answer, so
 * a mapper reading the response answer alone sees no ordinal. The standards-
 * correct way to score is to join the selected answer's code back to the
 * Questionnaire answerOption — which is exactly what the SDC `weight()` FHIRPath
 * function does. This module is the TypeScript reference implementation of that
 * join, used by the per-instrument observation mappers.
 */
import { stripCanonicalVersion } from './catalog'
import type { QuestionnaireResource } from '../types/fhir'

// This module is the single owner of the hand-authored Questionnaire JSON
// imports from ig/input/resources/questionnaires/. Both the form renderer (web/src/data/toolViews.tsx)
// and the ordinal-scoring join below consume the resources through the named
// exports here, so the raw JSON paths live in exactly one place.

import asq from '../../../../ig/input/resources/questionnaires/ASQ/asq-questionnaire.json'
import bssa from '../../../../ig/input/resources/questionnaires/BSSA/bssa-questionnaire.json'
import pss3 from '../../../../ig/input/resources/questionnaires/PSS-3/pss3-questionnaire.json'
import safet from '../../../../ig/input/resources/questionnaires/SAFE-T/safet-questionnaire.json'
import phq9 from '../../../../ig/input/resources/questionnaires/PHQ-9/phq9-questionnaire.json'
import sbqr from '../../../../ig/input/resources/questionnaires/SBQ-R/sbqr-questionnaire.json'
import cssrsScreenerJson from '../../../../ig/input/resources/questionnaires/C-SSRS/cssrs-screener.json'
import cssrsSinceLastContactJson from '../../../../ig/input/resources/questionnaires/C-SSRS/cssrs-since-last-contact.json'
import cssrsPediatricJson from '../../../../ig/input/resources/questionnaires/C-SSRS/cssrs-pediatric.json'
import cssrsFullJson from '../../../../ig/input/resources/questionnaires/C-SSRS/cssrs-full-lifetime-recent.json'
import camsSectionAJson from '../../../../ig/input/resources/questionnaires/CAMS/cams-ssf5-section-a.json'
import camsSectionBJson from '../../../../ig/input/resources/questionnaires/CAMS/cams-ssf5-section-b.json'
import camsOutcomeDispositionJson from '../../../../ig/input/resources/questionnaires/CAMS/cams-ssf5-outcome-disposition.json'
import camsStabilizationPlanJson from '../../../../ig/input/resources/questionnaires/CAMS/cams-stabilization-plan.json'
import camsTherapeuticWorksheetJson from '../../../../ig/input/resources/questionnaires/CAMS/cams-therapeutic-worksheet.json'
import crpJson from '../../../../ig/input/resources/questionnaires/CRP/crp-questionnaire.json'
import pssFullJson from '../../../../ig/input/resources/questionnaires/PSS-Full/pss-full-questionnaire.json'
// ⚠️ Stanley-Brown was imported straight into `web/src/components/StanleyBrownView.tsx`
// until 2026-09-17 — the one instrument that bypassed this module, and the
// reason it was not in `QUESTIONNAIRE_BY_URL`. It has no ordinal-scored answers
// so nothing read the gap, but "single owner of the JSON imports" was only true
// of seventeen of the eighteen. See docs/internals/tool-views.md §2.
// That view is gone (it was a fork of QuestionnaireView) and this claim is now
// GATED rather than merely stated: `check:catalog` check C asserts that every
// Questionnaire JSON under ig/input/resources/questionnaires/ is imported here, matched on the
// file path — a canonical-based check would pass on a second importer, which
// is exactly the defect.
import stanleyBrownJson from '../../../../ig/input/resources/questionnaires/Stanley-Brown/stanley-brown-questionnaire.json'

/** Named Questionnaire resources — the canonical, typed registry entries. */
export const asqQuestionnaire = asq as unknown as QuestionnaireResource
export const bssaQuestionnaire = bssa as unknown as QuestionnaireResource
export const pss3Questionnaire = pss3 as unknown as QuestionnaireResource
export const safetQuestionnaire = safet as unknown as QuestionnaireResource
export const phq9Questionnaire = phq9 as unknown as QuestionnaireResource
export const sbqrQuestionnaire = sbqr as unknown as QuestionnaireResource
export const cssrsScreener = cssrsScreenerJson as unknown as QuestionnaireResource
export const cssrsSinceLastContact = cssrsSinceLastContactJson as unknown as QuestionnaireResource
export const cssrsPediatric = cssrsPediatricJson as unknown as QuestionnaireResource
export const cssrsFull = cssrsFullJson as unknown as QuestionnaireResource
export const camsSectionA = camsSectionAJson as unknown as QuestionnaireResource
export const camsSectionB = camsSectionBJson as unknown as QuestionnaireResource
export const camsOutcomeDisposition = camsOutcomeDispositionJson as unknown as QuestionnaireResource
export const camsStabilizationPlan = camsStabilizationPlanJson as unknown as QuestionnaireResource
export const camsTherapeuticWorksheet = camsTherapeuticWorksheetJson as unknown as QuestionnaireResource
export const crpQuestionnaire = crpJson as unknown as QuestionnaireResource
export const pssFullQuestionnaire = pssFullJson as unknown as QuestionnaireResource
export const stanleyBrownQuestionnaire = stanleyBrownJson as unknown as QuestionnaireResource

const ALL_QUESTIONNAIRES: QuestionnaireResource[] = [
  asqQuestionnaire,
  bssaQuestionnaire,
  pss3Questionnaire,
  safetQuestionnaire,
  phq9Questionnaire,
  sbqrQuestionnaire,
  cssrsScreener,
  cssrsSinceLastContact,
  cssrsPediatric,
  cssrsFull,
  camsSectionA,
  camsSectionB,
  camsOutcomeDisposition,
  camsStabilizationPlan,
  camsTherapeuticWorksheet,
  crpQuestionnaire,
  pssFullQuestionnaire,
  stanleyBrownQuestionnaire,
]

/** Canonical (version-stripped) Questionnaire URL → Questionnaire resource. */
export const QUESTIONNAIRE_BY_URL: Record<string, unknown> = Object.fromEntries(
  ALL_QUESTIONNAIRES.filter(q => q?.url).map(q => [stripCanonicalVersion(q.url!), q]),
)

/**
 * ⚠️ **The SDC `weight()` join used to live here and deliberately does not any
 * more.** `ordinalForAnswer` / `answerCodingForOrdinal` moved to
 * `./questionnaireOrdinals.ts`, which reads a derived table instead of these
 * whole resources — because the observation mappers call them, the mappers are
 * eager, and importing this module from one put all 18 Questionnaires (166.8 KB)
 * into the entry chunk of both build surfaces. See that file's header and
 * `docs/plans/tool-bundling-audit-2026-09-19.md` §5.1.
 *
 * This module is now imported only where a whole Questionnaire is genuinely
 * needed — the renderer's tool views, which are lazy. Keep it that way: a mapper
 * importing from here re-lands the regression silently, and
 * `npm run check:eager-forms` is what fails if one does.
 */
