import type { RiskLevel } from './statusIcons'

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
 * The highest active level across a patient's alerts, for the identity strip.
 *
 * ⚠️ An empty set is `unknown` — "no screening on file" — and NOT `none` —
 * "screened, no risk". The distinction is clinical: a chart that has never
 * been screened must not read as cleared. The `highestRiskLevel` in
 * observationMappers collapses the two, which is why the strip has its own.
 */
export function highestActiveRiskLevel(alertLevels: readonly string[]): RiskLevel {
  if (alertLevels.length === 0) return 'unknown'
  const order: RiskLevel[] = ['acute', 'high', 'moderate', 'low', 'none']
  return order.find(l => alertLevels.includes(l)) ?? 'none'
}

/** The tooltip that goes with the strip's pill. */
export function riskTitle(level: RiskLevel): string {
  return level === 'unknown' ? 'No suicide-risk screening on file' : `Highest active risk level: ${RISK_LABEL[level]}`
}
