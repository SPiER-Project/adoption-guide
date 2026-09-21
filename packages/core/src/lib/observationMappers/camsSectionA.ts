import { makeObservation, interpretationOf, walkItems, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource } from './shared'
import { displayFor, type CodedOption } from '../codedOption'

// Each entry also carried a `textLinkId` ('1-text' … '6-text') that nothing ever
// read. '6-text' did not even exist in cams-ssf5-section-a.json — unlike ratings
// 1–5, the SSF-5's overall-risk item has rating anchors rather than a "what I
// mean by this is…" prompt. Six hand-duplicated linkIds with no consumer is the
// drift risk CLAUDE.md warns about, so they are gone; the score↔text pairing is
// recoverable from the Questionnaire's own naming.
const CAMS_VITALS = [
  { linkId: '1-score', code: 'psychological-pain', display: 'Psychological Pain' },
  { linkId: '2-score', code: 'stress', display: 'Stress' },
  { linkId: '3-score', code: 'agitation', display: 'Agitation' },
  { linkId: '4-score', code: 'hopelessness', display: 'Hopelessness' },
  { linkId: '5-score', code: 'self-hate', display: 'Self-Hate' },
  { linkId: '6-score', code: 'overall-risk', display: 'Overall Risk of Suicide' },
]

export const CAMS_OVERALL_RISK_SYSTEM =
  'http://thespierproject.org/fhir/CodeSystem/cams-ssf-overall-risk'

/**
 * The SSF overall-risk rating as a CODE, which is the form the concept layer
 * can read.
 *
 * ⚠️ **This table is why CAMS reaches the concept layer at all (#436).** The
 * six SSF vitals are integers by published contract — `SPiERCAMSSSFVital`
 * constrains `value[x] only integer` — and until 2026-09-21 the seventh
 * Observation this mapper emits, the one carrying LOINC 93374-7, was a copy of
 * that same integer. So a CAMS chart said "suicide risk level: 3" and nothing
 * downstream could tell what 3 meant: `ConceptMap/CAMSOverallRiskToRiskTier` is
 * published and translates `cams-ssf-overall-risk` 1–5 into the shared tier,
 * and **nothing emitted a code for it to translate**. The data dictionary
 * recorded the consequence — "CAMS has no route into the concept layer" — and
 * the pathway evaluator hit it: patient-006 is a documented moderate-risk CAMS
 * patient whose chart could state no tier.
 *
 * `cams.fsh` anticipated exactly this and says so on the CodeSystem: *"A
 * producer maps valueInteger n to the like-numbered code before translating."*
 * This mapper is that producer. The integers are untouched — the six vitals
 * still carry them, and the profile still requires them.
 *
 * ⚠️ **The displays are the CodeSystem's own, verbatim, em dash included.**
 * `validate-fhir.mjs` checks every `Coding.display` on a SPiER-local system
 * against the published CodeSystem, and `camsSectionA.test.ts` pins this table
 * against the generated artifact from the other side, so a code added or
 * reworded in FSH fails here rather than shipping a display that agrees with
 * nothing.
 */
export const CAMS_OVERALL_RISK_OPTIONS: CodedOption[] = [
  { code: '1', display: '1 — Extremely low risk' },
  { code: '2', display: '2 — Low risk' },
  { code: '3', display: '3 — Moderate risk' },
  { code: '4', display: '4 — High risk' },
  { code: '5', display: '5 — Extremely high risk' },
]

const CAMS_OVERALL_RISK_CODES = new Set(CAMS_OVERALL_RISK_OPTIONS.map(o => o.code))

export function mapCAMSSectionA(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  let maxScore = 0

  for (const vital of CAMS_VITALS) {
    const scoreItem = walkItems(items, vital.linkId)
    const score = scoreItem?.answer?.[0]?.valueInteger

    if (score !== undefined) {
      if (score > maxScore) maxScore = score

      const obs = makeObservation({
        id: `cams-${vital.code}-${Date.now()}`,
        profile: 'http://thespierproject.org/fhir/StructureDefinition/spier-cams-ssf-vital',
        // `display` is the cams-ssf CodeSystem's own wording (ig/input/fsh/cams.fsh)
        // — CAMS_VITALS[].display is kept identical to it on purpose. The "CAMS
        // SSF:" prefix a reader wants is `.text`, not a redefinition of the code.
        code: {
          system: 'http://thespierproject.org/fhir/CodeSystem/cams-ssf',
          code: vital.code,
          display: vital.display,
          text: `CAMS SSF: ${vital.display}`,
        },
        value: score,
        valueType: 'integer',
        interpretation: score >= 4
          ? interpretationOf('H', `Elevated (${score}/5)`)
          : score >= 3
          ? interpretationOf('N', `Moderate (${score}/5)`)
          : interpretationOf('L', `Low (${score}/5)`),
        note: `CAMS SSF-5 Section A: ${vital.display} rated ${score}/5 by patient. Code system is local (pending LOINC submission). EHRs should track these longitudinally across sessions to show trending.`,
        questionnaireName: 'CAMS SSF-5: Section A',
      })

      observations.push(obs)
    }
  }

  // Overall risk, re-coded onto the LOINC code that does exist — and CODED,
  // which is what lets a consumer read it (#436).
  //
  // ⚠️ A rating outside 1–5 now yields NO concept Observation, where it used to
  // yield one carrying the raw integer. The SSF scale is 1–5 and the
  // Questionnaire constrains it, so this is unreachable from a conformant
  // response — and inventing a sixth code on a published CodeSystem to keep an
  // Observation alive would be worse than not having one. The rating itself is
  // never lost: the six SSF vitals above carry it whatever it is.
  const overallScore = walkItems(items, '6-score')?.answer?.[0]?.valueInteger
  if (overallScore !== undefined && CAMS_OVERALL_RISK_CODES.has(String(overallScore))) {
    const code = String(overallScore)
    const display = displayFor(CAMS_OVERALL_RISK_OPTIONS, code)
    observations.push(
      makeObservation({
        id: `cams-risk-level-${Date.now()}`,
        code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
        value: {
          coding: [{ system: CAMS_OVERALL_RISK_SYSTEM, code, display }],
          text: display,
        },
        valueType: 'codeable',
        interpretation: overallScore >= 4
          ? interpretationOf('H', `High risk (${overallScore}/5)`)
          : overallScore >= 3
          ? interpretationOf('N', `Moderate risk (${overallScore}/5)`)
          : interpretationOf('L', `Lower risk (${overallScore}/5)`),
        questionnaireName: 'CAMS SSF-5: Section A',
      }),
    )
  }

  const riskAlert: RiskAlert = maxScore >= 4
    ? {
        tool: 'CAMS Section A',
        level: 'high',
        summary: `CAMS Vitals: Elevated scores (max ${maxScore}/5)`,
        detail: `One or more CAMS SSF vitals rated 4-5/5. Stabilization planning and driver-focused treatment indicated.`,
        suggestedAction: { label: 'Start Stabilization Plan', path: '/patient/assessments/cams-stabilization-plan' },
      }
    : maxScore >= 3
    ? {
        tool: 'CAMS Section A',
        level: 'moderate',
        summary: `CAMS Vitals: Moderate scores (max ${maxScore}/5)`,
        detail: `CAMS SSF vitals in moderate range. Continue CAMS framework with driver exploration.`,
        suggestedAction: { label: 'Start Therapeutic Worksheet', path: '/patient/assessments/cams-therapeutic-worksheet' },
      }
    : {
        tool: 'CAMS Section A',
        level: 'low',
        summary: `CAMS Vitals: Low scores (max ${maxScore}/5)`,
        detail: `All CAMS SSF vitals rated low (1-2/5). Consider whether resolution criteria are met.`,
      }

  return { observations, riskAlert }
}
