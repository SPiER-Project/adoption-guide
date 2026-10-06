import type { RiskLevel } from '@spier/tool-views/lib/statusIcons'

/**
 * The display word for each risk level — the one map. It was pasted into
 * PatientBanner and PanelShell (six levels each) and exported from
 * populationSummary (five, without `unknown`), and the two component copies
 * documented that they existed to disagree with a *fourth* rule elsewhere.
 */
export const RISK_LABEL: Record<RiskLevel, string> = {
  acute: 'Acute',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  none: 'None',
  unknown: 'Unknown',
}

/**
 * The tooltip that goes with a risk pill — the identity strip's and the
 * caseload's, which both show `chartRiskLevel` (packages/core registry.ts).
 *
 * ⚠️ `unknown` is "no screening on file" and NOT `none` — "screened, no risk".
 * The distinction is clinical: a chart that has never been screened must not
 * read as cleared. "Current", not "highest active": the level is the harmonized
 * tier the pathway branches on, which can be lower than the loudest instrument.
 */
export function riskTitle(level: RiskLevel): string {
  return level === 'unknown' ? 'No suicide-risk screening on file' : `Current suicide-risk level: ${RISK_LABEL[level]}`
}
