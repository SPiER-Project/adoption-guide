/**
 * The severity chip shared by the patient banner, the panel shell, the
 * caseload table and the post-submit result — see `RiskPill.css` for why
 * there is one shape. Centralized here (rather than five copies of the same
 * span) so the icon that now leads every pill can't drift from its label.
 */
import { RISK_ICON, type RiskLevel } from '../lib/statusIcons'

export function RiskPill({
  level,
  label,
  sm,
  title,
}: {
  level: RiskLevel
  label: string
  /** The dense variant used in alert lists and table cells. */
  sm?: boolean
  title?: string
}) {
  const Icon = RISK_ICON[level]
  return (
    <span className={`risk-pill ${sm ? 'risk-pill--sm ' : ''}risk-pill--${level}`} title={title}>
      <Icon aria-hidden="true" size={12} className="risk-pill-icon" />
      {label}
    </span>
  )
}
