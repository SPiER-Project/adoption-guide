import { makeObservation, interpretationOf, walkItems, getYesNoBoolean, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource, CSSRS_RISK_LEVEL_SYSTEM, cssrsRiskLevelDisplay } from './shared'

export function mapCSSRSFull(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // Check both lifetime and recent for each ideation level
  const q1Life = getYesNoBoolean(walkItems(items, 'q1-lifetime'))
  const q1Recent = getYesNoBoolean(walkItems(items, 'q1-recent'))
  const q2Life = getYesNoBoolean(walkItems(items, 'q2-lifetime'))
  const q2Recent = getYesNoBoolean(walkItems(items, 'q2-recent'))
  const q3Life = getYesNoBoolean(walkItems(items, 'q3-lifetime'))
  const q3Recent = getYesNoBoolean(walkItems(items, 'q3-recent'))
  const q4Life = getYesNoBoolean(walkItems(items, 'q4-lifetime'))
  const q4Recent = getYesNoBoolean(walkItems(items, 'q4-recent'))
  const q5Life = getYesNoBoolean(walkItems(items, 'q5-lifetime'))
  const q5Recent = getYesNoBoolean(walkItems(items, 'q5-recent'))

  const attemptLife = getYesNoBoolean(walkItems(items, 'actual-attempt-lifetime'))
  const attemptRecent = getYesNoBoolean(walkItems(items, 'actual-attempt-recent'))

  // Highest recent ideation level
  let highestRecent = 0
  if (q5Recent) highestRecent = 5
  else if (q4Recent) highestRecent = 4
  else if (q3Recent) highestRecent = 3
  else if (q2Recent) highestRecent = 2
  else if (q1Recent) highestRecent = 1

  let highestLifetime = 0
  if (q5Life) highestLifetime = 5
  else if (q4Life) highestLifetime = 4
  else if (q3Life) highestLifetime = 3
  else if (q2Life) highestLifetime = 2
  else if (q1Life) highestLifetime = 1

  // Most severe ideation type from intensity section
  const mostSevereType = walkItems(items, 'most-severe-type')?.answer?.[0]?.valueInteger

  // ── Risk tier: the published C-SSRS triage ladder, applied to this form ───
  //
  // Same ladder as the screener core (`cssrsScreener.ts`), verified against the
  // CMS 2008 "Screen Version — Recent" PDF and the Columbia Lighthouse Project's
  // 2026 "Screen with Triage Points for Primary Care" — the record is
  // docs/reference/suicide-safer-care-pathway-spec.md §"Published-instrument
  // verification (Phase 1b)"; this is Phase 1c of
  // docs/plans/suicide-safer-care-pathway.md. Clinical review is retrospective,
  // not blocking (decision recorded 2026-09-01).
  //
  //   recent ideation 1–2   → low
  //   recent ideation 3     → moderate
  //   recent ideation 4–5   → high     (level 4 was `moderate` before this)
  //   attempt, past 3 months→ high
  //   attempt, lifetime-only→ moderate (was `low — historical behavior`)
  //
  // The form's own item labels supply the recency windows the ladder needs:
  // ideation items are "(Past month)" and the behavior items "(Past 3 months)",
  // matching the screener's timeframes, so the ladder transfers directly.
  //
  // Two deliberate departures from the screener core, both from this form's
  // different item set rather than a different rule:
  //
  //  - Behavior here is read from `actual-attempt` only. The screener's q6 is
  //    the composite "done anything, started to do anything, or prepared to do
  //    anything"; this form splits that into actual / interrupted / aborted /
  //    preparatory, and only the first is read. That narrowing predates this
  //    change and is left as-is rather than widened under a ladder fix — a
  //    recent *preparatory act* with no attempt still scores no behavior here.
  //  - The diagram's separate "Historical" tier is not implemented, for the
  //    reason recorded in the screener core: no published C-SSRS source defines
  //    a fourth level, and both score lifetime-only behavior `moderate`. Open
  //    clinical question 2 in the plan owns whether it becomes an orthogonal
  //    flag.
  //
  // As in the core, behavior sets a floor rather than overriding: a lifetime-
  // only attempt must not pull a recent level-5 ideation down to moderate.
  const TIER_RANK = { none: 0, low: 1, moderate: 2, high: 3 } as const
  type Tier = keyof typeof TIER_RANK

  let ideationTier: Tier = 'none'
  let riskDisplay = 'No risk identified'
  if (highestRecent >= 4) { ideationTier = 'high'; riskDisplay = 'High Risk' }
  else if (highestRecent === 3) { ideationTier = 'moderate'; riskDisplay = 'Moderate Risk' }
  else if (highestRecent >= 1) { ideationTier = 'low'; riskDisplay = 'Low Risk' }

  let behaviorTier: Tier = 'none'
  let behaviorDisplay: string | undefined
  if (attemptRecent) { behaviorTier = 'high'; behaviorDisplay = 'High Risk — suicide attempt within past 3 months' }
  else if (attemptLife) { behaviorTier = 'moderate'; behaviorDisplay = 'Moderate Risk — lifetime-only suicide attempt' }

  const riskCode: Tier =
    TIER_RANK[behaviorTier] > TIER_RANK[ideationTier] ? behaviorTier : ideationTier
  if (behaviorDisplay && TIER_RANK[behaviorTier] >= TIER_RANK[ideationTier]) {
    riskDisplay = behaviorDisplay
  }

  observations.push(
    makeObservation({
      id: `cssrs-full-risk-${Date.now()}`,
      code: { system: 'http://loinc.org', code: '93374-7', display: 'Suicide risk level' },
      value: {
        // display = the CodeSystem's display; the narrative goes in `text`.
        coding: [
          {
            system: CSSRS_RISK_LEVEL_SYSTEM,
            code: riskCode,
            display: cssrsRiskLevelDisplay(riskCode),
          },
        ],
        text: riskDisplay,
      },
      valueType: 'codeable',
      interpretation: riskCode === 'high'
        ? interpretationOf('H', riskDisplay)
        : riskCode === 'moderate'
        ? interpretationOf('A', riskDisplay)
        : interpretationOf('L', riskDisplay),
      note: `C-SSRS Full: Highest recent ideation level ${highestRecent}/5, highest lifetime ${highestLifetime}/5. Most severe type: ${mostSevereType || 'N/A'}. Attempt history: lifetime=${attemptLife ? 'Yes' : 'No'}, recent=${attemptRecent ? 'Yes' : 'No'}.`,
      questionnaireName: 'C-SSRS Full',
    }),
  )

  const riskAlert: RiskAlert = riskCode === 'high'
    ? {
        tool: 'C-SSRS Full',
        level: 'high',
        summary: `C-SSRS Full: HIGH Risk (ideation level ${highestRecent}/5)`,
        detail: `Comprehensive assessment indicates high risk. ${attemptRecent ? 'Recent suicide attempt reported.' : ''} Immediate safety planning and intervention required.`,
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'moderate'
    ? {
        tool: 'C-SSRS Full',
        level: 'moderate',
        summary: `C-SSRS Full: MODERATE Risk (ideation level ${highestRecent}/5)`,
        detail: `${riskDisplay}. ${behaviorTier === 'moderate' ? 'Suicidal behavior on record, none within the past 3 months.' : 'Active ideation with a method, without intent.'} Safety planning recommended.`,
        suggestedAction: { label: 'Start Safety Plan', path: '/patient/assessments/stanley-and-brown' },
      }
    : riskCode === 'low'
    ? {
        tool: 'C-SSRS Full',
        level: 'low',
        summary: `C-SSRS Full: LOW Risk (ideation level ${highestRecent}/5)`,
        detail: `Passive or non-specific active ideation only, no method, intent, plan, or behavior. Outpatient follow-up recommended.`,
      }
    : {
        tool: 'C-SSRS Full',
        level: 'none',
        summary: 'C-SSRS Full: No current risk identified',
        detail: 'No suicidal ideation or behavior endorsed in recent or lifetime assessment.',
      }

  return { observations, riskAlert }
}
