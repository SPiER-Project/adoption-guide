/**
 * The severity chip shared by the patient banner, the panel shell, the
 * caseload table and the post-submit result: a `Pill` in a solid risk tone,
 * led by the level's icon so the two can't drift apart. Kept as its own
 * component because five call sites pass a RiskLevel and should not each
 * have to know that a level is also a Pill tone.
 */
import { RISK_ICON, type RiskLevel } from '../lib/statusIcons'
import { Pill } from './Pill'

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
  return (
    <Pill tone={level} size={sm ? 'sm' : 'md'} icon={RISK_ICON[level]} title={title}>
      {label}
    </Pill>
  )
}
